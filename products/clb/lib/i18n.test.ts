import { describe, expect, it } from 'vitest'
import { ERROR_KINDS } from '../shared/api'
import { CAPS } from '../shared/config'
import { ALLOWED_PHRASES, findClaims } from '../shared/content-rules'
import { ApiClientError } from './api'
import { describeError } from './errors'
import { errorKindLabel, fill, formatCad, formatClock, sellerLine, t, UI } from './i18n'

describe('UI strings', () => {
  it('make no forbidden claims in either language', () => {
    for (const lang of ['en', 'ko'] as const) {
      for (const [key, text] of Object.entries(UI[lang])) {
        expect({ key, claims: findClaims(text) }).toEqual({ key, claims: [] })
      }
    }
  })

  it('never promise that purchases open soon (checkout can be off for good)', () => {
    for (const lang of ['en', 'ko'] as const) {
      for (const text of Object.values(UI[lang])) {
        expect(text).not.toMatch(/open soon|곧 구매/)
      }
    }
  })

  it('say "Passes are not sold in Quebec." on the buy card', () => {
    expect(t('en', 'b.notQuebec')).toBe('Passes are not sold in Quebec.')
  })

  it('never promise emails to learners (no learner email at launch, memo §7.2 Z4)', () => {
    for (const lang of ['en', 'ko'] as const) {
      for (const [key, text] of Object.entries(UI[lang])) {
        expect({ key, text: /receipts are (always|still) sent|영수증은 (항상|계속) 보내요|verify your email|이메일 인증 후/.test(text) }).toEqual({
          key,
          text: false,
        })
      }
    }
    expect(t('en', 'a.noEmail')).toContain('We do not send emails')
    expect(t('en', 'c.noEmail')).toContain('We do not send a confirmation email')
    expect(t('en', 'a.receipt')).toBe('View receipt')
    expect(t('ko', 'a.receipt')).toBe('영수증 보기')
  })

  it('say that practice-mode recordings never leave the device', () => {
    expect(t('en', 'pm.practiceNoteSpeaking')).toContain('never uploaded')
    expect(t('en', 'pm.practice')).toBe('Practise without feedback')
    expect(t('ko', 'pm.practiceNoteSpeaking')).toContain('업로드되지 않아요')
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

  it('names the seller once the legal name is configured (memo §7.2 Z5)', () => {
    expect(sellerLine('en', 'Jane Q. Owner')).toBe('Maple Practice Coach is sold by Jane Q. Owner, a sole proprietor in Ontario.')
    expect(sellerLine('ko', ' Jane Q. Owner ')).toBe('메이플 영어 연습 코치는 온타리오주의 개인사업자 Jane Q. Owner이(가) 판매해요.')
    expect(sellerLine('en', '')).toBeNull()
    expect(sellerLine('ko', '   ')).toBeNull()
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

  it('says free samples are off (no sign-in link) when the page knows they are, or the learner is signed in', () => {
    const off = describeError(err('free_unavailable', 429), 'en', 'writing', '/practice/writing/email/', { freeOff: true })
    expect(off.text).toBe('Free samples are not available right now. Get a pass to receive feedback.')
    expect(off.text).toBe(t('en', 'p.freeOff'))
    expect(off.actions.map((a) => a.href)).toEqual(['/pricing/'])
    const signedIn = describeError(err('free_unavailable', 429), 'ko', 'speaking', '/practice/speaking/advice/', { signedIn: true })
    expect(signedIn.text).toBe('지금은 무료 체험을 이용할 수 없어요. 피드백을 받으려면 이용권을 구매해 주세요.')
    expect(signedIn.actions.map((a) => a.href)).toEqual(['/ko/pricing/'])
    // the practice pages never tell a visitor with no sample (free off) that they used it
    for (const lang of ['en', 'ko'] as const) {
      expect(t(lang, 'p.freeOff')).not.toBe(t(lang, 'p.freeUsed'))
      expect(t(lang, 's.signInFreeOff')).not.toMatch(/free after|무료예요/)
    }
  })

  it('offers sign-in for unauthorized', () => {
    expect(describeError(err('unauthorized', 401), 'en', 'speaking', '/practice/speaking/advice/').actions[0].href).toBe(
      '/login/?next=/practice/speaking/advice/',
    )
  })

  it('explains the fair-use caps with the configured numbers, including the no-feedback cap', () => {
    const text = describeError(err('rate_limited', 429), 'en', 'writing').text
    expect(text).toContain(`${CAPS.writingPerDay} writing and ${CAPS.speakingPerDay} speaking`)
    expect(text).toContain(`${CAPS.gradedPer30Days} tasks in 30 days`)
    expect(text).toContain(`up to ${CAPS.noFeedbackPerDay} answers a day that could not get feedback`)
    expect(describeError(err('rate_limited', 429), 'ko', 'speaking').text).toContain(`하루 ${CAPS.noFeedbackPerDay}개`)
    expect(describeError(err('rate_limited', 429), 'en', 'login').text).toContain('wait an hour')
  })

  it('explains an empty speaking transcript instead of a generic bad request', () => {
    const noSpeech = err('bad_request', 400, 'No speech detected. Please check your microphone and try again.')
    expect(describeError(noSpeech, 'en', 'speaking').text).toBe(t('en', 's.noSpeech'))
    expect(describeError(noSpeech, 'ko', 'speaking').text).toBe(t('ko', 's.noSpeech'))
    expect(describeError(noSpeech, 'en', 'writing').text).toBe(t('en', 'err.bad_request'))
  })

  it('uses neutral wording when purchases are off, and asks for a reload on a stale checkout request', () => {
    expect(describeError(err('checkout_unavailable', 503), 'en', 'checkout').text).toBe('Passes are not available to buy right now.')
    expect(describeError(err('checkout_unavailable', 503), 'ko', 'checkout').text).toBe('지금은 이용권을 구매할 수 없어요.')
    expect(describeError(err('bad_request', 400, 'Please reload the page'), 'en', 'checkout').text).toBe(t('en', 'b.reload'))
  })

  it('shows the server wording for account policy answers only', () => {
    expect(describeError(err('forbidden', 403, 'Refund window has passed'), 'en', 'account').text).toBe(
      'Refund window has passed',
    )
    expect(describeError(err('forbidden', 403, 'x'), 'en', 'writing').text).toBe(t('en', 'common.generic'))
  })

  it('says speaking is closed for the day on at_capacity, and when it opens', () => {
    const closed = describeError(err('at_capacity', 503, 'x'), 'en', 'speaking')
    expect(closed.text).toBe(t('en', 's.closedToday'))
    expect(closed.text).toContain('00:00 UTC')
    expect(closed.text).toContain('without feedback')
    expect(describeError(err('at_capacity', 503), 'ko', 'speaking').text).toBe(t('ko', 's.closedToday'))
    expect(describeError(err('at_capacity', 503), 'en', 'writing').text).toBe(t('en', 'err.at_capacity'))
  })

  it('explains Google sign-in problems, and that the email link is for the owner', () => {
    expect(describeError(err('forbidden', 403, 'Google sign-in is not available on this site'), 'en', 'google').text).toBe(
      t('en', 'l.googleOff'),
    )
    expect(describeError(err('not_found', 404, 'Not implemented'), 'ko', 'google').text).toBe(t('ko', 'l.googleOff'))
    expect(describeError(err('rate_limited', 429), 'ko', 'google').text).toBe(t('ko', 'l.tooMany'))
    expect(describeError(err('bad_request', 400), 'en', 'google').text).toBe(t('en', 'b.reload'))
    expect(describeError(err('turnstile_failed', 403), 'en', 'google').text).toBe(t('en', 'err.turnstile_failed'))
    expect(describeError(err('forbidden', 403, 'Sign in with Google'), 'en', 'login').text).toBe(
      'Email links are only for the site owner. Please continue with Google.',
    )
    expect(describeError(err('bad_request', 400), 'en', 'login').text).toBe(t('en', 'l.badEmail'))
  })

  it('reports network failures plainly', () => {
    expect(describeError(new ApiClientError('internal', 0, 'Network error'), 'en', 'writing').text).toBe(
      t('en', 'common.network'),
    )
  })
})
