import { describe, expect, it } from 'vitest'
import day26 from './fixtures/metrics-2026-10-26.json'
import { parseD1Json } from './lib/d1'
import { findPersonalData, isTokenLike } from './lib/pii-guard'
import { classifyMetricsPath, guardFile, guardPaths, isFresh, serializeMetricsFile, toMetricsFile, validateDailyMetrics, validateMetricsFile, type GuardFs } from './metrics'

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

describe('validateDailyMetrics allowlist (R61)', () => {
  const base = day26.metrics

  it('accepts the Worker shape, with and without paidEvents', () => {
    expect(validateDailyMetrics(base)).toEqual([])
    expect(validateDailyMetrics({ ...base, paidEvents: { sample_start: 2, landing: 9 } })).toEqual([])
    expect(validateDailyMetrics({ ...base, paidEvents: {} })).toEqual([])
    expect(validateDailyMetrics({ ...base, outcomes: { graded: 12, failed: 1, pending: 0 } })).toEqual([])
    expect(validateDailyMetrics({ ...base, outcomes: { graded: 1, essay_text: 1 } })).toContain('outcomes.essay_text is not an allowed field')
  })

  it('rejects unknown keys at every level, including a free-text field', () => {
    const note = { ...base, note: 'My landlord in Toronto refused to fix the heating' }
    expect(validateDailyMetrics(note)).toContain('note is not an allowed field')
    expect(validateDailyMetrics({ ...base, events: { ...base.events, tickets: 1 } })).toContain('events.tickets is not an allowed field')
    expect(validateDailyMetrics({ ...base, grades: { ...base.grades, comment: 1 } })).toContain('grades.comment is not an allowed field')
    expect(validateDailyMetrics({ ...base, paidEvents: { sample_start: 1, gclid: 1 } })).toContain('paidEvents.gclid is not an allowed field')
    // a long key is described by its length, never printed
    const longKey = validateDailyMetrics({ ...base, 'my landlord refused to fix the heating': 1 })
    expect(longKey.join(' ')).not.toContain('landlord')
    expect(longKey[0]).toMatch(/^<key of \d+ chars> is not an allowed field$/)
  })

  it('requires numeric leaves (whole numbers for counts)', () => {
    expect(validateDailyMetrics({ ...base, paidEvents: { sample_start: 'two' } })).toContain('paidEvents.sample_start must be a whole number ≥ 0')
    expect(validateDailyMetrics({ ...base, paidEvents: [] })).toContain('paidEvents must be an object')
    expect(validateDailyMetrics({ ...base, grades: { ...base.grades, writing: 1.5 } })).toContain('grades.writing must be a whole number ≥ 0')
    expect(validateDailyMetrics({ ...base, disputes: 'none' })).toContain('disputes must be a whole number ≥ 0')
    expect(validateDailyMetrics({ ...base, costUsd: 0.1234 })).toEqual([])
  })

  it('validates the whole committed file, not only metrics', () => {
    expect(validateMetricsFile(day26, '2026-10-26')).toEqual([])
    expect(validateMetricsFile({ ...day26, note: 'x' })).toContain('note is not an allowed field')
    expect(validateMetricsFile(day26, '2026-10-27')).toContain('day differs from the file name')
    expect(validateMetricsFile({ ...day26, computedAt: 'yesterday' })).toContain('computedAt must be an ISO-8601 UTC time')
    expect(validateMetricsFile({ ...day26, metrics: { ...day26.metrics, note: 'x' } })).toContain('metrics: note is not an allowed field')
  })

  it('refuses to export a row whose JSON carries an extra field', () => {
    const json = JSON.stringify({ ...day26.metrics, note: 'My landlord in Toronto refused to fix the heating' })
    expect(() => toMetricsFile({ day: '2026-10-26', json, created_at: '2026-10-27T05:00:02.114Z' })).toThrow(/note is not an allowed field/)
    expect(() => toMetricsFile({ day: '2026-10-26', json, created_at: '2026-10-27T05:00:02.114Z' })).not.toThrow(/landlord/)
  })
})

describe('personal-data guard over ops/metrics (R61)', () => {
  it('allows only README.md and <day>.json at the top level (ads.json went with the ad budget, Z1)', () => {
    expect(classifyMetricsPath('README.md')).toBe('readme')
    expect(classifyMetricsPath('2026-10-27.json')).toBe('daily')
    for (const p of ['ads.json', 'sub/2026-10-27.json', 'ads.csv', 'x.JSON', '2026-10-27.JSON', 'notes.json', '.hidden', 'readme.md']) expect(classifyMetricsPath(p)).toBe('unexpected')
  })

  it('checks every file whatever its extension, and validates daily files', () => {
    expect(guardFile('README.md', 'Emails and essays never go here: someone@example.com')).toEqual([])
    expect(guardFile('2026-10-26.json', serializeMetricsFile(day26 as never))).toEqual([])
    expect(guardFile('ads.json', '[{"date":"2026-10-26","spendCad":1}]')).toEqual(['unexpected file: only README.md and <YYYY-MM-DD>.json belong in ops/metrics (no subfolders)'])
    expect(guardFile('ads.csv', 'date,spend\n2026-10-26,a@b.c').join(' ')).toMatch(/unexpected file.*"@" character/)
    expect(guardFile('x.JSON', '{"essay": 1}').join(' ')).toMatch(/unexpected file.*forbidden word "essay"/)
    expect(guardFile('2026-10-26.json', JSON.stringify({ ...day26, metrics: { ...day26.metrics, note: 'My landlord refused' } }))).toContain('metrics: note is not an allowed field')
    expect(guardFile('2026-10-26.json', 'not json')).toContain('not valid JSON')
  })

  it('accepts the free practice events and an optional paidEvents map (Z1, Z9)', () => {
    const withPractice = { ...day26.metrics, events: { ...day26.metrics.events, practice_start: 4, practice_done: 2 } }
    expect(validateDailyMetrics(withPractice)).toEqual([])
    // no ads → the Worker writes no paidEvents; older files may still carry it
    expect(validateDailyMetrics({ ...withPractice, paidEvents: { landing: 3 } })).toEqual([])
    expect(validateDailyMetrics({ ...withPractice, paidEvents: { gclid_clicks: 3 } })).toContain('paidEvents.gclid_clicks is not an allowed field')
    expect(validateDailyMetrics({ ...withPractice, events: { ...withPractice.events, practice_start: -1 } })).toContain('events.practice_start must be a whole number ≥ 0')
  })

  // in-memory tree standing in for node:fs/promises
  function fakeFs(tree: Record<string, string>): GuardFs {
    const isDir = (p: string) => Object.keys(tree).some((k) => k.startsWith(`${p}/`))
    const entry = (dir: string, name: string) => ({ name, isDirectory: () => isDir(`${dir}/${name}`), isFile: () => `${dir}/${name}` in tree })
    return {
      stat: async (p) => {
        if (!(p in tree) && !isDir(p)) throw new Error('ENOENT')
        return { isDirectory: () => isDir(p), isFile: () => p in tree }
      },
      readdir: async (dir) => [...new Set(Object.keys(tree).filter((k) => k.startsWith(`${dir}/`)).map((k) => k.slice(dir.length + 1).split('/')[0]))].map((n) => entry(dir, n)),
      readFile: async (p) => tree[p],
    }
  }

  it('walks subdirectories and fails on the files the old guard skipped', async () => {
    const lines: string[] = []
    const log = { out: (l: string) => lines.push(l), err: (l: string) => lines.push(l) }
    const tree = {
      'm/README.md': '# aggregate numbers only',
      'm/2026-10-26.json': serializeMetricsFile(day26 as never),
      'm/sub/2026-10-27.json': '{"email":"a@b.c"}',
      'm/ads.csv': 'someone@example.com',
      'm/x.JSON': '{"essay": "text"}',
    }
    expect(await guardPaths(['m'], fakeFs(tree), log)).toBe(1)
    expect(lines.at(-1)).toBe('pii-guard: 5 file(s) checked, 3 with findings')
    expect(lines.filter((l) => l.startsWith('pii-guard: m/')).map((l) => l.split(':')[1].trim())).toEqual(['m/ads.csv', 'm/sub/2026-10-27.json', 'm/x.JSON'])
    expect(lines.join('\n')).not.toContain('someone')
    expect(lines.join('\n')).not.toContain('a@b.c')
  })

  it('passes a clean folder', async () => {
    const lines: string[] = []
    const tree = { 'm/README.md': '# x', 'm/2026-10-26.json': serializeMetricsFile(day26 as never), 'm/2026-10-27.json': serializeMetricsFile({ ...day26, day: '2026-10-27', metrics: { ...day26.metrics, day: '2026-10-27' } } as never) }
    expect(await guardPaths(['m/'], fakeFs(tree), { out: (l) => lines.push(l), err: (l) => lines.push(l) })).toBe(0)
    expect(lines).toEqual(['pii-guard: 3 file(s) checked, 0 with findings'])
  })
})
