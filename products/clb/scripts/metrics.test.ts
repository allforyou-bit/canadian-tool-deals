import { describe, expect, it } from 'vitest'
import day26 from './fixtures/metrics-2026-10-26.json'
import { parseD1Json } from './lib/d1'
import { findPersonalData, isTokenLike } from './lib/pii-guard'
import { isFresh, serializeMetricsFile, toMetricsFile, validateDailyMetrics } from './metrics'

// what `wrangler d1 execute DB --remote --json --command "SELECT day, json, created_at FROM metrics_daily ..."` prints
const wranglerOutput = JSON.stringify([
  {
    results: [{ day: '2026-10-26', json: JSON.stringify(day26.metrics), created_at: '2026-10-27T05:00:02.114Z' }],
    success: true,
    meta: { duration: 0.2 },
  },
])

describe('parseD1Json', () => {
  it('returns the rows of the first statement, ignoring noise before the JSON', () => {
    expect(parseD1Json(`warning line\n${wranglerOutput}`)).toHaveLength(1)
  })

  it('throws on wrangler errors without echoing data', () => {
    expect(() => parseD1Json('{"error":{"text":"no such table: metrics_daily"}}')).toThrow(/no such table/)
    expect(() => parseD1Json('nothing here')).toThrow()
  })
})

describe('toMetricsFile', () => {
  it('builds the committed file from a metrics_daily row', () => {
    const [row] = parseD1Json(wranglerOutput)
    const file = toMetricsFile(row)
    expect(file).toEqual(day26)
    expect(serializeMetricsFile(file).endsWith('}\n')).toBe(true)
  })

  it('rejects rows whose JSON is not the aggregate shape', () => {
    expect(() => toMetricsFile({ day: '2026-10-26', json: '{"day":"2026-10-26"}' })).toThrow(/events must be an object/)
    expect(() => toMetricsFile({ day: '2026-10-26', json: 'not json' })).toThrow(/not valid JSON/)
    expect(() => toMetricsFile({ day: '2026-10-25', json: JSON.stringify(day26.metrics) })).toThrow(/differ/)
    expect(validateDailyMetrics({ ...day26.metrics, costUsd: -1 })).toContain('costUsd must be a non-negative number')
  })
})

describe('personal-data guard', () => {
  it('passes a real metrics file', () => {
    expect(findPersonalData(serializeMetricsFile(toMetricsFile(parseD1Json(wranglerOutput)[0])))).toEqual([])
  })

  it('fails on an @, on text fields and on token-like strings, without returning the value', () => {
    const leaked = JSON.stringify({ contact: 'someone@example.com', input_text: 'My essay', transcript: 'x', id: 'cs_live_a1B2c3D4e5F6g7H8' }, null, 2)
    const findings = findPersonalData(leaked)
    expect(findings.map((f) => f.rule)).toEqual(expect.arrayContaining(['at_sign', 'forbidden_word', 'token_like']))
    expect(findings.filter((f) => f.rule === 'forbidden_word').map((f) => f.word).sort()).toEqual(['essay', 'input_text', 'transcript'])
    expect(JSON.stringify(findings)).not.toContain('someone')
    expect(findPersonalData('{"emailsSent": 3}').map((f) => f.word)).toEqual(['email'])
  })

  it('treats long mixed identifiers as tokens but not keys, dates or model ids', () => {
    expect(isTokenLike('0123456789abcdef0123')).toBe(true)
    expect(isTokenLike('123e4567-e89b-12d3-a456-426614174000')).toBe(true)
    expect(isTokenLike('checkout_start_count')).toBe(false)
    expect(isTokenLike('claude-haiku-4-5')).toBe(false)
    expect(isTokenLike('2026-10-27T05')).toBe(false)
  })
})

describe('isFresh', () => {
  it('accepts yesterday or later (UTC) and rejects older or missing rows', () => {
    const now = new Date('2026-10-28T07:30:00Z')
    expect(isFresh('2026-10-27', now)).toBe(true)
    expect(isFresh('2026-10-28', now)).toBe(true)
    expect(isFresh('2026-10-26', now)).toBe(false)
    expect(isFresh(null, now)).toBe(false)
  })
})
