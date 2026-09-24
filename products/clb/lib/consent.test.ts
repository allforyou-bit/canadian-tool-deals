import { describe, expect, it } from 'vitest'
import { MARKETING_CONSENT } from '../shared/config'
import { ADDRESS_FALLBACK, consentText } from './consent'

describe('consentText', () => {
  it('uses the configured wording with the mailing address and site URL', () => {
    const text = consentText('en', '1 Test St, Toronto ON', 'https://coach.test')
    expect(text).toBe(MARKETING_CONSENT.en('1 Test St, Toronto ON', 'https://coach.test'))
    expect(text).toContain('withdraw')
  })

  it('falls back to pointing at the Privacy page when no address is configured', () => {
    expect(consentText('en', '  ', 'https://coach.test')).toContain(ADDRESS_FALLBACK.en)
    expect(consentText('ko', '', 'https://coach.test')).toBe(MARKETING_CONSENT.ko(ADDRESS_FALLBACK.ko, 'https://coach.test'))
  })
})
