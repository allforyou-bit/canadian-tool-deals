'use client'

// Buy button for one pass (CONTRACT §6). Used by /pricing/ and /ko/pricing/.
import Link from 'next/link'
import { Fragment, useId, useState, type FormEvent, type JSX, type ReactNode } from 'react'
import type { Lang } from '../shared/api'
import { SKUS, TERMS_VERSION, type Sku } from '../shared/config'
import { api, ApiClientError } from '../lib/api'
import { useMe } from '../lib/hooks'
import { formatCad, formatDate, t } from '../lib/i18n'
import { accessEndsAt, refreshMe } from '../lib/me'
import { isSafeCheckoutUrl, loginHref } from '../lib/url'
import { ErrorNotice, Notice } from './Notice'
import { cls } from './ui'

type Phase = 'idle' | 'submitting' | 'redirecting'

/** "By buying you agree to the {terms} and {refunds}." with both placeholders as links. */
function TermsLine(props: { lang: Lang }) {
  const { lang } = props
  const links: Record<string, ReactNode> = {
    terms: (
      <Link href="/legal/terms/" className={cls.link}>
        {t(lang, 'b.termsLink')}
      </Link>
    ),
    refunds: (
      <Link href="/legal/refunds/" className={cls.link}>
        {t(lang, 'b.refundsLink')}
      </Link>
    ),
  }
  const parts = t(lang, 'b.terms').split(/(\{terms\}|\{refunds\})/)
  return (
    <p className="text-sm text-slate-800" data-testid="buy-terms">
      {parts.map((part, i) => (
        <Fragment key={i}>{part === '{terms}' ? links.terms : part === '{refunds}' ? links.refunds : part}</Fragment>
      ))}
    </p>
  )
}

export function BuyPass(props: { sku: Sku; lang: Lang }): JSX.Element {
  const { sku, lang } = props
  const cfg = SKUS[sku]
  const name = cfg[lang]
  const id = useId()
  const meState = useMe()
  const [attested, setAttested] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<ApiClientError | null>(null)
  const pricingPath = lang === 'ko' ? '/ko/pricing/' : '/pricing/'

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!attested || phase !== 'idle') return
    setPhase('submitting')
    setError(null)
    try {
      // termsVersion: the Worker refuses a checkout for terms other than the ones shown here
      const { url } = await api.checkout({ sku, termsVersion: TERMS_VERSION, residentAttestation: true, lang })
      if (!isSafeCheckoutUrl(url)) throw new ApiClientError('internal', 200, 'Invalid checkout URL')
      setPhase('redirecting')
      window.location.assign(url)
    } catch (err) {
      setError(err instanceof ApiClientError ? err : new ApiClientError('internal', 0, 'Network error'))
      setPhase('idle')
    }
  }

  let body: JSX.Element
  if (meState.status === 'loading') {
    body = (
      <button type="button" className={`${cls.btn} ${cls.primary} w-full`} disabled>
        {t(lang, 'common.loading')}
      </button>
    )
  } else if (meState.status === 'error') {
    body = (
      <div className="space-y-3">
        <ErrorNotice error={meState.error} lang={lang} context="checkout" />
        <button type="button" className={`${cls.btn} ${cls.secondary} w-full`} onClick={() => void refreshMe({ force: true })}>
          {t(lang, 'common.tryAgain')}
        </button>
      </div>
    )
  } else if (!meState.me.flags.checkoutEnabled || error?.code === 'checkout_unavailable') {
    // neutral: checkout can be off for a pause or for good, so never promise that it opens soon
    body = <Notice kind="info">{t(lang, 'err.checkout_unavailable')}</Notice>
  } else if (!meState.me.signedIn || error?.code === 'unauthorized') {
    body = (
      <Link href={loginHref(pricingPath, lang)} className={`${cls.btn} ${cls.primary} w-full`}>
        {t(lang, 'b.signInToBuy')}
      </Link>
    )
  } else {
    const endsAt = accessEndsAt(meState.me)
    body = (
      <form onSubmit={onSubmit} className="space-y-3" aria-describedby={`${id}-where`}>
        {endsAt && <p className={cls.muted}>{t(lang, 'b.hasPass', { date: formatDate(endsAt, lang) })}</p>}
        <div className="flex items-start gap-3">
          <input
            id={`${id}-attest`}
            type="checkbox"
            required
            className={cls.checkbox}
            checked={attested}
            onChange={(e) => setAttested(e.target.checked)}
          />
          <label htmlFor={`${id}-attest`} className="text-base text-slate-900">
            {t(lang, 'b.attest')}
          </label>
        </div>
        <TermsLine lang={lang} />
        <button
          type="submit"
          className={`${cls.btn} ${cls.primary} w-full`}
          disabled={phase !== 'idle'}
          aria-busy={phase !== 'idle'}
        >
          {phase === 'idle' ? t(lang, 'b.buy', { name }) : t(lang, 'b.redirecting')}
        </button>
        <p className={cls.muted}>{t(lang, 'b.stripe')}</p>
        {error && <ErrorNotice error={error} lang={lang} context="checkout" returnTo={pricingPath} />}
      </form>
    )
  }

  return (
    <section className={`${cls.card} flex flex-col gap-3`} aria-labelledby={`${id}-name`} lang={lang}>
      {/* h3: the pricing pages group the cards under their own h2 */}
      <h3 id={`${id}-name`} className={cls.h2}>
        {name}
      </h3>
      <p>
        <span className="text-3xl font-bold text-slate-950">{formatCad(cfg.priceCents)}</span>{' '}
        <span className={cls.muted}>CAD</span>
      </p>
      <p className="text-slate-800">{t(lang, 'b.days', { n: cfg.days })}</p>
      <p className={cls.muted}>{t(lang, 'b.oneTime')}</p>
      <p id={`${id}-where`} className="font-semibold text-slate-900">
        {t(lang, 'b.notQuebec')}
      </p>
      <div className="mt-auto pt-2">{body}</div>
    </section>
  )
}
