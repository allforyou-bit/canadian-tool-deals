'use client'

import { useCallback, useEffect, useId, useState, type FormEvent } from 'react'
import { LangToggle } from '../../components/LangToggle'
import { ErrorNotice, Notice } from '../../components/Notice'
import { Turnstile } from '../../components/Turnstile'
import { cls } from '../../components/ui'
import { api, ApiClientError } from '../../lib/api'
import { consentText } from '../../lib/consent'
import { PUBLIC_ENV } from '../../lib/env'
import { useSiteUrl, useUiLang } from '../../lib/hooks'
import { t } from '../../lib/i18n'
import { rememberReturnPath } from '../../lib/return-path'
import { safeNextPath } from '../../lib/url'

/**
 * Magic-link sign-in: email, required 18+ confirmation, an OPTIONAL marketing box that starts
 * unticked (CASL), and Turnstile. The consent sentence sent is exactly the one displayed.
 */
export function LoginForm() {
  const lang = useUiLang()
  const siteUrl = useSiteUrl()
  const id = useId()
  const [email, setEmail] = useState('')
  const [adult, setAdult] = useState(false)
  const [marketing, setMarketing] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [resetSignal, setResetSignal] = useState(0)
  const [sending, setSending] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [error, setError] = useState<ApiClientError | null>(null)
  const [needToken, setNeedToken] = useState(false)
  const [next, setNext] = useState<string | null>(null)

  const consent = consentText(lang, PUBLIC_ENV.mailingAddress, siteUrl)
  const onToken = useCallback((v: string | null) => {
    setToken(v)
    if (v) setNeedToken(false)
  }, [])

  useEffect(() => {
    setNext(safeNextPath(new URLSearchParams(window.location.search).get('next'), window.location.origin))
  }, [])

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (sending) return
    setError(null)
    if (!token) {
      setNeedToken(true)
      return
    }
    setSending(true)
    const address = email.trim()
    try {
      await api.requestMagicLink({
        email: address,
        lang,
        turnstileToken: token,
        marketingOptIn: marketing,
        marketingConsentText: consent,
        adult,
      })
      rememberReturnPath(next)
      setSentTo(address)
    } catch (err) {
      setError(err instanceof ApiClientError ? err : new ApiClientError('internal', 0, 'Network error'))
    } finally {
      setSending(false)
      setResetSignal((n) => n + 1)
    }
  }

  if (sentTo) {
    return (
      <section className={`${cls.card} space-y-4`} aria-labelledby={`${id}-sent`} lang={lang}>
        <h1 id={`${id}-sent`} className={cls.h1}>
          {t(lang, 'l.sentTitle')}
        </h1>
        <Notice kind="success">{t(lang, 'l.sentBody', { email: sentTo })}</Notice>
        <button
          type="button"
          className={`${cls.btn} ${cls.secondary}`}
          onClick={() => {
            setSentTo(null)
            setEmail('')
          }}
        >
          {t(lang, 'l.again')}
        </button>
      </section>
    )
  }

  return (
    <section className={`${cls.card} space-y-5`} aria-labelledby={`${id}-title`} lang={lang}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 id={`${id}-title`} className={cls.h1}>
          {t(lang, 'l.title')}
        </h1>
        <LangToggle lang={lang} />
      </div>
      <p className="text-slate-800">{t(lang, 'l.intro')}</p>

      <form onSubmit={onSubmit} className="space-y-5" aria-busy={sending}>
        <div className="space-y-1">
          <label htmlFor={`${id}-email`} className={cls.label}>
            {t(lang, 'l.email')}
          </label>
          <input
            id={`${id}-email`}
            type="email"
            name="email"
            required
            autoComplete="email"
            inputMode="email"
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={cls.input}
          />
        </div>

        <div className="flex items-start gap-3">
          <input
            id={`${id}-adult`}
            type="checkbox"
            required
            checked={adult}
            onChange={(e) => setAdult(e.target.checked)}
            className={cls.checkbox}
          />
          <label htmlFor={`${id}-adult`} className="text-base text-slate-900">
            {t(lang, 'l.adult')}
          </label>
        </div>

        <div className="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
          <input
            id={`${id}-marketing`}
            type="checkbox"
            name="marketing"
            checked={marketing}
            onChange={(e) => setMarketing(e.target.checked)}
            className={cls.checkbox}
          />
          <label htmlFor={`${id}-marketing`} className="text-sm text-slate-800">
            <span className="font-semibold">{t(lang, 'l.optional')} </span>
            <span data-testid="consent-text">{consent}</span>
          </label>
        </div>

        <div className="space-y-2">
          <Turnstile lang={lang} onToken={onToken} resetSignal={resetSignal} />
          {needToken && <Notice kind="error">{t(lang, 'p.securityNeeded')}</Notice>}
        </div>

        {error && <ErrorNotice error={error} lang={lang} context="login" />}

        <button type="submit" className={`${cls.btn} ${cls.primary} w-full`} disabled={sending}>
          {sending ? t(lang, 'l.sending') : t(lang, 'l.submit')}
        </button>
      </form>
    </section>
  )
}
