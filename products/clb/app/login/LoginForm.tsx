'use client'

import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { LangToggle } from '../../components/LangToggle'
import { ErrorNotice, Notice } from '../../components/Notice'
import { Turnstile } from '../../components/Turnstile'
import { cls } from '../../components/ui'
import { api, ApiClientError } from '../../lib/api'
import { useMe, useUiLang } from '../../lib/hooks'
import { t, type UiKey } from '../../lib/i18n'
import { LOGIN_ERROR_TEXT, loginErrorFromSearch, signInOptions, type LoginError } from '../../lib/login'
import { rememberReturnPath } from '../../lib/return-path'
import { isGoogleSignInUrl, safeNextPath } from '../../lib/url'

const toClientError = (e: unknown) => (e instanceof ApiClientError ? e : new ApiClientError('internal', 0, 'Network error'))

/**
 * Sign-in (memo §7.2 Z3). Learners: a required 18+ box, Turnstile and "Continue with Google", which asks
 * POST /api/auth/google/start for Google's URL and hands the tab over; the Worker's callback comes back
 * here with ?error= when Google sign-in did not work. The email link is shown only when the deployment
 * offers it (MeResponse.auth.magicLink): for the owner by default. No marketing box: learners get no
 * email from us (memo §7.2 Z4).
 */
export function LoginForm() {
  const lang = useUiLang()
  const meState = useMe()
  const id = useId()
  const [adult, setAdult] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [resetSignal, setResetSignal] = useState(0)
  const [next, setNext] = useState<string | null>(null)
  const [callbackError, setCallbackError] = useState<LoginError | null>(null)
  // the check that failed before anything was sent (18+ box, security check, email address)
  const [localError, setLocalError] = useState<UiKey | null>(null)

  const [googlePending, setGooglePending] = useState(false)
  const [googleError, setGoogleError] = useState<ApiClientError | null>(null)

  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [linkError, setLinkError] = useState<ApiClientError | null>(null)
  const [emailMissing, setEmailMissing] = useState(false)
  const sentRef = useRef<HTMLHeadingElement>(null)

  const options = signInOptions(meState.status === 'ready' ? meState.me : null)

  const onToken = useCallback((v: string | null) => {
    setToken(v)
    if (v) setLocalError((e) => (e === 'p.securityNeeded' ? null : e))
  }, [])

  useEffect(() => {
    setNext(safeNextPath(new URLSearchParams(window.location.search).get('next'), window.location.origin))
    setCallbackError(loginErrorFromSearch(window.location.search))
  }, [])

  // Back from Google's page (the browser may restore this page from its cache): the button must work
  // again, and the used security token must be replaced.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return
      setGooglePending(false)
      setResetSignal((n) => n + 1)
    }
    window.addEventListener('pageshow', onShow)
    return () => window.removeEventListener('pageshow', onShow)
  }, [])

  // the form (and the focused submit button) is replaced by the confirmation: move focus there
  useEffect(() => {
    if (sentTo) sentRef.current?.focus()
  }, [sentTo])

  /** The checks both sign-in methods share: the security token, or null (and why) when one is missing. */
  function readyToken(): string | null {
    if (!adult) {
      setLocalError('w.adultNeeded')
      return null
    }
    if (!token) {
      setLocalError('p.securityNeeded')
      return null
    }
    setLocalError(null)
    return token
  }

  async function continueWithGoogle() {
    if (googlePending || sending) return
    setGoogleError(null)
    setLinkError(null)
    setEmailMissing(false)
    const turnstileToken = readyToken()
    if (!turnstileToken) return
    setGooglePending(true)
    try {
      const { url } = await api.googleStart({ lang, adult: true, turnstileToken, ...(next ? { next } : {}) })
      if (!isGoogleSignInUrl(url)) throw new ApiClientError('internal', 200, 'Unexpected sign-in address')
      // leave the button disabled: the tab is moving to Google
      window.location.assign(url)
    } catch (err) {
      setGoogleError(toClientError(err))
      setGooglePending(false)
      // Turnstile tokens are single-use
      setResetSignal((n) => n + 1)
    }
  }

  async function sendLink(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (sending || googlePending) return
    setLinkError(null)
    setGoogleError(null)
    const address = email.trim()
    setEmailMissing(!address)
    if (!address) return
    const turnstileToken = readyToken()
    if (!turnstileToken) return
    setSending(true)
    try {
      await api.requestMagicLink({
        email: address,
        lang,
        turnstileToken,
        marketingOptIn: false,
        marketingConsentText: '',
        adult: true,
      })
      rememberReturnPath(next)
      setSentTo(address)
    } catch (err) {
      setLinkError(toClientError(err))
    } finally {
      setSending(false)
      setResetSignal((n) => n + 1)
    }
  }

  if (sentTo) {
    return (
      <section className={`${cls.card} space-y-4`} aria-labelledby={`${id}-sent`} lang={lang}>
        <h1 id={`${id}-sent`} ref={sentRef} tabIndex={-1} className={`${cls.h1} focus:outline-none`}>
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

  const busy = googlePending || sending
  const emailLink = options.emailLink

  return (
    // data-me tells end-to-end tests when the sign-in options from /api/me are applied
    <section className={`${cls.card} space-y-5`} aria-labelledby={`${id}-title`} lang={lang} data-me={meState.status}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 id={`${id}-title`} className={cls.h1}>
          {t(lang, 'l.title')}
        </h1>
        <LangToggle lang={lang} />
      </div>
      {callbackError && (
        <Notice kind="error">
          <p data-testid="login-callback-error">{t(lang, LOGIN_ERROR_TEXT[callbackError])}</p>
        </Notice>
      )}
      <p className="text-slate-800">{t(lang, 'l.intro')}</p>

      <div className="space-y-5" aria-busy={busy}>
        <div className="flex items-start gap-3">
          <input
            id={`${id}-adult`}
            type="checkbox"
            required
            aria-required="true"
            checked={adult}
            onChange={(e) => {
              setAdult(e.target.checked)
              if (e.target.checked && localError === 'w.adultNeeded') setLocalError(null)
            }}
            className={cls.checkbox}
          />
          <label htmlFor={`${id}-adult`} className="text-base text-slate-900">
            {t(lang, 'l.adult')}
          </label>
        </div>

        <div className="space-y-2">
          <p className={cls.label}>{t(lang, 'p.securityCheck')}</p>
          <Turnstile lang={lang} onToken={onToken} resetSignal={resetSignal} />
        </div>

        {localError && <Notice kind="error">{t(lang, localError)}</Notice>}
        {googleError && <ErrorNotice error={googleError} lang={lang} context="google" />}

        {options.google ? (
          <div className="space-y-2">
            <button
              type="button"
              className={`${cls.btn} ${cls.secondary} w-full border-slate-500`}
              onClick={() => void continueWithGoogle()}
              disabled={busy}
            >
              {googlePending ? t(lang, 'l.googleOpening') : t(lang, 'l.google')}
            </button>
            <p className={cls.muted}>{t(lang, 'l.googleNote')}</p>
          </div>
        ) : (
          <Notice kind="info">{t(lang, 'l.googleOff')}</Notice>
        )}
      </div>

      {emailLink !== 'off' && (
        <details className="rounded-md border border-slate-200 bg-slate-50 p-3" open={!options.google}>
          <summary className="cursor-pointer font-semibold text-slate-900">
            {t(lang, emailLink === 'owner' ? 'l.ownerTitle' : 'l.allTitle')}
          </summary>
          <form onSubmit={sendLink} className="mt-3 space-y-3" aria-busy={sending} noValidate>
            <p className="text-sm text-slate-800">{t(lang, emailLink === 'owner' ? 'l.ownerNote' : 'l.emailIntro')}</p>
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
                onChange={(e) => {
                  setEmail(e.target.value)
                  setEmailMissing(false)
                }}
                aria-invalid={emailMissing || undefined}
                className={cls.input}
              />
            </div>
            {emailMissing && <Notice kind="error">{t(lang, 'l.badEmail')}</Notice>}
            {linkError && <ErrorNotice error={linkError} lang={lang} context="login" />}
            <button type="submit" className={`${cls.btn} ${cls.secondary}`} disabled={busy}>
              {sending ? t(lang, 'l.sending') : t(lang, 'l.submit')}
            </button>
          </form>
        </details>
      )}
    </section>
  )
}
