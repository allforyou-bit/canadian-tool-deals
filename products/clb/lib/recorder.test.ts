import { describe, expect, it } from 'vitest'
import { CAPS } from '../shared/config'
import {
  checkRecording,
  durationSeconds,
  fileExtension,
  pickMimeType,
  PREFERRED_MIME_TYPES,
  recordingLimitSeconds,
} from './recorder'

const supports = (...types: string[]) => (t: string) => types.includes(t)

describe('pickMimeType', () => {
  it('prefers Opus in WebM when available', () => {
    expect(pickMimeType(supports('audio/webm', 'audio/mp4', 'audio/webm;codecs=opus'))).toBe('audio/webm;codecs=opus')
  })

  it('falls back to MP4 before plain WebM', () => {
    expect(pickMimeType(supports('audio/webm', 'audio/mp4'))).toBe('audio/mp4')
  })

  it('picks MP4 on an iOS-like browser that supports only audio/mp4', () => {
    expect(pickMimeType(supports('audio/mp4'))).toBe('audio/mp4')
  })

  it('uses plain WebM as the last resort', () => {
    expect(pickMimeType(supports('audio/webm'))).toBe('audio/webm')
  })

  it('returns null when nothing is supported', () => {
    expect(pickMimeType(() => false)).toBeNull()
  })

  it('treats a throwing isTypeSupported as unsupported', () => {
    expect(
      pickMimeType((t) => {
        if (t.includes('opus')) throw new Error('boom')
        return t === 'audio/mp4'
      }),
    ).toBe('audio/mp4')
  })

  it('asks in the documented order', () => {
    const asked: string[] = []
    pickMimeType((t) => {
      asked.push(t)
      return false
    })
    expect(asked).toEqual([...PREFERRED_MIME_TYPES])
  })
})

describe('recording limits', () => {
  it('maps MIME types to upload extensions', () => {
    expect(fileExtension('audio/webm;codecs=opus')).toBe('webm')
    expect(fileExtension('audio/mp4')).toBe('mp4')
    expect(fileExtension('audio/mp4;codecs=mp4a.40.2')).toBe('mp4')
    expect(fileExtension('application/octet-stream')).toBe('bin')
  })

  it('caps the recording at the task time and the global limit', () => {
    expect(recordingLimitSeconds(60)).toBe(60)
    expect(recordingLimitSeconds(90)).toBe(90)
    expect(recordingLimitSeconds(600)).toBe(CAPS.maxAudioSeconds)
    expect(recordingLimitSeconds(undefined)).toBe(CAPS.maxAudioSeconds)
  })

  it('measures duration to a tenth of a second and never above the cap', () => {
    expect(durationSeconds(1000, 4260)).toBe(3.3)
    expect(durationSeconds(0, (CAPS.maxAudioSeconds + 0.4) * 1000)).toBe(CAPS.maxAudioSeconds)
    expect(durationSeconds(5000, 1000)).toBe(0)
  })

  it('checks size and length before upload', () => {
    expect(checkRecording(200_000, 45)).toBe('ok')
    expect(checkRecording(CAPS.maxAudioBytes, 60)).toBe('ok')
    expect(checkRecording(CAPS.maxAudioBytes + 1, 60)).toBe('too_large')
    expect(checkRecording(1000, CAPS.maxAudioSeconds + 1)).toBe('too_long')
    expect(checkRecording(0, 5)).toBe('too_short')
    expect(checkRecording(500, 0.4)).toBe('too_short')
  })
})
