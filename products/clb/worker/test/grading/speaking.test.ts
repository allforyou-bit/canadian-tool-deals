import { env } from 'cloudflare:test'
import { exports } from 'cloudflare:workers'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ApiError, GradeResponse } from '../../../shared/api'
import { CAPS } from '../../../shared/config'
import type { Env, User } from '../../src/env'
import { gradeSpeaking } from '../../src/grading'
import { SAFETY_REFUSAL } from '../../src/grading/copy'
import { toBase64, WHISPER_MODEL } from '../../src/grading/transcribe'
import { tokenCostMicroUsd, whisperCostMicroUsd } from '../../src/lib/spend'
import { apiMessage, createUser, gradeRow, gradeRowsFor, makeCtx, ORIGIN, SIMPLE_OUTPUT, stubGrader, USAGE } from './helpers'

afterEach(() => {
  vi.unstubAllGlobals()
})

const TRANSCRIPT = 'I think my friend should start by updating his resume and then visit a settlement agency near his home.'

function audioFile(size = 4096, type = 'audio/webm;codecs=opus'): File {
  const bytes = new Uint8Array(size)
  for (let i = 0; i < size; i++) bytes[i] = (i * 31 + 7) & 255
  return new File([bytes], 'answer', { type })
}

interface FormFields {
  taskId?: string
  promptIndex?: string
  explanationLang?: string
  audio?: File | null
  durationSeconds?: string
}

function speakingRequest(f: FormFields = {}): Request {
  const form = new FormData()
  form.set('taskId', f.taskId ?? 'advice')
  form.set('promptIndex', f.promptIndex ?? '0')
  form.set('explanationLang', f.explanationLang ?? 'en')
  const audio = f.audio === undefined ? audioFile() : f.audio
  if (audio) form.set('audio', audio)
  if (f.durationSeconds !== undefined) form.set('durationSeconds', f.durationSeconds)
  return new Request(`${ORIGIN}/api/grade/speaking`, { method: 'POST', body: form })
}

type AiResult = { text?: string; transcription_info?: { duration?: number } }

function fakeAi(result: AiResult | Error) {
  return {
    run: vi.fn(async (_model: string, _inputs: Record<string, unknown>) => {
      if (result instanceof Error) throw result
      return result
    }),
  }
}

function call(user: User, ai: ReturnType<typeof fakeAi>, fields: FormFields = {}): Promise<Response> {
  const testEnv = { ...(env as Env), AI: ai as unknown as Ai }
  return gradeSpeaking(speakingRequest(fields), makeCtx({ env: testEnv, user }))
}

async function expectError(res: Response, status: number, code: ApiError['error']): Promise<ApiError> {
  const body = (await res.json()) as ApiError
  expect({ status: res.status, error: body.error }).toEqual({ status, error: code })
  return body
}

const freeSpeakingUsed = async (userId: string) =>
  (await env.DB.prepare('SELECT free_speaking_used AS f FROM users WHERE id = ?1').bind(userId).first<{ f: number }>())?.f

describe('POST /api/grade/speaking', () => {
  it('rejects signed-out requests', async () => {
    const form = new FormData()
    form.set('taskId', 'advice')
    form.set('audio', audioFile())
    const res = await exports.default.fetch(`${ORIGIN}/api/grade/speaking`, { method: 'POST', headers: { origin: ORIGIN }, body: form })
    await expectError(res, 401, 'unauthorized')
  })

  it('transcribes, grades the transcript, stores the transcript but never the audio', async () => {
    const { user } = await createUser({ pass: true })
    const ai = fakeAi({ text: `  ${TRANSCRIPT} `, transcription_info: { duration: 42.5 } })
    const { calls } = stubGrader(apiMessage(SIMPLE_OUTPUT))
    const audio = audioFile(6000)
    const res = await call(user, ai, { audio, durationSeconds: '40' })
    expect(res.status).toBe(200)
    const body = (await res.json()) as GradeResponse

    const audioB64 = toBase64(new Uint8Array(await audio.arrayBuffer()))
    expect(ai.run).toHaveBeenCalledTimes(1)
    expect(ai.run).toHaveBeenCalledWith(WHISPER_MODEL, { audio: audioB64, task: 'transcribe', language: 'en' })

    expect(body.free).toBe(false)
    expect(body.result.transcript).toBe(TRANSCRIPT)
    expect(body.result.wordCount).toBe(TRANSCRIPT.split(' ').length)
    const userBlock = (calls[0].body.messages as { content: string }[])[0].content
    expect(userBlock).toContain('Kind: speaking (automatic transcript)')
    expect(userBlock).toContain(TRANSCRIPT)

    const row = await gradeRow(body.gradeId)
    expect(row).toMatchObject({
      kind: 'speaking',
      task_id: 'advice',
      input_text: TRANSCRIPT,
      audio_seconds: 42.5,
      refused: 0,
      pending: 0,
      outcome: 'graded',
      free: 0,
      device_hash: null,
    })
    expect(row?.cost_micro_usd).toBe(whisperCostMicroUsd(42.5) + tokenCostMicroUsd('claude-opus-5', USAGE))
    expect(whisperCostMicroUsd(42.5)).toBeGreaterThan(0)
    for (const [column, value] of Object.entries(row ?? {})) {
      expect(value instanceof ArrayBuffer || ArrayBuffer.isView(value), column).toBe(false)
      if (typeof value === 'string') {
        expect(value.includes(audioB64.slice(0, 64)), column).toBe(false)
        expect(value.length, column).toBeLessThan(audioB64.length)
      }
    }
  })

  for (const type of ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg;codecs=opus', 'audio/wav']) {
    it(`accepts ${type}`, async () => {
      const { user } = await createUser({ pass: true })
      stubGrader(apiMessage(SIMPLE_OUTPUT))
      const res = await call(user, fakeAi({ text: TRANSCRIPT, transcription_info: { duration: 20 } }), { audio: audioFile(2048, type) })
      expect(res.status).toBe(200)
    })
  }

  for (const type of ['video/webm', 'audio/x-flac', 'application/octet-stream', '']) {
    it(`rejects MIME type "${type}"`, async () => {
      const { user } = await createUser({ pass: true })
      const ai = fakeAi({ text: TRANSCRIPT })
      await expectError(await call(user, ai, { audio: audioFile(2048, type) }), 400, 'bad_request')
      expect(ai.run).not.toHaveBeenCalled()
    })
  }

  it('rejects a chunked upload over the byte limit without buffering or transcribing it', async () => {
    const { user } = await createUser({ pass: true })
    const ai = fakeAi({ text: TRANSCRIPT })
    const chunk = new Uint8Array(256 * 1024)
    let sent = 0
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        // 4 MB in total, more than CAPS.maxAudioBytes plus the multipart allowance; no Content-Length
        if (sent >= 16) return controller.close()
        sent++
        controller.enqueue(chunk)
      },
    })
    const req = new Request(`${ORIGIN}/api/grade/speaking`, {
      method: 'POST',
      headers: { 'content-type': 'multipart/form-data; boundary=x' },
      body,
    })
    expect(req.headers.get('content-length')).toBeNull()
    const res = await gradeSpeaking(req, makeCtx({ env: { ...(env as Env), AI: ai as unknown as Ai }, user }))
    await expectError(res, 413, 'too_large')
    expect(ai.run).not.toHaveBeenCalled()
    expect(sent).toBeLessThan(16)
  })

  it('rejects a body that is not multipart form data', async () => {
    const { user } = await createUser({ pass: true })
    const req = new Request(`${ORIGIN}/api/grade/speaking`, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: 'hello' })
    await expectError(await gradeSpeaking(req, makeCtx({ user })), 400, 'bad_request')
  })

  it('rejects audio over the size cap', async () => {
    const { user } = await createUser({ pass: true })
    const ai = fakeAi({ text: TRANSCRIPT })
    await expectError(await call(user, ai, { audio: audioFile(CAPS.maxAudioBytes + 1) }), 413, 'too_large')
    expect(ai.run).not.toHaveBeenCalled()
  })

  it('rejects a declared duration over the cap and an invalid one', async () => {
    const { user } = await createUser({ pass: true })
    const ai = fakeAi({ text: TRANSCRIPT })
    await expectError(await call(user, ai, { durationSeconds: String(CAPS.maxAudioSeconds + 3) }), 413, 'too_large')
    await expectError(await call(user, ai, { durationSeconds: 'abc' }), 400, 'bad_request')
    expect(ai.run).not.toHaveBeenCalled()
  })

  it('rejects missing audio, a writing task id and a bad prompt index', async () => {
    const { user } = await createUser({ pass: true })
    const ai = fakeAi({ text: TRANSCRIPT })
    await expectError(await call(user, ai, { audio: null }), 400, 'bad_request')
    await expectError(await call(user, ai, { taskId: 'email' }), 400, 'bad_request')
    await expectError(await call(user, ai, { promptIndex: '7' }), 400, 'bad_request')
    await expectError(await call(user, ai, { explanationLang: 'fr' }), 400, 'bad_request')
  })

  it('refuses audio that turns out longer than the cap, recording the speech-to-text cost', async () => {
    const { user } = await createUser({ pass: true })
    const { calls } = stubGrader(apiMessage(SIMPLE_OUTPUT))
    await expectError(await call(user, fakeAi({ text: TRANSCRIPT, transcription_info: { duration: 600 } })), 413, 'too_large')
    expect(calls).toHaveLength(0)
    expect(await gradeRowsFor(user.id)).toMatchObject([
      { refused: 1, pending: 0, outcome: 'too_long', model: WHISPER_MODEL, audio_seconds: 600, cost_micro_usd: whisperCostMicroUsd(600) },
    ])
  })

  it('uses the declared duration for cost when the model reports none', async () => {
    const { user } = await createUser({ pass: true })
    stubGrader(apiMessage(SIMPLE_OUTPUT))
    const res = await call(user, fakeAi({ text: TRANSCRIPT }), { durationSeconds: '33' })
    const row = await gradeRow(((await res.json()) as GradeResponse).gradeId)
    expect(row?.audio_seconds).toBe(33)
    expect(row?.cost_micro_usd).toBe(whisperCostMicroUsd(33) + tokenCostMicroUsd('claude-opus-5', USAGE))
  })
})

describe('free speaking sample', () => {
  it('is available once after sign-up, then payment is required', async () => {
    const { user } = await createUser()
    stubGrader(apiMessage(SIMPLE_OUTPUT))
    const ai = fakeAi({ text: TRANSCRIPT, transcription_info: { duration: 30 } })
    const res = await call(user, ai)
    const body = (await res.json()) as GradeResponse
    expect(body.free).toBe(true)
    expect((await gradeRow(body.gradeId))?.free).toBe(1)
    expect(await freeSpeakingUsed(user.id)).toBe(1)
    await expectError(await call({ ...user, freeSpeakingUsed: true }, ai), 402, 'payment_required')
  })

  it('is given back when no speech is detected, and the speech-to-text cost is still logged', async () => {
    const { user } = await createUser()
    const { calls } = stubGrader(apiMessage(SIMPLE_OUTPUT))
    const err = await expectError(await call(user, fakeAi({ text: '  ', transcription_info: { duration: 12 } })), 400, 'bad_request')
    expect(err.message).toContain('No speech detected')
    expect(calls).toHaveLength(0)
    expect(await freeSpeakingUsed(user.id)).toBe(0)
    expect(await gradeRowsFor(user.id)).toMatchObject([
      { refused: 1, free: 0, outcome: 'no_speech', model: WHISPER_MODEL, audio_seconds: 12, cost_micro_usd: whisperCostMicroUsd(12), input_text: null },
    ])
  })

  it('is given back when transcription fails', async () => {
    const { user } = await createUser()
    await expectError(await call(user, fakeAi(new Error('AI unavailable')), { durationSeconds: '50' }), 500, 'internal')
    expect(await freeSpeakingUsed(user.id)).toBe(0)
    expect(await gradeRowsFor(user.id)).toMatchObject([
      { refused: 1, free: 0, pending: 0, outcome: 'failed', model: WHISPER_MODEL, audio_seconds: 50, cost_micro_usd: whisperCostMicroUsd(50) },
    ])
  })

  it('is given back when the grader output is unusable, with the full cost logged', async () => {
    const { user } = await createUser()
    stubGrader(apiMessage('not json'))
    await expectError(await call(user, fakeAi({ text: TRANSCRIPT, transcription_info: { duration: 25 } })), 500, 'internal')
    expect(await freeSpeakingUsed(user.id)).toBe(0)
    expect(await gradeRowsFor(user.id)).toMatchObject([
      {
        refused: 1,
        free: 1,
        outcome: 'failed',
        audio_seconds: 25,
        input_text: null,
        cost_micro_usd: whisperCostMicroUsd(25) + tokenCostMicroUsd('claude-opus-5', USAGE),
      },
    ])
  })

  it('is given back after a safety refusal, which invites a retry', async () => {
    const { user } = await createUser()
    stubGrader(apiMessage('', { content: [], stop_reason: 'refusal' }))
    const res = await call(user, fakeAi({ text: TRANSCRIPT, transcription_info: { duration: 20 } }))
    expect(res.status).toBe(200)
    const body = (await res.json()) as GradeResponse
    expect(body).toMatchObject({ free: false, result: { refused: true, refusalMessage: SAFETY_REFUSAL.en } })
    expect(await freeSpeakingUsed(user.id)).toBe(0)
    expect(await gradeRow(body.gradeId)).toMatchObject({ free: 1, refused: 1, outcome: 'safety_refused', input_text: null })
  })

  it('is off while the free budget is used up', async () => {
    const { user } = await createUser()
    const id = 'g_budget_' + user.id
    await env.DB.prepare(
      `INSERT INTO grades (id, task_id, prompt_index, kind, model, free, cost_micro_usd, created_at) VALUES (?1, 'advice', 0, 'speaking', 'm', 1, 2100000, ?2)`,
    )
      .bind(id, new Date().toISOString())
      .run()
    try {
      await expectError(await call(user, fakeAi({ text: TRANSCRIPT })), 402, 'payment_required')
    } finally {
      await env.DB.prepare('DELETE FROM grades WHERE id = ?1').bind(id).run()
    }
  })
})

describe('speaking caps', () => {
  it(`allows ${CAPS.speakingPerDay} speaking grades a day for a pass holder`, async () => {
    const { user } = await createUser({ pass: true })
    const now = new Date().toISOString()
    await env.DB.batch(
      Array.from({ length: CAPS.speakingPerDay }, (_, i) =>
        env.DB.prepare(
          `INSERT INTO grades (id, user_id, task_id, prompt_index, kind, model, created_at) VALUES (?1, ?2, 'advice', 0, 'speaking', 'm', ?3)`,
        ).bind(`g_sp_${user.id}_${i}`, user.id, now),
      ),
    )
    const ai = fakeAi({ text: TRANSCRIPT })
    await expectError(await call(user, ai), 429, 'rate_limited')
    expect(ai.run).not.toHaveBeenCalled()
  })

  it('reserves the last slot for only one of several parallel requests', async () => {
    const { user } = await createUser({ pass: true })
    const now = new Date().toISOString()
    await env.DB.batch(
      Array.from({ length: CAPS.speakingPerDay - 1 }, (_, i) =>
        env.DB.prepare(
          `INSERT INTO grades (id, user_id, task_id, prompt_index, kind, model, created_at) VALUES (?1, ?2, 'advice', 0, 'speaking', 'm', ?3)`,
        ).bind(`g_spp_${user.id}_${i}`, user.id, now),
      ),
    )
    const { calls } = stubGrader(apiMessage(SIMPLE_OUTPUT))
    const ai = fakeAi({ text: TRANSCRIPT, transcription_info: { duration: 20 } })
    const results = await Promise.all(Array.from({ length: 4 }, () => call(user, ai)))
    expect(results.map((r) => r.status).sort()).toEqual([200, 429, 429, 429])
    expect(ai.run).toHaveBeenCalledTimes(1)
    expect(calls).toHaveLength(1)
  })

  it('blocks the free sample path too once the no-feedback limit is reached', async () => {
    const { user } = await createUser()
    const now = new Date().toISOString()
    await env.DB.batch(
      Array.from({ length: CAPS.noFeedbackPerDay }, (_, i) =>
        env.DB.prepare(
          `INSERT INTO grades (id, user_id, task_id, prompt_index, kind, model, refused, created_at) VALUES (?1, ?2, 'advice', 0, 'speaking', 'm', 1, ?3)`,
        ).bind(`g_spnf_${user.id}_${i}`, user.id, now),
      ),
    )
    const ai = fakeAi({ text: TRANSCRIPT })
    await expectError(await call(user, ai), 429, 'rate_limited')
    expect(ai.run).not.toHaveBeenCalled()
    // the free sample claimed for the request is given back
    expect(await freeSpeakingUsed(user.id)).toBe(0)
  })
})
