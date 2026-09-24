'use client'

// Cloudflare Turnstile, explicit rendering (cloudflare-docs turnstile/get-started/client-side-rendering:
// api.js?render=explicit&onload=<fn>, turnstile.render(selector, options) → widgetId, reset/remove).
import { useEffect, useId, useRef, useState } from 'react'
import type { Lang } from '../shared/api'
import { PUBLIC_ENV } from '../lib/env'
import { t } from '../lib/i18n'

interface TurnstileOptions {
  sitekey: string
  callback: (token: string) => void
  'error-callback'?: (code: string) => void
  'expired-callback'?: () => void
  'timeout-callback'?: () => void
  language?: string
  size?: 'normal' | 'flexible' | 'compact'
  theme?: 'auto' | 'light' | 'dark'
}

interface TurnstileApi {
  render: (container: string, options: TurnstileOptions) => string | undefined
  reset: (widgetId: string) => void
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
    __mpcTurnstileReady?: () => void
  }
}

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=__mpcTurnstileReady'

let loading: Promise<TurnstileApi> | null = null

/** Load the Turnstile script once per page. */
function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  if (loading) return loading
  loading = new Promise<TurnstileApi>((resolve, reject) => {
    window.__mpcTurnstileReady = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile missing')))
    const s = document.createElement('script')
    s.src = SCRIPT_URL
    s.async = true
    s.onerror = () => {
      loading = null
      s.remove()
      reject(new Error('turnstile load failed'))
    }
    document.head.appendChild(s)
  })
  return loading
}

/**
 * Renders the widget and reports the current token (null when missing, expired or failed).
 * Tokens are single-use: bump `resetSignal` after each submission to get a fresh one.
 */
export function Turnstile(props: { lang: Lang; onToken: (token: string | null) => void; resetSignal?: number }) {
  const { lang, resetSignal } = props
  const containerId = `cf-ts-${useId().replace(/[^A-Za-z0-9_-]/g, '')}`
  const widgetRef = useRef<string | null>(null)
  const onTokenRef = useRef(props.onToken)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    onTokenRef.current = props.onToken
  }, [props.onToken])

  useEffect(() => {
    let cancelled = false
    const clear = () => onTokenRef.current(null)
    loadTurnstile()
      .then((ts) => {
        if (cancelled) return
        setFailed(false)
        widgetRef.current =
          ts.render(`#${containerId}`, {
            sitekey: PUBLIC_ENV.turnstileSiteKey,
            language: lang,
            size: 'flexible',
            theme: 'light',
            callback: (token) => onTokenRef.current(token),
            'expired-callback': clear,
            'timeout-callback': clear,
            'error-callback': clear,
          }) ?? null
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
      if (widgetRef.current && window.turnstile) window.turnstile.remove(widgetRef.current)
      widgetRef.current = null
      clear()
    }
  }, [containerId, lang])

  useEffect(() => {
    if (!resetSignal || !widgetRef.current || !window.turnstile) return
    window.turnstile.reset(widgetRef.current)
    onTokenRef.current(null)
  }, [resetSignal])

  return (
    <div>
      <div id={containerId} className="min-h-[65px]" />
      {failed && <p className="mt-2 text-sm text-red-900">{t(lang, 'common.network')}</p>}
    </div>
  )
}
