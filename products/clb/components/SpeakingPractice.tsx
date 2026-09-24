'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import type { GradeResponse, Lang } from '../shared/api'
import { CAPS } from '../shared/config'
import type { TaskType } from '../shared/tasks'
import { api, ApiClientError } from '../lib/api'
import { useMe, useUiLang } from '../lib/hooks'
import { formatClock, formatDate, formatTime, t, type UiKey } from '../lib/i18n'
import { activePass, freeSample, refreshMe, speakingStatus } from '../lib/me'
import { nextUtcMidnight } from '../lib/practice'
import { fileExtension, recordingLimitSeconds } from '../lib/recorder'
import { track } from '../lib/track'
import { loginHref } from '../lib/url'
import { useRecorder, useRecordingMimeType, type RecorderControls, type RecorderPhase } from '../lib/use-recorder'
import { GradeResultView } from './GradeResultView'
import { LangToggle } from './LangToggle'
import { ErrorNotice, Notice, PricingNotice } from './Notice'
import { ExplanationLangSelect, PromptPicker } from './PracticeControls'
import { PracticeCtaPanel, PracticeModeSwitch, SelfCheck, usePracticeMode } from './PracticeMode'
import { cls } from './ui'

const toClientError = (e: unknown) => (e instanceof ApiClientError ? e : new ApiClientError('internal', 0, 'Network error'))

const MB = CAPS.maxAudioBytes / 1024 / 1024

interface FocusTargets {
  idle: RefObject<HTMLElement | null>
  prep: RefObject<HTMLElement | null>
  recording: RefObject<HTMLElement | null>
  review: RefObject<HTMLElement | null>
}

/**
 * Keep keyboard and screen-reader users on the next primary control when a phase ends (recording can
 * also start and stop by itself when a countdown ends). `skipIdle` is set by the caller when focus
 * belongs elsewhere after returning to idle (the feedback heading after a successful submission).
 */
function usePhaseFocus(phase: RecorderPhase, targets: FocusTargets, skipIdle: RefObject<boolean>) {
  const prevRef = useRef<RecorderPhase>(phase)
  useEffect(() => {
    const prev = prevRef.current
    prevRef.current = phase
    if (prev === phase) return
    if (phase === 'prep') targets.prep.current?.focus()
    else if (phase === 'recording') targets.recording.current?.focus()
    else if (phase === 'review') targets.review.current?.focus()
    else if (phase === 'idle') {
      if (skipIdle.current) skipIdle.current = false
      else targets.idle.current?.focus()
    }
    // the refs are stable; only a phase change moves focus
  }, [phase])
}

/** Report whether a timed phase or an upload is running, so the mode switch can wait. */
function useBusyReport(busy: boolean, onBusyChange: (busy: boolean) => void) {
  useEffect(() => {
    onBusyChange(busy)
  }, [busy, onBusyChange])
  useEffect(() => () => onBusyChange(false), [onBusyChange])
}

function PrepPanel(props: { lang: Lang; rec: RecorderControls; skipRef: RefObject<HTMLButtonElement | null> }) {
  const { lang, rec } = props
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-md border border-slate-300 bg-white p-4">
      <p className="font-semibold text-slate-900">{t(lang, 's.prep')}</p>
      <span role="timer" aria-live="off" className="font-mono text-3xl tabular-nums">
        {formatClock(rec.secondsLeft)}
      </span>
      <button ref={props.skipRef} type="button" className={`${cls.btn} ${cls.primary}`} onClick={rec.beginSpeaking}>
        {t(lang, 's.skipPrep')}
      </button>
    </div>
  )
}

function SpeakingPanel(props: { lang: Lang; rec: RecorderControls; stopRef: RefObject<HTMLButtonElement | null> }) {
  const { lang, rec } = props
  if (rec.timersOnly) {
    return (
      <div className="flex flex-wrap items-center gap-4 rounded-md border border-slate-300 bg-white p-4">
        <p className="font-semibold text-slate-900">{t(lang, 'pm.speakingTime')}</p>
        <span role="timer" aria-live="off" className="font-mono text-3xl tabular-nums">
          {formatClock(rec.secondsLeft)}
        </span>
        <button ref={props.stopRef} type="button" className={`${cls.btn} ${cls.secondary}`} onClick={rec.stop}>
          {t(lang, 'pm.stopSpeaking')}
        </button>
      </div>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-md border border-red-300 bg-red-50 p-4">
      <p className="flex items-center gap-2 font-semibold text-red-900">
        <span aria-hidden="true" className="inline-block size-3 animate-pulse rounded-full bg-red-600" />
        {t(lang, 's.recording')}
      </p>
      <span role="timer" aria-live="off" className="font-mono text-3xl tabular-nums text-red-950">
        {formatClock(rec.secondsLeft)}
      </span>
      <button ref={props.stopRef} type="button" className={`${cls.btn} ${cls.danger}`} onClick={rec.stop}>
        {t(lang, 's.stop')}
      </button>
    </div>
  )
}

/** The recorder's own message: a size stop is information; everything else is a problem. */
function RecorderNotice(props: { lang: Lang; notice: UiKey | null }) {
  if (!props.notice) return null
  return (
    <Notice kind={props.notice === 's.sizeStopped' ? 'info' : 'error'}>{t(props.lang, props.notice, { mb: MB })}</Notice>
  )
}

interface ModeProps {
  task: TaskType
  lang: Lang
  promptIndex: number
  onPromptChange: (i: number) => void
  mimeType: string | null | undefined
  prepSeconds: number
  limit: number
  onBusyChange: (busy: boolean) => void
  /** switch to the other mode */
  onSwitch: () => void
}

/**
 * Grading is paused (the owner's switch, the spend tiers or Anthropic credits used up): no reopening time is
 * known, and active passes are extended by the pause. Offer the practice mode.
 */
function SpeakingPaused(props: { lang: Lang; onPractise: () => void }) {
  const { lang } = props
  return (
    <Notice kind="warn">
      <div data-testid="speaking-paused">
        <p>{t(lang, 'p.paused')}</p>
        <button type="button" className={`${cls.btn} ${cls.secondary} mt-3`} onClick={props.onPractise}>
          {t(lang, 'pm.practice')}
        </button>
      </div>
    </Notice>
  )
}

/** "Closed for today" and when it opens again, in the learner's time. */
function ClosedToday(props: { lang: Lang }) {
  const { lang } = props
  const opensAt = formatTime(nextUtcMidnight().toISOString(), lang)
  return (
    <>
      <p>{t(lang, 's.closedToday')}</p>
      <p className="mt-1">{t(lang, 's.opensAt', { time: opensAt })}</p>
    </>
  )
}

/** Speaking closed for today (site-wide budget used up, grading on): say when it opens, and offer the practice mode. */
function SpeakingClosed(props: { lang: Lang; onPractise: () => void }) {
  const { lang } = props
  return (
    <Notice kind="warn">
      <div data-testid="speaking-closed">
        <ClosedToday lang={lang} />
        <button type="button" className={`${cls.btn} ${cls.secondary} mt-3`} onClick={props.onPractise}>
          {t(lang, 'pm.practice')}
        </button>
      </div>
    </Notice>
  )
}

/** Feedback mode: prep countdown, recording with a hard stop, playback, then transcript feedback. */
function SpeakingFeedback(props: ModeProps) {
  const { task, lang, promptIndex, prepSeconds, limit } = props
  const meState = useMe()
  const returnTo = `/practice/speaking/${task.id}/`
  const rec = useRecorder({ prepSeconds, limitSeconds: limit, mimeType: props.mimeType, upload: true })

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<ApiClientError | null>(null)
  const [result, setResult] = useState<GradeResponse | null>(null)
  // bumped after a failed submission: focus returns to "Get feedback" once it is enabled again
  const [refocus, setRefocus] = useState(0)

  const resultRef = useRef<HTMLHeadingElement>(null)
  const startRef = useRef<HTMLButtonElement>(null)
  const skipPrepRef = useRef<HTMLButtonElement>(null)
  const stopRef = useRef<HTMLButtonElement>(null)
  const submitRef = useRef<HTMLButtonElement>(null)
  const skipIdleFocus = useRef(false)

  const me = meState.status === 'ready' ? meState.me : null
  const pass = me ? activePass(me) : null
  // without a pass: is the free sample available, already used, or switched off for everyone?
  const free = me !== null && !pass ? freeSample(me, 'speaking') : null
  // a grading pause, or the site-wide daily speaking budget used up (memo §7.2 Z2); unknown while loading counts as open
  const status = me ? speakingStatus(me) : 'open'
  const open = status === 'open'

  const busy = rec.phase === 'requesting' || rec.phase === 'prep' || rec.phase === 'recording' || submitting
  useBusyReport(busy, props.onBusyChange)
  usePhaseFocus(rec.phase, { idle: startRef, prep: skipPrepRef, recording: stopRef, review: submitRef }, skipIdleFocus)

  useEffect(() => {
    if (result) resultRef.current?.focus()
  }, [result])

  useEffect(() => {
    if (refocus > 0) submitRef.current?.focus()
  }, [refocus])

  async function start() {
    setError(null)
    const ok = await rec.start()
    if (ok && free === 'available') track('sample_start')
  }

  async function submit() {
    const recording = rec.recording
    if (!recording || submitting) return
    setError(null)
    setSubmitting(true)
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
      // focus goes to the feedback heading, not back to the start button
      skipIdleFocus.current = true
      rec.discard()
    } catch (err) {
      const clientError = toClientError(err)
      setError(clientError)
      // the free sample may have been used or switched off, speaking closed for the day, or grading paused (e.g.
      // Anthropic credits used up), since /api/me loaded
      if (['free_unavailable', 'payment_required', 'at_capacity', 'grading_paused'].includes(clientError.code)) {
        void refreshMe({ force: true })
      }
      setRefocus((n) => n + 1)
    } finally {
      setSubmitting(false)
    }
  }

  function again() {
    setResult(null)
    setError(null)
    rec.setNotice(null)
    window.scrollTo({ top: 0 })
    // the "Practise again" button is about to disappear; the start button is already on the page
    startRef.current?.focus({ preventScroll: true })
  }

  // Assertive: prep and recording start on a timer, so the learner must hear when to speak.
  const announcement =
    rec.phase === 'prep'
      ? t(lang, 's.announcePrep')
      : rec.phase === 'recording'
        ? t(lang, 's.announceRecording')
        : rec.phase === 'review' && rec.recording
          ? t(lang, 's.announceStopped')
          : ''

  let recorder: ReactNode
  if (meState.status === 'loading' || props.mimeType === undefined) {
    recorder = <p className={cls.muted}>{t(lang, 'common.loading')}</p>
  } else if (meState.status === 'error') {
    recorder = <ErrorNotice error={meState.error} lang={lang} context="speaking" returnTo={returnTo} />
  } else if (status === 'paused' && rec.phase === 'idle') {
    // Only while nothing is in progress: an attempt that started before the pause (or closure) was known keeps its
    // panel with its Stop button (the hook's timers and microphone run whatever is rendered), and a take can still
    // be played. A pause is not a capacity closure: never "closed for today … 00:00 UTC" (passes are extended instead).
    recorder = <SpeakingPaused lang={lang} onPractise={props.onSwitch} />
  } else if (status === 'closed' && rec.phase === 'idle') {
    recorder = <SpeakingClosed lang={lang} onPractise={props.onSwitch} />
  } else if (!meState.me.signedIn) {
    recorder = (
      <Notice kind="info">
        <p>{t(lang, free === 'off' ? 's.signInFreeOff' : 's.signIn')}</p>
        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link href={loginHref(returnTo, lang)} className={cls.link}>
            {t(lang, 'common.signIn')}
          </Link>
          <button type="button" className={cls.link} onClick={props.onSwitch}>
            {t(lang, 'pm.practice')}
          </button>
        </p>
      </Notice>
    )
  } else if (props.mimeType === null) {
    recorder = <Notice kind="error">{t(lang, 's.unsupported')}</Notice>
  } else {
    const phase = rec.phase
    recorder = (
      <div className="space-y-4">
        {pass ? (
          <p className={cls.muted}>{t(lang, 'p.passActive', { date: formatDate(pass.endsAt, lang) })}</p>
        ) : free === 'available' ? (
          <Notice kind="info">{t(lang, 's.freeSpeaking')}</Notice>
        ) : (
          <PricingNotice text={t(lang, free === 'off' ? 'p.freeOff' : 's.noFreeSpeaking')} lang={lang} />
        )}
        {/* paused or closed while an attempt runs or a take waits: say why sending (and a new take) is off */}
        {status === 'paused' && <Notice kind="warn">{t(lang, 'p.paused')}</Notice>}
        {status === 'closed' && (
          <Notice kind="warn">
            <ClosedToday lang={lang} />
          </Notice>
        )}

        <p className="text-slate-800">{t(lang, 's.timing', { prep: prepSeconds, speak: limit })}</p>

        {(phase === 'idle' || phase === 'requesting') && (
          <button ref={startRef} type="button" className={`${cls.btn} ${cls.primary}`} onClick={() => void start()} disabled={phase === 'requesting'}>
            {t(lang, 's.start')}
          </button>
        )}

        {phase === 'prep' && <PrepPanel lang={lang} rec={rec} skipRef={skipPrepRef} />}
        {phase === 'recording' && <SpeakingPanel lang={lang} rec={rec} stopRef={stopRef} />}

        {phase === 'review' && rec.recording && (
          <div className="space-y-3 rounded-md border border-slate-300 bg-white p-4">
            <p className="text-slate-800">{t(lang, 's.review')}</p>
            <audio controls src={rec.recording.url} className="w-full" aria-label={t(lang, 's.review')} />
            <p className={cls.muted}>{t(lang, 's.duration', { n: rec.recording.seconds })}</p>
            <div className="flex flex-wrap gap-3">
              <button
                ref={submitRef}
                type="button"
                className={`${cls.btn} ${cls.primary}`}
                onClick={() => void submit()}
                disabled={submitting || !open}
              >
                {t(lang, 'p.submit')}
              </button>
              {/* no new take while feedback is paused or closed: it could never be sent */}
              <button type="button" className={`${cls.btn} ${cls.secondary}`} onClick={() => void start()} disabled={submitting || !open}>
                {t(lang, 's.reRecord')}
              </button>
            </div>
            {submitting && (
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
      <PromptPicker prompts={task.prompts} value={promptIndex} onChange={props.onPromptChange} lang={lang} disabled={busy} />
      {recorder}
      <p className="sr-only" aria-live="assertive" data-testid="recorder-live">
        {announcement}
      </p>
      <div aria-live="polite" className="space-y-3">
        <RecorderNotice lang={lang} notice={rec.notice} />
        {error && (
          <ErrorNotice
            error={error}
            lang={lang}
            context="speaking"
            returnTo={returnTo}
            hints={{ signedIn: me?.signedIn, freeOff: free === 'off' }}
          />
        )}
      </div>
      {result && <GradeResultView ref={resultRef} response={result} kind="speaking" onAgain={again} />}
    </div>
  )
}

/**
 * Practice without feedback (memo §7.2 Z9): prep and speaking timers, a recording that plays back in
 * this browser only (never uploaded, no sign-in), a self-check list and the call to action. Without a
 * usable microphone the same timers run on their own.
 */
function SpeakingSelfPractice(props: ModeProps) {
  const { task, lang, promptIndex, prepSeconds, limit } = props
  const rec = useRecorder({ prepSeconds, limitSeconds: limit, mimeType: props.mimeType, upload: false })
  const [round, setRound] = useState(0)

  const startRef = useRef<HTMLButtonElement>(null)
  const skipPrepRef = useRef<HTMLButtonElement>(null)
  const stopRef = useRef<HTMLButtonElement>(null)
  const againRef = useRef<HTMLButtonElement>(null)
  const noSkip = useRef(false)

  const phase = rec.phase
  const busy = phase === 'requesting' || phase === 'prep' || phase === 'recording'
  useBusyReport(busy, props.onBusyChange)
  usePhaseFocus(phase, { idle: startRef, prep: skipPrepRef, recording: stopRef, review: againRef }, noSkip)

  // practice_done: one answer finished (the recording stopped or the speaking time ended); no content is sent
  useEffect(() => {
    if (phase === 'review') track('practice_done')
  }, [phase])

  async function start(timersOnly = false) {
    setRound((n) => n + 1)
    if (await rec.start({ timersOnly })) track('practice_start')
  }

  const micProblem = rec.notice === 's.micDenied' || rec.notice === 's.noMic' || rec.notice === 's.micError'
  // after a failed microphone, or in a browser that cannot record, the timers still work on their own
  const offerTimersOnly = props.mimeType === null || micProblem

  const announcement =
    phase === 'prep'
      ? t(lang, rec.timersOnly ? 'pm.announcePrep' : 's.announcePrep')
      : phase === 'recording'
        ? t(lang, rec.timersOnly ? 'pm.announceSpeaking' : 's.announceRecording')
        : phase === 'review'
          ? t(lang, rec.timersOnly ? 'pm.timeUp' : 'pm.announceStopped')
          : ''

  return (
    <div className="space-y-6" data-testid="speaking-practice-mode">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-prose text-slate-800">{t(lang, 'pm.speakingIntro')}</p>
        <LangToggle lang={lang} />
      </div>
      <PromptPicker prompts={task.prompts} value={promptIndex} onChange={props.onPromptChange} lang={lang} disabled={busy} />
      <p className="text-slate-800">{t(lang, 's.timing', { prep: prepSeconds, speak: limit })}</p>

      {props.mimeType === undefined ? (
        <p className={cls.muted}>{t(lang, 'common.loading')}</p>
      ) : (
        (phase === 'idle' || phase === 'requesting') && (
          <div className="space-y-3">
            {props.mimeType === null && <Notice kind="info">{t(lang, 'pm.timersOnlyNote')}</Notice>}
            <div className="flex flex-wrap gap-3">
              {props.mimeType !== null && (
                <button ref={startRef} type="button" className={`${cls.btn} ${cls.primary}`} onClick={() => void start()} disabled={phase === 'requesting'}>
                  {t(lang, 's.start')}
                </button>
              )}
              {offerTimersOnly && (
                <button
                  ref={props.mimeType === null ? startRef : undefined}
                  type="button"
                  className={`${cls.btn} ${props.mimeType === null ? cls.primary : cls.secondary}`}
                  onClick={() => void start(true)}
                >
                  {t(lang, 'pm.timersOnly')}
                </button>
              )}
            </div>
          </div>
        )
      )}

      {phase === 'prep' && <PrepPanel lang={lang} rec={rec} skipRef={skipPrepRef} />}
      {phase === 'recording' && <SpeakingPanel lang={lang} rec={rec} stopRef={stopRef} />}

      {phase === 'review' && (
        <div className="space-y-4">
          <div className="space-y-3 rounded-md border border-slate-300 bg-white p-4">
            {rec.recording ? (
              <>
                <p className="text-slate-800">{t(lang, 'pm.localPlayback')}</p>
                <audio controls src={rec.recording.url} className="w-full" aria-label={t(lang, 'pm.localPlayback')} data-testid="practice-audio" />
                <p className={cls.muted}>{t(lang, 's.duration', { n: rec.recording.seconds })}</p>
              </>
            ) : (
              <p className="text-slate-800">{t(lang, 'pm.timeUp')}</p>
            )}
            <button ref={againRef} type="button" className={`${cls.btn} ${cls.secondary}`} onClick={() => void start(rec.timersOnly)}>
              {t(lang, rec.recording ? 's.reRecord' : 'pm.again')}
            </button>
          </div>
          <SelfCheck kind="speaking" lang={lang} resetKey={round} />
          <PracticeCtaPanel kind="speaking" lang={lang} onGetFeedback={props.onSwitch} returnTo={`/practice/speaking/${task.id}/`} />
        </div>
      )}

      <p className={cls.muted}>{t(lang, 'pm.practiceNoteSpeaking')}</p>
      <p className="sr-only" aria-live="assertive" data-testid="practice-live">
        {announcement}
      </p>
      <div aria-live="polite">
        <RecorderNotice lang={lang} notice={rec.notice} />
      </div>
    </div>
  )
}

/**
 * Speaking task: AI feedback on a recording (sign-in needed; paused while grading is paused; closed for the day
 * when the site-wide speaking budget is used up), or the free practice mode whose recording never leaves the device.
 */
export function SpeakingPractice(props: { task: TaskType }) {
  const { task } = props
  const lang = useUiLang()
  const [mode, setMode] = usePracticeMode()
  const [promptIndex, setPromptIndex] = useState(0)
  const [busy, setBusy] = useState(false)
  const mimeType = useRecordingMimeType()

  const common = {
    task,
    lang,
    promptIndex,
    onPromptChange: setPromptIndex,
    mimeType,
    prepSeconds: task.target.prepSeconds ?? 30,
    limit: recordingLimitSeconds(task.target.speakSeconds),
    onBusyChange: setBusy,
  }

  return (
    <div className="space-y-6">
      <PracticeModeSwitch mode={mode} onChange={setMode} lang={lang} kind="speaking" disabled={busy} />
      {mode === 'feedback' ? (
        <SpeakingFeedback {...common} onSwitch={() => setMode('practice')} />
      ) : (
        <SpeakingSelfPractice {...common} onSwitch={() => setMode('feedback')} />
      )}
    </div>
  )
}
