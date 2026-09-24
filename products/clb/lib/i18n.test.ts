import { describe, expect, it } from 'vitest'
import { ERROR_KINDS } from '../shared/api'
import { ALLOWED_PHRASES, findClaims } from '../shared/content-rules'
import { ApiClientError } from './api'
import { describeError } from './errors'
import { errorKindLabel, fill, formatCad, formatClock, t, UI } from './i18n'

describe('UI strings', () => {
  it('make no forbidden claims in either language', () => {
    for (const lang of ['en', 'ko'] as const) {
      for (const [key, text] of Object.entries(UI[lang])) {
        expect({ key, claims: findClaims(text) }).toEqual({ key, claims: [] })
      }
    }
  })

  it('use the exact allowed disclaimer sentence', () => {
    expect(ALLOWED_PHRASES).toContain(t('en', 'r.disclaimer'))
    expect(ALLOWED_PHRASES).toContain(t('ko', 'r.disclaimer'))
  })

  it('label every error kind in both languages', () => {
    for (const kind of ERROR_KINDS) {
      expect(errorKindLabel('en', kind)).not.toContain('_')
      expect(errorKindLabel('ko', kind)).not.toContain('_')
    }
    expect(errorKindLabel('en', 'new_kind')).toBe('new kind')
  })
})

describe('helpers', () => {
  it('fills placeholders', () => {
    expect(fill('{n} of {max}', { n: 3, max: 5 })).toBe('3 of 5')
    expect(fill('{unknown} stays', {})).toBe('{unknown} stays')
  })

  it('formats the countdown clock', () => {
    expect(formatClock(27 * 60)).toBe('27:00')
    expect(formatClock(4.2)).toBe('0:05')
    expect(formatClock(-3)).toBe('0:00')
  })

  it('formats Canadian dollars', () => {
    expect(formatCad(3900)).toBe('C$39')
    expect(formatCad(7950)).toBe('C$79.50')
  })
})

describe('describeError', () => {
  const err = (code: ApiClientError['code'], status = 400, message = 'server says') => new ApiClientError(code, status, message)

  it('links payment_required to pricing', () => {
    expect(describeError(err('payment_required', 402), 'en', 'writing').actions.map((a) => a.href)).toEqual(['/pricing/'])
    expect(describeError(err('payment_required', 402), 'ko', 'writing').actions.map((a) => a.href)).toEqual(['/ko/pricing/'])
  })

  it('offers sign-in and pricing when the free sample is unavailable', () => {
    expect(describeError(err('free_unavailable', 429), 'en', 'writing', '/practice/writing/email/').actions.map((a) => a.href)).toEqual([
      '/login/?next=/practice/writing/email/',
      '/pricing/',
    ])
  })

  it('offers sign-in for unauthorized', () => {
    expect(describeError(err('unauthorized', 401), 'en', 'speaking', '/practice/speaking/advice/').actions[0].href).toBe(
      '/login/?next=/practice/speaking/advice/',
    )
  })

  it('explains the fair-use caps with the configured numbers', () => {
    expect(describeError(err('rate_limited', 429), 'en', 'writing').text).toContain('15 writing and 30 speaking')
    expect(describeError(err('rate_limited', 429), 'en', 'login').text).toContain('wait an hour')
  })

  it('shows the server wording for account policy answers only', () => {
    expect(describeError(err('forbidden', 403, 'Refund window has passed'), 'en', 'account').text).toBe(
      'Refund window has passed',
    )
    expect(describeError(err('forbidden', 403, 'x'), 'en', 'writing').text).toBe(t('en', 'common.generic'))
  })

  it('reports network failures plainly', () => {
    expect(describeError(new ApiClientError('internal', 0, 'Network error'), 'en', 'writing').text).toBe(
      t('en', 'common.network'),
    )
  })
})
