// Speaking recorder state machine shared by the feedback flow and the free practice mode
// (components/SpeakingPractice.tsx): microphone, preparation countdown, recording with a hard stop,
// playback. Nothing here uploads anything; the feedback flow sends `recording.blob` itself.
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { CAPS } from '../shared/config'
import type { UiKey } from './i18n'
import { checkRecording, durationSeconds, nearSizeLimit, pickMimeType, recorderOptions } from './recorder'

/**
 * idle → requesting (microphone prompt) → prep → recording → review. With `timersOnly` there is no
 * microphone: prep and speaking time run as plain countdowns and review has no recording.
 */
export type RecorderPhase = 'idle' | 'requesting' | 'prep' | 'recording' | 'review'

export interface Recording {
  blob: Blob
  url: string
  seconds: number
  mimeType: string
}

export function micErrorKey(e: unknown): UiKey {
  const name = e instanceof DOMException || e instanceof Error ? e.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') return 's.micDenied'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 's.noMic'
  return 's.micError'
}

/** The recording format this browser supports: undefined until checked, null when it cannot record. */
export function useRecordingMimeType(): string | null | undefined {
  const [mimeType, setMimeType] = useState<string | null | undefined>(undefined)
  useEffect(() => {
    const canRecord =
      typeof window.MediaRecorder !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function'
    setMimeType(canRecord ? pickMimeType((type) => MediaRecorder.isTypeSupported(type)) : null)
  }, [])
  return mimeType
}

export interface RecorderConfig {
  prepSeconds: number
  /** hard stop for the recording (≤ CAPS.maxAudioSeconds) */
  limitSeconds: number
  mimeType: string | null | undefined
  /**
   * true when the recording will be uploaded: it must stay under CAPS.maxAudioBytes, so recording stops
   * early near the cap. false for the practice mode (the recording never leaves the device).
   */
  upload: boolean
}

export interface RecorderControls {
  phase: RecorderPhase
  secondsLeft: number
  recording: Recording | null
  /** a problem (or, for 's.sizeStopped', information) to show next to the recorder */
  notice: UiKey | null
  setNotice: (key: UiKey | null) => void
  /** the current attempt runs without a microphone */
  timersOnly: boolean
  /** Ask for the microphone (unless `timersOnly`) and start the preparation countdown; false if the mic failed. */
  start: (opts?: { timersOnly?: boolean }) => Promise<boolean>
  /** end preparation early */
  beginSpeaking: () => void
  /** end the recording (or the speaking countdown) now */
  stop: () => void
  /** drop the recording and go back to idle */
  discard: () => void
}

export function useRecorder(config: RecorderConfig): RecorderControls {
  const { prepSeconds, limitSeconds, mimeType, upload } = config
  const [phase, setPhase] = useState<RecorderPhase>('idle')
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [recording, setRecording] = useState<Recording | null>(null)
  const [notice, setNotice] = useState<UiKey | null>(null)
  const [timersOnly, setTimersOnly] = useState(false)

  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const bytesRef = useRef(0)
  const sizeStopRef = useRef(false)
  const startedAtRef = useRef(0)
  const stoppedAtRef = useRef(0)
  const urlRef = useRef<string | null>(null)
  const timersOnlyRef = useRef(false)

  function stopStream() {
    streamRef.current?.getTracks().forEach((tr) => tr.stop())
    streamRef.current = null
  }

  function replaceUrl(url: string | null) {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = url
  }

  // release the microphone and the playback URL when leaving the page (or switching mode)
  useEffect(() => {
    return () => {
      const rec = recorderRef.current
      if (rec && rec.state !== 'inactive') {
        rec.onstop = null
        rec.ondataavailable = null
        rec.stop()
      }
      recorderRef.current = null
      streamRef.current?.getTracks().forEach((tr) => tr.stop())
      streamRef.current = null
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
      urlRef.current = null
    }
  }, [])

  function finishRecording(rec: MediaRecorder) {
    const seconds = durationSeconds(startedAtRef.current, stoppedAtRef.current || Date.now())
    const type = rec.mimeType || mimeType || 'audio/webm'
    const blob = new Blob(chunksRef.current, { type })
    chunksRef.current = []
    recorderRef.current = null
    stopStream()
    const check = checkRecording(blob.size, seconds, upload ? CAPS.maxAudioBytes : Infinity)
    if (check !== 'ok') {
      setNotice(check === 'too_short' ? 's.tooShort' : 's.tooLarge')
      setPhase('idle')
      return
    }
    setNotice(sizeStopRef.current ? 's.sizeStopped' : null)
    const url = URL.createObjectURL(blob)
    replaceUrl(url)
    setRecording({ blob, url, seconds, mimeType: type })
    setPhase('review')
  }

  function stop() {
    if (timersOnlyRef.current) {
      setPhase((p) => (p === 'recording' ? 'review' : p))
      return
    }
    const rec = recorderRef.current
    if (!rec || rec.state === 'inactive') return
    stoppedAtRef.current = Date.now()
    rec.stop()
  }

  function beginSpeaking() {
    if (timersOnlyRef.current) {
      setPhase('recording')
      return
    }
    const stream = streamRef.current
    if (!stream || !mimeType) return
    let rec: MediaRecorder | null = null
    // the requested bitrate first; then without the format; then the browser's defaults
    for (const options of [recorderOptions(mimeType), recorderOptions(null), undefined]) {
      try {
        rec = new MediaRecorder(stream, options)
        break
      } catch {
        rec = null
      }
    }
    if (!rec) {
      stopStream()
      setNotice('s.micError')
      setPhase('idle')
      return
    }
    const recorder = rec
    chunksRef.current = []
    bytesRef.current = 0
    sizeStopRef.current = false
    recorder.ondataavailable = (ev) => {
      if (!ev.data || ev.data.size === 0) return
      chunksRef.current.push(ev.data)
      bytesRef.current += ev.data.size
      if (upload && recorder.state === 'recording' && nearSizeLimit(bytesRef.current, ev.data.size)) {
        sizeStopRef.current = true
        stop()
      }
    }
    recorder.onstop = () => finishRecording(recorder)
    recorderRef.current = recorder
    startedAtRef.current = Date.now()
    stoppedAtRef.current = 0
    recorder.start(1000)
    setPhase('recording')
  }

  const onCountdownEnd = useEffectEvent((ended: 'prep' | 'recording') => {
    if (ended === 'prep') beginSpeaking()
    else stop()
  })

  // Countdown for prep and recording. Recording has a hard stop at the task limit (≤ CAPS.maxAudioSeconds).
  useEffect(() => {
    if (phase !== 'prep' && phase !== 'recording') return
    const total = phase === 'prep' ? prepSeconds : limitSeconds
    const endsAt = Date.now() + total * 1000
    setSecondsLeft(total)
    const tick = window.setInterval(() => setSecondsLeft(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))), 250)
    const done = window.setTimeout(() => onCountdownEnd(phase), total * 1000)
    return () => {
      window.clearInterval(tick)
      window.clearTimeout(done)
    }
  }, [phase, prepSeconds, limitSeconds])

  async function start(opts: { timersOnly?: boolean } = {}): Promise<boolean> {
    setNotice(null)
    replaceUrl(null)
    setRecording(null)
    const noMic = opts.timersOnly === true
    timersOnlyRef.current = noMic
    setTimersOnly(noMic)
    if (noMic) {
      setPhase('prep')
      return true
    }
    setPhase('requesting')
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (e) {
      setNotice(micErrorKey(e))
      setPhase('idle')
      return false
    }
    setPhase('prep')
    return true
  }

  function discard() {
    replaceUrl(null)
    setRecording(null)
    setPhase('idle')
  }

  return { phase, secondsLeft, recording, notice, setNotice, timersOnly, start, beginSpeaking, stop, discard }
}
