// Funnel totals over the daily metrics files (memo B8: the daily JSON funnel reconciles to fixture
// purchases ±0). Ads, ad caps and CAC were removed with the ad budget (memo §7.2 Z1).
import { describe, expect, it } from 'vitest'
import m26 from './fixtures/metrics-2026-10-26.json'
import m27 from './fixtures/metrics-2026-10-27.json'
import m28 from './fixtures/metrics-2026-10-28.json'
import purchases from './fixtures/purchases.json'
import { funnel, reconcileFunnel, validDay } from './funnel'
import { validateMetricsFile, type MetricsFile } from './metrics'

const files = [m26, m27, m28] as MetricsFile[]
const window = { from: '2026-10-26', to: '2026-10-28' }

describe('funnel (memo B8)', () => {
  it('uses fixtures that pass the metrics validator (practice events included)', () => {
    for (const f of files) expect(validateMetricsFile(f, f.day)).toEqual([])
  })

  it('reconciles the daily JSON funnel to the fixture purchases ±0', () => {
    const result = reconcileFunnel(files, purchases.map((p) => p.paidAt), window)
    expect(result).toEqual({ expected: 2, purchasesPaid: 2, purchaseEvents: 2, ok: true })
  })

  it('detects a funnel that does not match the purchases', () => {
    const extra = [...purchases.map((p) => p.paidAt), '2026-10-28T10:00:00.000Z']
    expect(reconcileFunnel(files, extra, window).ok).toBe(false)
    // a purchase outside the window is not expected inside it
    expect(reconcileFunnel(files, [...purchases.map((p) => p.paidAt), '2026-10-29T00:00:01.000Z'], window).ok).toBe(true)
  })

  it('sums each step over the window only, including the free practice mode (Z9)', () => {
    expect(funnel(files, window)).toEqual({
      days: 3,
      landing: 133,
      practice_start: 9,
      practice_done: 5,
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
    expect(funnel(files, { from: '2026-10-26', to: '2026-10-26' }).practice_start).toBe(0)
    expect(funnel(files, { from: '2026-11-01', to: '2026-11-30' }).days).toBe(0)
  })

  it('accepts real calendar days only', () => {
    expect(validDay('2026-10-26')).toBe(true)
    expect(validDay('2026-02-30')).toBe(false)
    expect(validDay('26-10-2026')).toBe(false)
    expect(validDay('2026-13-01')).toBe(false)
    expect(validDay(undefined)).toBe(false)
  })
})
