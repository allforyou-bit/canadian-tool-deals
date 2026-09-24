'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useId, useState, type FormEvent, type ReactNode } from 'react'
import { LangToggle } from '../../components/LangToggle'
import { ErrorNotice, Notice } from '../../components/Notice'
import { cls } from '../../components/ui'
import { api, ApiClientError } from '../../lib/api'
import { consentText } from '../../lib/consent'
import { PUBLIC_ENV } from '../../lib/env'
import { useMe, useSiteUrl, useUiLang } from '../../lib/hooks'
import { errorKindLabel, formatCad, formatDate, t } from '../../lib/i18n'
import { activePass, refreshMe } from '../../lib/me'
import { loginHref } from '../../lib/url'
import { useAction } from '../../lib/use-action'
import type { HistoryResponse, Lang, MeResponse, RefundResponse } from '../../shared/api'
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
  return (
    <Section id="account-pass" title={t(lang, 'a.pass')}>
      {pass ? (
        <p className="text-slate-900" data-testid="pass-summary">
          {t(lang, 'a.passActive', {
            name: SKUS[pass.sku]?.[lang] ?? pass.sku,
            start: formatDate(pass.startsAt, lang),
            end: formatDate(pass.endsAt, lang),
          })}
        </p>
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
          {data.items.map((item) => {
            const task = taskById(item.taskId)
            return (
              <li key={item.gradeId} className="py-3">
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
              </li>
            )
          })}
        </ul>
      )}
    </Section>
  )
}

function MarketingSection({ lang }: { lang: Lang }) {
  const id = useId()
  const siteUrl = useSiteUrl()
  const consent = consentText(lang, PUBLIC_ENV.mailingAddress, siteUrl)
  const [ticked, setTicked] = useState(false)
  const action = useAction<'in' | 'out'>()

  async function optIn(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!ticked) return
    await action.run(async () => {
      await api.setMarketing({ optIn: true, consentText: consent })
      return 'in'
    })
  }

  return (
    <Section id="account-marketing" title={t(lang, 'a.marketing')}>
      <p className="text-slate-800">{t(lang, 'a.marketingIntro')}</p>
      <button
        type="button"
        className={`${cls.btn} ${cls.secondary}`}
        disabled={action.pending}
        onClick={() => {
          setTicked(false)
          void action.run(async () => {
            await api.setMarketing({ optIn: false })
            return 'out'
          })
        }}
      >
        {t(lang, 'a.marketingWithdraw')}
      </button>
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
          <label htmlFor={`${id}-optin`} className="text-sm text-slate-800">
            {consent}
          </label>
        </div>
        <button type="submit" className={`${cls.btn} ${cls.secondary}`} disabled={action.pending}>
          {t(lang, 'a.marketingOptIn')}
        </button>
      </form>
      {action.done && <Notice kind="success">{t(lang, action.done === 'in' ? 'a.marketingSaved' : 'a.marketingWithdrawn')}</Notice>}
      {action.error && <ErrorNotice error={action.error} lang={lang} context="account" returnTo="/account/" />}
    </Section>
  )
}

/** Shown while a pass is active, and kept after a refund so the confirmation stays visible. */
function RefundSection({ me, lang }: { me: MeResponse; lang: Lang }) {
  const [confirming, setConfirming] = useState(false)
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
              type="button"
              className={`${cls.btn} ${cls.danger}`}
              disabled={action.pending}
              onClick={async () => {
                const res = await action.run(() => api.refundRequest({ lang }))
                setConfirming(false)
                if (res) void refreshMe()
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
        <button type="button" className={`${cls.btn} ${cls.secondary}`} onClick={() => setConfirming(true)}>
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
  const [confirming, setConfirming] = useState(false)
  const action = useAction<true>()

  return (
    <Section id="account-delete" title={t(lang, 'a.delete')}>
      <p className="text-slate-800">{t(lang, 'a.deleteInfo')}</p>
      {confirming ? (
        <div className="space-y-3 rounded-md border border-red-300 bg-red-50 p-3">
          <p className="font-semibold text-red-950">{t(lang, 'a.deleteConfirm')}</p>
          <div className="flex flex-wrap gap-3">
            <button
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
        <button type="button" className={`${cls.btn} ${cls.danger}`} onClick={() => setConfirming(true)}>
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
        <button type="button" className={`${cls.btn} ${cls.secondary}`} onClick={() => void refreshMe()}>
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
                await refreshMe()
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
        <MarketingSection lang={lang} />
        <SupportSection lang={lang} />
        <DeleteSection
          lang={lang}
          onDeleted={() => {
            setDeleted(true)
            void refreshMe()
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
