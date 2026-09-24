// Region rules and billing text (claims lint for every message and email, both languages).
import { describe, expect, it } from 'vitest'
import { findClaims } from '../../../shared/content-rules'
import { ERRORS, formatCad, formatUtc, langOf, passActiveEmail, regionRefundEmail, selfRefundEmail } from '../../src/billing/messages'
import { evidenceAllowed, inSalesRegion, normalizeRegion } from '../../src/billing/region'

describe('sales region', () => {
  it.each([
    ['CA', 'ON', true],
    ['ca', 'bc', true],
    ['CA', null, true],
    ['CA', 'QC', false],
    ['CA', 'qc', false],
    ['CA', 'Québec', false],
    ['CA', 'CA-QC', false],
    ['US', 'WA', false],
    [null, null, false],
    ['', 'ON', false],
  ])('inSalesRegion(%s, %s) is %s', (country, region, expected) => {
    expect(inSalesRegion(country, region)).toBe(expected)
  })

  it('normalizes subdivision spellings', () => {
    expect(normalizeRegion(' quebec ')).toBe('QC')
    expect(normalizeRegion('ON')).toBe('ON')
    expect(normalizeRegion('')).toBeNull()
    expect(normalizeRegion('   ')).toBeNull()
  })

  it('needs a Canadian card as well as a Canadian address outside Quebec', () => {
    const base = {
      chargeId: 'ch_1',
      paymentMethodType: 'card',
      billingCountry: 'CA',
      billingRegion: 'AB',
      cardCountry: 'CA',
      cardFingerprint: null,
    }
    expect(evidenceAllowed(base)).toBe(true)
    // Link, BNPL and bank payments fail even with a Canadian address (Checkout is card-only)
    expect(evidenceAllowed({ ...base, paymentMethodType: 'link' })).toBe(false)
    expect(evidenceAllowed({ ...base, paymentMethodType: 'klarna', cardCountry: null })).toBe(false)
    expect(evidenceAllowed({ ...base, paymentMethodType: null })).toBe(false)
    expect(evidenceAllowed({ ...base, cardCountry: 'US' })).toBe(false)
    expect(evidenceAllowed({ ...base, cardCountry: null })).toBe(false)
    expect(evidenceAllowed({ ...base, billingRegion: 'QC' })).toBe(false)
    expect(evidenceAllowed({ ...base, billingCountry: 'MX' })).toBe(false)
  })
})

const RECEIPT = 'https://pay.stripe.com/receipts/payment/CAcaFwoVYWNjdF90ZXN0'

describe('billing text', () => {
  const site = 'https://coach.test'
  const texts: string[] = []
  for (const lang of ['en', 'ko'] as const) {
    for (const t of Object.values(ERRORS)) texts.push(t[lang])
    for (const mail of [
      passActiveEmail(lang, 'pass30', '2026-10-24T05:55:33.123Z', site),
      passActiveEmail(lang, 'pass90', '2026-12-24T05:55:33.123Z', site, RECEIPT),
      regionRefundEmail(lang, 3900, site),
      regionRefundEmail(lang, 3900, site, RECEIPT),
      selfRefundEmail(lang, 7900),
      selfRefundEmail(lang, 7900, RECEIPT),
    ]) {
      texts.push(mail.subject, mail.text)
    }
  }

  it('has no forbidden claims in any message or email', () => {
    for (const t of texts) expect(findClaims(t), t).toEqual([])
  })

  it('formats money, dates and languages', () => {
    expect(formatCad(3900)).toBe('C$39.00')
    expect(formatCad(7950)).toBe('C$79.50')
    expect(formatUtc('2026-10-24T05:55:33.123Z')).toBe('2026-10-24 05:55 UTC')
    expect(langOf('ko')).toBe('ko')
    expect(langOf('fr')).toBe('en')
    expect(passActiveEmail('ko', 'pass30', '2026-10-24T05:55:33.123Z', site).text).toContain('30일 이용권은 2026-10-24 05:55 UTC까지')
    expect(passActiveEmail('en', 'pass90', '2026-10-24T05:55:33.123Z', site).text).toContain('Your 90-day pass is active until')
  })

  it('adds the Stripe receipt link to buyer emails only when there is one', () => {
    const withReceipt = [
      passActiveEmail('en', 'pass30', '2026-10-24T05:55:33.123Z', site, RECEIPT),
      regionRefundEmail('en', 3900, site, RECEIPT),
      selfRefundEmail('en', 3900, RECEIPT),
    ]
    for (const mail of withReceipt) expect(mail.text).toContain(`\n\nReceipt (Stripe): ${RECEIPT}\n\n`)
    expect(passActiveEmail('ko', 'pass30', '2026-10-24T05:55:33.123Z', site, RECEIPT).text).toContain(`영수증(Stripe): ${RECEIPT}`)
    for (const mail of [
      passActiveEmail('en', 'pass30', '2026-10-24T05:55:33.123Z', site, null),
      regionRefundEmail('ko', 3900, site, ''),
      selfRefundEmail('en', 3900),
    ]) {
      expect(mail.text).not.toMatch(/Receipt|영수증/)
      expect(mail.text).not.toContain('\n\n\n')
    }
  })
})
