// Speech to text with Workers AI. Input/output per cloudflare-docs
// src/content/workers-ai-models/whisper-large-v3-turbo.json (fetched 2026-09-24): `audio` is a
// base64 string (or {body, contentType}); `task` "transcribe"; `language` of the audio; output
// `text` (required) and `transcription_info.duration` in seconds. The same call shape (base64,
// language "en") appears in workers-ai/guides/tutorials/build-a-workers-ai-whisper-with-chunking.mdx.
// No input size limit is documented for this model (workers-ai/platform/limits.mdx lists only 720
// requests/minute for speech recognition), so a full 3 MB clip (~4 MB of base64) is a level-B check.
// The audio is only held in memory for this call: it is never stored or logged.
import type { Env } from '../env'

export const WHISPER_MODEL = '@cf/openai/whisper-large-v3-turbo'

export interface Transcript {
  text: string
  /** duration reported by the model, or null when it did not report one */
  durationSeconds: number | null
}

/** Base64 without Node's Buffer (chunked so large clips do not overflow the argument list). */
export function toBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK) binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  return btoa(binary)
}

export async function transcribe(env: Env, audio: Blob): Promise<Transcript> {
  const bytes = new Uint8Array(await audio.arrayBuffer())
  const out = await env.AI.run(WHISPER_MODEL, { audio: toBase64(bytes), task: 'transcribe', language: 'en' })
  const d = out.transcription_info?.duration
  return {
    text: typeof out.text === 'string' ? out.text.trim() : '',
    durationSeconds: typeof d === 'number' && Number.isFinite(d) && d >= 0 ? d : null,
  }
}
