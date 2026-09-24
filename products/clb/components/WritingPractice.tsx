'use client'

import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react'
import type { GradeResponse } from '../shared/api'
import { CAPS } from '../shared/config'
import type { TaskType } from '../shared/tasks'
import { api, ApiClientError } from '../lib/api'
import { useMe, useUiLang } from '../lib/hooks'
import { formatDate, t, type UiKey } from '../lib/i18n'
import { activePass, refreshMe } from '../lib/me'
import { track } from '../lib/track'
import { countWords, wordStatus } from '../lib/words'
import { GradeResultView } from './GradeResultView'
import { ErrorNotice, Notice } from './Notice'
import { ExplanationLangSelect, PromptPicker } from './PracticeControls'
import { PracticeTimer } from './PracticeTimer'
import { Turnstile } from './Turnstile'
import { cls } from './ui'

const toClientError = (e: unknown) => (e instanceof ApiClientError ? e : new ApiClientError('internal', 0, 'Network error'))

/** Writing task: prompt, timer, answer with live word count, security check when needed, feedback. */
export function WritingPractice(props: { task: TaskType }) {
  const { task } = props
  const lang = useUiLang()
  const meState = useMe()
  const answerId = useId()
  const resultRef = useRef<HTMLHeadingElement>(null)

  const [promptIndex, setPromptIndex] = useState(0)
  const [text, setText] = useState('')
  const [token, setToken] = useState<string | null>(null)
  const [resetSignal, setResetSignal] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<GradeResponse | null>(null)
  const [error, setError] = useState<ApiClientError | null>(null)
  const [localError, setLocalError] = useState<UiKey | null>(null)

  const startedRef = useRef(false)

  const me = meState.status === 'ready' ? meState.me : null
  const pass = me ? activePass(me) : null
  // Signed out, or signed in without a pass: this is the free sample and needs the security check.
  // While /api/me loads we wait; if it failed we assume the free path (the server decides anyway).
  const usesFreeSample = meState.status === 'loading' ? false : !pass
  const freeUsed = me !== null && !pass && !me.free.writing
  const paused = me !== null && !me.flags.gradingEnabled
  const returnTo = `/practice/writing/${task.id}/`

  const words = countWords(text)
  const status = wordStatus(words, task.target.minWords, task.target.maxWords)
  const onToken = useCallback((v: string | null) => setToken(v), [])

  function onChange(value: string) {
    setText(value)
    setLocalError(null)
    // sample_start: first keystroke of an available free sample
    if (!startedRef.current && me && !pass && me.free.writing && value.trim()) {
      startedRef.current = true
      track('sample_start')
    }
  }

  useEffect(() => {
    if (result) resultRef.current?.focus()
  }, [result])

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (submitting) return
    setError(null)
    if (words === 0) return setLocalError('w.empty')
    if (text.length > CAPS.maxEssayChars) return setLocalError('w.tooLong')
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
      void refreshMe()
    } catch (err) {
      setError(toClientError(err))
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
  }

  const countText =
    status.state === 'under'
      ? t(lang, 'w.under', { n: status.diff })
      : status.state === 'over'
        ? t(lang, 'w.over', { n: status.diff })
        : status.state === 'in'
          ? t(lang, 'w.inRange')
          : ''

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="space-y-6" aria-busy={submitting} noValidate>
        <ExplanationLangSelect lang={lang} disabled={submitting} />
        <PromptPicker prompts={task.prompts} value={promptIndex} onChange={setPromptIndex} lang={lang} disabled={submitting} />
        {task.timerSeconds && <PracticeTimer seconds={task.timerSeconds} lang={lang} />}

        <div className="space-y-2">
          <label htmlFor={answerId} className={cls.label}>
            {t(lang, 'w.answer')}
          </label>
          <textarea
            id={answerId}
            name="answer"
            rows={14}
            maxLength={CAPS.maxEssayChars}
            value={text}
            onChange={(e) => onChange(e.target.value)}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="sentences"
            lang="en"
            aria-describedby={`${answerId}-count`}
            className={`${cls.input} min-h-72 font-serif leading-relaxed`}
            disabled={submitting}
          />
          <p id={`${answerId}-count`} className="flex flex-wrap gap-x-3 text-sm text-slate-700" aria-live="polite">
            <span className="font-semibold tabular-nums">{t(lang, 'w.words', { n: words })}</span>
            {task.target.minWords !== undefined && task.target.maxWords !== undefined && (
              <span>{t(lang, 'w.target', { min: task.target.minWords, max: task.target.maxWords })}</span>
            )}
            <span className={status.state === 'in' ? 'text-emerald-800' : ''}>{countText}</span>
          </p>
        </div>

        {pass && <p className={cls.muted}>{t(lang, 'p.passActive', { date: formatDate(pass.endsAt, lang) })}</p>}
        {paused && <Notice kind="warn">{t(lang, 'p.paused')}</Notice>}
        {freeUsed && <Notice kind="info">{t(lang, 'p.freeUsed')}</Notice>}

        {usesFreeSample && (
          <div className="space-y-2">
            {!freeUsed && <p className={cls.muted}>{t(lang, 'p.freeWriting')}</p>}
            <p className={cls.label}>{t(lang, 'p.securityCheck')}</p>
            <Turnstile lang={lang} onToken={onToken} resetSignal={resetSignal} />
          </div>
        )}

        {localError && <Notice kind="error">{t(lang, localError, { max: CAPS.maxEssayChars })}</Notice>}
        {error && <ErrorNotice error={error} lang={lang} context="writing" returnTo={returnTo} />}

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
    </div>
  )
}
