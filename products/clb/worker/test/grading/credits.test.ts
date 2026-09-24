// Anthropic out of credit (memo §7.2 Z6): when the API refuses a grading call because the prepaid balance is used
// up or a Console usage limit is reached, the grade handlers pause grading instead of failing (grading_paused, the
// free sample given back, a $0 failed row, one owner alert a day), and the 15-minute spend monitor keeps the pause
// until a top-up is deployed or the owner switches grading back on.
import { APIConnectionTimeoutError, APIError } from '@anthropic-ai/sdk'
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiError } from '../../../shared/api'
import {
  ALERT_GUARD_TYPE,
  ALERT_GUARDS,
  CREDITS_OUT_SUBJECT,
  KV,
  ownerMarker,
  pauseGradingForCredits,
  runSpendMonitor,
  type CreditsOutMarker,
} from '../../src/cron'
import type { Env } from '../../src/env'
import { gradeSpeaking, gradeWriting } from '../../src/grading'
import { GraderApiError, isCreditExhausted } from '../../src/grading/claude'
import { resetAudioInputMode } from '../../src/grading/transcribe'
import { saltedHash } from '../../src/lib/crypto'
import { getFlags } from '../../src/lib/flags'
import { clearSpendCache, whisperCostMicroUsd } from '../../src/lib/spend'
import {
  apiMessage,
  createUser,
  deviceCookie,
  golden,
  gradeRowsFor,
  jsonResponse,
  latestAnonymousRow,
  makeCtx,
  multipartRequest,
  ORIGIN,
  postWriting,
  SIMPLE_OUTPUT,
  stubFetch,
  stubGrader,
  writingBody,
  type SentEmail,
} from './helpers'

const PAUSED = 'Feedback is paused right now. Active passes are extended by the length of the pause. Please try again later.'

/** The bodies Anthropic answers with when the organisation cannot pay ([unverified] wording of the 400s). */
const CREDIT_BALANCE = {
  type: 'error',
  error: {
    type: 'invalid_request_error',
    message: 'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.',
  },
}
const USAGE_LIMIT = {
  type: 'error',
  error: { type: 'invalid_request_error', message: 'You have reached your specified API usage limits. You will regain access on 2026-10-01 at 00:00 UTC.' },
}
const BILLING_ERROR = { type: 'error', error: { type: 'billing_error', message: 'Billing problem' } }

const sdkError = (status: number, body: unknown) => APIError.generate(status, body as object, undefined, new Headers())

beforeEach(() => {
  clearSpendCache()
  resetAudioInputMode()
})

afterEach(async () => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  await Promise.all(
    ['flag:grading_enabled', ownerMarker('grading_enabled'), KV.creditsOut, KV.autoGradingOff, KV.pauseStartedAt].map((k) => env.FLAGS.delete(k)),
  )
  await env.DB.batch([
    env.DB.prepare('DELETE FROM webhook_events WHERE type = ?1').bind(ALERT_GUARD_TYPE),
    env.DB.prepare("DELETE FROM webhook_events WHERE type = 'cron_pause_extension'"),
  ])
})

const prepaidEnv = (usd: string, since: string): Env => ({ ...(env as Env), ANTHROPIC_PREPAID_USD: usd, ANTHROPIC_PREPAID_SINCE: since })
const today = () => new Date().toISOString().slice(0, 10)

function writingRequest(): Request {
  const f = golden[0]
  const body = JSON.stringify({ taskId: f.taskId, promptIndex: f.promptIndex, text: f.text, explanationLang: f.explanationLang })
  return new Request(`${ORIGIN}/api/grade/writing`, { method: 'POST', headers: { 'content-type': 'application/json' }, body })
}

async function speakingRequest(): Promise<Request> {
  const form = new FormData()
  form.set('taskId', 'advice')
  form.set('promptIndex', '0')
  form.set('explanationLang', 'en')
  form.set('audio', new File([new Uint8Array(2048).fill(7)], 'answer', { type: 'audio/webm' }))
  return multipartRequest(`${ORIGIN}/api/grade/speaking`, form)
}

async function expectError(res: Response, status: number, code: ApiError['error']): Promise<ApiError> {
  const body = (await res.json()) as ApiError
  expect({ status: res.status, error: body.error }).toEqual({ status, error: code })
  return body
}

const creditAlerts = (emails: SentEmail[]) => emails.filter((e) => e.subject === `[MPC] ${CREDITS_OUT_SUBJECT}`)

async function marker(): Promise<CreditsOutMarker | null> {
  const raw = await env.FLAGS.get(KV.creditsOut)
  return raw === null ? null : (JSON.parse(raw) as CreditsOutMarker)
}

let seq = 0
async function passFor(startsAt: string, endsAt: string): Promise<string> {
  const n = ++seq
  const uid = `u_credits_${n}_${Date.now()}`
  await env.DB.prepare(`INSERT INTO users (id, email, email_hash, created_at, last_active_at) VALUES (?1, ?2, 'hash', ?3, ?3)`)
    .bind(uid, `${uid}@example.test`, startsAt)
    .run()
  const pid = `p_credits_${n}_${Date.now()}`
  await env.DB.prepare(`INSERT INTO passes (id, user_id, sku, starts_at, ends_at, purchase_id) VALUES (?1, ?2, 'pass30', ?3, ?4, ?5)`)
    .bind(pid, uid, startsAt, endsAt, `cs_${pid}`)
    .run()
  return pid
}

async function passEnd(pid: string): Promise<string> {
  const row = await env.DB.prepare('SELECT ends_at FROM passes WHERE id = ?1').bind(pid).first<{ ends_at: string }>()
  return row!.ends_at
}

const plus = (iso: string, ms: number) => new Date(Date.parse(iso) + ms).toISOString()

describe('isCreditExhausted', () => {
  it('recognises the documented 402 billing_error and the 400s that name the credit balance or a usage limit', () => {
    expect(isCreditExhausted(sdkError(402, BILLING_ERROR))).toBe(true)
    expect(isCreditExhausted(sdkError(400, BILLING_ERROR))).toBe(true)
    expect(isCreditExhausted(sdkError(400, CREDIT_BALANCE))).toBe(true)
    expect(isCreditExhausted(sdkError(400, USAGE_LIMIT))).toBe(true)
    // the grade handlers see it wrapped by callGrader
    expect(isCreditExhausted(new GraderApiError(sdkError(400, CREDIT_BALANCE), 400, 0, 0))).toBe(true)
  })

  it('does not treat other failures as a lack of credit', () => {
    expect(isCreditExhausted(sdkError(400, { type: 'error', error: { type: 'invalid_request_error', message: 'messages: roles must alternate' } }))).toBe(false)
    expect(isCreditExhausted(sdkError(401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }))).toBe(false)
    expect(isCreditExhausted(sdkError(429, { type: 'error', error: { type: 'rate_limit_error', message: 'rate limit' } }))).toBe(false)
    expect(isCreditExhausted(sdkError(500, { type: 'error', error: { type: 'api_error', message: 'x' } }))).toBe(false)
    expect(isCreditExhausted(sdkError(529, { type: 'error', error: { type: 'overloaded_error', message: 'x' } }))).toBe(false)
    expect(isCreditExhausted(new APIConnectionTimeoutError())).toBe(false)
    expect(isCreditExhausted(new Error('Your credit balance is too low'))).toBe(false)
    expect(isCreditExhausted(new GraderApiError(new Error('timeout'), null, 1, 5))).toBe(false)
  })
})

describe('grade handlers when Anthropic is out of credit', () => {
  it('pause grading instead of failing: grading_paused, a $0 failed row, the switch off with the credits marker, the pause start, one alert', async () => {
    const { user } = await createUser({ pass: true })
    const penv = prepaidEnv('10', today())
    const { calls, emails } = stubFetch(() => jsonResponse(CREDIT_BALANCE, 400))
    const now = new Date()
    const err = await expectError(await gradeWriting(writingRequest(), makeCtx({ env: penv, user, now })), 503, 'grading_paused')
    expect(err.message).toBe(PAUSED)
    // not retried: another attempt cannot succeed
    expect(calls).toHaveLength(1)
    expect(await gradeRowsFor(user.id)).toMatchObject([{ outcome: 'failed', refused: 1, pending: 0, cost_micro_usd: 0, input_text: null }])

    // switched off the way the spend monitor does it, but with the credits marker
    expect((await getFlags(env)).grading_enabled).toBe(false)
    expect(await marker()).toEqual({ at: now.toISOString(), ledger: `${today()}T00:00:00.000Z|10` })
    expect(await env.FLAGS.get(KV.autoGradingOff)).toBeNull()
    expect(await env.FLAGS.get(KV.pauseStartedAt)).toBe(now.toISOString())

    const alerts = creditAlerts(emails)
    expect(alerts).toHaveLength(1)
    expect(alerts[0].to).toEqual(['owner@coach.test'])
    // the daily Routine files [MPC] alerts whose subject mentions credit under "Anthropic credits: top up"
    expect(alerts[0].subject).toMatch(/credit/i)
    expect(alerts[0].text).toContain('"Anthropic credits: top up"')
    expect(alerts[0].text).toContain('Eval runs, staging checks and level-B runs spend the same credits')
    expect(alerts[0].text).toContain('Prepaid credits: US$0.00 of US$10.00 used since')
    // a D1 guard row, not a KV key (Workers Free KV write quota)
    const guard = await env.DB.prepare('SELECT type FROM webhook_events WHERE id = ?1').bind(ALERT_GUARDS.creditsOut(today())).first<{ type: string }>()
    expect(guard?.type).toBe(ALERT_GUARD_TYPE)

    // the next learner is told at once, with no model call and no second alert
    const other = await createUser({ pass: true })
    await expectError(await gradeWriting(writingRequest(), makeCtx({ env: penv, user: other.user })), 503, 'grading_paused')
    expect(calls).toHaveLength(1)
    expect(creditAlerts(emails)).toHaveLength(1)
  })

  it('a 402 billing_error on the anonymous writing sample gives the sample back', async () => {
    stubFetch(() => jsonResponse(BILLING_ERROR, 402))
    const refused = await postWriting(writingBody(golden[0], 'good-token'))
    await expectError(refused, 503, 'grading_paused')
    expect(await latestAnonymousRow()).toMatchObject({ free: 1, refused: 1, pending: 0, outcome: 'failed', cost_micro_usd: 0 })
    const cookie = deviceCookie(refused)
    const deviceHash = await saltedHash(env.HASH_SALT, `device:${cookie.split('=')[1]}`)
    const used = await env.DB.prepare('SELECT COALESCE(SUM(count), 0) AS n FROM free_usage WHERE key_hash = ?1').bind(deviceHash).first<{ n: number }>()
    expect(used?.n).toBe(0)

    // topped up and switched back on: the same device still has its sample
    await env.FLAGS.delete('flag:grading_enabled')
    await env.FLAGS.delete(KV.creditsOut)
    stubGrader(apiMessage(SIMPLE_OUTPUT))
    const again = await postWriting(writingBody(golden[0], 'good-token'), { cookie })
    expect(again.status).toBe(200)
    expect(((await again.json()) as { free: boolean }).free).toBe(true)
  })

  it('speaking: the free speaking sample is given back and the row keeps only the speech-to-text cost', async () => {
    const { user } = await createUser()
    stubFetch(() => jsonResponse(USAGE_LIMIT, 400))
    const ai = { run: vi.fn(async () => ({ text: 'I would call the settlement office first.', transcription_info: { duration: 20 } })) }
    const res = await gradeSpeaking(await speakingRequest(), makeCtx({ env: { ...(env as Env), AI: ai as unknown as Ai }, user }))
    expect((await expectError(res, 503, 'grading_paused')).message).toBe(PAUSED)
    const row = await env.DB.prepare('SELECT free_speaking_used FROM users WHERE id = ?1').bind(user.id).first<{ free_speaking_used: number }>()
    expect(row?.free_speaking_used).toBe(0)
    expect(await gradeRowsFor(user.id)).toMatchObject([{ kind: 'speaking', outcome: 'failed', cost_micro_usd: whisperCostMicroUsd(20) }])
    expect((await getFlags(env)).grading_enabled).toBe(false)
  })

  it('alerts once per UTC day, and a later refusal keeps the first pause start and marker', async () => {
    const { emails } = stubFetch(() => jsonResponse(CREDIT_BALANCE, 400))
    await pauseGradingForCredits(env as Env, new Date('2027-06-15T10:00:00.000Z'))
    await pauseGradingForCredits(env as Env, new Date('2027-06-15T11:00:00.000Z'))
    expect(creditAlerts(emails)).toHaveLength(1)
    expect((await marker())?.at).toBe('2027-06-15T10:00:00.000Z')
    expect(await env.FLAGS.get(KV.pauseStartedAt)).toBe('2027-06-15T10:00:00.000Z')
    // the ledger is off here: only the owner's switch (or setting the prepaid variables) lifts the pause
    expect((await marker())?.ledger).toBe('none')
    await pauseGradingForCredits(env as Env, new Date('2027-06-16T01:00:00.000Z'))
    expect(creditAlerts(emails)).toHaveLength(2)
  })

  it('never throws, even when every KV write fails (Workers Free quota)', async () => {
    stubFetch(() => jsonResponse(CREDIT_BALANCE, 400))
    vi.spyOn(env.FLAGS, 'put').mockRejectedValue(new Error('KV put() limit exceeded for the day.'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { user } = await createUser({ pass: true })
    await expectError(await gradeWriting(writingRequest(), makeCtx({ user })), 503, 'grading_paused')
  })
})

describe('spend monitor during a credits pause', () => {
  it('never switches grading back on by itself before a top-up, reminds the owner once a day, and resumes after the top-up', async () => {
    const { emails } = stubFetch(() => jsonResponse(CREDIT_BALANCE, 400))
    const e = prepaidEnv('10', '2027-06-01')
    const pid = await passFor('2027-06-10T00:00:00.000Z', '2027-07-10T00:00:00.000Z')
    const pausedAt = '2027-06-15T12:00:00.000Z'
    await pauseGradingForCredits(e, new Date(pausedAt))
    expect(await marker()).toEqual({ at: pausedAt, ledger: '2027-06-01T00:00:00.000Z|10' })

    // the Worker's own ledger says only 0% is used (eval and staging spend is invisible to it): still paused
    for (const t of ['2027-06-15T12:15:00.000Z', '2027-06-15T18:00:00.000Z', '2027-06-16T00:15:00.000Z', '2027-06-16T00:30:00.000Z']) {
      await runSpendMonitor(e, new Date(t))
      expect((await getFlags(env)).grading_enabled, t).toBe(false)
      expect(await marker(), t).not.toBeNull()
    }
    expect(await env.FLAGS.get(KV.pauseStartedAt)).toBe(pausedAt)
    expect(await passEnd(pid)).toBe('2027-07-10T00:00:00.000Z')
    // the pause's own alert on the 15th, one reminder on the 16th
    expect(creditAlerts(emails)).toHaveLength(2)

    // the owner tops up and the new balance is deployed: grading resumes and passes are extended
    const resume = '2027-06-16T09:15:00.000Z'
    await runSpendMonitor(prepaidEnv('12.3', '2027-06-16'), new Date(resume))
    expect((await getFlags(env)).grading_enabled).toBe(true)
    expect(await marker()).toBeNull()
    expect(await env.FLAGS.get(KV.pauseStartedAt)).toBeNull()
    expect(await passEnd(pid)).toBe(plus('2027-07-10T00:00:00.000Z', Date.parse(resume) - Date.parse(pausedAt)))
  })

  it("outlives the spend monitor's own pause, and ends when the owner switches grading back on", async () => {
    stubFetch(() => jsonResponse(CREDIT_BALANCE, 400))
    const pid = await passFor('2027-06-10T00:00:00.000Z', '2027-07-10T00:00:00.000Z')
    const pausedAt = '2027-06-15T12:00:00.000Z'
    // the spend monitor had paused grading as well (daily cap), and spend is back under every tier now
    await env.FLAGS.put(KV.autoGradingOff, '1')
    await pauseGradingForCredits(env as Env, new Date(pausedAt))
    await runSpendMonitor(env as Env, new Date('2027-06-16T00:15:00.000Z'))
    expect((await getFlags(env)).grading_enabled).toBe(false)
    expect(await env.FLAGS.get(KV.autoGradingOff)).toBeNull()
    expect(await marker()).not.toBeNull()

    // the owner raised a Console usage limit and switched grading on with flags.yml
    await env.FLAGS.put('flag:grading_enabled', 'true')
    await env.FLAGS.put(ownerMarker('grading_enabled'), 'true')
    const resume = '2027-06-16T08:00:00.000Z'
    await runSpendMonitor(env as Env, new Date(resume))
    expect((await getFlags(env)).grading_enabled).toBe(true)
    expect(await marker()).toBeNull()
    expect(await passEnd(pid)).toBe(plus('2027-07-10T00:00:00.000Z', Date.parse(resume) - Date.parse(pausedAt)))
  })

  it('holds a fresh credits pause that this run still reads as grading on (KV propagation)', async () => {
    const pid = await passFor('2027-06-10T00:00:00.000Z', '2027-07-10T00:00:00.000Z')
    const pausedAt = '2027-06-15T12:00:00.000Z'
    await env.FLAGS.put(KV.creditsOut, JSON.stringify({ at: pausedAt, ledger: 'none' }))
    await env.FLAGS.put(KV.pauseStartedAt, pausedAt)
    await runSpendMonitor(env as Env, new Date('2027-06-15T12:02:00.000Z'))
    expect(await marker()).not.toBeNull()
    expect(await env.FLAGS.get(KV.pauseStartedAt)).toBe(pausedAt)
    expect(await passEnd(pid)).toBe('2027-07-10T00:00:00.000Z')
  })

  it('a top-up while a spend tier still pauses hands the pause to the spend monitor, which lifts it later', async () => {
    stubFetch(() => jsonResponse(CREDIT_BALANCE, 400))
    await pauseGradingForCredits(prepaidEnv('10', '2027-06-01'), new Date('2027-06-15T12:00:00.000Z'))
    // today's spend is over the daily cap (US$15)
    const gid = `g_credits_${Date.now()}`
    await env.DB.prepare(
      `INSERT INTO grades (id, task_id, prompt_index, kind, pending, model, cost_micro_usd, created_at) VALUES (?1, 'email', 0, 'writing', 0, 'claude-opus-5', 16000000, '2027-06-16T08:00:00.000Z')`,
    )
      .bind(gid)
      .run()
    try {
      const topped = prepaidEnv('50', '2027-06-16')
      await runSpendMonitor(topped, new Date('2027-06-16T09:15:00.000Z'))
      expect((await getFlags(env)).grading_enabled).toBe(false)
      expect(await marker()).toBeNull()
      expect(await env.FLAGS.get(KV.autoGradingOff)).toBe('1')
      await runSpendMonitor(topped, new Date('2027-06-17T00:15:00.000Z'))
      expect((await getFlags(env)).grading_enabled).toBe(true)
    } finally {
      await env.DB.prepare('DELETE FROM grades WHERE id = ?1').bind(gid).run()
    }
  })

  it("keeps grading off after a top-up when the owner's marker says off", async () => {
    stubFetch(() => jsonResponse(CREDIT_BALANCE, 400))
    await pauseGradingForCredits(prepaidEnv('10', '2027-06-01'), new Date('2027-06-15T12:00:00.000Z'))
    await env.FLAGS.put(ownerMarker('grading_enabled'), 'false')
    await runSpendMonitor(prepaidEnv('20', '2027-06-16'), new Date('2027-06-16T09:15:00.000Z'))
    expect((await getFlags(env)).grading_enabled).toBe(false)
    expect(await marker()).toBeNull()
  })
})
