// Speech-to-text input form (memo §7.2 Z2): the audio goes to Workers AI as a raw stream, with a
// one-time fallback to base64 (native Uint8Array.prototype.toBase64 where available). env.AI is a stub.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Env } from '../../src/env'
import {
  audioInputMode,
  resetAudioInputMode,
  toBase64,
  toBase64Loop,
  transcribe,
  WHISPER_MODEL,
} from '../../src/grading/transcribe'

beforeEach(() => {
  resetAudioInputMode()
})

afterEach(() => {
  vi.restoreAllMocks()
})

function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n)
  for (let i = 0; i < n; i += 65_536) crypto.getRandomValues(out.subarray(i, Math.min(n, i + 65_536)))
  return out
}

const fromBase64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))

type Answer = unknown
interface Seen {
  form: 'stream' | 'base64'
  bytes: Uint8Array
  contentType?: string
  params: Record<string, unknown>
}

/** A fake env whose AI.run answers per input form; an Error answer is thrown. */
function fakeEnv(answers: { stream?: Answer; base64?: Answer }) {
  const seen: Seen[] = []
  const run = vi.fn(async (model: string, params: Record<string, unknown>) => {
    expect(model).toBe(WHISPER_MODEL)
    const audio = params.audio
    const s: Seen =
      typeof audio === 'string'
        ? { form: 'base64', bytes: fromBase64(audio), params }
        : {
            form: 'stream',
            bytes: new Uint8Array(await new Response((audio as { body: ReadableStream }).body).arrayBuffer()),
            contentType: (audio as { contentType: string }).contentType,
            params,
          }
    seen.push(s)
    const a = answers[s.form]
    if (a instanceof Error) throw a
    return a
  })
  return { env: { AI: { run } } as unknown as Env, run, seen }
}

const clip = (bytes = randomBytes(3000), type = 'audio/webm;codecs=opus') => ({ bytes, blob: new Blob([bytes], { type }) })
const ok = (text: string, duration?: unknown) => ({ text, transcription_info: { duration } })

describe('toBase64', () => {
  it('matches the known encoding and the JavaScript loop for every length pattern', () => {
    expect(toBase64(new Uint8Array([0, 1, 2, 250, 251, 255, 65]))).toBe('AAEC+vv/QQ==')
    for (const n of [0, 1, 2, 3, 4, 100, 0x8000 - 1, 0x8000, 0x8000 + 1, 100_003]) {
      const bytes = randomBytes(n)
      expect(toBase64(bytes), `length ${n}`).toBe(toBase64Loop(bytes))
      expect(fromBase64(toBase64(bytes))).toEqual(bytes)
    }
  })

  it('uses the runtime method when it exists', () => {
    const proto = Uint8Array.prototype as Uint8Array & { toBase64?: () => string }
    const original = Object.getOwnPropertyDescriptor(proto, 'toBase64')
    // workerd (compatibility date 2026-08-15) has it
    expect(typeof original?.value).toBe('function')
    Object.defineProperty(proto, 'toBase64', { value: () => 'native', configurable: true, writable: true })
    try {
      expect(toBase64(new Uint8Array([1, 2, 3]))).toBe('native')
    } finally {
      Object.defineProperty(proto, 'toBase64', original!)
    }
  })

  it('falls back to the loop when the runtime lacks Uint8Array.prototype.toBase64', () => {
    const proto = Uint8Array.prototype as Uint8Array & { toBase64?: () => string }
    const original = Object.getOwnPropertyDescriptor(proto, 'toBase64')
    delete proto.toBase64
    try {
      expect(typeof proto.toBase64).toBe('undefined')
      const bytes = randomBytes(70_000)
      expect(fromBase64(toBase64(bytes))).toEqual(bytes)
      expect(toBase64(new Uint8Array([0, 1, 2, 250, 251, 255, 65]))).toBe('AAEC+vv/QQ==')
    } finally {
      if (original) Object.defineProperty(proto, 'toBase64', original)
    }
    expect(typeof proto.toBase64).toBe('function')
  })
})

describe('transcribe', () => {
  it('sends the raw audio stream with its content type, never base64', async () => {
    const { bytes, blob } = clip()
    const { env, run, seen } = fakeEnv({ stream: ok('  Hello there.  ', 12.5) })
    expect(await transcribe(env, blob)).toEqual({ text: 'Hello there.', durationSeconds: 12.5 })
    expect(run).toHaveBeenCalledTimes(1)
    expect(seen[0]).toMatchObject({ form: 'stream', contentType: 'audio/webm;codecs=opus', bytes })
    expect(seen[0].params).toMatchObject({ task: 'transcribe', language: 'en' })
    expect(audioInputMode()).toBe('stream')
  })

  it('labels audio without a type as application/octet-stream (the binding requires a content type)', async () => {
    const { blob } = clip(randomBytes(10), '')
    const { env, seen } = fakeEnv({ stream: ok('Hi.') })
    await transcribe(env, blob)
    expect(seen[0].contentType).toBe('application/octet-stream')
  })

  it('retries as base64 when the stream form throws, then uses base64 for the rest of the isolate', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { bytes, blob } = clip()
    const { env, run, seen } = fakeEnv({ stream: new Error('5006: Error: required properties at "/" are "audio" (secret detail)'), base64: ok('Hello.', 4) })
    expect(await transcribe(env, blob)).toEqual({ text: 'Hello.', durationSeconds: 4 })
    expect(seen.map((s) => s.form)).toEqual(['stream', 'base64'])
    expect(seen[1].bytes).toEqual(bytes)
    expect(seen[1].params).toEqual({ audio: toBase64(bytes), task: 'transcribe', language: 'en' })
    expect(audioInputMode()).toBe('base64')
    // logs name the error code only, never the rest of the message
    expect(warn).toHaveBeenCalledWith('speech to text: stream input failed, retrying as base64', 'Error 5006')
    expect(JSON.stringify(warn.mock.calls)).not.toContain('secret detail')

    await transcribe(env, clip().blob)
    expect(run).toHaveBeenCalledTimes(3)
    expect(seen.map((s) => s.form)).toEqual(['stream', 'base64', 'base64'])
  })

  for (const [label, answer] of [
    ['no text field', { transcription_info: { duration: 3 } }],
    ['a raw stream', new ReadableStream()],
    ['null', null],
    ['a string', 'Hello.'],
  ] as const) {
    it(`treats a stream answer with ${label} as a rejection`, async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => undefined)
      const { env, seen } = fakeEnv({ stream: answer, base64: ok('Hello.') })
      expect((await transcribe(env, clip().blob)).text).toBe('Hello.')
      expect(seen.map((s) => s.form)).toEqual(['stream', 'base64'])
      expect(audioInputMode()).toBe('base64')
    })
  }

  it('retries an empty stream transcript as base64 and switches when base64 hears speech', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { env, seen } = fakeEnv({ stream: ok('   '), base64: ok('Hello.') })
    expect((await transcribe(env, clip().blob)).text).toBe('Hello.')
    expect(seen.map((s) => s.form)).toEqual(['stream', 'base64'])
    expect(audioInputMode()).toBe('base64')
  })

  it('treats an empty transcript from both forms as silence and learns nothing', async () => {
    const { env, seen } = fakeEnv({ stream: ok(''), base64: ok(' ', 2) })
    expect(await transcribe(env, clip().blob)).toEqual({ text: '', durationSeconds: 2 })
    expect(seen.map((s) => s.form)).toEqual(['stream', 'base64'])
    expect(audioInputMode()).toBe('unknown')
  })

  it('keeps an empty stream answer (no speech) when the base64 retry fails', async () => {
    const { env } = fakeEnv({ stream: ok('', 7), base64: new Error('3040: capacity') })
    expect(await transcribe(env, clip().blob)).toEqual({ text: '', durationSeconds: 7 })
    expect(audioInputMode()).toBe('unknown')
  })

  it('throws the base64 error when both forms fail, and learns nothing', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { env, run } = fakeEnv({ stream: new Error('5006: bad input'), base64: new Error('3040: capacity') })
    await expect(transcribe(env, clip().blob)).rejects.toThrow('3040: capacity')
    expect(run).toHaveBeenCalledTimes(2)
    expect(audioInputMode()).toBe('unknown')
  })

  it('once the stream form has worked, throws its errors without a retry and accepts silence', async () => {
    const answers: { stream?: Answer; base64?: Answer } = { stream: ok('Hello.'), base64: ok('never used') }
    const { env, run } = fakeEnv(answers)
    await transcribe(env, clip().blob)
    expect(audioInputMode()).toBe('stream')

    answers.stream = new Error('4006: you have used up your daily free allocation')
    await expect(transcribe(env, clip().blob)).rejects.toThrow('4006')
    answers.stream = ok('  ')
    expect(await transcribe(env, clip().blob)).toEqual({ text: '', durationSeconds: null })
    answers.stream = { unexpected: true }
    expect(await transcribe(env, clip().blob)).toEqual({ text: '', durationSeconds: null })
    expect(run).toHaveBeenCalledTimes(4)
    expect(audioInputMode()).toBe('stream')
  })

  it('reports a duration only when it is a finite, non-negative number', async () => {
    const cases: [unknown, number | null][] = [
      [30, 30],
      [0, 0],
      [-1, null],
      [Number.NaN, null],
      [Number.POSITIVE_INFINITY, null],
      ['30', null],
      [undefined, null],
    ]
    for (const [duration, expected] of cases) {
      resetAudioInputMode()
      const { env } = fakeEnv({ stream: ok('Hello.', duration) })
      expect((await transcribe(env, clip().blob)).durationSeconds, String(duration)).toBe(expected)
    }
  })

  it('base64 mode reads a missing text as no speech, as before the stream form', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const answers: { stream?: Answer; base64?: Answer } = { stream: new Error('5006'), base64: ok('Hello.') }
    const { env } = fakeEnv(answers)
    await transcribe(env, clip().blob)
    expect(audioInputMode()).toBe('base64')
    answers.base64 = { transcription_info: { duration: 5 } }
    expect(await transcribe(env, clip().blob)).toEqual({ text: '', durationSeconds: null })
  })
})
