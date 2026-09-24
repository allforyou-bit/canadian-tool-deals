'use client'

import Link from 'next/link'
import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from 'react'
import type { GradeResponse } from '../shared/api'
import { CAPS } from '../shared/config'
import type { TaskType } from '../shared/tasks'
import { api, ApiClientError } from '../lib/api'
import { useMe, useUiLang } from '../lib/hooks'
import { formatClock, formatDate, t, type UiKey } from '../lib/i18n'
import { activePass, refreshMe } from '../lib/me'
import { checkRecording, durationSeconds, fileExtension, pickMimeType, recordingLimitSeconds } from '../lib/recorder'
import { track } from '../lib/track'
import { loginHref } from '../lib/url'
import { GradeResultView } from './GradeResultView'
import { ErrorNotice, Notice } from './Notice'
import { ExplanationLangSelect, PromptPicker } from './PracticeControls'
import { cls } from './ui'

type Phase = 'idle' | 'requesting' | 'prep' | 'recording' | 'review' | 'submitting'

interface Recording {
  blob: Blob
  url: string
  seconds: number
  mimeType: string
}

const toClientError = (e: unknown) => (e instanceof ApiClientError ? e : new ApiClientError('internal', 0, 'Network error'))

function micErrorKey(e: unknown): UiKey {
  const name = e instanceof DOMException || e instanceof Error ? e.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') return 's.micDenied'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 's.noMic'
  return 's.micError'
}

/** Speaking task: prep countdown, recording with a hard stop, playback, then transcript feedback. */
export function SpeakingPractice(props: { task: TaskType }) {
  const { task } = props
  const lang = useUiLang()
  const meState = useMe()
  const prepSeconds = task.target.prepSeconds ?? 30
  const limit = recordingLimitSeconds(task.target.speakSeconds)
  const returnTo = `/practice/speaking/${task.id}/`

  const [promptIndex, setPromptIndex] = useState(0)
  // undefined until checked in the browser; null when recording is not possible
  const [mimeType, setMimeType] = useState<string | null | undefined>(undefined)
  const [phase, setPhase] = useState<Phase>('idle')
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [recording, setRecording] = useState<Recording | null>(null)
  const [notice, setNotice] = useState<UiKey | null>(null)
  const [error, setError] = useState<ApiClientError | null>(null)
  const [result, setResult] = useState<GradeResponse | null>(null)

  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startedAtRef = useRef(0)
  const stoppedAtRef = useRef(0)
  const urlRef = useRef<string | null>(null)
  const resultRef = useRef<HTMLHeadingElement>(null)
  // the control to focus after each phase change (the previous one is unmounted or disabled)
  const startRef = useRef<HTMLButtonElement>(null)
  const skipPrepRef = useRef<HTMLButtonElement>(null)
  const stopRef = useRef<HTMLButtonElement>(null)
  const submitRef = useRef<HTMLButtonElement>(null)
  const prevPhaseRef = useRef<Phase>('idle')

  const me = meState.status === 'ready' ? meState.me : null
  const pass = me ? activePass(me) : null

  useEffect(() => {
    const canRecord =
      typeof window.MediaRecorder !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function'
    setMimeType(canRecord ? pickMimeType((type) => MediaRecorder.isTypeSupported(type)) : null)
  }, [])

  function stopStream() {
    streamRef.current?.getTracks().forEach((tr) => tr.stop())
    streamRef.current = null
  }

  function replaceUrl(url: string | null) {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = url
  }

  // release the microphone and the playback URL when leaving the page
  useEffect(() => {
    return () => {
      const rec = recorderRef.current
      if (rec && rec.state !== 'inactive') {
        rec.onstop = null
        rec.stop()
      }
      stopStream()
      replaceUrl(null)
    }
  }, [])

  function finishRecording(rec: MediaRecorder) {
    const seconds = durationSeconds(startedAtRef.current, stoppedAtRef.current || Date.now())
    const type = rec.mimeType || mimeType || 'audio/webm'
    const blob = new Blob(chunksRef.current, { type })
    chunksRef.current = []
    recorderRef.current = null
    stopStream()
    const check = checkRecording(blob.size, seconds)
    if (check !== 'ok') {
      setNotice(check === 'too_short' ? 's.tooShort' : 's.tooLarge')
      setPhase('idle')
      return
    }
    const url = URL.createObjectURL(blob)
    replaceUrl(url)
    setRecording({ blob, url, seconds, mimeType: type })
    setPhase('review')
  }

  function beginRecording() {
    const stream = streamRef.current
    if (!stream || !mimeType) return
    let rec: MediaRecorder
    try {
      rec = new MediaRecorder(stream, { mimeType })
    } catch {
      try {
        rec = new MediaRecorder(stream)
      } catch {
        stopStream()
        setNotice('s.micError')
        setPhase('idle')
        return
      }
    }
    chunksRef.current = []
    rec.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data)
    }
    rec.onstop = () => finishRecording(rec)
    recorderRef.current = rec
    startedAtRef.current = Date.now()
    stoppedAtRef.current = 0
    rec.start(1000)
    setPhase('recording')
  }

  function stopRecording() {
    const rec = recorderRef.current
    if (!rec || rec.state === 'inactive') return
    stoppedAtRef.current = Date.now()
    rec.stop()
  }

  const onCountdownEnd = useEffectEvent((ended: 'prep' | 'recording') => {
    if (ended === 'prep') beginRecording()
    else stopRecording()
  })

  // Countdown for prep and recording. Recording has a hard stop at the task limit (≤ CAPS.maxAudioSeconds).
  useEffect(() => {
    if (phase !== 'prep' && phase !== 'recording') return
    const total = phase === 'prep' ? prepSeconds : limit
    const endsAt = Date.now() + total * 1000
    setSecondsLeft(total)
    const tick = window.setInterval(() => setSecondsLeft(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))), 250)
    const done = window.setTimeout(() => onCountdownEnd(phase), total * 1000)
    return () => {
      window.clearInterval(tick)
      window.clearTimeout(done)
    }
  }, [phase, prepSeconds, limit])

  useEffect(() => {
    if (result) resultRef.current?.focus()
  }, [result])

  // Keep keyboard and screen-reader users on the next primary control when a phase ends
  // (recording can also start and stop by itself when a countdown ends).
  useEffect(() => {
    const prev = prevPhaseRef.current
    prevPhaseRef.current = phase
    if (prev === phase) return
    if (phase === 'prep') skipPrepRef.current?.focus()
    else if (phase === 'recording') stopRef.current?.focus()
    else if (phase === 'review') submitRef.current?.focus()
    // back to the start (mic blocked, recording too short); after feedback the result heading takes focus
    else if (phase === 'idle' && prev !== 'submitting') startRef.current?.focus()
  }, [phase])

  async function start() {
    setNotice(null)
    setError(null)
    setPhase('requesting')
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (e) {
      setNotice(micErrorKey(e))
      setPhase('idle')
      return
    }
    if (!pass && me?.free.speaking) track('sample_start')
    setPhase('prep')
  }

  function reRecord() {
    replaceUrl(null)
    setRecording(null)
    setError(null)
    void start()
  }

  async function submit() {
    if (!recording) return
    setError(null)
    setPhase('submitting')
    try {
      const res = await api.gradeSpeaking({
        taskId: task.id,
        promptIndex,
        explanationLang: lang,
        audio: recording.blob,
        filename: `answer.${fileExtension(recording.mimeType)}`,
        durationSeconds: recording.seconds,
      })
      setResult(res)
      if (res.free) track('sample_done')
      void refreshMe({ force: true })
      setPhase('idle')
      replaceUrl(null)
      setRecording(null)
    } catch (err) {
      setError(toClientError(err))
      setPhase('review')
    }
  }

  function again() {
    setResult(null)
    setError(null)
    setNotice(null)
    window.scrollTo({ top: 0 })
    // the "Practise again" button is about to disappear; the start button is already on the page
    startRef.current?.focus({ preventScroll: true })
  }

  const busy = phase !== 'idle' && phase !== 'review'

  // Assertive: prep and recording start on a timer, so the learner must hear when to speak.
  const announcement =
    phase === 'prep'
      ? t(lang, 's.announcePrep')
      : phase === 'recording'
        ? t(lang, 's.announceRecording')
        : (phase === 'review' || phase === 'submitting') && recording
          ? t(lang, 's.announceStopped')
          : ''

  let recorder: ReactNode
  if (meState.status === 'loading' || mimeType === undefined) {
    recorder = <p className={cls.muted}>{t(lang, 'common.loading')}</p>
  } else if (meState.status === 'error') {
    recorder = <ErrorNotice error={meState.error} lang={lang} context="speaking" returnTo={returnTo} />
  } else if (!meState.me.signedIn) {
    recorder = (
      <Notice kind="info">
        <p>{t(lang, 's.signIn')}</p>
        <p className="mt-2">
          <Link href={loginHref(returnTo, lang)} className={cls.link}>
            {t(lang, 'common.signIn')}
          </Link>
        </p>
      </Notice>
    )
  } else if (mimeType === null) {
    recorder = <Notice kind="error">{t(lang, 's.unsupported')}</Notice>
  } else {
    recorder = (
      <div className="space-y-4">
        {pass ? (
          <p className={cls.muted}>{t(lang, 'p.passActive', { date: formatDate(pass.endsAt, lang) })}</p>
        ) : meState.me.free.speaking ? (
          <Notice kind="info">{t(lang, 's.freeSpeaking')}</Notice>
        ) : (
          <Notice kind="info">
            <p>{t(lang, 's.noFreeSpeaking')}</p>
            <p className="mt-2">
              <Link href={lang === 'ko' ? '/ko/pricing/' : '/pricing/'} className={cls.link}>
                {t(lang, 'common.seePricing')}
              </Link>
            </p>
          </Notice>
        )}
        {!meState.me.flags.gradingEnabled && <Notice kind="warn">{t(lang, 'p.paused')}</Notice>}

        <p className="text-slate-800">{t(lang, 's.timing', { prep: prepSeconds, speak: limit })}</p>

        {(phase === 'idle' || phase === 'requesting') && (
          <button
            ref={startRef}
            type="button"
            className={`${cls.btn} ${cls.primary}`}
            onClick={() => void start()}
            disabled={phase === 'requesting'}
          >
            {t(lang, 's.start')}
          </button>
        )}

        {phase === 'prep' && (
          <div className="flex flex-wrap items-center gap-4 rounded-md border border-slate-300 bg-white p-4">
            <p className="font-semibold text-slate-900">{t(lang, 's.prep')}</p>
            <span role="timer" aria-live="off" className="font-mono text-3xl tabular-nums">
              {formatClock(secondsLeft)}
            </span>
            <button ref={skipPrepRef} type="button" className={`${cls.btn} ${cls.primary}`} onClick={beginRecording}>
              {t(lang, 's.skipPrep')}
            </button>
          </div>
        )}

        {phase === 'recording' && (
          <div className="flex flex-wrap items-center gap-4 rounded-md border border-red-300 bg-red-50 p-4">
            <p className="flex items-center gap-2 font-semibold text-red-900">
              <span aria-hidden="true" className="inline-block size-3 animate-pulse rounded-full bg-red-600" />
              {t(lang, 's.recording')}
            </p>
            <span role="timer" aria-live="off" className="font-mono text-3xl tabular-nums text-red-950">
              {formatClock(secondsLeft)}
            </span>
            <button ref={stopRef} type="button" className={`${cls.btn} ${cls.danger}`} onClick={stopRecording}>
              {t(lang, 's.stop')}
            </button>
          </div>
        )}

        {(phase === 'review' || phase === 'submitting') && recording && (
          <div className="space-y-3 rounded-md border border-slate-300 bg-white p-4">
            <p className="text-slate-800">{t(lang, 's.review')}</p>
            <audio controls src={recording.url} className="w-full" aria-label={t(lang, 's.review')} />
            <p className={cls.muted}>{t(lang, 's.duration', { n: recording.seconds })}</p>
            <div className="flex flex-wrap gap-3">
              <button
                ref={submitRef}
                type="button"
                className={`${cls.btn} ${cls.primary}`}
                onClick={() => void submit()}
                disabled={phase === 'submitting'}
              >
                {t(lang, 'p.submit')}
              </button>
              <button type="button" className={`${cls.btn} ${cls.secondary}`} onClick={reRecord} disabled={phase === 'submitting'}>
                {t(lang, 's.reRecord')}
              </button>
            </div>
            {phase === 'submitting' && (
              <p role="status" className="text-sm text-slate-700">
                {t(lang, 'p.submitting')}
              </p>
            )}
          </div>
        )}

        <p className={cls.muted}>{t(lang, 's.privacy')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div role="note" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950" data-testid="transcript-notice">
        <p>{t('en', 's.notice')}</p>
        <p lang="ko" className="mt-1">
          {t('ko', 's.notice')}
        </p>
      </div>
      <ExplanationLangSelect lang={lang} disabled={busy} />
      <PromptPicker prompts={task.prompts} value={promptIndex} onChange={setPromptIndex} lang={lang} disabled={busy} />
      {recorder}
      <p className="sr-only" aria-live="assertive" data-testid="recorder-live">
        {announcement}
      </p>
      <div aria-live="polite" className="space-y-3">
        {notice && <Notice kind="error">{t(lang, notice, { mb: CAPS.maxAudioBytes / 1024 / 1024 })}</Notice>}
        {error && <ErrorNotice error={error} lang={lang} context="speaking" returnTo={returnTo} />}
      </div>
      {result && <GradeResultView ref={resultRef} response={result} kind="speaking" onAgain={again} />}
    </div>
  )
}
