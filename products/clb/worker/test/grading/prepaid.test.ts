// The prepaid-credit ledger in the grade handlers (memo §7.2 Z6): the live check reads spend fresh
// (never the /api/me cache), pauses grading at 97% of the credits before a call starts, and turns free
// samples off at 70%. Spend rows are removed after each test, so the ledger starts empty every time.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiError, GradeResponse } from '../../../shared/api'
import type { Env } from '../../src/env'
import { gradeSpeaking, gradeWriting, PAUSE_STARTED_KEY } from '../../src/grading'
import { resetAudioInputMode } from '../../src/grading/transcribe'
import { clearSpendCache, evaluateTiers, spendSnapshotCached } from '../../src/lib/spend'
import { dayKey } from '../../src/lib/time'
import { apiMessage, createUser, golden, makeCtx, multipartRequest, ORIGIN, SIMPLE_OUTPUT, stubGrader } from './helpers'

const spendIds: string[] = []

beforeEach(() => {
  clearSpendCache()
  resetAudioInputMode()
})

afterEach(async () => {
  vi.unstubAllGlobals()
  for (const id of spendIds.splice(0)) await env.DB.prepare('DELETE FROM grades WHERE id = ?1').bind(id).run()
  await env.FLAGS.delete(PAUSE_STARTED_KEY)
})

/** US$10 of credits bought today. */
const prepaidEnv = (): Env => ({ ...(env as Env), ANTHROPIC_PREPAID_USD: '10', ANTHROPIC_PREPAID_SINCE: dayKey(new Date()) })

/** A finished (or running) pass-holder grade today costing `usd`. */
async function spend(usd: number, pending = false): Promise<void> {
  const id = `g_prepaid_${spendIds.length}_${Date.now()}`
  spendIds.push(id)
  await env.DB.prepare(
    `INSERT INTO grades (id, task_id, prompt_index, kind, pending, model, cost_micro_usd, created_at) VALUES (?1, 'email', 0, 'writing', ?2, 'claude-opus-5', ?3, ?4)`,
  )
    .bind(id, pending ? 1 : 0, Math.round(usd * 1e6), new Date().toISOString())
    .run()
}

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

const fakeAi = () => ({ run: vi.fn(async () => ({ text: 'I would call the settlement office first.', transcription_info: { duration: 20 } })) })

async function expectError(res: Response, status: number, code: ApiError['error']): Promise<ApiError> {
  const body = (await res.json()) as ApiError
  expect({ status: res.status, error: body.error }).toEqual({ status, error: code })
  return body
}

describe('prepaid credits in the grade handlers', () => {
  it('pauses grading at 97% of the credits although /api/me still has a healthy snapshot cached', async () => {
    const { user } = await createUser({ pass: true })
    const penv = prepaidEnv()
    // /api/me cached this a moment ago
    expect(evaluateTiers(await spendSnapshotCached(penv, new Date())).pauseGrading).toBe(false)
    await spend(9.7)
    const { calls } = stubGrader(apiMessage(SIMPLE_OUTPUT))
    const err = await expectError(await gradeWriting(writingRequest(), makeCtx({ env: penv, user })), 503, 'grading_paused')
    expect(err.message).toBe('Feedback is paused right now. Active passes are extended by the length of the pause. Please try again later.')
    expect(calls).toHaveLength(0)
    // the pause is recorded at once, so passes are extended by all of it (decision 12)
    expect(await env.FLAGS.get(PAUSE_STARTED_KEY)).not.toBeNull()
    // the cached snapshot is still the old one; only the live check saw the spend
    expect(evaluateTiers(await spendSnapshotCached(penv, new Date())).pauseGrading).toBe(false)
  })

  it('counts calls in flight at their worst case, so the last credits are never over-committed', async () => {
    const { user } = await createUser({ pass: true })
    await spend(9.5)
    stubGrader(apiMessage(SIMPLE_OUTPUT))
    // US$9.50 finished: one more call may start
    expect((await gradeWriting(writingRequest(), makeCtx({ env: prepaidEnv(), user }))).status).toBe(200)
    // a running call's US$0.25 worst case takes the ledger to 97.5%+
    await spend(0.25, true)
    await expectError(await gradeWriting(writingRequest(), makeCtx({ env: prepaidEnv(), user })), 503, 'grading_paused')
  })

  it('turns free samples off at 70% of the credits; pass holders are still graded', async () => {
    const { user } = await createUser()
    const holder = await createUser({ pass: true })
    await spend(7)
    stubGrader(apiMessage(SIMPLE_OUTPUT))
    const ai = fakeAi()
    const penv = { ...prepaidEnv(), AI: ai as unknown as Ai }
    const err = await expectError(await gradeSpeaking(await speakingRequest(), makeCtx({ env: penv, user })), 429, 'free_unavailable')
    expect(err.message).toContain('Free samples are paused')
    expect(ai.run).not.toHaveBeenCalled()
    const res = await gradeSpeaking(await speakingRequest(), makeCtx({ env: penv, user: holder.user }))
    expect(res.status).toBe(200)
    expect(((await res.json()) as GradeResponse).free).toBe(false)
  })

  it('does nothing without the prepaid variables', async () => {
    const { user } = await createUser({ pass: true })
    await spend(9.9)
    stubGrader(apiMessage(SIMPLE_OUTPUT))
    expect((await gradeWriting(writingRequest(), makeCtx({ env: env as Env, user }))).status).toBe(200)
  })
})
