'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { Notice } from '../../../components/Notice'
import { cls } from '../../../components/ui'
import { api, ApiClientError } from '../../../lib/api'
import { useUiLang } from '../../../lib/hooks'
import { t } from '../../../lib/i18n'
import { refreshMe } from '../../../lib/me'
import { takeReturnPath } from '../../../lib/return-path'
import { safeNextPath, tokenFromHash } from '../../../lib/url'

type State = 'working' | 'missing' | 'failed' | 'network' | 'done'

/**
 * Reads the one-time token from the URL fragment (never sent to servers or logs), removes it from
 * the address bar and history at once, exchanges it for a session cookie, then moves on to a safe
 * same-origin ?next= path or /account/.
 */
export function VerifyClient() {
  const lang = useUiLang()
  const router = useRouter()
  const [state, setState] = useState<State>('working')
  const tokenRef = useRef<string | null>(null)
  const startedRef = useRef(false)

  async function exchange(token: string) {
    setState('working')
    try {
      await api.verify({ token })
      tokenRef.current = null
      setState('done')
      await refreshMe()
      const origin = window.location.origin
      const next =
        safeNextPath(new URLSearchParams(window.location.search).get('next'), origin) ?? takeReturnPath(origin) ?? '/account/'
      router.replace(next)
    } catch (err) {
      const network = err instanceof ApiClientError && err.isNetwork
      if (!network) tokenRef.current = null
      setState(network ? 'network' : 'failed')
    }
  }

  const start = useEffectEvent(() => {
    // guard against the dev-mode double effect: the fragment is gone after the first run
    if (startedRef.current) return
    startedRef.current = true
    const token = tokenFromHash(window.location.hash)
    if (window.location.hash) window.history.replaceState(null, '', window.location.pathname + window.location.search)
    if (!token) {
      setState('missing')
      return
    }
    tokenRef.current = token
    void exchange(token)
  })

  useEffect(() => {
    start()
  }, [])

  return (
    <section className={`${cls.card} space-y-4`} aria-labelledby="verify-title" lang={lang}>
      <h1 id="verify-title" className={cls.h1}>
        {t(lang, 'v.title')}
      </h1>
      {state === 'working' && <p role="status">{t(lang, 'v.working')}</p>}
      {state === 'done' && <Notice kind="success">{t(lang, 'v.done')}</Notice>}
      {(state === 'missing' || state === 'failed') && (
        <>
          <Notice kind="error">{t(lang, state === 'missing' ? 'v.missing' : 'v.failed')}</Notice>
          <Link href="/login/" className={`${cls.btn} ${cls.primary}`}>
            {t(lang, 'v.newLink')}
          </Link>
        </>
      )}
      {state === 'network' && (
        <>
          <Notice kind="error">{t(lang, 'common.network')}</Notice>
          <button
            type="button"
            className={`${cls.btn} ${cls.primary}`}
            onClick={() => tokenRef.current && void exchange(tokenRef.current)}
          >
            {t(lang, 'common.tryAgain')}
          </button>
        </>
      )}
    </section>
  )
}
