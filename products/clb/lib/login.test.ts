import { describe, expect, it } from 'vitest'
import type { MeResponse } from '../shared/api'
import { t } from './i18n'
import { LOGIN_ERROR_TEXT, LOGIN_ERRORS, loginErrorFromSearch, signInOptions } from './login'

function me(auth?: MeResponse['auth']): MeResponse {
  return {
    signedIn: false,
    free: { writing: true, speaking: false },
    usage: { writingToday: 0, speakingToday: 0, graded30d: 0 },
    flags: { checkoutEnabled: true, gradingEnabled: true, freeEnabled: true, banner: '', speakingAvailable: true },
    ...(auth ? { auth } : {}),
  } as MeResponse
}

describe('loginErrorFromSearch', () => {
  it("reads the Google callback's error codes", () => {
    expect(loginErrorFromSearch('?error=google_cancelled')).toBe('google_cancelled')
    expect(loginErrorFromSearch('?next=/account/&error=email_unverified')).toBe('email_unverified')
    expect(loginErrorFromSearch('?error=google_failed&lang=ko')).toBe('google_failed')
    expect(loginErrorFromSearch('?error=google_expired')).toBe('google_expired')
    expect(loginErrorFromSearch('?error=disposable_email')).toBe('disposable_email')
    expect(loginErrorFromSearch('?error=staging_only')).toBe('staging_only')
  })

  it('shows any other value as a failed sign-in, and nothing without one', () => {
    expect(loginErrorFromSearch('?error=<script>')).toBe('google_failed')
    expect(loginErrorFromSearch('?error=')).toBeNull()
    expect(loginErrorFromSearch('?next=/account/')).toBeNull()
    expect(loginErrorFromSearch('')).toBeNull()
  })

  it('has an English and a Korean message for every code', () => {
    for (const code of LOGIN_ERRORS) {
      expect(t('en', LOGIN_ERROR_TEXT[code]).length).toBeGreaterThan(20)
      expect(t('ko', LOGIN_ERROR_TEXT[code]).length).toBeGreaterThan(10)
      expect(t('ko', LOGIN_ERROR_TEXT[code])).not.toBe(t('en', LOGIN_ERROR_TEXT[code]))
    }
    expect(t('en', 'l.err.google_cancelled')).toContain('cancelled')
    expect(t('en', 'l.err.email_unverified')).toContain('verified email address')
  })
})

describe('signInOptions', () => {
  it('offers Google, and the email link as the deployment says', () => {
    expect(signInOptions(me({ google: true, magicLink: 'owner' }))).toEqual({ google: true, emailLink: 'owner' })
    expect(signInOptions(me({ google: true, magicLink: 'off' }))).toEqual({ google: true, emailLink: 'off' })
    expect(signInOptions(me({ google: true, magicLink: 'all' }))).toEqual({ google: true, emailLink: 'all' })
    // staging without a Google client: the owner signs in by email link
    expect(signInOptions(me({ google: false, magicLink: 'owner' }))).toEqual({ google: false, emailLink: 'owner' })
  })

  it('shows Google and hides the email link while /api/me is unknown', () => {
    expect(signInOptions(null)).toEqual({ google: true, emailLink: 'off' })
  })

  it('uses the launch defaults for an older Worker without auth, and treats unknown values as owner-only', () => {
    expect(signInOptions(me())).toEqual({ google: true, emailLink: 'owner' })
    expect(signInOptions(me({ google: true, magicLink: 'everyone' as 'all' }))).toEqual({ google: true, emailLink: 'owner' })
  })

  it('labels the email link for the owner', () => {
    expect(t('en', 'l.ownerTitle')).toBe('Owner sign-in by email link')
    expect(t('en', 'l.google')).toBe('Continue with Google')
    expect(t('ko', 'l.google')).toBe('Google로 계속하기')
    expect(t('en', 'l.googleNote')).toContain('we never see your Google password')
  })
})
