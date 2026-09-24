'use client'

import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type Ref } from 'react'
import type { GradeResponse, Lang } from '../shared/api'
import { CAPS } from '../shared/config'
import type { TaskType } from '../shared/tasks'
import { api, ApiClientError } from '../lib/api'
import { useMe, useUiLang } from '../lib/hooks'
import { formatDate, t, type UiKey } from '../lib/i18n'
import { activePass, freeSample, refreshMe } from '../lib/me'
import { track } from '../lib/track'
import { countWords, wordStatus } from '../lib/words'
import { GradeResultView } from './GradeResultView'
import { LangToggle } from './LangToggle'
import { ErrorNotice, Notice, PricingNotice } from './Notice'
import { ExplanationLangSelect, PromptPicker } from './PracticeControls'
import { PracticeCtaPanel, PracticeModeSwitch, SelfCheck, usePracticeMode } from './PracticeMode'
import { PracticeTimer } from './PracticeTimer'
import { Turnstile } from './Turnstile'
import { cls } from './ui'

const toClientError = (e: unknown) => (e instanceof ApiClientError ? e : new ApiClientError('internal', 0, 'Network error'))

/** The answer box with its live word count; the same in both modes, so the text carries over. */
function WritingAnswer(props: {
  task: TaskType
  lang: Lang
  text: string
  onChange: (value: string) => void
  disabled?: boolean
  ref?: Ref<HTMLTextAreaElement>
}) {
  const { task, lang, text } = props
  const answerId = useId()
  const words = countWords(text)
  const status = wordStatus(words, task.target.minWords, task.target.maxWords)

  // Announced (politely) only when the range state changes, not on every word.
  const rangeAnnouncement = status.state === 'in' ? t(lang, 'w.inRange') : status.state === 'over' ? t(lang, 'w.overRange') : ''

  const countText =
    status.state === 'under'
      ? t(lang, 'w.under', { n: status.diff })
      : status.state === 'over'
        ? t(lang, 'w.over', { n: status.diff })
        : status.state === 'in'
          ? t(lang, 'w.inRange')
          : ''

  return (
    <div className="space-y-2">
      <label htmlFor={answerId} className={cls.label}>
        {t(lang, 'w.answer')}
      </label>
      <textarea
        ref={props.ref}
        id={answerId}
        name="answer"
        rows={14}
        maxLength={CAPS.maxEssayChars}
        value={text}
        onChange={(e) => props.onChange(e.target.value)}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="sentences"
        lang="en"
        aria-describedby={`${answerId}-count`}
        className={`${cls.input} min-h-72 font-serif leading-relaxed`}
        disabled={props.disabled}
      />
      <p id={`${answerId}-count`} className="flex flex-wrap gap-x-3 text-sm text-slate-700">
        <span className="font-semibold tabular-nums">{t(lang, 'w.words', { n: words })}</span>
        {task.target.minWords !== undefined && task.target.maxWords !== undefined && (
          <span>{t(lang, 'w.target', { min: task.target.minWords, max: task.target.maxWords })}</span>
        )}
        <span className={status.state === 'in' ? 'text-emerald-800' : ''}>{countText}</span>
      </p>
      <p className="sr-only" aria-live="polite" data-testid="word-range-live">
        {rangeAnnouncement}
      </p>
    </div>
  )
}

/**
 * Practice without feedback (memo §7.2 Z9): prompt, timer, word counter and a self-check list. Nothing is
 * sent; only the practice_start / practice_done events (no content). "Get AI feedback on this answer"
 * switches to the feedback mode with the answer kept.
 */
function WritingSelfPractice(props: {
  task: TaskType
  lang: Lang
  promptIndex: number
  onPromptChange: (i: number) => void
  text: string
  onTextChange: (value: string) => void
  onGetFeedback: () => void
}) {
  const { task, lang } = props
  const [done, setDone] = useState(false)
  const [round, setRound] = useState(0)
  const startedRef = useRef(false)
  const doneRef = useRef<HTMLHeadingElement>(null)
  const answerRef = useRef<HTMLTextAreaElement>(null)

  const started = () => {
    if (startedRef.current) return
    startedRef.current = true
    track('practice_start')
  }

  useEffect(() => {
    if (done) doneRef.current?.focus()
  }, [done])

  function finish() {
    started()
    setDone(true)
    track('practice_done')
  }

  function again() {
    props.onTextChange('')
    setDone(false)
    setRound((n) => n + 1)
    answerRef.current?.focus()
  }

  return (
    <div className="space-y-6" data-testid="writing-practice-mode">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-prose text-slate-800">{t(lang, 'pm.writingIntro')}</p>
        <LangToggle lang={lang} />
      </div>
      <PromptPicker prompts={task.prompts} value={props.promptIndex} onChange={props.onPromptChange} lang={lang} />
      {task.timerSeconds && <PracticeTimer key={round} seconds={task.timerSeconds} lang={lang} onStart={started} />}
      <WritingAnswer
        ref={answerRef}
        task={task}
        lang={lang}
        text={props.text}
        onChange={(value) => {
          props.onTextChange(value)
          if (value.trim()) started()
        }}
      />
      <SelfCheck kind="writing" lang={lang} resetKey={round} />
      {!done ? (
        <button type="button" className={`${cls.btn} ${cls.primary}`} onClick={finish}>
          {t(lang, 'pm.done')}
        </button>
      ) : (
        <div className="space-y-4">
          <h2 ref={doneRef} tabIndex={-1} className={`${cls.h2} focus:outline-none`}>
            {t(lang, 'pm.doneTitle')}
          </h2>
          <PracticeCtaPanel kind="writing" lang={lang} onGetFeedback={props.onGetFeedback} returnTo={`/practice/writing/${task.id}/`} />
          <button type="button" className={`${cls.btn} ${cls.secondary}`} onClick={again}>
            {t(lang, 'pm.again')}
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * Writing task: a choice between AI feedback (prompt, timer, answer with live word count, security
 * check when needed, feedback) and the free practice mode without feedback. The prompt and the answer
 * are shared, so an answer practised without feedback can then be sent for feedback.
 */
export function WritingPractice(props: { task: TaskType }) {
  const { task } = props
  const lang = useUiLang()
  const meState = useMe()
  const [mode, setMode] = usePracticeMode()
  const resultRef = useRef<HTMLHeadingElement>(null)
  const answerRef = useRef<HTMLTextAreaElement>(null)
  const adultId = useId()

  const [promptIndex, setPromptIndex] = useState(0)
  const [text, setText] = useState('')
  const [token, setToken] = useState<string | null>(null)
  const [adult, setAdult] = useState(false)
  const [resetSignal, setResetSignal] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<GradeResponse | null>(null)
  const [error, setError] = useState<ApiClientError | null>(null)
  const [localError, setLocalError] = useState<UiKey | null>(null)
  // after "Get AI feedback on this answer", the answer box takes focus in the feedback mode
  const focusAnswerRef = useRef(false)

  const startedRef = useRef(false)

  const me = meState.status === 'ready' ? meState.me : null
  const pass = me ? activePass(me) : null
  // Signed out, or signed in without a pass: this is the free sample and needs the security check.
  // While /api/me loads we wait; if it failed we assume the free path (the server decides anyway).
  const usesFreeSample = meState.status === 'loading' ? false : !pass
  // without a pass: is the free sample available, already used, or switched off for everyone?
  const free = me !== null && !pass ? freeSample(me, 'writing') : null
  const freeUsed = free === 'used'
  const freeOff = free === 'off'
  // Signed-out visitors confirm they are 18+ here (signed-in learners did so at sign-in; terms require 18+).
  const needsAdult = usesFreeSample && !(me?.signedIn ?? false)
  const paused = me !== null && !me.flags.gradingEnabled
  const returnTo = `/practice/writing/${task.id}/`
  const words = countWords(text)

  const onToken = useCallback((v: string | null) => setToken(v), [])

  // sample_start: an available free sample gets its first words in the feedback mode (typed there, or
  // brought over from the practice mode)
  useEffect(() => {
    if (mode !== 'feedback' || startedRef.current || free !== 'available' || !text.trim()) return
    startedRef.current = true
    track('sample_start')
  }, [mode, free, text])

  useEffect(() => {
    if (result) resultRef.current?.focus()
  }, [result])

  useEffect(() => {
    if (mode === 'feedback' && focusAnswerRef.current) {
      focusAnswerRef.current = false
      answerRef.current?.focus()
    }
  }, [mode])

  function onChange(value: string) {
    setText(value)
    setLocalError(null)
  }

  function getFeedback() {
    focusAnswerRef.current = true
    setMode('feedback')
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (submitting) return
    setError(null)
    if (words === 0) return setLocalError('w.empty')
    if (text.length > CAPS.maxEssayChars) return setLocalError('w.tooLong')
    if (needsAdult && !adult) return setLocalError('w.adultNeeded')
    if (usesFreeSample && !token) return setLocalError('p.securityNeeded')
    setLocalError(null)
    setSubmitting(true)
    try {
      const res = await api.gradeWriting({
        taskId: task.id,
        promptIndex,
        text,
        explanationLang: lang,
        ...(usesFreeSample && token ? { turnstileToken: token } : {}),
      })
      setResult(res)
      if (res.free) track('sample_done')
      void refreshMe({ force: true })
    } catch (err) {
      const clientError = toClientError(err)
      setError(clientError)
      // the free sample may have been used or switched off since /api/me loaded: update the notice
      // the sample may have been used or switched off, or grading paused (e.g. Anthropic credits), since /api/me loaded
      if (['free_unavailable', 'payment_required', 'grading_paused'].includes(clientError.code)) void refreshMe({ force: true })
    } finally {
      setSubmitting(false)
      // Turnstile tokens are single-use
      if (usesFreeSample) setResetSignal((n) => n + 1)
    }
  }

  function again() {
    setResult(null)
    setText('')
    setError(null)
    window.scrollTo({ top: 0 })
    // the "Practise again" button is about to disappear; continue in the answer box
    answerRef.current?.focus({ preventScroll: true })
  }

  return (
    <div className="space-y-6">
      <PracticeModeSwitch
        mode={mode}
        onChange={(m) => {
          setMode(m)
          setError(null)
          setLocalError(null)
        }}
        lang={lang}
        kind="writing"
        disabled={submitting}
      />

      {mode === 'practice' ? (
        <WritingSelfPractice
          task={task}
          lang={lang}
          promptIndex={promptIndex}
          onPromptChange={setPromptIndex}
          text={text}
          onTextChange={setText}
          onGetFeedback={getFeedback}
        />
      ) : (
        <>
          <form onSubmit={onSubmit} className="space-y-6" aria-busy={submitting} noValidate>
            <ExplanationLangSelect lang={lang} disabled={submitting} />
            <PromptPicker prompts={task.prompts} value={promptIndex} onChange={setPromptIndex} lang={lang} disabled={submitting} />
            {task.timerSeconds && <PracticeTimer seconds={task.timerSeconds} lang={lang} />}

            <WritingAnswer ref={answerRef} task={task} lang={lang} text={text} onChange={onChange} disabled={submitting} />

            {pass && <p className={cls.muted}>{t(lang, 'p.passActive', { date: formatDate(pass.endsAt, lang) })}</p>}
            {paused && <Notice kind="warn">{t(lang, 'p.paused')}</Notice>}
            {freeUsed && <Notice kind="info">{t(lang, 'p.freeUsed')}</Notice>}
            {freeOff && <PricingNotice text={t(lang, 'p.freeOff')} lang={lang} />}

            {usesFreeSample && (
              <div className="space-y-2">
                {!freeUsed && !freeOff && <p className={cls.muted}>{t(lang, 'p.freeWriting')}</p>}
                {needsAdult && (
                  <div className="flex items-start gap-3">
                    <input
                      id={`${adultId}-adult`}
                      type="checkbox"
                      required
                      checked={adult}
                      onChange={(e) => {
                        setAdult(e.target.checked)
                        if (e.target.checked && localError === 'w.adultNeeded') setLocalError(null)
                      }}
                      className={cls.checkbox}
                    />
                    <label htmlFor={`${adultId}-adult`} className="text-base text-slate-900">
                      {t(lang, 'l.adult')}
                    </label>
                  </div>
                )}
                <p className={cls.label}>{t(lang, 'p.securityCheck')}</p>
                <Turnstile lang={lang} onToken={onToken} resetSignal={resetSignal} />
              </div>
            )}

            {localError && <Notice kind="error">{t(lang, localError, { max: CAPS.maxEssayChars })}</Notice>}
            {error && (
              <ErrorNotice error={error} lang={lang} context="writing" returnTo={returnTo} hints={{ signedIn: me?.signedIn, freeOff }} />
            )}

            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" className={`${cls.btn} ${cls.primary}`} disabled={submitting}>
                {t(lang, 'p.submit')}
              </button>
              {submitting && (
                <p role="status" className="text-sm text-slate-700">
                  {t(lang, 'p.submitting')}
                </p>
              )}
            </div>
          </form>

          {result && <GradeResultView ref={resultRef} response={result} kind="writing" onAgain={again} />}
        </>
      )}
    </div>
  )
}
