import { env } from 'cloudflare:test'
import { exports } from 'cloudflare:workers'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiError, GradeResponse } from '../../../shared/api'
import { CAPS, SPEAKING_DAILY_AUDIO_MINUTES } from '../../../shared/config'
import type { Env, User } from '../../src/env'
import { gradeSpeaking } from '../../src/grading'
import { SAFETY_REFUSAL } from '../../src/grading/copy'
import { audioInputMode, resetAudioInputMode, toBase64, WHISPER_MODEL } from '../../src/grading/transcribe'
import { tokenCostMicroUsd, whisperCostMicroUsd } from '../../src/lib/spend'
import {
  apiMessage,
  createUser,
  gradeRow,
  gradeRowsFor,
  makeCtx,
  multipartRequest,
  ORIGIN,
  SIMPLE_OUTPUT,
  stubGrader,
  USAGE,
} from './helpers'

beforeEach(() => {
  // each test starts as a fresh isolate that has not yet tried the stream form
  resetAudioInputMode()
})

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

function speakingForm(f: FormFields = {}): FormData {
  const form = new FormData()
  form.set('taskId', f.taskId ?? 'advice')
  form.set('promptIndex', f.promptIndex ?? '0')
  form.set('explanationLang', f.explanationLang ?? 'en')
  const audio = f.audio === undefined ? audioFile() : f.audio
  if (audio) form.set('audio', audio)
  if (f.durationSeconds !== undefined) form.set('durationSeconds', f.durationSeconds)
  return form
}

/** The upload as a browser sends it: multipart with Content-Length. */
const speakingRequest = (f: FormFields = {}): Promise<Request> => multipartRequest(`${ORIGIN}/api/grade/speaking`, speakingForm(f))

type AiResult = { text?: string; transcription_info?: { duration?: number } }
/** What the fake Workers AI received: the raw stream ({body, contentType}) or a base64 string. */
interface AudioInput {
  form: 'stream' | 'base64'
  bytes: Uint8Array
  contentType?: string
}
type AiAnswer = AiResult | Error

const fromBase64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))

/** A fake env.AI: one answer for every call, or separate answers for the stream and base64 forms. */
function fakeAi(answer: AiAnswer | { stream: AiAnswer; base64: AiAnswer }) {
  const inputs: AudioInput[] = []
  const run = vi.fn(async (_model: string, params: Record<string, unknown>) => {
    const audio = params.audio
    const input: AudioInput =
      typeof audio === 'string'
        ? { form: 'base64', bytes: fromBase64(audio) }
        : {
            form: 'stream',
            bytes: new Uint8Array(await new Response((audio as { body: ReadableStream }).body).arrayBuffer()),
            contentType: (audio as { contentType: string }).contentType,
          }
    inputs.push(input)
    const a = answer instanceof Error || !('stream' in answer) ? answer : answer[input.form]
    if (a instanceof Error) throw a
    return a
  })
  return { run, inputs }
}

async function call(user: User, ai: ReturnType<typeof fakeAi>, fields: FormFields = {}): Promise<Response> {
  const testEnv = { ...(env as Env), AI: ai as unknown as Ai }
  return gradeSpeaking(await speakingRequest(fields), makeCtx({ env: testEnv, user }))
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

    // the audio goes to Workers AI as a raw stream, with no base64 in the Worker (memo §7.2 Z2)
    const audioBytes = new Uint8Array(await audio.arrayBuffer())
    const audioB64 = toBase64(audioBytes)
    expect(ai.run).toHaveBeenCalledTimes(1)
    expect(ai.run).toHaveBeenCalledWith(WHISPER_MODEL, {
      audio: { body: expect.any(ReadableStream), contentType: 'audio/webm;codecs=opus' },
      task: 'transcribe',
      language: 'en',
    })
    expect(ai.inputs).toEqual([{ form: 'stream', bytes: audioBytes, contentType: 'audio/webm;codecs=opus' }])
    expect(audioInputMode()).toBe('stream')

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

  /** A 4 MB chunked multipart body that counts how many chunks were read. */
  function countingBody() {
    const chunk = new Uint8Array(256 * 1024)
    const state = { sent: 0 }
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (state.sent >= 16) return controller.close()
        state.sent++
        controller.enqueue(chunk)
      },
    })
    return { body, state }
  }

  it('refuses an upload without Content-Length before reading it (length required)', async () => {
    const { user } = await createUser()
    const ai = fakeAi({ text: TRANSCRIPT })
    const { body, state } = countingBody()
    const req = new Request(`${ORIGIN}/api/grade/speaking`, {
      method: 'POST',
      headers: { 'content-type': 'multipart/form-data; boundary=x' },
      body,
    })
    expect(req.headers.get('content-length')).toBeNull()
    const err = await expectError(await gradeSpeaking(req, makeCtx({ env: { ...(env as Env), AI: ai as unknown as Ai }, user })), 400, 'bad_request')
    expect(err.message).toBe('Length required: the upload did not say its size. Please try again.')
    expect(req.bodyUsed).toBe(false)
    // at most the stream's initial pull; nothing parsed, transcribed or claimed
    expect(state.sent).toBeLessThanOrEqual(1)
    expect(ai.run).not.toHaveBeenCalled()
    expect(await freeSpeakingUsed(user.id)).toBe(0)
    expect(await gradeRowsFor(user.id)).toEqual([])
  })

  for (const length of ['abc', '-1', '1e3', '12.5', ' ']) {
    it(`treats Content-Length "${length}" as missing`, async () => {
      const { user } = await createUser({ pass: true })
      const ai = fakeAi({ text: TRANSCRIPT })
      const req = await multipartRequest(`${ORIGIN}/api/grade/speaking`, speakingForm(), { 'content-length': length })
      const err = await expectError(await gradeSpeaking(req, makeCtx({ env: { ...(env as Env), AI: ai as unknown as Ai }, user })), 400, 'bad_request')
      expect(err.message).toContain('Length required')
      expect(ai.run).not.toHaveBeenCalled()
    })
  }

  it('refuses a declared Content-Length over the limit without reading the body', async () => {
    const { user } = await createUser({ pass: true })
    const ai = fakeAi({ text: TRANSCRIPT })
    const { body, state } = countingBody()
    const req = new Request(`${ORIGIN}/api/grade/speaking`, {
      method: 'POST',
      headers: { 'content-type': 'multipart/form-data; boundary=x', 'content-length': String(16 * 256 * 1024) },
      body,
    })
    const err = await expectError(await gradeSpeaking(req, makeCtx({ env: { ...(env as Env), AI: ai as unknown as Ai }, user })), 413, 'too_large')
    expect(err.message).toBe(`Recordings can be up to ${CAPS.maxAudioSeconds} seconds and 1 MB.`)
    expect(req.bodyUsed).toBe(false)
    expect(state.sent).toBeLessThanOrEqual(1)
    expect(ai.run).not.toHaveBeenCalled()
  })

  it('accepts a body just under the form limit (1 MB of audio plus the multipart allowance)', async () => {
    const { user } = await createUser({ pass: true })
    stubGrader(apiMessage(SIMPLE_OUTPUT))
    const ai = fakeAi({ text: TRANSCRIPT, transcription_info: { duration: 100 } })
    const res = await call(user, ai, { audio: audioFile(CAPS.maxAudioBytes) })
    expect(res.status).toBe(200)
    expect(ai.inputs[0].bytes.byteLength).toBe(CAPS.maxAudioBytes)
  })

  it('rejects a body that is not multipart form data', async () => {
    const { user } = await createUser({ pass: true })
    const req = new Request(`${ORIGIN}/api/grade/speaking`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain', 'content-length': '5' },
      body: 'hello',
    })
    const err = await expectError(await gradeSpeaking(req, makeCtx({ user })), 400, 'bad_request')
    expect(err.message).toBe('Expected multipart form data')
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

  it('is paused, not used, while the free budget is used up', async () => {
    const { user } = await createUser()
    const id = 'g_budget_' + user.id
    await env.DB.prepare(
      `INSERT INTO grades (id, task_id, prompt_index, kind, model, free, cost_micro_usd, created_at) VALUES (?1, 'advice', 0, 'speaking', 'm', 1, 2100000, ?2)`,
    )
      .bind(id, new Date().toISOString())
      .run()
    const ai = fakeAi({ text: TRANSCRIPT })
    try {
      const err = await expectError(await call(user, ai), 429, 'free_unavailable')
      expect(err.message).toBe('Free samples are paused right now. Please try again later, or get a pass to keep practising.')
      // a learner who already used theirs is told so
      await expectError(await call({ ...user, freeSpeakingUsed: true }, ai), 402, 'payment_required')
    } finally {
      await env.DB.prepare('DELETE FROM grades WHERE id = ?1').bind(id).run()
    }
    expect(ai.run).not.toHaveBeenCalled()
    expect(await freeSpeakingUsed(user.id)).toBe(0)
    expect(await gradeRowsFor(user.id)).toEqual([])
  })

  it('is paused, not used, while the free_enabled flag is false; pass holders are still graded', async () => {
    const { user } = await createUser()
    const holder = await createUser({ pass: true })
    stubGrader(apiMessage(SIMPLE_OUTPUT))
    const ai = fakeAi({ text: TRANSCRIPT, transcription_info: { duration: 30 } })
    await env.FLAGS.put('flag:free_enabled', 'false')
    try {
      const err = await expectError(await call(user, ai), 429, 'free_unavailable')
      expect(err.message).toContain('paused')
      await expectError(await call({ ...user, freeSpeakingUsed: true }, ai), 402, 'payment_required')
      expect(await freeSpeakingUsed(user.id)).toBe(0)
      expect((await call(holder.user, ai)).status).toBe(200)
    } finally {
      await env.FLAGS.delete('flag:free_enabled')
    }
    // back on: the sample is still there
    const body = (await (await call(user, ai)).json()) as GradeResponse
    expect(body.free).toBe(true)
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

describe('speech-to-text input form (memo §7.2 Z2)', () => {
  it('falls back to base64 when Workers AI rejects the stream form, then keeps using base64', async () => {
    const { user } = await createUser({ pass: true })
    stubGrader(apiMessage(SIMPLE_OUTPUT))
    const ai = fakeAi({ stream: new Error('5006: could not parse input'), base64: { text: TRANSCRIPT, transcription_info: { duration: 30 } } })
    const audio = audioFile(5000)
    const res = await call(user, ai, { audio })
    expect(res.status).toBe(200)
    const body = (await res.json()) as GradeResponse
    expect(body.result.transcript).toBe(TRANSCRIPT)
    const bytes = new Uint8Array(await audio.arrayBuffer())
    expect(ai.inputs.map((i) => i.form)).toEqual(['stream', 'base64'])
    expect(ai.inputs[1].bytes).toEqual(bytes)
    expect(ai.run).toHaveBeenLastCalledWith(WHISPER_MODEL, { audio: toBase64(bytes), task: 'transcribe', language: 'en' })
    expect(audioInputMode()).toBe('base64')
    // one row, one speech-to-text cost: the rejected stream call is not billed as audio
    expect(await gradeRow(body.gradeId)).toMatchObject({ outcome: 'graded', audio_seconds: 30 })

    // the next request in this isolate goes straight to base64
    expect((await call(user, ai)).status).toBe(200)
    expect(ai.inputs.map((i) => i.form)).toEqual(['stream', 'base64', 'base64'])
  })

  it('does not retry once the stream form has worked in this isolate', async () => {
    const { user } = await createUser({ pass: true })
    stubGrader(apiMessage(SIMPLE_OUTPUT))
    let fail = false
    const ai = fakeAi({ text: TRANSCRIPT, transcription_info: { duration: 20 } })
    const run = ai.run.getMockImplementation()!
    ai.run.mockImplementation(async (model, params) => {
      const out = await run(model, params)
      if (fail) throw new Error('4006: daily free allocation used up')
      return out
    })
    expect((await call(user, ai)).status).toBe(200)
    expect(audioInputMode()).toBe('stream')
    fail = true
    await expectError(await call(user, ai), 500, 'internal')
    expect(ai.inputs.map((i) => i.form)).toEqual(['stream', 'stream'])
  })
})

describe('shared daily speaking allowance (memo §7.2 Z2)', () => {
  /** Finished speaking rows today that use up the whole allowance; removed by the returned cleanup. */
  async function fillAllowance(): Promise<() => Promise<void>> {
    const id = 'g_allowance_' + Date.now()
    await env.DB.prepare(
      `INSERT INTO grades (id, task_id, prompt_index, kind, model, audio_seconds, created_at) VALUES (?1, 'advice', 0, 'speaking', ?2, ?3, ?4)`,
    )
      .bind(id, WHISPER_MODEL, SPEAKING_DAILY_AUDIO_MINUTES * 60, new Date().toISOString())
      .run()
    return async () => {
      await env.DB.prepare('DELETE FROM grades WHERE id = ?1').bind(id).run()
    }
  }

  it('answers at_capacity before the upload is read, claiming and spending nothing', async () => {
    const { user } = await createUser()
    const holder = await createUser({ pass: true })
    const ai = fakeAi({ text: TRANSCRIPT, transcription_info: { duration: 30 } })
    const { calls } = stubGrader(apiMessage(SIMPLE_OUTPUT))
    const cleanup = await fillAllowance()
    try {
      for (const u of [user, holder.user]) {
        const req = await speakingRequest()
        const res = await gradeSpeaking(req, makeCtx({ env: { ...(env as Env), AI: ai as unknown as Ai }, user: u }))
        const err = await expectError(res, 503, 'at_capacity')
        expect(err.message).toBe(
          'Speaking feedback has reached its limit for today. It reopens at midnight UTC. You can still practise speaking without feedback.',
        )
        expect(req.bodyUsed).toBe(false)
        expect(await gradeRowsFor(u.id)).toEqual([])
      }
    } finally {
      await cleanup()
    }
    expect(ai.run).not.toHaveBeenCalled()
    expect(calls).toHaveLength(0)
    expect(await freeSpeakingUsed(user.id)).toBe(0)
    // the allowance is back (a new day, here: the rows are gone): the free sample still works
    const body = (await (await call(user, ai)).json()) as GradeResponse
    expect(body.free).toBe(true)
  })

  it('still answers unauthorized first for signed-out requests', async () => {
    const cleanup = await fillAllowance()
    try {
      const res = await gradeSpeaking(await speakingRequest(), makeCtx({ user: null }))
      await expectError(res, 401, 'unauthorized')
    } finally {
      await cleanup()
    }
  })
})
