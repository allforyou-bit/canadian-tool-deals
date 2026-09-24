'use client'

// Buy button for one pass (CONTRACT §6). Used by /pricing/ and /ko/pricing/.
import Link from 'next/link'
import { useId, useState, type FormEvent, type JSX } from 'react'
import type { Lang } from '../shared/api'
import { SKUS, type Sku } from '../shared/config'
import { api, ApiClientError } from '../lib/api'
import { useMe } from '../lib/hooks'
import { formatCad, formatDate, t } from '../lib/i18n'
import { activePass, refreshMe } from '../lib/me'
import { isSafeCheckoutUrl, loginHref } from '../lib/url'
import { ErrorNotice, Notice } from './Notice'
import { cls } from './ui'

type Phase = 'idle' | 'submitting' | 'redirecting'

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
      const { url } = await api.checkout({ sku, residentAttestation: true, lang })
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
        <button type="button" className={`${cls.btn} ${cls.secondary} w-full`} onClick={() => void refreshMe()}>
          {t(lang, 'common.tryAgain')}
        </button>
      </div>
    )
  } else if (!meState.me.flags.checkoutEnabled || error?.code === 'checkout_unavailable') {
    body = <Notice kind="info">{t(lang, 'b.soon')}</Notice>
  } else if (!meState.me.signedIn || error?.code === 'unauthorized') {
    body = (
      <Link href={loginHref(pricingPath, lang)} className={`${cls.btn} ${cls.primary} w-full`}>
        {t(lang, 'b.signInToBuy')}
      </Link>
    )
  } else {
    const pass = activePass(meState.me)
    body = (
      <form onSubmit={onSubmit} className="space-y-3" aria-describedby={`${id}-where`}>
        {pass && <p className={cls.muted}>{t(lang, 'b.hasPass', { date: formatDate(pass.endsAt, lang) })}</p>}
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
