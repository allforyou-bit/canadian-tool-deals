import { describe, expect, it } from 'vitest'
import { MARKETING_CONSENT } from '../shared/config'
import { canAskMarketingConsent, consentText } from './consent'

describe('consentText', () => {
  it('is exactly MARKETING_CONSENT[lang](address, siteUrl), the sentence the Worker rebuilds', () => {
    const address = '1 Test St, Toronto ON M5V 0A1'
    expect(consentText('en', address, 'https://coach.test')).toBe(MARKETING_CONSENT.en(address, 'https://coach.test'))
    expect(consentText('ko', address, 'https://coach.test')).toBe(MARKETING_CONSENT.ko(address, 'https://coach.test'))
    expect(consentText('en', address, 'https://coach.test')).toContain('withdraw')
  })

  it('normalises the values exactly like the Worker (address trimmed, no trailing slash on the URL)', () => {
    // worker/src/auth.ts expectedConsentText: MAILING_ADDRESS.trim(), SITE_URL.replace(/\/+$/, '')
    expect(consentText('en', ' 1 Test St \n', 'https://coach.test//')).toBe(MARKETING_CONSENT.en('1 Test St', 'https://coach.test'))
  })

  it('asks for nothing while the mailing address is missing or still the placeholder', () => {
    expect(consentText('en', '', 'https://coach.test')).toBeNull()
    expect(consentText('ko', '   ', 'https://coach.test')).toBeNull()
    expect(consentText('en', 'SET-BEFORE-LAUNCH (CASL: owner mailing address)', 'https://coach.test')).toBeNull()
    expect(canAskMarketingConsent('SET-BEFORE-LAUNCH')).toBe(false)
    expect(canAskMarketingConsent('1 Test St, Toronto ON')).toBe(true)
  })
})
