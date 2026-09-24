// Audio recording helpers for the speaking tasks (memo B4). Pure functions; the MediaRecorder
// wiring lives in lib/use-recorder.ts.
import { CAPS } from '../shared/config'

/**
 * Preferred recording formats, best first: Opus in WebM (Chrome, Edge, Firefox), then MP4/AAC
 * (Safari on iOS and macOS), then any WebM.
 */
export const PREFERRED_MIME_TYPES = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'] as const

/** First supported type, or null when the browser can record none of them. */
export function pickMimeType(isTypeSupported: (type: string) => boolean): string | null {
  for (const type of PREFERRED_MIME_TYPES) {
    try {
      if (isTypeSupported(type)) return type
    } catch {
      // a throwing isTypeSupported counts as "not supported"
    }
  }
  return null
}

/**
 * MediaRecorder options: the chosen format and a low bitrate (CAPS.recordingBitsPerSecond, 32 kbps).
 * Speech stays clear at that rate, and a small upload keeps the Worker's speaking request well under the
 * Workers Free CPU limit (memo §7.2 Z2; Chromium measured 31 kbps with this setting, 120 kbps without).
 */
export function recorderOptions(mimeType: string | null): { mimeType?: string; audioBitsPerSecond: number } {
  return { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: CAPS.recordingBitsPerSecond }
}

/** Bytes a recording of this length takes at the requested bitrate (an estimate; encoders vary). */
export function expectedBytes(seconds: number, bitsPerSecond: number = CAPS.recordingBitsPerSecond): number {
  return Math.ceil((seconds * bitsPerSecond) / 8)
}

/** Room kept below the upload cap for the last piece the recorder hands over after stop(). */
export const RECORDING_SIZE_MARGIN_BYTES = 64 * 1024

/**
 * true when a recording should stop now so the file stays under `maxBytes`. A browser that ignores the
 * requested bitrate (Safari's AAC is not measured) would otherwise make a long answer too large to send;
 * the recorder hands data over every second, so it stops while there is room for about two more pieces.
 */
export function nearSizeLimit(totalBytes: number, lastChunkBytes: number, maxBytes: number = CAPS.maxAudioBytes): boolean {
  return totalBytes + Math.max(RECORDING_SIZE_MARGIN_BYTES, 2 * lastChunkBytes) >= maxBytes
}

/** File extension for the upload's file name. */
export function fileExtension(mimeType: string): string {
  const base = mimeType.split(';')[0].trim().toLowerCase()
  if (base === 'audio/webm') return 'webm'
  if (base === 'audio/mp4' || base === 'audio/aac' || base === 'audio/x-m4a') return 'mp4'
  if (base === 'audio/ogg') return 'ogg'
  return 'bin'
}

/** Longest allowed recording for a task: its speaking time, never above the global cap. */
export function recordingLimitSeconds(speakSeconds?: number): number {
  if (!speakSeconds || speakSeconds <= 0) return CAPS.maxAudioSeconds
  return Math.min(speakSeconds, CAPS.maxAudioSeconds)
}

/** Recording length in seconds (one decimal), clamped to the cap so the server never sees 120.1. */
export function durationSeconds(startMs: number, endMs: number): number {
  const s = Math.max(0, endMs - startMs) / 1000
  return Math.min(CAPS.maxAudioSeconds, Math.round(s * 10) / 10)
}

export const MIN_RECORDING_SECONDS = 1

export type RecordingCheck = 'ok' | 'too_short' | 'too_long' | 'too_large'

/**
 * Client-side checks before upload; the Worker enforces the same caps. `maxBytes` is Infinity for the
 * practice mode, whose recordings never leave the device.
 */
export function checkRecording(bytes: number, seconds: number, maxBytes: number = CAPS.maxAudioBytes): RecordingCheck {
  if (bytes > maxBytes) return 'too_large'
  if (seconds > CAPS.maxAudioSeconds) return 'too_long'
  if (bytes === 0 || seconds < MIN_RECORDING_SECONDS) return 'too_short'
  return 'ok'
}
