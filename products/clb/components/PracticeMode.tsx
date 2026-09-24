'use client'

// Free practice mode (memo §7.2 Z9): the mode switch, the self-check list and the call to action that
// the writing and speaking pages share. Nothing here talks to the server except the analytics events
// the pages send (no content).
import Link from 'next/link'
import { useEffect, useId, useState } from 'react'
import type { Lang } from '../shared/api'
import type { TaskKind } from '../shared/tasks'
import { useMe } from '../lib/hooks'
import { t } from '../lib/i18n'
import { activePass } from '../lib/me'
import { practiceCta, practiceModeFromSearch, SELF_CHECK, type PracticeMode } from '../lib/practice'
import { loginHref } from '../lib/url'
import { cls } from './ui'

/** 'feedback' by default; `?mode=practice` in the address opens the practice mode. */
export function usePracticeMode(): [PracticeMode, (mode: PracticeMode) => void] {
  const [mode, setMode] = useState<PracticeMode>('feedback')
  useEffect(() => {
    const asked = practiceModeFromSearch(window.location.search)
    if (asked) setMode(asked)
  }, [])
  return [mode, setMode]
}

/** "Get AI feedback" / "Practise without feedback", above the task's inputs. */
export function PracticeModeSwitch(props: {
  mode: PracticeMode
  onChange: (mode: PracticeMode) => void
  lang: Lang
  kind: TaskKind
  disabled?: boolean
}) {
  const { mode, onChange, lang, kind } = props
  const name = useId()
  const choices: { value: PracticeMode; label: string; note: string }[] = [
    {
      value: 'feedback',
      label: t(lang, 'pm.feedback'),
      note: t(lang, kind === 'writing' ? 'pm.feedbackNoteWriting' : 'pm.feedbackNoteSpeaking'),
    },
    {
      value: 'practice',
      label: t(lang, 'pm.practice'),
      note: t(lang, kind === 'writing' ? 'pm.practiceNoteWriting' : 'pm.practiceNoteSpeaking'),
    },
  ]
  return (
    <fieldset disabled={props.disabled} className="space-y-2" data-testid="practice-mode">
      <legend className={`${cls.label} mb-2`}>{t(lang, 'pm.legend')}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {choices.map((c) => {
          const id = `${name}-${c.value}`
          const selected = mode === c.value
          return (
            <div
              key={c.value}
              className={`flex gap-3 rounded-md border p-3 ${selected ? 'border-red-700 bg-red-50/40' : 'border-slate-200 bg-white'}`}
            >
              <input
                id={id}
                type="radio"
                name={name}
                className={cls.checkbox}
                checked={selected}
                onChange={() => onChange(c.value)}
                aria-describedby={`${id}-note`}
              />
              {/* the note is the radio's description, not part of its name */}
              <div>
                <label htmlFor={id} className="block font-semibold text-slate-950">
                  {c.label}
                </label>
                <p id={`${id}-note`} className="mt-1 text-sm text-slate-700">
                  {c.note}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </fieldset>
  )
}

/** A short list the learner ticks for themselves; nothing is sent or stored. `resetKey` clears it. */
export function SelfCheck(props: { kind: TaskKind; lang: Lang; resetKey?: number }) {
  const { kind, lang } = props
  const id = useId()
  const items = SELF_CHECK[kind][lang]
  const [ticked, setTicked] = useState<boolean[]>(() => items.map(() => false))

  useEffect(() => {
    setTicked(SELF_CHECK[kind][lang].map(() => false))
  }, [props.resetKey, kind, lang])

  return (
    <fieldset className="space-y-2 rounded-md border border-slate-200 bg-white p-3" data-testid="self-check">
      <legend className="px-1 font-semibold text-slate-900">{t(lang, 'pm.selfCheck')}</legend>
      <p className={cls.muted}>{t(lang, 'pm.selfCheckNote')}</p>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={item} className="flex items-start gap-3">
            <input
              id={`${id}-${i}`}
              type="checkbox"
              className={cls.checkbox}
              checked={ticked[i] ?? false}
              onChange={(e) => setTicked((prev) => prev.map((v, j) => (j === i ? e.target.checked : v)))}
            />
            <label htmlFor={`${id}-${i}`} className="text-base text-slate-900">
              {item}
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  )
}

/**
 * After a practice answer: the way to AI feedback that fits this visitor (practiceCta) — the free
 * writing sample, sign-in for the free speaking task, a pass — and pricing.
 */
export function PracticeCtaPanel(props: {
  kind: TaskKind
  lang: Lang
  /** switch this page to AI feedback */
  onGetFeedback: () => void
  /** where sign-in comes back to */
  returnTo: string
}) {
  const { kind, lang } = props
  const meState = useMe()
  const me = meState.status === 'ready' ? meState.me : null
  const cta = practiceCta(me, kind)
  const hasPass = me !== null && activePass(me) !== null
  const pricingHref = lang === 'ko' ? '/ko/pricing/' : '/pricing/'
  const sampleHref = lang === 'ko' ? '/practice/writing/email/?lang=ko' : '/practice/writing/email/'

  return (
    <section aria-label={t(lang, 'pm.ctaTitle')} className="space-y-3 rounded-md border border-sky-300 bg-sky-50 p-4 text-sky-950" data-testid="practice-cta">
      <h3 className="font-semibold">{t(lang, 'pm.ctaTitle')}</h3>
      {cta.feedback && (
        <div className="space-y-2">
          <p>
            {kind === 'writing'
              ? t(lang, hasPass ? 'pm.ctaWritingPass' : 'pm.ctaWritingFree')
              : t(lang, 'pm.ctaSpeakingFeedback')}
          </p>
          <button type="button" className={`${cls.btn} ${cls.primary}`} onClick={props.onGetFeedback}>
            {t(lang, kind === 'writing' ? 'pm.getFeedbackWriting' : 'pm.getFeedbackSpeaking')}
          </button>
        </div>
      )}
      {cta.signIn && (
        <p>
          {t(lang, 'pm.ctaSignIn')}{' '}
          <Link href={loginHref(props.returnTo, lang)} className={cls.link}>
            {t(lang, 'common.signIn')}
          </Link>
        </p>
      )}
      {cta.writingSample && (
        <p>
          {t(lang, 'pm.ctaWritingSample')}{' '}
          <Link href={sampleHref} className={cls.link}>
            {t(lang, 'pm.writingSampleLink')}
          </Link>
        </p>
      )}
      {cta.pricing && (
        <p>
          {t(lang, 'pm.ctaPricing')}{' '}
          <Link href={pricingHref} className={cls.link}>
            {t(lang, 'common.seePricing')}
          </Link>
        </p>
      )}
    </section>
  )
}
