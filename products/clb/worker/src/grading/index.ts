// Grading endpoints (memo B3, B4, B5, B10). Every grade call runs, in order: kill switch → (speaking:
// sign-in and the shared daily speech-to-text allowance, memo §7.2 Z2) → input checks → live spend
// tiers → entitlement (pass, or a free sample) → a pending `grades` row that reserves the cap slot
// before any model call (decision 2) → speech to text / grader → claim filter → the row is finished
// with its outcome, tokens and cost, including refusals and failures (cost log). When Anthropic refuses a
// call for lack of credit, grading is paused (cron.ts pauseGradingForCredits) and the learner hears so.
// Essays and transcripts are stored only for signed-in users; audio is never stored or logged.
import type {
  GradeResponse,
  GradeResult,
  HistoryItem,
  HistoryItemResponse,
  HistoryResponse,
  Lang,
  WritingGradeRequest,
} from '../../../shared/api'
import { CAPS, MODELS } from '../../../shared/config'
import { taskById, type TaskKind, type TaskType } from '../../../shared/tasks'
import { stagingAllows } from '../auth'
import { pauseGradingForCredits, recordPauseStart } from '../cron'
import type { Ctx, Env } from '../env'
import { randomId } from '../lib/crypto'
import { getFlags, type Flags } from '../lib/flags'
import { error, json, readFormDataLimited, readJson } from '../lib/http'
import { getActivePass } from '../lib/session'
import { evaluateTiers, spendSnapshot, whisperCostMicroUsd, type TierDecision } from '../lib/spend'
import {
  freeAvailability,
  recordFreeSpeaking,
  recordFreeWriting,
  reserveGrade,
  speakingAvailableToday,
  type FreeKeys,
  type ReserveBlock,
} from '../lib/usage'
import { verifyTurnstile } from '../turnstile'
import {
  callCost,
  callGrader,
  GraderApiError,
  GraderOutputError,
  graderSettings,
  isCreditExhausted,
  worstCaseCallCostMicroUsd,
  type CallCost,
  type GraderInput,
} from './claude'
import { filterResult } from './filter'
import { finishGrade, releaseFreeSpeaking, releaseFreeWriting, type GradeFinish } from './store'
import { transcribe, WHISPER_MODEL } from './transcribe'

const MAX_JSON_BYTES = 64 * 1024
/** multipart overhead allowed on top of the audio cap before the body is parsed */
const MAX_FORM_BYTES = CAPS.maxAudioBytes + 64 * 1024
const AUDIO_TYPES = ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav']
/** recorders stop a little after the timer; allow this much over CAPS.maxAudioSeconds */
const AUDIO_SLACK_SECONDS = 2
/** history page size; older rows are fetched with ?before=<nextBefore> */
export const HISTORY_PAGE_SIZE = 50
const RECURRING_LIMIT = 5
/** history cursor: `<created_at>|<id>` of the last row of the previous page (ISO-8601 UTC, then a grades id) */
const HISTORY_CURSOR = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z)\|([A-Za-z0-9_-]{1,64})$/
/** KV key the cron reads to extend passes by the length of a pause (decision 12) */
export const PAUSE_STARTED_KEY = 'pause:started_at'

const MSG = {
  paused: 'Feedback is paused right now. Active passes are extended by the length of the pause. Please try again later.',
  graderFailed: 'We could not produce feedback this time. Please try again.',
  graderUnreachable: 'The feedback service is busy. Please try again in a minute.',
  audioTooLarge: `Recordings can be up to ${CAPS.maxAudioSeconds} seconds and ${CAPS.maxAudioBytes / (1024 * 1024)} MB.`,
  noFeedback: `You have reached today's limit of ${CAPS.noFeedbackPerDay} requests that got no feedback. It resets at midnight UTC.`,
  /** the learner's sample is unused, but free samples are off (owner switch or spend tiers) */
  freePaused: 'Free samples are paused right now. Please try again later, or get a pass to keep practising.',
  /** the shared daily speech-to-text allowance is used up (memo §7.2 Z2); nothing was uploaded or charged */
  atCapacity:
    'Speaking feedback has reached its limit for today. It reopens at midnight UTC. You can still practise speaking without feedback.',
  lengthRequired: 'Length required: the upload did not say its size. Please try again.',
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

/** Error class and HTTP status only: never the message, which could echo request content. */
function errorName(e: unknown): string {
  const inner = e instanceof GraderApiError ? e.cause : e
  const status = (inner as { status?: unknown } | null)?.status
  // SDK errors keep name "Error"; the class name says which (e.g. APIConnectionTimeoutError)
  const name = inner instanceof Error ? (inner.constructor.name !== 'Error' ? inner.constructor.name : inner.name) : 'unknown'
  return typeof status === 'number' ? `${name} ${status}` : name
}

// ---------- spend and entitlement ----------

/**
 * Live spend tiers. When they pause grading, record the pause start in KV (only if absent) so the
 * cron extends passes by the whole pause, even before its own 15-minute check sees it (decision 12).
 */
async function liveTiers(ctx: Ctx): Promise<TierDecision | Response> {
  const tiers = evaluateTiers(await spendSnapshot(ctx.env, ctx.now))
  if (!tiers.pauseGrading) return tiers
  await recordPauseStart(ctx.env, ctx.now)
  return error('grading_paused', MSG.paused)
}

function limitError(block: ReserveBlock, kind: TaskKind): Response {
  if (block === 'rolling30') {
    return error('rate_limited', `You have reached the fair-use limit of ${CAPS.gradedPer30Days} graded tasks in 30 days.`)
  }
  if (block === 'daily') {
    const n = kind === 'writing' ? CAPS.writingPerDay : CAPS.speakingPerDay
    return error('rate_limited', `You have reached today's limit of ${n} ${kind} tasks. It resets at midnight UTC.`)
  }
  return error('rate_limited', MSG.noFeedback)
}

/** What the pending row records before the call. */
interface SlotSpec {
  kind: TaskKind
  taskId: string
  promptIndex: number
  model: string
  /** worst-case cost of the whole request, kept if the call never finishes */
  estimateMicroUsd: number
}

/** A reserved grades row. */
interface Slot {
  gradeId: string
  free: boolean
  /** gives the free sample back when the call produced no feedback (no-op for pass holders) */
  releaseFree: () => Promise<void>
}

const noop = async (): Promise<void> => undefined

/** Reserve the row; on a limit, give back a free sample claimed for it and answer rate_limited. */
async function reserveSlot(
  ctx: Ctx,
  spec: SlotSpec,
  entitlement: { free: boolean; fairUse: boolean; releaseFree: () => Promise<void> },
): Promise<Slot | Response> {
  const gradeId = randomId('g_')
  const block = await reserveGrade(
    ctx.env,
    {
      id: gradeId,
      userId: ctx.user?.id ?? null,
      taskId: spec.taskId,
      promptIndex: spec.promptIndex,
      kind: spec.kind,
      free: entitlement.free,
      model: spec.model,
      costMicroUsd: spec.estimateMicroUsd,
      createdAt: ctx.now.toISOString(),
    },
    ctx.now,
    { fairUse: entitlement.fairUse },
  )
  if (block) {
    await entitlement.releaseFree()
    return limitError(block, spec.kind)
  }
  return { gradeId, free: entitlement.free, releaseFree: entitlement.releaseFree }
}

/** Free samples are on: the owner's KV flag and the live spend tiers both allow them. */
const freeOn = (flags: Flags, tiers: TierDecision): boolean => flags.free_enabled && !tiers.freeOff

/**
 * Pass holders reserve against the caps; everyone else may use the free writing sample. A used sample
 * is reported as used even while free samples are off; an unused one as paused (free_unavailable).
 */
async function writingSlot(ctx: Ctx, flags: Flags, tiers: TierDecision, turnstileToken: unknown, spec: SlotSpec): Promise<Slot | Response> {
  const { env, user, now } = ctx
  if (user && (await getActivePass(env, user.id, now))) {
    return reserveSlot(ctx, spec, { free: false, fairUse: true, releaseFree: noop })
  }
  // staging (STAGING_ALLOWED_EMAILS set): no anonymous grading on a public test host
  if (!user && !stagingAllows(env, null)) return error('unauthorized', 'Sign in to use this test site.')
  const keys: FreeKeys = { user, deviceHash: ctx.deviceHash, ipHash: ctx.ipHash }
  const unavailable = () =>
    user
      ? error('payment_required', 'Your free writing sample has been used. A pass unlocks more feedback.')
      : error('free_unavailable', 'The free writing sample is not available right now. Sign in to continue practising.')
  if (!(await freeAvailability(env, keys, now, true)).writing) return unavailable()
  if (!freeOn(flags, tiers)) return error('free_unavailable', MSG.freePaused)
  if (!(await verifyTurnstile(env, typeof turnstileToken === 'string' ? turnstileToken : null))) {
    return error('turnstile_failed', 'Please complete the check and try again.')
  }
  // claimed atomically before the model call, so parallel or failed calls cannot multiply free samples
  if (!(await recordFreeWriting(env, keys, now))) return unavailable()
  return reserveSlot(ctx, spec, { free: true, fairUse: false, releaseFree: () => releaseFreeWriting(env, keys, now) })
}

// ---------- grading and cost rows ----------

interface GradeJob {
  slot: Slot
  input: GraderInput
  /** speaking only */
  transcript?: string
  audioSeconds: number
  /** cost already incurred for this request before the grader call (speech to text) */
  priorCostMicroUsd: number
}

type FinishFields = Partial<GradeFinish> & Pick<GradeFinish, 'outcome' | 'model'>

/** Finish a row; defaults describe a request that produced no feedback and spent no tokens. */
function finish(env: Env, gradeId: string, base: { free: boolean; audioSeconds: number; costMicroUsd: number }, f: FinishFields) {
  return finishGrade(env, gradeId, {
    inputText: null,
    resultJson: null,
    errorKinds: null,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    ...base,
    ...f,
  })
}

function tokenFields(priorCostMicroUsd: number, cost: CallCost): Partial<GradeFinish> {
  return {
    inputTokens: cost.inputTokens,
    outputTokens: cost.outputTokens,
    cacheReadTokens: cost.cacheReadTokens,
    cacheWriteTokens: cost.cacheWriteTokens,
    costMicroUsd: priorCostMicroUsd + cost.costMicroUsd,
  }
}

async function runGrade(ctx: Ctx, job: GradeJob): Promise<Response> {
  const { env, user } = ctx
  const { slot } = job
  // free stays set on rows that spent tokens, so their cost counts against the free budget
  const base = { free: slot.free, audioSeconds: job.audioSeconds, costMicroUsd: job.priorCostMicroUsd }

  let call
  try {
    call = await callGrader(env, job.input)
  } catch (e) {
    // no feedback was produced, so the learner may retry: the free sample is given back
    await slot.releaseFree()
    if (e instanceof GraderOutputError) {
      await finish(env, slot.gradeId, base, { outcome: 'failed', model: e.call.model, ...tokenFields(job.priorCostMicroUsd, callCost(e.call)) })
      console.warn('grader output unusable', { stopReason: e.call.stopReason, reason: e.message })
      return error('internal', MSG.graderFailed)
    }
    // usage unknown: attempts that may have run are logged at their worst-case cost (never under-count)
    const estimate = e instanceof GraderApiError ? e.costMicroUsd : 0
    await finish(env, slot.gradeId, base, { outcome: 'failed', model: job.input.model, costMicroUsd: job.priorCostMicroUsd + estimate })
    if (isCreditExhausted(e)) {
      // Anthropic cannot bill the call (credits used up or a Console usage limit): a pause, not a failure. The
      // refusal itself costs nothing (estimate is 0 unless an earlier attempt may have run). Grading is switched
      // off until a top-up or the owner's switch (cron.ts), passes are extended, and the owner is alerted. On
      // staging only this request is refused and the owner gets a staging alert (no pause; cron.ts).
      console.warn('grader call refused: Anthropic credits used up', errorName(e))
      await pauseGradingForCredits(env, ctx.now)
      return error('grading_paused', MSG.paused)
    }
    console.error('grader call failed', errorName(e))
    return error('internal', MSG.graderUnreachable)
  }

  // A safety stop gives no feedback and its message invites a retry, so a free sample is given back
  // (the row keeps free = 1: its tokens count against the free budget, as for unusable output).
  const safety = call.stopReason === 'refusal'
  if (safety) await slot.releaseFree()
  const filtered = filterResult(call.result)
  if (filtered.removed > 0) console.warn('grader claims removed', { removed: filtered.removed })
  const result: GradeResult = {
    ...filtered.result,
    ...(job.transcript !== undefined ? { transcript: job.transcript } : {}),
    wordCount: countWords(job.input.text),
  }
  const outcome = safety ? 'safety_refused' : result.refused ? 'scope_refused' : 'graded'
  const kinds = [...new Set(result.topErrors.map((e) => e.kind))]
  // privacy by design: text and feedback are kept only for signed-in learners' own history
  const keepText = user !== null && outcome === 'graded'
  await finish(env, slot.gradeId, base, {
    outcome,
    model: call.model,
    inputText: keepText ? job.input.text : null,
    resultJson: keepText ? JSON.stringify(result) : null,
    errorKinds: kinds.length > 0 ? kinds.join(',') : null,
    ...tokenFields(job.priorCostMicroUsd, callCost(call)),
  })
  return json({ gradeId: slot.gradeId, result, free: slot.free && !safety } satisfies GradeResponse)
}

// ---------- handlers ----------

export async function gradeWriting(req: Request, ctx: Ctx): Promise<Response> {
  const { env } = ctx
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

  const tiers = await liveTiers(ctx)
  if (tiers instanceof Response) return tiers

  const input: GraderInput = { taskId: task.id, promptIndex, text, explanationLang: body.explanationLang, model: graderModel(env) }
  const spec: SlotSpec = {
    kind: 'writing',
    taskId: task.id,
    promptIndex,
    model: input.model,
    estimateMicroUsd: worstCaseCallCostMicroUsd(input, graderSettings(env).maxTokens),
  }
  const slot = await writingSlot(ctx, flags, tiers, body.turnstileToken, spec)
  if (slot instanceof Response) return slot

  return runGrade(ctx, { slot, input, audioSeconds: 0, priorCostMicroUsd: 0 })
}

export async function gradeSpeaking(req: Request, ctx: Ctx): Promise<Response> {
  const { env, user, now } = ctx
  const flags = await getFlags(env)
  if (!flags.grading_enabled) return error('grading_paused', MSG.paused)
  if (!user) return error('unauthorized', 'Please sign in to practise speaking.')
  // the shared Workers AI allowance: checked before the upload is read, so nothing is claimed or spent
  if (!(await speakingAvailableToday(env, now))) return error('at_capacity', MSG.atCapacity)

  // Content-Length must be declared and within the limit before the runtime parses the body
  const form = await readFormDataLimited(req, MAX_FORM_BYTES)
  if (form === 'length_required') return error('bad_request', MSG.lengthRequired)
  if (form === 'too_large') return error('too_large', MSG.audioTooLarge)
  if (!form) return error('bad_request', 'Expected multipart form data')
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

  const tiers = await liveTiers(ctx)
  if (tiers instanceof Response) return tiers

  const model = graderModel(env)
  // the transcript is not known yet: estimate with the longest recording and transcript allowed
  const longest: GraderInput = { taskId: task.id, promptIndex, text: 'x'.repeat(CAPS.maxEssayChars), explanationLang, model }
  const spec: SlotSpec = {
    kind: 'speaking',
    taskId: task.id,
    promptIndex,
    model,
    estimateMicroUsd:
      whisperCostMicroUsd(CAPS.maxAudioSeconds + AUDIO_SLACK_SECONDS) + worstCaseCallCostMicroUsd(longest, graderSettings(env).maxTokens),
  }
  const usedMessage = 'Your free speaking sample has been used. A pass unlocks more feedback.'
  let slot: Slot | Response
  if (await getActivePass(env, user.id, now)) {
    slot = await reserveSlot(ctx, spec, { free: false, fairUse: true, releaseFree: noop })
  } else if (user.freeSpeakingUsed) {
    return error('payment_required', usedMessage)
  } else if (!freeOn(flags, tiers)) {
    // unused, but free samples are off right now: not "used" (the learner keeps the sample)
    return error('free_unavailable', MSG.freePaused)
  } else if (await recordFreeSpeaking(env, user.id)) {
    slot = await reserveSlot(ctx, spec, { free: true, fairUse: false, releaseFree: () => releaseFreeSpeaking(env, user.id) })
  } else {
    return error('payment_required', usedMessage)
  }
  if (slot instanceof Response) return slot
  const { gradeId } = slot
  /** Row for a speech-to-text-only outcome; free is false where the sample was given back. */
  const sttOnly = (seconds: number, free: boolean) => ({ free, audioSeconds: seconds, costMicroUsd: whisperCostMicroUsd(seconds) })

  let transcript
  try {
    transcript = await transcribe(env, audio)
  } catch (e) {
    // the audio may have been processed: record the worst-case speech-to-text cost
    const seconds = clientSeconds ?? CAPS.maxAudioSeconds
    await slot.releaseFree()
    await finish(env, gradeId, sttOnly(seconds, false), { outcome: 'failed', model: WHISPER_MODEL })
    console.error('transcription failed', errorName(e))
    return error('internal', 'We could not process the recording. Please try again.')
  }
  const seconds = transcript.durationSeconds ?? clientSeconds ?? CAPS.maxAudioSeconds
  if (seconds > CAPS.maxAudioSeconds + AUDIO_SLACK_SECONDS || transcript.text.length > CAPS.maxEssayChars) {
    await finish(env, gradeId, sttOnly(seconds, slot.free), { outcome: 'too_long', model: WHISPER_MODEL })
    return error('too_large', MSG.audioTooLarge)
  }
  if (transcript.text === '') {
    await slot.releaseFree()
    await finish(env, gradeId, sttOnly(seconds, false), { outcome: 'no_speech', model: WHISPER_MODEL })
    return error('bad_request', 'No speech detected. Please check your microphone and try again.')
  }

  return runGrade(ctx, {
    slot,
    input: { taskId: task.id, promptIndex, text: transcript.text, explanationLang, model },
    transcript: transcript.text,
    audioSeconds: seconds,
    priorCostMicroUsd: whisperCostMicroUsd(seconds),
  })
}

/** The cursor that asks for the rows after this one (older, or same time with a smaller id). */
export function historyCursor(createdAt: string, id: string): string {
  return `${createdAt}|${id}`
}

/**
 * GET /api/history[?before=<cursor>] — the learner's graded answers, newest first (ties broken by id),
 * HISTORY_PAGE_SIZE per page, so every saved answer stays reachable until the retention purge.
 * nextBefore is the cursor for the next (older) page, or null on the last page. `recurring` is
 * computed from the newest page only and is empty on later pages.
 */
export async function history(req: Request, ctx: Ctx): Promise<Response> {
  if (!ctx.user) return error('unauthorized', 'Please sign in to see your history.')
  const before = new URL(req.url).searchParams.get('before')
  const cursor = before === null ? null : HISTORY_CURSOR.exec(before)
  if (before !== null && !cursor) return error('bad_request', 'Invalid history cursor')
  // one extra row tells whether an older page exists
  const { results } = await ctx.env.DB.prepare(
    `SELECT id, task_id, created_at, error_kinds FROM grades
      WHERE user_id = ?1 AND refused = 0 AND pending = 0
        AND (?2 IS NULL OR created_at < ?2 OR (created_at = ?2 AND id < ?3))
      ORDER BY created_at DESC, id DESC LIMIT ?4`,
  )
    .bind(ctx.user.id, cursor?.[1] ?? null, cursor?.[2] ?? null, HISTORY_PAGE_SIZE + 1)
    .all<{ id: string; task_id: string; created_at: string; error_kinds: string | null }>()
  const page = results.slice(0, HISTORY_PAGE_SIZE)
  const last = page.at(-1)
  const nextBefore = results.length > HISTORY_PAGE_SIZE && last ? historyCursor(last.created_at, last.id) : null

  const items: HistoryItem[] = page.map((r) => ({
    gradeId: r.id,
    taskId: r.task_id,
    createdAt: r.created_at,
    topErrorKinds: (r.error_kinds ?? '').split(',').filter((k) => k !== ''),
  }))
  const counts = new Map<string, number>()
  if (cursor === null) for (const item of items) for (const k of new Set(item.topErrorKinds)) counts.set(k, (counts.get(k) ?? 0) + 1)
  const recurring = [...counts]
    .map(([kind, count]) => ({ kind, count }))
    .sort((a, b) => b.count - a.count || a.kind.localeCompare(b.kind))
    .slice(0, RECURRING_LIMIT)
  return json({ items, recurring, nextBefore } satisfies HistoryResponse)
}

/**
 * GET /api/history/item?id= — the learner's own saved answer and feedback (decision 6). Only graded,
 * finished rows of the signed-in user; 404 for anything else, including rows whose text was purged
 * after RETENTION_DAYS.
 */
export async function historyItem(req: Request, ctx: Ctx): Promise<Response> {
  if (!ctx.user) return error('unauthorized', 'Please sign in to see your history.')
  const id = new URL(req.url).searchParams.get('id')?.trim() ?? ''
  if (id === '' || id.length > 64) return error('bad_request', 'Missing or invalid id')
  const notFound = () => error('not_found', 'This answer is no longer saved.')
  const row = await ctx.env.DB.prepare(
    `SELECT id, task_id, kind, created_at, input_text, result_json FROM grades
      WHERE id = ?1 AND user_id = ?2 AND refused = 0 AND pending = 0`,
  )
    .bind(id, ctx.user.id)
    .first<{ id: string; task_id: string; kind: string; created_at: string; input_text: string | null; result_json: string | null }>()
  if (!row || row.input_text === null || row.result_json === null) return notFound()
  if (row.kind !== 'writing' && row.kind !== 'speaking') return notFound()
  let result: GradeResult
  try {
    result = JSON.parse(row.result_json) as GradeResult
  } catch {
    return notFound()
  }
  return json({
    gradeId: row.id,
    taskId: row.task_id,
    kind: row.kind,
    createdAt: row.created_at,
    text: row.input_text,
    result,
  } satisfies HistoryItemResponse)
}
