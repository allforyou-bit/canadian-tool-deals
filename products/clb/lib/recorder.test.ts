import { describe, expect, it } from 'vitest'
import { CAPS } from '../shared/config'
import {
  checkRecording,
  durationSeconds,
  expectedBytes,
  fileExtension,
  nearSizeLimit,
  pickMimeType,
  PREFERRED_MIME_TYPES,
  recorderOptions,
  RECORDING_SIZE_MARGIN_BYTES,
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

  it('has no size cap for practice recordings that never leave the device', () => {
    expect(checkRecording(CAPS.maxAudioBytes * 5, 60, Infinity)).toBe('ok')
    expect(checkRecording(0, 60, Infinity)).toBe('too_short')
  })
})

describe('bitrate and upload size (memo §7.2 Z2)', () => {
  it('records at the configured low bitrate, with or without a chosen format', () => {
    expect(CAPS.recordingBitsPerSecond).toBe(32_000)
    expect(recorderOptions('audio/webm;codecs=opus')).toEqual({ mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 32_000 })
    expect(recorderOptions(null)).toEqual({ audioBitsPerSecond: 32_000 })
  })

  it('fits the longest answer in the 1 MB cap with room to spare', () => {
    expect(CAPS.maxAudioBytes).toBe(1024 * 1024)
    // 120 s at 32 kbps is 480,000 bytes: about half the cap
    expect(expectedBytes(CAPS.maxAudioSeconds)).toBe(480_000)
    expect(2 * expectedBytes(CAPS.maxAudioSeconds)).toBeLessThan(CAPS.maxAudioBytes)
    // the size guard does not stop a normal answer early
    expect(nearSizeLimit(expectedBytes(CAPS.maxAudioSeconds), expectedBytes(1))).toBe(false)
  })

  it('stops a recording before it outgrows the cap when a browser ignores the bitrate', () => {
    // 128 kbps (a browser default) passes 1 MB after about 65 s
    const perSecond = expectedBytes(1, 128_000)
    expect(nearSizeLimit(60 * perSecond, perSecond)).toBe(false)
    expect(nearSizeLimit(62 * perSecond, perSecond)).toBe(true)
    expect(nearSizeLimit(CAPS.maxAudioBytes - RECORDING_SIZE_MARGIN_BYTES, 1000)).toBe(true)
    // a large last piece widens the margin
    expect(nearSizeLimit(CAPS.maxAudioBytes - 200_000, 100_000)).toBe(true)
    expect(nearSizeLimit(100, 10, 1000)).toBe(true)
  })
})
