'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { GradeResultView } from '../../components/GradeResultView'
import { LangToggle } from '../../components/LangToggle'
import { ErrorNotice, Notice } from '../../components/Notice'
import { cls } from '../../components/ui'
import { api, ApiClientError } from '../../lib/api'
import { consentText } from '../../lib/consent'
import { PUBLIC_ENV } from '../../lib/env'
import { useMe, useSiteUrl, useUiLang } from '../../lib/hooks'
import { errorKindLabel, formatCad, formatDate, t } from '../../lib/i18n'
import { accessEndsAt, activePass, refreshMe } from '../../lib/me'
import { loginHref } from '../../lib/url'
import { useAction } from '../../lib/use-action'
import type { HistoryItem, HistoryItemResponse, HistoryResponse, Lang, MeResponse, RefundResponse } from '../../shared/api'
import { CAPS, REFUND_POLICY, SKUS } from '../../shared/config'
import { taskById } from '../../shared/tasks'

const SUPPORT_MAX_CHARS = 4000

function Section(props: { title: string; children: ReactNode; id: string }) {
  return (
    <section aria-labelledby={props.id} className={`${cls.card} space-y-4`}>
      <h2 id={props.id} className={cls.h2}>
        {props.title}
      </h2>
      {props.children}
    </section>
  )
}

function UsageRow(props: { label: string; used: number; cap: number }) {
  const pct = Math.min(100, Math.round((props.used / props.cap) * 100))
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span className="text-slate-800">{props.label}</span>
        <span className="font-semibold tabular-nums">
          {props.used} / {props.cap}
        </span>
      </div>
      <div aria-hidden="true" className="mt-1 h-2 rounded-full bg-slate-200">
        <div className={`h-2 rounded-full ${pct >= 100 ? 'bg-red-700' : 'bg-slate-700'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function PassSection({ me, lang }: { me: MeResponse; lang: Lang }) {
  const pass = activePass(me)
  // end of every pass bought, including passes queued after the current one
  const endsAt = accessEndsAt(me)
  const queued = pass !== null && endsAt !== null && new Date(endsAt).getTime() > new Date(pass.endsAt).getTime()
  return (
    <Section id="account-pass" title={t(lang, 'a.pass')}>
      {pass || endsAt ? (
        <div className="space-y-1">
          {pass && (
            <p className="text-slate-900" data-testid="pass-summary">
              {t(lang, 'a.passActive', {
                name: SKUS[pass.sku]?.[lang] ?? pass.sku,
                start: formatDate(pass.startsAt, lang),
                end: formatDate(pass.endsAt, lang),
              })}
            </p>
          )}
          {endsAt && (
            <p className="font-semibold text-slate-900" data-testid="access-ends">
              {t(lang, 'a.accessUntil', { date: formatDate(endsAt, lang) })}
            </p>
          )}
          {queued && <p className={cls.muted}>{t(lang, 'a.queued')}</p>}
        </div>
      ) : (
        <>
          <p className="text-slate-800">{t(lang, 'a.noPass')}</p>
          <Link href={lang === 'ko' ? '/ko/pricing/' : '/pricing/'} className={cls.link}>
            {t(lang, 'common.seePricing')}
          </Link>
        </>
      )}
      <div className="space-y-3 border-t border-slate-200 pt-4">
        <h3 className="font-semibold text-slate-900">{t(lang, 'a.usage')}</h3>
        <UsageRow label={t(lang, 'a.writingToday')} used={me.usage.writingToday} cap={CAPS.writingPerDay} />
        <UsageRow label={t(lang, 'a.speakingToday')} used={me.usage.speakingToday} cap={CAPS.speakingPerDay} />
        <UsageRow label={t(lang, 'a.graded30d')} used={me.usage.graded30d} cap={CAPS.gradedPer30Days} />
        <p className={cls.muted}>{t(lang, 'a.usageNote')}</p>
      </div>
      <div className="space-y-1 border-t border-slate-200 pt-4">
        <h3 className="font-semibold text-slate-900">{t(lang, 'a.free')}</h3>
        <p className="text-sm">
          {t(lang, 'a.freeWriting')}: {t(lang, me.free.writing ? 'a.available' : 'a.used')}
        </p>
        <p className="text-sm">
          {t(lang, 'a.freeSpeaking')}: {t(lang, me.free.speaking ? 'a.available' : 'a.used')}
        </p>
      </div>
    </Section>
  )
}

type ItemState = { status: 'loading' } | { status: 'ready'; item: HistoryItemResponse } | { status: 'error'; error: ApiClientError }

/** One saved task: title, date, error kinds, and a button that loads the saved answer and feedback. */
function HistoryEntry({ item, lang }: { item: HistoryItem; lang: Lang }) {
  const task = taskById(item.taskId)
  const panelId = useId()
  const [open, setOpen] = useState(false)
  const [detail, setDetail] = useState<ItemState | null>(null)

  function toggle() {
    const next = !open
    setOpen(next)
    if (!next || (detail && detail.status !== 'error')) return
    setDetail({ status: 'loading' })
    api.historyItem(item.gradeId).then(
      (res) => setDetail({ status: 'ready', item: res }),
      (e: unknown) => setDetail({ status: 'error', error: e instanceof ApiClientError ? e : new ApiClientError('internal', 0, 'Network error') }),
    )
  }

  let panel: ReactNode = null
  if (open && detail) {
    if (detail.status === 'loading') {
      panel = <p role="status" className={cls.muted}>{t(lang, 'common.loading')}</p>
    } else if (detail.status === 'error') {
      // 404: purged after the retention period (or refused, which has no feedback to show)
      panel =
        detail.error.code === 'not_found' ? (
          <Notice kind="info">{t(lang, 'a.historyGone')}</Notice>
        ) : (
          <ErrorNotice error={detail.error} lang={lang} context="account" returnTo="/account/" />
        )
    } else {
      const saved = detail.item
      const isSpeaking = saved.kind === 'speaking'
      // speaking: the saved text is the transcript, which the feedback view shows itself
      const result = isSpeaking && saved.result.transcript === undefined ? { ...saved.result, transcript: saved.text } : saved.result
      panel = (
        <div className="space-y-4">
          {!isSpeaking && (
            <div>
              <h3 className="font-semibold text-slate-900">{t(lang, 'w.answer')}</h3>
              <blockquote
                lang="en"
                className="mt-2 whitespace-pre-wrap rounded-md border-l-4 border-slate-300 bg-slate-50 p-3 font-serif text-slate-800"
                data-testid="history-answer"
              >
                {saved.text}
              </blockquote>
            </div>
          )}
          <GradeResultView response={{ gradeId: saved.gradeId, result, free: false }} kind={saved.kind} headingLevel={3} />
        </div>
      )
    }
  }

  return (
    <li className="py-3">
      <p className="font-medium text-slate-900">
        {task ? (
          <Link href={`/practice/${task.kind}/${task.id}/`} className={cls.link}>
            {task.title[lang]}
          </Link>
        ) : (
          item.taskId
        )}
        <span className="ml-2 text-sm font-normal text-slate-600">{formatDate(item.createdAt, lang)}</span>
      </p>
      {item.topErrorKinds.length > 0 && (
        <p className="mt-1 text-sm text-slate-700">{item.topErrorKinds.map((k) => errorKindLabel(lang, k)).join(', ')}</p>
      )}
      <button
        type="button"
        className={`${cls.btn} ${cls.secondary} mt-2 min-h-9 px-3 py-1 text-sm`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
      >
        {t(lang, open ? 'a.historyClose' : 'a.historyOpen')}
      </button>
      <div id={panelId} className={open ? 'mt-3' : 'hidden'}>
        {panel}
      </div>
    </li>
  )
}

function HistorySection({ lang }: { lang: Lang }) {
  const [data, setData] = useState<HistoryResponse | null>(null)
  const [error, setError] = useState<ApiClientError | null>(null)

  useEffect(() => {
    let cancelled = false
    api.history().then(
      (res) => !cancelled && setData(res),
      (e: unknown) => !cancelled && setError(e instanceof ApiClientError ? e : new ApiClientError('internal', 0, 'Network error')),
    )
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <Section id="account-history" title={t(lang, 'a.history')}>
      {error && <ErrorNotice error={error} lang={lang} context="account" returnTo="/account/" />}
      {!data && !error && <p className={cls.muted}>{t(lang, 'common.loading')}</p>}
      {data && data.recurring.length > 0 && (
        <div>
          <h3 className="font-semibold text-slate-900">{t(lang, 'a.recurring')}</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {data.recurring.map((r) => (
              <li key={r.kind} className="rounded-full bg-amber-100 px-3 py-1 text-sm text-amber-950">
                {errorKindLabel(lang, r.kind)} · {t(lang, 'a.recurringCount', { n: r.count })}
              </li>
            ))}
          </ul>
        </div>
      )}
      {data && data.items.length === 0 && <p className="text-slate-800">{t(lang, 'a.noHistory')}</p>}
      {data && data.items.length > 0 && (
        <ul className="divide-y divide-slate-200">
          {data.items.map((item) => (
            <HistoryEntry key={item.gradeId} item={item} lang={lang} />
          ))}
        </ul>
      )}
    </Section>
  )
}

function MarketingSection({ lang, optedIn }: { lang: Lang; optedIn: boolean }) {
  const id = useId()
  const siteUrl = useSiteUrl()
  // null while the owner's mailing address is not configured: then we do not ask for consent at all
  const consent = consentText(lang, PUBLIC_ENV.mailingAddress, siteUrl)
  const [ticked, setTicked] = useState(false)
  const action = useAction<'in' | 'out'>()
  const stateRef = useRef<HTMLParagraphElement>(null)
  const shownOptIn = useRef(optedIn)

  // the withdraw button or the opt-in form (whichever had focus) is swapped out when the state
  // changes after the learner's own action: keep focus on the new state line
  useEffect(() => {
    if (shownOptIn.current !== optedIn && action.done) stateRef.current?.focus()
    shownOptIn.current = optedIn
  }, [optedIn, action.done])

  async function optIn(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!ticked || !consent) return
    const done = await action.run(async () => {
      await api.setMarketing({ optIn: true, consentText: consent })
      return 'in'
    })
    if (done) {
      setTicked(false)
      void refreshMe({ force: true })
    }
  }

  async function optOut() {
    const done = await action.run(async () => {
      await api.setMarketing({ optIn: false })
      return 'out'
    })
    if (done) void refreshMe({ force: true })
  }

  return (
    <Section id="account-marketing" title={t(lang, 'a.marketing')}>
      <p className="text-slate-800">{t(lang, 'a.marketingIntro')}</p>
      <p ref={stateRef} tabIndex={-1} className="font-semibold text-slate-900 focus:outline-none" data-testid="marketing-state">
        {t(lang, optedIn ? 'a.marketingOn' : 'a.marketingOff')}
      </p>
      {optedIn ? (
        <button type="button" className={`${cls.btn} ${cls.secondary}`} disabled={action.pending} onClick={() => void optOut()}>
          {t(lang, 'a.marketingWithdraw')}
        </button>
      ) : (
        consent && (
          <form onSubmit={optIn} className="space-y-3 border-t border-slate-200 pt-4">
            <div className="flex items-start gap-3">
              <input
                id={`${id}-optin`}
                type="checkbox"
                required
                checked={ticked}
                onChange={(e) => setTicked(e.target.checked)}
                className={cls.checkbox}
              />
              <label htmlFor={`${id}-optin`} className="text-sm text-slate-800" data-testid="account-consent-text">
                {consent}
              </label>
            </div>
            <button type="submit" className={`${cls.btn} ${cls.secondary}`} disabled={action.pending}>
              {t(lang, 'a.marketingOptIn')}
            </button>
          </form>
        )
      )}
      {action.done && <Notice kind="success">{t(lang, action.done === 'in' ? 'a.marketingSaved' : 'a.marketingWithdrawn')}</Notice>}
      {action.error && <ErrorNotice error={action.error} lang={lang} context="account" returnTo="/account/" />}
    </Section>
  )
}

/** Shown while a pass is active, and kept after a refund so the confirmation stays visible. */
/** Opens a confirm box, focuses its confirm button, and returns focus to the trigger on cancel. */
function useConfirmFocus() {
  const [confirming, setConfirming] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const wasConfirming = useRef(false)
  useEffect(() => {
    if (confirming) confirmRef.current?.focus()
    else if (wasConfirming.current) triggerRef.current?.focus()
    wasConfirming.current = confirming
  }, [confirming])
  return { confirming, setConfirming, triggerRef, confirmRef }
}

function RefundSection({ me, lang }: { me: MeResponse; lang: Lang }) {
  const { confirming, setConfirming, triggerRef, confirmRef } = useConfirmFocus()
  const action = useAction<RefundResponse>()
  if (!activePass(me) && !action.done) return null

  return (
    <Section id="account-refund" title={t(lang, 'a.refund')}>
      <p className="text-slate-800">
        {t(lang, 'a.refundPolicy', { days: REFUND_POLICY.withinDays, max: REFUND_POLICY.maxGradedTasksUsed })}
      </p>
      {action.done ? (
        <Notice kind="success">{t(lang, 'a.refundDone', { amount: formatCad(action.done.refundedCents) })}</Notice>
      ) : confirming ? (
        <div className="space-y-3 rounded-md border border-amber-300 bg-amber-50 p-3">
          <p className="text-amber-950">{t(lang, 'a.refundConfirm')}</p>
          <div className="flex flex-wrap gap-3">
            <button
              ref={confirmRef}
              type="button"
              className={`${cls.btn} ${cls.danger}`}
              disabled={action.pending}
              onClick={async () => {
                const res = await action.run(() => api.refundRequest({ lang }))
                setConfirming(false)
                if (res) void refreshMe({ force: true })
              }}
            >
              {t(lang, 'a.refundYes')}
            </button>
            <button type="button" className={`${cls.btn} ${cls.secondary}`} onClick={() => setConfirming(false)} disabled={action.pending}>
              {t(lang, 'common.cancel')}
            </button>
          </div>
        </div>
      ) : (
        <button ref={triggerRef} type="button" className={`${cls.btn} ${cls.secondary}`} onClick={() => setConfirming(true)}>
          {t(lang, 'a.refundButton')}
        </button>
      )}
      {action.error && <ErrorNotice error={action.error} lang={lang} context="account" returnTo="/account/" />}
    </Section>
  )
}

function SupportSection({ lang }: { lang: Lang }) {
  const id = useId()
  const [message, setMessage] = useState('')
  const action = useAction<true>()

  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const text = message.trim()
    if (!text) return
    const ok = await action.run(async () => {
      await api.support({ message: text, lang })
      return true
    })
    if (ok) setMessage('')
  }

  return (
    <Section id="account-support" title={t(lang, 'a.support')}>
      <form onSubmit={send} className="space-y-3">
        <label htmlFor={`${id}-msg`} className={cls.label}>
          {t(lang, 'a.supportLabel')}
        </label>
        <textarea
          id={`${id}-msg`}
          required
          rows={5}
          maxLength={SUPPORT_MAX_CHARS}
          value={message}
          onChange={(e) => {
            setMessage(e.target.value)
            if (action.done) action.reset()
          }}
          aria-describedby={`${id}-hint`}
          className={cls.input}
        />
        <p id={`${id}-hint`} className={cls.muted}>
          {t(lang, 'a.supportHint')}
        </p>
        <button type="submit" className={`${cls.btn} ${cls.secondary}`} disabled={action.pending}>
          {t(lang, 'a.supportSend')}
        </button>
      </form>
      {action.done && <Notice kind="success">{t(lang, 'a.supportSent')}</Notice>}
      {action.error && <ErrorNotice error={action.error} lang={lang} context="account" returnTo="/account/" />}
    </Section>
  )
}

function DeleteSection({ lang, onDeleted }: { lang: Lang; onDeleted: () => void }) {
  const { confirming, setConfirming, triggerRef, confirmRef } = useConfirmFocus()
  const action = useAction<true>()

  return (
    <Section id="account-delete" title={t(lang, 'a.delete')}>
      <p className="text-slate-800">{t(lang, 'a.deleteInfo')}</p>
      {confirming ? (
        <div className="space-y-3 rounded-md border border-red-300 bg-red-50 p-3">
          <p className="font-semibold text-red-950">{t(lang, 'a.deleteConfirm')}</p>
          <div className="flex flex-wrap gap-3">
            <button
              ref={confirmRef}
              type="button"
              className={`${cls.btn} ${cls.primary}`}
              disabled={action.pending}
              onClick={async () => {
                const ok = await action.run(async () => {
                  await api.deleteAccount()
                  return true
                })
                if (ok) onDeleted()
              }}
            >
              {t(lang, 'a.deleteYes')}
            </button>
            <button type="button" className={`${cls.btn} ${cls.secondary}`} onClick={() => setConfirming(false)} disabled={action.pending}>
              {t(lang, 'common.cancel')}
            </button>
          </div>
        </div>
      ) : (
        <button ref={triggerRef} type="button" className={`${cls.btn} ${cls.danger}`} onClick={() => setConfirming(true)}>
          {t(lang, 'a.deleteButton')}
        </button>
      )}
      {action.error && <ErrorNotice error={action.error} lang={lang} context="account" returnTo="/account/" />}
    </Section>
  )
}

/** Account page: pass, usage, free samples, history, email consent, refund, support, deletion. */
export function AccountClient() {
  const lang = useUiLang()
  const meState = useMe()
  const router = useRouter()
  const [deleted, setDeleted] = useState(false)
  const signOut = useAction<true>()

  let body: ReactNode
  if (deleted) {
    body = <Notice kind="success">{t(lang, 'a.deleted')}</Notice>
  } else if (meState.status === 'loading') {
    body = <p role="status">{t(lang, 'common.loading')}</p>
  } else if (meState.status === 'error') {
    body = (
      <div className="space-y-3">
        <ErrorNotice error={meState.error} lang={lang} context="account" returnTo="/account/" />
        <button type="button" className={`${cls.btn} ${cls.secondary}`} onClick={() => void refreshMe({ force: true })}>
          {t(lang, 'common.tryAgain')}
        </button>
      </div>
    )
  } else if (!meState.me.signedIn) {
    body = (
      <div className="space-y-3">
        <p className="text-slate-800">{t(lang, 'a.signInPrompt')}</p>
        <Link href={loginHref('/account/', lang)} className={`${cls.btn} ${cls.primary}`}>
          {t(lang, 'common.signIn')}
        </Link>
      </div>
    )
  } else {
    const me = meState.me
    body = (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-slate-800">{t(lang, 'a.signedInAs', { email: me.email ?? '' })}</p>
          <button
            type="button"
            className={`${cls.btn} ${cls.secondary}`}
            disabled={signOut.pending}
            onClick={async () => {
              const ok = await signOut.run(async () => {
                await api.logout()
                return true
              })
              if (ok) {
                await refreshMe({ force: true })
                router.push('/')
              }
            }}
          >
            {t(lang, 'a.signOut')}
          </button>
        </div>
        {signOut.error && <ErrorNotice error={signOut.error} lang={lang} context="account" />}
        <PassSection me={me} lang={lang} />
        <HistorySection lang={lang} />
        <RefundSection me={me} lang={lang} />
        <MarketingSection lang={lang} optedIn={me.marketingOptIn === true} />
        <SupportSection lang={lang} />
        <DeleteSection
          lang={lang}
          onDeleted={() => {
            setDeleted(true)
            void refreshMe({ force: true })
          }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6" lang={lang}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className={cls.h1}>{t(lang, 'a.title')}</h1>
        <LangToggle lang={lang} />
      </div>
      {body}
    </div>
  )
}
