// Tests for the level-B Lighthouse assertion (scripts/lighthouse-check.ts, memo B1). Report shapes follow
// the Lighthouse repo's docs/understanding-results.md; no browser or network is involved.
import { describe, expect, it } from 'vitest'
import { evaluateLighthouse, median, scoreFromReport } from './lighthouse-check'

const report = (score: number | null, over: Record<string, unknown> = {}) => ({
  lighthouseVersion: '13.5.0',
  finalDisplayedUrl: 'https://coach.test/',
  configSettings: { formFactor: 'mobile' },
  categories: { performance: { id: 'performance', score } },
  ...over,
})

describe('scoreFromReport', () => {
  it('reads the mobile performance score on a 0–100 scale', () => {
    expect(scoreFromReport(report(0.87))).toEqual({ score: 87, url: 'https://coach.test/' })
    // 0.57 * 100 is 56.99999999999999 in floating point
    expect(scoreFromReport(report(0.57)).score).toBe(57)
  })

  it('does not count errored, desktop, scoreless or foreign reports', () => {
    expect(scoreFromReport(report(0.9, { runtimeError: { code: 'NO_FCP', message: 'x' } })).problem).toMatch(/NO_FCP/)
    expect(scoreFromReport(report(0.99, { configSettings: { formFactor: 'desktop' } })).problem).toMatch(/want mobile/)
    expect(scoreFromReport(report(null)).problem).toMatch(/score is missing/)
    expect(scoreFromReport(report(0.9, { categories: {} })).problem).toMatch(/no performance category/)
    expect(scoreFromReport('nope').score).toBeNull()
  })
})

describe('evaluateLighthouse', () => {
  it('passes on a median of at least the minimum, even when one run is slow', () => {
    const v = evaluateLighthouse(
      [
        { name: 'run-1', report: report(0.91) },
        { name: 'run-2', report: report(0.62) },
        { name: 'run-3', report: report(0.86) },
      ],
      85,
    )
    expect(v.ok).toBe(true)
    expect(v.median).toBe(86)
  })

  it('fails below the minimum and when no run counts', () => {
    expect(evaluateLighthouse([{ name: 'a', report: report(0.84) }, { name: 'b', report: report(0.8) }, { name: 'c', report: report(0.9) }], 85).ok).toBe(false)
    const none = evaluateLighthouse([{ name: 'a', report: null }, { name: 'b', report: report(null) }], 85)
    expect(none).toMatchObject({ ok: false, median: null })
    expect(none.lines.join(' ')).toMatch(/report missing/)
  })

  it('uses the runs that count when one failed', () => {
    const v = evaluateLighthouse([{ name: 'a', report: null }, { name: 'b', report: report(0.88) }, { name: 'c', report: report(0.9) }], 85)
    expect(v).toMatchObject({ ok: true, median: 89 })
  })

  it('computes the median of odd and even counts', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([90, 80])).toBe(85)
  })
})
