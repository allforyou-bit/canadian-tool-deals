'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Notice } from '../../../components/Notice'
import { cls } from '../../../components/ui'
import { PUBLIC_ENV } from '../../../lib/env'
import { reportConversion } from '../../../lib/gads'
import { useUiLang } from '../../../lib/hooks'
import { formatDate, t } from '../../../lib/i18n'
import { activePass, refreshMe } from '../../../lib/me'
import { loginHref } from '../../../lib/url'
import type { Pass } from '../../../shared/api'
import { SKUS } from '../../../shared/config'

const POLL_MS = 2000
const MAX_WAIT_MS = 30_000

type State = { kind: 'waiting' } | { kind: 'active'; pass: Pass } | { kind: 'slow' } | { kind: 'signedOut' }

/** Polls /api/me until the webhook has granted the pass (every 2 s, up to 30 s). */
export function SuccessClient() {
  const lang = useUiLang()
  const [state, setState] = useState<State>({ kind: 'waiting' })

  useEffect(() => {
    let stopped = false
    let timer: number | undefined
    const startedAt = Date.now()

    async function poll() {
      const me = await refreshMe()
      if (stopped) return
      if (me && !me.signedIn) return setState({ kind: 'signedOut' })
      const pass = me ? activePass(me) : null
      if (pass) {
        setState({ kind: 'active', pass })
        if (PUBLIC_ENV.gadsSendTo) {
          // Stripe's session id (success_url ?session_id=) de-duplicates reloads; it is not sent to Google
          const sessionId = new URLSearchParams(window.location.search).get('session_id')
          reportConversion(PUBLIC_ENV.gadsSendTo, SKUS[pass.sku]?.priceCents ?? 0, sessionId || pass.endsAt)
        }
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
      {state.kind === 'active' && (
        <>
          <Notice kind="success">
            {t(lang, 'c.active', { name: SKUS[state.pass.sku]?.[lang] ?? state.pass.sku, date: formatDate(state.pass.endsAt, lang) })}
          </Notice>
          <Link href="/practice/" className={`${cls.btn} ${cls.primary}`}>
            {t(lang, 'c.start')}
          </Link>
        </>
      )}
      {state.kind === 'slow' && <Notice kind="info">{t(lang, 'c.slow')}</Notice>}
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
