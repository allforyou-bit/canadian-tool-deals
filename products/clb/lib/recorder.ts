// Audio recording helpers for the speaking tasks (memo B4). Pure functions; the MediaRecorder
// wiring lives in components/SpeakingPractice.tsx.
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

/** Client-side checks before upload; the Worker enforces the same caps. */
export function checkRecording(bytes: number, seconds: number): RecordingCheck {
  if (bytes > CAPS.maxAudioBytes) return 'too_large'
  if (seconds > CAPS.maxAudioSeconds) return 'too_long'
  if (bytes === 0 || seconds < MIN_RECORDING_SECONDS) return 'too_short'
  return 'ok'
}
