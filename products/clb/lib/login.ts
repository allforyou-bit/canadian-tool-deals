// Sign-in page logic (memo §7.2 Z3): learners sign in with Google; the email link is only for the owner
// unless the deployment sets MAGIC_LINK = 'all'. Pure functions, so the rules are unit-tested.
import type { MeResponse } from '../shared/api'
import { AUTH_DEFAULTS } from '../shared/config'
import type { UiKey } from './i18n'

/**
 * `?error=` values the Worker's Google callback redirects to (CONTRACT §2: /login/?error=…;
 * worker/src/auth-google.ts GoogleSignInError). Any other value is shown as google_failed.
 */
export const LOGIN_ERRORS = [
  'google_cancelled',
  'google_failed',
  'email_unverified',
  'google_expired',
  'disposable_email',
  'staging_only',
] as const
export type LoginError = (typeof LOGIN_ERRORS)[number]

export const LOGIN_ERROR_TEXT: Record<LoginError, UiKey> = {
  google_cancelled: 'l.err.google_cancelled',
  google_failed: 'l.err.google_failed',
  email_unverified: 'l.err.email_unverified',
  google_expired: 'l.err.google_expired',
  disposable_email: 'l.err.disposable_email',
  staging_only: 'l.err.staging_only',
}

/** The callback's error, or null. Any other non-empty value is shown as a failed sign-in. */
export function loginErrorFromSearch(search: string): LoginError | null {
  const v = new URLSearchParams(search).get('error')
  if (!v) return null
  return (LOGIN_ERRORS as readonly string[]).includes(v) ? (v as LoginError) : 'google_failed'
}

export type EmailLinkMode = MeResponse['auth']['magicLink']

export interface SignInOptions {
  /** show "Continue with Google" */
  google: boolean
  /** the email-link form: hidden ('off'), for the owner only ('owner'), or for everyone ('all') */
  emailLink: EmailLinkMode
}

/**
 * What the sign-in page offers. While /api/me loads or fails, the Google button is shown (the Worker
 * decides) and the email link is not. An older Worker without `auth` gets the launch defaults.
 */
export function signInOptions(me: MeResponse | null): SignInOptions {
  if (!me) return { google: true, emailLink: 'off' }
  const auth = me.auth ?? { google: true, magicLink: AUTH_DEFAULTS.magicLink }
  const emailLink: EmailLinkMode = auth.magicLink === 'all' || auth.magicLink === 'off' ? auth.magicLink : 'owner'
  return { google: auth.google !== false, emailLink }
}
