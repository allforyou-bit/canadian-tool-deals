'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Notice } from '../../../components/Notice'
import { cls } from '../../../components/ui'
import { PUBLIC_ENV } from '../../../lib/env'
import { reportConversion } from '../../../lib/gads'
import { useUiLang } from '../../../lib/hooks'
import { formatDate, t } from '../../../lib/i18n'
import { refreshMe } from '../../../lib/me'
import { checkoutSessionId, conversionFor, purchaseOutcome, type PurchaseOutcome } from '../../../lib/purchase'
import { loginHref } from '../../../lib/url'
import { SKUS } from '../../../shared/config'

const POLL_MS = 2000
const MAX_WAIT_MS = 30_000

type State = PurchaseOutcome | { kind: 'slow' }

/**
 * Polls /api/me until the purchase Stripe sent us back from (?session_id=, which is purchases.id)
 * is final: paid (then the pass and the overall end date are shown and, only then, the ads
 * conversion is reported with that purchase's price), refunded by the region rule, or refunded.
 * An older pass never counts as this purchase. Every 2 s, up to 30 s.
 */
export function SuccessClient() {
  const lang = useUiLang()
  const [state, setState] = useState<State>({ kind: 'waiting' })

  useEffect(() => {
    let stopped = false
    let timer: number | undefined
    const startedAt = Date.now()
    const sessionId = checkoutSessionId(window.location.search)

    async function poll() {
      // force: every poll must ask the server again, not reuse an earlier answer
      const me = await refreshMe({ force: true })
      if (stopped) return
      const outcome = purchaseOutcome(me, sessionId)
      if (outcome.kind !== 'waiting') {
        setState(outcome)
        const conversion = conversionFor(outcome, sessionId)
        // the session id de-duplicates reloads in this browser; it is not sent to Google
        if (conversion && PUBLIC_ENV.gadsSendTo) reportConversion(PUBLIC_ENV.gadsSendTo, conversion.valueCents, conversion.dedupeKey)
        return
      }
      if (Date.now() - startedAt + POLL_MS > MAX_WAIT_MS) return setState({ kind: 'slow' })
      timer = window.setTimeout(() => void poll(), POLL_MS)
    }

    void poll()
    return () => {
      stopped = true
      window.clearTimeout(timer)
    }
  }, [])

  return (
    <section className={`${cls.card} space-y-4`} aria-labelledby="success-title" lang={lang}>
      <h1 id="success-title" className={cls.h1}>
        {t(lang, 'c.successTitle')}
      </h1>
      {state.kind === 'waiting' && <p role="status">{t(lang, 'c.waiting')}</p>}
      {state.kind === 'paid' && (
        <>
          <Notice kind="success">
            <span data-testid="purchase-confirmed">
              {t(lang, 'c.active', { name: SKUS[state.sku]?.[lang] ?? state.sku, date: formatDate(state.endsAt, lang) })}
            </span>
          </Notice>
          <Link href="/practice/" className={`${cls.btn} ${cls.primary}`}>
            {t(lang, 'c.start')}
          </Link>
        </>
      )}
      {state.kind === 'rejected' && <Notice kind="warn">{t(lang, 'c.rejected')}</Notice>}
      {state.kind === 'refunded' && <Notice kind="info">{t(lang, 'c.refunded')}</Notice>}
      {state.kind === 'problem' && <Notice kind="warn">{t(lang, 'c.problem')}</Notice>}
      {state.kind === 'slow' && <Notice kind="info">{t(lang, 'c.slow')}</Notice>}
      {(state.kind === 'rejected' || state.kind === 'refunded' || state.kind === 'problem' || state.kind === 'slow') && (
        <Link href="/account/" className={`${cls.btn} ${cls.secondary}`}>
          {t(lang, 'common.goToAccount')}
        </Link>
      )}
      {state.kind === 'signedOut' && (
        <>
          <Notice kind="info">{t(lang, 'c.signedOut')}</Notice>
          <Link href={loginHref('/account/', lang)} className={`${cls.btn} ${cls.primary}`}>
            {t(lang, 'common.signIn')}
          </Link>
        </>
      )}
    </section>
  )
}
