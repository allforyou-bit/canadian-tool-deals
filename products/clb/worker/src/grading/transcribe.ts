// Speech to text with Workers AI. Input/output per cloudflare-docs
// src/content/workers-ai-models/whisper-large-v3-turbo.json (fetched 2026-09-24): `audio` is a
// base64 string or {body, contentType}; `task` "transcribe"; `language` of the audio; output
// `text` (required) and `transcription_info.duration` in seconds. The base64 call shape (language "en")
// appears in workers-ai/guides/tutorials/build-a-workers-ai-whisper-with-chunking.mdx.
//
// CPU (memo §7.2 Z2, Workers Free allows 10 ms per request): the binding in workerd
// (src/cloudflare/internal/ai-api.ts, #generateStreamFetch, read 2026-09-24) sends an input shaped
// {body: ReadableStream, contentType} as the raw request body, with no base64 and no JSON, so the audio
// never passes through JavaScript. Whether the Whisper backend accepts that form is a staging check, so
// the first failure falls back to base64 (native Uint8Array.prototype.toBase64 where the runtime has it)
// and this isolate keeps using base64 once that works. Clips are at most CAPS.maxAudioBytes (1 MB).
// The audio is only held in memory for this call: it is never stored or logged.
import type { Env } from '../env'

export const WHISPER_MODEL = '@cf/openai/whisper-large-v3-turbo'

export interface Transcript {
  text: string
  /** duration reported by the model, or null when it did not report one */
  durationSeconds: number | null
}

/** Base64 in JavaScript, chunked so large clips do not overflow the argument list (~80 ms per MiB). */
export function toBase64Loop(bytes: Uint8Array): string {
  const CHUNK = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK) binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  return btoa(binary)
}

/** Base64 with the runtime's native Uint8Array.prototype.toBase64 when present, else the loop. */
export function toBase64(bytes: Uint8Array): string {
  const native = (bytes as Uint8Array & { toBase64?: () => string }).toBase64
  return typeof native === 'function' ? native.call(bytes) : toBase64Loop(bytes)
}

/**
 * How this isolate sends audio: 'unknown' until the stream form has worked ('stream') or has failed
 * where base64 then worked ('base64'). Module state lives as long as the isolate; a deploy starts over.
 */
export type AudioInputMode = 'unknown' | 'stream' | 'base64'
let mode: AudioInputMode = 'unknown'

export function audioInputMode(): AudioInputMode {
  return mode
}

/** Tests only: forget what this isolate learned about the stream form. */
export function resetAudioInputMode(): void {
  mode = 'unknown'
}

type WhisperOutput = { text?: unknown; transcription_info?: { duration?: unknown } }

/** The model's answer, or null when it is not the documented output (no `text` string). */
function readOutput(out: unknown): Transcript | null {
  if (!out || typeof out !== 'object') return null
  const o = out as WhisperOutput
  if (typeof o.text !== 'string') return null
  const d = o.transcription_info?.duration
  return {
    text: o.text.trim(),
    durationSeconds: typeof d === 'number' && Number.isFinite(d) && d >= 0 ? d : null,
  }
}

/** The Workers AI error code at the start of a binding error ("5006: …"), never the rest of the message. */
function errorCode(e: unknown): string {
  const name = e instanceof Error ? e.name : typeof e
  const code = e instanceof Error ? /^(\d{3,5}):/.exec(e.message)?.[1] : undefined
  return code ? `${name} ${code}` : name
}

const OPTIONS = { task: 'transcribe', language: 'en' } as const

async function runBase64(env: Env, audio: Blob): Promise<Transcript> {
  const bytes = new Uint8Array(await audio.arrayBuffer())
  const out = await env.AI.run(WHISPER_MODEL, { audio: toBase64(bytes), ...OPTIONS })
  // same handling as before the stream form existed: a missing text is no speech
  return readOutput(out) ?? { text: '', durationSeconds: null }
}

/**
 * Transcribe one recording. The stream form is tried first. While this isolate has not yet seen it
 * work, a failure — an error, an answer without `text`, or an empty transcript — is retried once as
 * base64; if base64 then answers, the isolate switches to base64. Once the stream form has produced a
 * transcript, its errors are real errors (for example the daily Workers AI allocation) and are thrown
 * as they are, and an empty transcript means no speech.
 */
export async function transcribe(env: Env, audio: Blob): Promise<Transcript> {
  if (mode === 'base64') return runBase64(env, audio)

  let streamed: Transcript | null = null
  try {
    const out = await env.AI.run(WHISPER_MODEL, {
      audio: { body: audio.stream(), contentType: audio.type || 'application/octet-stream' },
      ...OPTIONS,
    })
    streamed = readOutput(out)
  } catch (e) {
    if (mode === 'stream') throw e
    console.warn('speech to text: stream input failed, retrying as base64', errorCode(e))
  }
  // the stream form worked before in this isolate: take its answer (without `text`, no speech)
  if (mode === 'stream') return streamed ?? { text: '', durationSeconds: null }
  if (streamed && streamed.text !== '') {
    mode = 'stream'
    return streamed
  }

  let fallback: Transcript
  try {
    fallback = await runBase64(env, audio)
  } catch (e) {
    // the stream form did answer, with an empty transcript: keep that answer (no speech)
    if (streamed) return streamed
    throw e
  }
  // an empty transcript from both forms is silence and says nothing about the stream form
  if (streamed === null || fallback.text !== '') {
    mode = 'base64'
    console.warn('speech to text: using base64 input in this isolate')
  }
  return fallback
}
