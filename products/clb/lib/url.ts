// URL safety helpers for redirects (?next=) and the checkout hand-off.
import type { Lang } from '../shared/api'

/**
 * A same-origin path that is safe to navigate to after sign-in, or null. Rejects absolute and
 * protocol-relative URLs, backslash tricks and anything that resolves to another origin.
 */
export function safeNextPath(value: string | null | undefined, origin: string): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null
  if (/[\u0000-\u001f]/.test(value)) return null
  try {
    const url = new URL(value, origin)
    if (url.origin !== new URL(origin).origin) return null
    // never bounce back into the sign-in flow itself
    if (url.pathname.startsWith('/auth/') || url.pathname.startsWith('/login/')) return null
    return url.pathname + url.search + url.hash
  } catch {
    return null
  }
}

/** The Stripe Checkout URL from POST /api/checkout must be https before we hand the tab over. */
export function isSafeCheckoutUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Google's authorization endpoint (https://accounts.google.com/o/oauth2/v2/auth, from Google's OpenID
 * discovery document, read 2026-09-24). The sign-in page hands the tab over only to an https URL on
 * that host, so a faulty or tampered /api answer cannot send the learner anywhere else.
 */
export const GOOGLE_AUTH_HOST = 'accounts.google.com'

export function isGoogleSignInUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname === GOOGLE_AUTH_HOST && url.username === '' && url.password === ''
  } catch {
    return false
  }
}

/**
 * Stripe's hosted receipt (MeResponse.latestPurchase.receiptUrl), or null. Only https links are shown;
 * the host is not restricted because Stripe does not document it in its API reference.
 */
export function safeReceiptUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 5000) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.username === '' && url.password === '' ? url.href : null
  } catch {
    return null
  }
}

/** /login/ link that returns to `next` after verification (and keeps Korean when asked). */
export function loginHref(next?: string, lang: Lang = 'en'): string {
  const params = new URLSearchParams()
  if (next) params.set('next', next)
  if (lang === 'ko') params.set('lang', 'ko')
  const qs = params.toString()
  // keep "/" readable in the query: /login/?next=/pricing/
  return qs ? `/login/?${qs.replace(/%2F/gi, '/')}` : '/login/'
}

/** Read the sign-in token from the magic-link fragment: "#token=abc" (or a bare "#abc"). */
export function tokenFromHash(hash: string): string | null {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  if (!raw) return null
  if (raw.includes('=')) {
    const v = new URLSearchParams(raw).get('token')
    return v ? v : null
  }
  return /^[A-Za-z0-9_-]{16,}$/.test(raw) ? raw : null
}

/**
 * Read the unsubscribe link fragment "#h=<email hash>&s=<signature>" (both hex, from the Worker's
 * unsubscribeUrl). null when either part is missing or malformed; the Worker checks the signature.
 */
export function unsubscribeFromHash(hash: string): { h: string; s: string } | null {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  const params = new URLSearchParams(raw)
  const h = params.get('h') ?? ''
  const s = params.get('s') ?? ''
  const hex = /^[0-9a-fA-F]{16,128}$/
  return hex.test(h) && hex.test(s) ? { h, s } : null
}
