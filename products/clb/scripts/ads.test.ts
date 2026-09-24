import { describe, expect, it } from 'vitest'
import capJson from '../../../ops/config/ad-cap.json?raw'
import adsFixture from './fixtures/ads.json'
import m26 from './fixtures/metrics-2026-10-26.json'
import m27 from './fixtures/metrics-2026-10-27.json'
import m28 from './fixtures/metrics-2026-10-28.json'
import purchases from './fixtures/purchases.json'
import {
  adsActive,
  adsFreshness,
  adsTotals,
  blendedCac,
  cacExceeds,
  cacReport,
  capStatus,
  funnel,
  parseAdCap,
  parseAdsJson,
  reconcileFunnel,
  type AdCap,
} from './ads'
import type { MetricsFile } from './metrics'

const files = [m26, m27, m28] as MetricsFile[]
const rows = parseAdsJson(JSON.stringify(adsFixture))
const window = { from: '2026-10-26', to: '2026-10-28' }

describe('parseAdsJson', () => {
  it('parses and sorts valid rows', () => {
    const shuffled = [adsFixture[2], adsFixture[0], adsFixture[1]]
    expect(parseAdsJson(JSON.stringify(shuffled)).map((r) => r.date)).toEqual(['2026-10-26', '2026-10-27', '2026-10-28'])
  })

  it('rejects bad shapes with every problem listed', () => {
    expect(() => parseAdsJson('{}')).toThrow(/array/)
    const bad = [
      { date: '2026-02-30', spendCad: -1, clicks: 1.5, impressions: 3, conversions: 0 },
      { date: '2026-10-26', spendCad: 1, clicks: 1, impressions: 3, conversions: 0, email: 'x' },
      { date: '2026-10-26', spendCad: 1, clicks: 1, impressions: 3, conversions: 0 },
    ]
    const err = (() => {
      try {
        parseAdsJson(JSON.stringify(bad))
      } catch (e) {
        return (e as Error).message
      }
      return ''
    })()
    expect(err).toContain('row 1: date')
    expect(err).toContain('row 1: spendCad')
    expect(err).toContain('row 1: clicks')
    expect(err).toContain('row 2: unknown field(s) email')
    expect(err).toContain('row 3: duplicate date 2026-10-26')
  })

  it('never quotes the input in its errors (the personal-data guard prints them)', () => {
    expect(() => parseAdsJson('{"note": "my landlord in Toronto')).toThrow(/^ads\.json is not valid JSON$/)
    const long = [{ date: '2026-10-26', spendCad: 1, clicks: 1, impressions: 3, conversions: 0, 'my landlord refused to fix the heating': 1 }]
    expect(() => parseAdsJson(JSON.stringify(long))).toThrow(/unknown field\(s\) <\d+ chars>/)
    expect(() => parseAdsJson(JSON.stringify(long))).not.toThrow(/landlord/)
  })
})

describe('funnel (memo B8)', () => {
  it('reconciles the daily JSON funnel to the fixture purchases ±0', () => {
    const result = reconcileFunnel(files, purchases.map((p) => p.paidAt), window)
    expect(result).toEqual({ expected: 2, purchasesPaid: 2, purchaseEvents: 2, ok: true })
  })

  it('detects a funnel that does not match the purchases', () => {
    const extra = [...purchases.map((p) => p.paidAt), '2026-10-28T10:00:00.000Z']
    expect(reconcileFunnel(files, extra, window).ok).toBe(false)
  })

  it('sums each step over the window only', () => {
    expect(funnel(files, window)).toEqual({
      days: 3,
      landing: 133,
      sample_start: 19,
      sample_done: 16,
      signup: 6,
      checkout_start: 3,
      purchaseEvents: 2,
      purchasesPaid: 2,
      grossCents: 11800,
      refunds: 1,
    })
    expect(funnel(files, { from: '2026-10-28', to: '2026-10-28' }).landing).toBe(38)
  })
})

describe('CAC', () => {
  it('computes blended CAC = spend ÷ purchases over a window', () => {
    expect(adsTotals(rows, window).spendCad).toBe(57.97)
    expect(blendedCac(57.97, 2)).toBe(28.99)
    expect(blendedCac(57.97, 0)).toBeNull()
    expect(cacReport(rows, files, window)).toMatchObject({ spendCad: 57.97, purchases: 2, adsConversions: 2, blendedCac: 28.99, conservativeCac: 28.99 })
  })

  it('uses the smaller buyer count for the conservative CAC', () => {
    const oneConversion = rows.map((r) => ({ ...r, conversions: r.date === '2026-10-26' ? 1 : 0 }))
    expect(cacReport(oneConversion, files, window).conservativeCac).toBe(57.97)
  })

  it('K4: CAC above first-sale net, including the zero-buyer case', () => {
    expect(cacExceeds(57.97, 2, 27.7)).toBe(true)
    expect(cacExceeds(50, 2, 27.7)).toBe(false)
    expect(cacExceeds(20, 0, 27.7)).toBe(false)
    expect(cacExceeds(30, 0, 27.7)).toBe(true)
  })
})

describe('cap and freshness', () => {
  const cap: AdCap = { ...parseAdCap(capJson), confirmedByOwner: true }

  it('reads the committed ops/config/ad-cap.json', () => {
    expect(parseAdCap(capJson)).toMatchObject({ capCad: 1200, dailyCad: 20, startDate: '2026-10-26', endDate: '2026-11-08', confirmedByOwner: false })
  })

  it('treats ads as running only when confirmed and inside the campaign dates', () => {
    expect(adsActive(cap, '2026-10-30')).toBe(true)
    expect(adsActive(cap, '2026-11-09')).toBe(false)
    expect(adsActive(cap, '2026-10-25')).toBe(false)
    expect(adsActive({ ...cap, confirmedByOwner: false }, '2026-10-30')).toBe(false)
  })

  it('marks ads.json stale after more than two days without a new row', () => {
    expect(adsFreshness(rows, '2026-10-30')).toEqual({ latest: '2026-10-28', ageDays: 2, stale: false })
    expect(adsFreshness(rows, '2026-10-31').stale).toBe(true)
    expect(adsFreshness([], '2026-10-27')).toEqual({ latest: null, ageDays: null, stale: true })
  })

  it('does not alert in the first 48 hours of a campaign: age counts from startDate − 1 day (R59)', () => {
    // no report can exist before the day after the start day
    expect(adsFreshness([], '2026-10-26', '2026-10-26')).toEqual({ latest: null, ageDays: 1, stale: false })
    expect(adsFreshness([], '2026-10-27', '2026-10-26')).toEqual({ latest: null, ageDays: 2, stale: false })
    expect(adsFreshness([], '2026-10-28', '2026-10-26')).toEqual({ latest: null, ageDays: 3, stale: true })
    // rows from an earlier campaign do not make a new campaign stale on its first days
    expect(adsFreshness(rows, '2026-11-11', '2026-11-10')).toMatchObject({ latest: '2026-10-28', ageDays: 2, stale: false })
    // once rows arrive, age is measured from the newest row
    expect(adsFreshness(rows, '2026-10-30', '2026-10-26')).toMatchObject({ ageDays: 2, stale: false })
    expect(adsFreshness(rows, '2026-10-31', '2026-10-26').stale).toBe(true)
  })

  it('tracks spend against the cap', () => {
    expect(capStatus(rows, cap)).toEqual({ spentCad: 57.97, capCad: 1200, remainingCad: 1142.03, overCap: false })
    expect(capStatus(rows, { ...cap, capCad: 50 }).overCap).toBe(true)
  })
})
