// Grading endpoints (memo B3, B4, B5, B10). Every grade call runs, in order: kill switch → input
// checks → live spend tiers → entitlement (pass + caps, or a free sample) → model call → claim
// filter → one `grades` row per model call, including refusals and unusable output (cost log).
// Essays and transcripts are stored only for signed-in users; audio is never stored or logged.
import type { GradeResponse, GradeResult, HistoryItem, HistoryResponse, Lang, WritingGradeRequest } from '../../../shared/api'
import { CAPS, MODELS } from '../../../shared/config'
import { taskById, type TaskKind, type TaskType } from '../../../shared/tasks'
import type { Ctx, Env } from '../env'
import { randomId } from '../lib/crypto'
import { getFlags, type Flags } from '../lib/flags'
import { error, json, readJson } from '../lib/http'
import { getActivePass } from '../lib/session'
import { evaluateTiers, spendSnapshot, whisperCostMicroUsd, type TierDecision } from '../lib/spend'
import { capReached, freeAvailability, getUsage, recordFreeSpeaking, recordFreeWriting, type FreeKeys } from '../lib/usage'
import { verifyTurnstile } from '../turnstile'
import { callCost, callGrader, GraderOutputError, type CallCost, type GraderInput } from './claude'
import { filterResult } from './filter'
import { insertGrade, releaseFreeSpeaking, releaseFreeWriting, type GradeRow } from './store'
import { transcribe, WHISPER_MODEL } from './transcribe'

const MAX_JSON_BYTES = 64 * 1024
/** multipart overhead allowed on top of the audio cap before the body is parsed */
const MAX_FORM_BYTES = CAPS.maxAudioBytes + 64 * 1024
const AUDIO_TYPES = ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav']
/** recorders stop a little after the timer; allow this much over CAPS.maxAudioSeconds */
const AUDIO_SLACK_SECONDS = 2
const HISTORY_LIMIT = 50
const RECURRING_LIMIT = 5

const MSG = {
  paused: 'Feedback is paused for maintenance. Please try again later.',
  graderFailed: 'We could not produce feedback this time. Please try again.',
  graderUnreachable: 'The feedback service is busy. Please try again in a minute.',
  audioTooLarge: `Recordings can be up to ${CAPS.maxAudioSeconds} seconds and ${CAPS.maxAudioBytes / (1024 * 1024)} MB.`,
}

export function graderModel(env: Env): string {
  return env.GRADER_MODEL?.trim() || MODELS.defaultGrader
}

export function countWords(text: string): number {
  const t = text.trim()
  return t === '' ? 0 : t.split(/\s+/).length
}

function isLang(v: unknown): v is Lang {
  return v === 'en' || v === 'ko'
}

function findTask(taskId: unknown, kind: TaskKind): TaskType | null {
  const task = typeof taskId === 'string' ? taskById(taskId) : undefined
  return task && task.kind === kind ? task : null
}

/** Prompt index from JSON (number) or multipart (string). */
function promptIndexOf(task: TaskType, v: unknown): number | null {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < task.prompts.length ? n : null
}

function errorName(e: unknown): string {
  const status = (e as { status?: unknown } | null)?.status
  const name = e instanceof Error ? e.name : 'unknown'
  return typeof status === 'number' ? `${name} ${status}` : name
}

// ---------- entitlement ----------

async function capsBlock(ctx: Ctx, userId: string, kind: TaskKind): Promise<Response | null> {
  const cap = capReached(await getUsage(ctx.env, userId, ctx.now), kind)
  if (cap === 'rolling30') {
    return error('rate_limited', `You have reached the fair-use limit of ${CAPS.gradedPer30Days} graded tasks in 30 days.`)
  }
  if (cap === 'daily') {
    const n = kind === 'writing' ? CAPS.writingPerDay : CAPS.speakingPerDay
    return error('rate_limited', `You have reached today's limit of ${n} ${kind} tasks. It resets at midnight UTC.`)
  }
  return null
}

/** Pass holders are checked against caps; everyone else may use the free writing sample. */
async function writingEntitlement(
  ctx: Ctx,
  flags: Flags,
  tiers: TierDecision,
  turnstileToken: unknown,
): Promise<{ free: boolean; keys: FreeKeys } | Response> {
  const { env, user, now } = ctx
  const keys: FreeKeys = { user, deviceHash: ctx.deviceHash, ipHash: ctx.ipHash }
  if (user && (await getActivePass(env, user.id, now))) {
    return (await capsBlock(ctx, user.id, 'writing')) ?? { free: false, keys }
  }
  const available = (await freeAvailability(env, keys, now, flags.free_enabled && !tiers.freeOff)).writing
  if (!available) {
    return user
      ? error('payment_required', 'Your free writing sample has been used. A pass unlocks more feedback.')
      : error('free_unavailable', 'The free writing sample is not available right now. Sign in to continue practising.')
  }
  if (!(await verifyTurnstile(env, typeof turnstileToken === 'string' ? turnstileToken : null))) {
    return error('turnstile_failed', 'Please complete the check and try again.')
  }
  // claimed atomically before the model call, so parallel or failed calls cannot multiply free samples
  if (!(await recordFreeWriting(env, keys, now))) {
    return user
      ? error('payment_required', 'Your free writing sample has been used. A pass unlocks more feedback.')
      : error('free_unavailable', 'The free writing sample is not available right now. Sign in to continue practising.')
  }
  return { free: true, keys }
}

// ---------- grading and cost rows ----------

interface GradeJob {
  kind: TaskKind
  input: GraderInput
  free: boolean
  /** speaking only */
  transcript?: string
  audioSeconds: number
  /** cost already incurred for this request before the grader call (speech to text) */
  priorCostMicroUsd: number
  /** gives the free sample back when the call produced no feedback */
  releaseFree: () => Promise<void>
}

type RowBase = Pick<GradeJob, 'kind' | 'free' | 'audioSeconds' | 'priorCostMicroUsd'> & { taskId: string; promptIndex: number }

/** A grades row; defaults describe a call that produced no feedback. */
function gradeRow(ctx: Ctx, base: RowBase, fields: Partial<GradeRow> & { model: string }): GradeRow {
  return {
    id: randomId('g_'),
    userId: ctx.user?.id ?? null,
    deviceHash: ctx.deviceHash,
    taskId: base.taskId,
    promptIndex: base.promptIndex,
    kind: base.kind,
    inputText: null,
    resultJson: null,
    errorKinds: null,
    free: base.free,
    refused: true,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    audioSeconds: base.audioSeconds,
    costMicroUsd: base.priorCostMicroUsd,
    createdAt: ctx.now.toISOString(),
    ...fields,
  }
}

function tokenFields(base: RowBase, cost: CallCost): Partial<GradeRow> {
  return {
    inputTokens: cost.inputTokens,
    outputTokens: cost.outputTokens,
    cacheReadTokens: cost.cacheReadTokens,
    cacheWriteTokens: cost.cacheWriteTokens,
    costMicroUsd: base.priorCostMicroUsd + cost.costMicroUsd,
  }
}

async function runGrade(ctx: Ctx, job: GradeJob): Promise<Response> {
  const { env, user } = ctx
  const base: RowBase = {
    kind: job.kind,
    taskId: job.input.taskId,
    promptIndex: job.input.promptIndex,
    free: job.free,
    audioSeconds: job.audioSeconds,
    priorCostMicroUsd: job.priorCostMicroUsd,
  }

  let call
  try {
    call = await callGrader(env, job.input)
  } catch (e) {
    // no feedback was produced, so the learner may retry: the free sample is given back
    if (job.free) await job.releaseFree()
    if (e instanceof GraderOutputError) {
      // tokens were spent: the row keeps free=1 so the cost still counts against the free budget
      await insertGrade(env, gradeRow(ctx, base, { model: e.call.model, ...tokenFields(base, callCost(e.call)) }))
      console.warn('grader output unusable', { stopReason: e.call.stopReason, reason: e.message })
      return error('internal', MSG.graderFailed)
    }
    await insertGrade(env, gradeRow(ctx, base, { model: job.input.model, free: false }))
    console.error('grader call failed', errorName(e))
    return error('internal', MSG.graderUnreachable)
  }

  const filtered = filterResult(call.result)
  if (filtered.removed > 0) console.warn('grader claims removed', { removed: filtered.removed })
  const result: GradeResult = {
    ...filtered.result,
    ...(job.transcript !== undefined ? { transcript: job.transcript } : {}),
    wordCount: countWords(job.input.text),
  }
  const kinds = [...new Set(result.topErrors.map((e) => e.kind))]
  // privacy by design: text and feedback are kept only for signed-in learners' own history
  const keepText = user !== null && !result.refused
  const row = gradeRow(ctx, base, {
    model: call.model,
    refused: result.refused,
    inputText: keepText ? job.input.text : null,
    resultJson: keepText ? JSON.stringify(result) : null,
    errorKinds: kinds.length > 0 ? kinds.join(',') : null,
    ...tokenFields(base, callCost(call)),
  })
  await insertGrade(env, row)
  return json({ gradeId: row.id, result, free: job.free } satisfies GradeResponse)
}

// ---------- handlers ----------

export async function gradeWriting(req: Request, ctx: Ctx): Promise<Response> {
  const { env, now } = ctx
  const flags = await getFlags(env)
  if (!flags.grading_enabled) return error('grading_paused', MSG.paused)

  if (Number(req.headers.get('content-length') ?? '0') > MAX_JSON_BYTES) return error('too_large', 'Request is too large')
  const body = await readJson<Partial<WritingGradeRequest>>(req, MAX_JSON_BYTES)
  if (!body || typeof body !== 'object') return error('bad_request', 'Invalid request body')
  const task = findTask(body.taskId, 'writing')
  if (!task) return error('bad_request', 'Unknown writing task')
  const promptIndex = promptIndexOf(task, body.promptIndex)
  if (promptIndex === null) return error('bad_request', 'Unknown prompt')
  if (!isLang(body.explanationLang)) return error('bad_request', 'explanationLang must be "en" or "ko"')
  const text = typeof body.text === 'string' ? body.text.trim() : ''
  if (text === '') return error('bad_request', 'Please write your response first.')
  if (text.length > CAPS.maxEssayChars) return error('too_large', `Responses can be up to ${CAPS.maxEssayChars} characters.`)

  const tiers = evaluateTiers(await spendSnapshot(env, now))
  if (tiers.pauseGrading) return error('grading_paused', MSG.paused)

  const ent = await writingEntitlement(ctx, flags, tiers, body.turnstileToken)
  if (ent instanceof Response) return ent

  return runGrade(ctx, {
    kind: 'writing',
    input: { taskId: task.id, promptIndex, text, explanationLang: body.explanationLang, model: graderModel(env) },
    free: ent.free,
    audioSeconds: 0,
    priorCostMicroUsd: 0,
    releaseFree: () => releaseFreeWriting(env, ent.keys, now),
  })
}

export async function gradeSpeaking(req: Request, ctx: Ctx): Promise<Response> {
  const { env, user, now } = ctx
  const flags = await getFlags(env)
  if (!flags.grading_enabled) return error('grading_paused', MSG.paused)
  if (!user) return error('unauthorized', 'Please sign in to practise speaking.')

  if (Number(req.headers.get('content-length') ?? '0') > MAX_FORM_BYTES) return error('too_large', MSG.audioTooLarge)
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return error('bad_request', 'Expected multipart form data')
  }
  const task = findTask(form.get('taskId'), 'speaking')
  if (!task) return error('bad_request', 'Unknown speaking task')
  const promptIndex = promptIndexOf(task, form.get('promptIndex'))
  if (promptIndex === null) return error('bad_request', 'Unknown prompt')
  const explanationLang = form.get('explanationLang')
  if (!isLang(explanationLang)) return error('bad_request', 'explanationLang must be "en" or "ko"')
  const audio = form.get('audio')
  if (!(audio instanceof File)) return error('bad_request', 'Missing audio recording')
  if (audio.size > CAPS.maxAudioBytes) return error('too_large', MSG.audioTooLarge)
  if (audio.size === 0) return error('bad_request', 'The recording is empty.')
  const type = audio.type.toLowerCase()
  if (!AUDIO_TYPES.some((t) => type.startsWith(t))) return error('bad_request', 'Unsupported audio format')
  let clientSeconds: number | null = null
  const rawDuration = form.get('durationSeconds')
  if (rawDuration !== null) {
    const n = typeof rawDuration === 'string' && rawDuration.trim() !== '' ? Number(rawDuration) : NaN
    if (!Number.isFinite(n) || n < 0) return error('bad_request', 'Invalid durationSeconds')
    if (n > CAPS.maxAudioSeconds + AUDIO_SLACK_SECONDS) return error('too_large', MSG.audioTooLarge)
    clientSeconds = n
  }

  const tiers = evaluateTiers(await spendSnapshot(env, now))
  if (tiers.pauseGrading) return error('grading_paused', MSG.paused)

  let free = false
  if (await getActivePass(env, user.id, now)) {
    const blocked = await capsBlock(ctx, user.id, 'speaking')
    if (blocked) return blocked
  } else if (flags.free_enabled && !tiers.freeOff && !user.freeSpeakingUsed && (await recordFreeSpeaking(env, user.id))) {
    free = true
  } else {
    return error('payment_required', 'Your free speaking sample has been used. A pass unlocks more feedback.')
  }
  const releaseFree = () => (free ? releaseFreeSpeaking(env, user.id) : Promise.resolve())
  /** Row for a speech-to-text-only outcome; free is false because those paths give the sample back. */
  const rowBase = (seconds: number): RowBase => ({
    kind: 'speaking',
    taskId: task.id,
    promptIndex,
    free: false,
    audioSeconds: seconds,
    priorCostMicroUsd: whisperCostMicroUsd(seconds),
  })

  let transcript
  try {
    transcript = await transcribe(env, audio)
  } catch (e) {
    // the audio may have been processed: record the worst-case speech-to-text cost
    const seconds = clientSeconds ?? CAPS.maxAudioSeconds
    await releaseFree()
    await insertGrade(env, gradeRow(ctx, rowBase(seconds), { model: WHISPER_MODEL }))
    console.error('transcription failed', errorName(e))
    return error('internal', 'We could not process the recording. Please try again.')
  }
  const seconds = transcript.durationSeconds ?? clientSeconds ?? CAPS.maxAudioSeconds
  if (seconds > CAPS.maxAudioSeconds + AUDIO_SLACK_SECONDS || transcript.text.length > CAPS.maxEssayChars) {
    await insertGrade(env, gradeRow(ctx, { ...rowBase(seconds), free }, { model: WHISPER_MODEL }))
    return error('too_large', MSG.audioTooLarge)
  }
  if (transcript.text === '') {
    await releaseFree()
    await insertGrade(env, gradeRow(ctx, rowBase(seconds), { model: WHISPER_MODEL }))
    return error('bad_request', 'No speech detected. Please check your microphone and try again.')
  }

  return runGrade(ctx, {
    kind: 'speaking',
    input: { taskId: task.id, promptIndex, text: transcript.text, explanationLang, model: graderModel(env) },
    free,
    transcript: transcript.text,
    audioSeconds: seconds,
    priorCostMicroUsd: whisperCostMicroUsd(seconds),
    releaseFree,
  })
}

export async function history(_req: Request, ctx: Ctx): Promise<Response> {
  if (!ctx.user) return error('unauthorized', 'Please sign in to see your history.')
  const { results } = await ctx.env.DB.prepare(
    `SELECT id, task_id, created_at, error_kinds FROM grades
      WHERE user_id = ?1 AND refused = 0
      ORDER BY created_at DESC, id DESC LIMIT ?2`,
  )
    .bind(ctx.user.id, HISTORY_LIMIT)
    .all<{ id: string; task_id: string; created_at: string; error_kinds: string | null }>()

  const items: HistoryItem[] = results.map((r) => ({
    gradeId: r.id,
    taskId: r.task_id,
    createdAt: r.created_at,
    topErrorKinds: (r.error_kinds ?? '').split(',').filter((k) => k !== ''),
  }))
  const counts = new Map<string, number>()
  for (const item of items) for (const k of new Set(item.topErrorKinds)) counts.set(k, (counts.get(k) ?? 0) + 1)
  const recurring = [...counts]
    .map(([kind, count]) => ({ kind, count }))
    .sort((a, b) => b.count - a.count || a.kind.localeCompare(b.kind))
    .slice(0, RECURRING_LIMIT)
  return json({ items, recurring } satisfies HistoryResponse)
}

/** STUB — implemented by the grading fixer: GET /api/history/item?id= (HistoryItemResponse). */
export async function historyItem(_req: Request, _ctx: Ctx): Promise<Response> {
  return error('not_found', 'Not implemented')
}
