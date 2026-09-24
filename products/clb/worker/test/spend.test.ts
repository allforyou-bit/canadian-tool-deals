// Spend accounting (memo §3.4, B10) and the prepaid-credit ledger (memo §7.2 Z6), plus the per-isolate
// snapshot cache used by /api/me. D1 state persists within this file, so every test uses its own month.
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'
import { FREE, MODELS, PREPAID, SPEND } from '../../shared/config'
import type { Env } from '../src/env'
import {
  clearSpendCache,
  evaluateTiers,
  modelPrice,
  parsePrepaidSince,
  prepaidConfig,
  SPEND_CACHE_MS,
  spendSnapshot,
  spendSnapshotCached,
  tokenCostMicroUsd,
  whisperCostMicroUsd,
  type SpendSnapshot,
} from '../src/lib/spend'

beforeEach(() => {
  clearSpendCache()
})

const base = env as Env
function withVars(vars: Partial<Pick<Env, 'ANTHROPIC_PREPAID_USD' | 'ANTHROPIC_PREPAID_SINCE' | 'ANTHROPIC_MONTHLY_LIMIT_USD'>>): Env {
  return { ...base, ...vars }
}

let n = 0
/** A grades row; cost in USD. */
function row(createdAt: string, usd: number, o: { free?: boolean; pending?: boolean } = {}) {
  return env.DB.prepare(
    `INSERT INTO grades (id, task_id, prompt_index, kind, free, pending, model, cost_micro_usd, created_at)
     VALUES (?1, 'email', 0, 'writing', ?2, ?3, 'claude-opus-5', ?4, ?5)`,
  ).bind(`g_spend_${++n}`, o.free ? 1 : 0, o.pending ? 1 : 0, Math.round(usd * 1e6), createdAt)
}

/** A snapshot with safe defaults (nothing spent, no prepaid ledger). */
function snap(over: Partial<SpendSnapshot> = {}): SpendSnapshot {
  return {
    monthToDateUsd: 0,
    todayUsd: 0,
    freeTodayUsd: 0,
    freeMonthUsd: 0,
    trailingGrossUsd: 0,
    configuredLimitUsd: null,
    limitUsd: SPEND.minMonthlyLimitUsd,
    dailyCapUsd: SPEND.dailyAnomalyMinUsd,
    prepaidUsd: null,
    prepaidSince: null,
    spentSincePrepaidUsd: null,
    prepaidInFlightUsd: null,
    prepaidRatio: null,
    ...over,
  }
}

/** A snapshot with a US$10 ledger at the given finished spend and in-flight worst case. */
const prepaidSnap = (spent: number, inFlight = 0) =>
  snap({ prepaidUsd: 10, prepaidSince: '2027-01-01T00:00:00.000Z', spentSincePrepaidUsd: spent, prepaidInFlightUsd: inFlight, prepaidRatio: spent / 10 })

describe('cost accounting', () => {
  it('prices tokens per 1M (micro-USD per token), rounding up; unknown models at the dearest rate', () => {
    expect(tokenCostMicroUsd('claude-opus-5', { input_tokens: 1000, output_tokens: 100 })).toBe(1000 * 5 + 100 * 25)
    expect(
      tokenCostMicroUsd('claude-sonnet-5', { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 1000, cache_creation_input_tokens: 1000 }),
    ).toBe(Math.ceil(1000 * 2 * MODELS.cacheReadMultiplier + 1000 * 2 * MODELS.cacheWrite5mMultiplier))
    const dearest = Math.max(...Object.values(MODELS.prices).map((p) => p.outUsd))
    expect(modelPrice('claude-unknown').outUsd).toBe(dearest)
    expect(whisperCostMicroUsd(60)).toBe(Math.ceil(MODELS.whisperUsdPerMinute * 1e6))
    expect(whisperCostMicroUsd(0)).toBe(0)
  })
})

describe('prepaid settings', () => {
  it('reads ANTHROPIC_PREPAID_SINCE as a date (00:00 UTC) or an ISO timestamp', () => {
    expect(parsePrepaidSince('2027-01-10')).toBe('2027-01-10T00:00:00.000Z')
    expect(parsePrepaidSince(' 2027-01-10 ')).toBe('2027-01-10T00:00:00.000Z')
    expect(parsePrepaidSince('2027-01-10T14:30:00Z')).toBe('2027-01-10T14:30:00.000Z')
    expect(parsePrepaidSince('2027-01-10T14:30Z')).toBe('2027-01-10T14:30:00.000Z')
    expect(parsePrepaidSince('2027-01-10T14:30:00.5-05:00')).toBe('2027-01-10T19:30:00.500Z')
    expect(parsePrepaidSince('2028-02-29')).toBe('2028-02-29T00:00:00.000Z')
  })

  for (const bad of [undefined, '', 'yesterday', '2027-02-30', '2027-02-29', '2027-13-01', '2027-00-10', '2027-1-5', '10/01/2027', '2027-01-10T25:00:00Z', '2027-01-10 14:30', '20270110']) {
    it(`rejects ANTHROPIC_PREPAID_SINCE ${JSON.stringify(bad)}`, () => {
      expect(parsePrepaidSince(bad)).toBeNull()
    })
  }

  it('needs both a positive amount and a valid date', () => {
    expect(prepaidConfig(withVars({ ANTHROPIC_PREPAID_USD: '10', ANTHROPIC_PREPAID_SINCE: '2027-01-10' }))).toEqual({
      usd: 10,
      since: '2027-01-10T00:00:00.000Z',
    })
    expect(prepaidConfig(withVars({ ANTHROPIC_PREPAID_USD: ' 12.5 ', ANTHROPIC_PREPAID_SINCE: '2027-01-10' }))?.usd).toBe(12.5)
    for (const usd of [undefined, '', ' ', '0', '-5', 'ten', 'NaN', 'Infinity', '10 USD']) {
      expect(prepaidConfig(withVars({ ANTHROPIC_PREPAID_USD: usd, ANTHROPIC_PREPAID_SINCE: '2027-01-10' })), String(usd)).toBeNull()
    }
    expect(prepaidConfig(withVars({ ANTHROPIC_PREPAID_USD: '10', ANTHROPIC_PREPAID_SINCE: undefined }))).toBeNull()
    expect(prepaidConfig(withVars({ ANTHROPIC_PREPAID_USD: '10', ANTHROPIC_PREPAID_SINCE: '2027-02-30' }))).toBeNull()
  })
})

describe('spendSnapshot', () => {
  it('has no prepaid ledger when the variables are unset', async () => {
    const now = new Date('2026-12-20T12:00:00Z')
    await env.DB.batch([row('2026-12-05T10:00:00.000Z', 1.5), row('2026-12-20T09:00:00.000Z', 0.25, { free: true })])
    const s = await spendSnapshot(base, now)
    expect(s).toMatchObject({
      monthToDateUsd: 1.75,
      todayUsd: 0.25,
      freeTodayUsd: 0.25,
      freeMonthUsd: 0.25,
      prepaidUsd: null,
      prepaidSince: null,
      spentSincePrepaidUsd: null,
      prepaidInFlightUsd: null,
      prepaidRatio: null,
    })
    expect(evaluateTiers(s)).toMatchObject({ prepaidPause: false, prepaidAlert: null })
  })

  it('adds up spend since the prepaid date, reaching back before the month, with calls in flight apart', async () => {
    const now = new Date('2027-02-20T12:00:00Z')
    await env.DB.batch([
      row('2027-01-14T23:59:59.999Z', 5), // before the ledger: ignored by it (and not this month)
      row('2027-01-15T00:00:00.000Z', 2), // on the ledger's first day, last month
      row('2027-01-31T08:00:00.000Z', 1, { free: true }),
      row('2027-02-03T08:00:00.000Z', 1.5),
      row('2027-02-20T08:00:00.000Z', 0.5, { free: true }),
      row('2027-02-20T11:59:00.000Z', 0.25, { pending: true }), // worst-case placeholder of a running call
    ])
    const s = await spendSnapshot(withVars({ ANTHROPIC_PREPAID_USD: '10', ANTHROPIC_PREPAID_SINCE: '2027-01-15' }), now)
    expect(s.monthToDateUsd).toBe(2)
    expect(s.todayUsd).toBe(0.5)
    expect(s.freeTodayUsd).toBe(0.5)
    expect(s.freeMonthUsd).toBe(0.5)
    expect(s.prepaidUsd).toBe(10)
    expect(s.prepaidSince).toBe('2027-01-15T00:00:00.000Z')
    expect(s.spentSincePrepaidUsd).toBe(5)
    expect(s.prepaidInFlightUsd).toBe(0.25)
    expect(s.prepaidRatio).toBe(0.5)
    expect(evaluateTiers(s)).toMatchObject({ prepaidAlert: 0.5, prepaidPause: false })

    // a ledger that starts this month counts only from its start
    const later = await spendSnapshot(withVars({ ANTHROPIC_PREPAID_USD: '4', ANTHROPIC_PREPAID_SINCE: '2027-02-20T08:00:00Z' }), now)
    expect(later.spentSincePrepaidUsd).toBe(0.5)
    expect(later.prepaidInFlightUsd).toBe(0.25)
    expect(later.prepaidRatio).toBe(0.125)
    expect(later.monthToDateUsd).toBe(2)

    // a date after now counts nothing yet
    const future = await spendSnapshot(withVars({ ANTHROPIC_PREPAID_USD: '10', ANTHROPIC_PREPAID_SINCE: '2027-03-01' }), now)
    expect(future).toMatchObject({ spentSincePrepaidUsd: 0, prepaidInFlightUsd: 0, prepaidRatio: 0, monthToDateUsd: 2 })
  })

  it('stops free samples at 70% and pauses grading at 97% of the credits, counting calls in flight', async () => {
    const now = new Date('2027-03-10T12:00:00Z')
    const vars = { ANTHROPIC_PREPAID_USD: '10', ANTHROPIC_PREPAID_SINCE: '2027-03-01' }
    await env.DB.batch([row('2027-03-02T10:00:00.000Z', 7)])
    let t = evaluateTiers(await spendSnapshot(withVars(vars), now))
    expect(t).toMatchObject({ freeOff: true, prepaidAlert: 0.5, pauseGrading: false, prepaidPause: false })
    // the monthly tiers alone would not have switched anything off
    expect(evaluateTiers(await spendSnapshot(base, now))).toMatchObject({ freeOff: false, pauseGrading: false })

    await env.DB.batch([row('2027-03-05T10:00:00.000Z', 2.5)])
    t = evaluateTiers(await spendSnapshot(withVars(vars), now))
    expect(t).toMatchObject({ freeOff: true, prepaidAlert: 0.8, pauseGrading: false, prepaidPause: false })

    // US$9.50 spent + a running call's US$0.25 worst case = 97.5%: no new call may start
    await env.DB.batch([row('2027-03-10T11:58:00.000Z', 0.25, { pending: true })])
    t = evaluateTiers(await spendSnapshot(withVars(vars), now))
    expect(t).toMatchObject({ pauseGrading: true, prepaidPause: true, prepaidAlert: 0.8 })

    // a top-up (new amount and date) lifts it
    t = evaluateTiers(await spendSnapshot(withVars({ ANTHROPIC_PREPAID_USD: '10.50', ANTHROPIC_PREPAID_SINCE: '2027-03-10' }), now))
    expect(t).toMatchObject({ freeOff: false, pauseGrading: false, prepaidPause: false, prepaidAlert: null })
  })
})

describe('evaluateTiers', () => {
  it('keeps the monthly tiers and free budgets as before', () => {
    const L = SPEND.minMonthlyLimitUsd
    expect(evaluateTiers(snap())).toEqual({ freeOff: false, alert: false, pauseGrading: false, prepaidPause: false, prepaidAlert: null })
    expect(evaluateTiers(snap({ monthToDateUsd: SPEND.freeOffAt * L })).freeOff).toBe(true)
    expect(evaluateTiers(snap({ monthToDateUsd: SPEND.alertAt * L })).alert).toBe(true)
    expect(evaluateTiers(snap({ freeTodayUsd: FREE.budgetUsdPerDay })).freeOff).toBe(true)
    expect(evaluateTiers(snap({ freeTodayUsd: FREE.budgetUsdPerDay - 0.01 })).freeOff).toBe(false)
    expect(evaluateTiers(snap({ freeMonthUsd: FREE.budgetUsdPerMonth })).freeOff).toBe(true)
    expect(evaluateTiers(snap({ todayUsd: SPEND.dailyAnomalyMinUsd + 0.01 }))).toMatchObject({ pauseGrading: true, prepaidPause: false })
    expect(evaluateTiers(snap({ todayUsd: SPEND.dailyAnomalyMinUsd })).pauseGrading).toBe(false)
  })

  it('uses the zero-capital free budget (US$0.50/day, US$5/month)', () => {
    expect(FREE.budgetUsdPerDay).toBe(0.5)
    expect(FREE.budgetUsdPerMonth).toBe(5)
  })

  it('reports the highest prepaid alert level reached', () => {
    expect(PREPAID.alertAt).toEqual([0.5, 0.8])
    const level = (spent: number) => evaluateTiers(prepaidSnap(spent)).prepaidAlert
    expect(level(0)).toBeNull()
    expect(level(4.99)).toBeNull()
    expect(level(5)).toBe(0.5)
    expect(level(7.99)).toBe(0.5)
    expect(level(8)).toBe(0.8)
    expect(level(12)).toBe(0.8)
  })

  it('switches free samples off at PREPAID.freeOffAt of finished spend only', () => {
    expect(evaluateTiers(prepaidSnap(6.99)).freeOff).toBe(false)
    expect(evaluateTiers(prepaidSnap(7)).freeOff).toBe(true)
    // calls in flight do not switch free samples off (a burst of placeholders is not spend)
    expect(evaluateTiers(prepaidSnap(6, 2)).freeOff).toBe(false)
  })

  it('pauses at PREPAID.pauseAt of finished spend plus calls in flight', () => {
    expect(evaluateTiers(prepaidSnap(9.69))).toMatchObject({ pauseGrading: false, prepaidPause: false })
    expect(evaluateTiers(prepaidSnap(9.7))).toMatchObject({ pauseGrading: true, prepaidPause: true })
    expect(evaluateTiers(prepaidSnap(9.5, 0.2))).toMatchObject({ pauseGrading: true, prepaidPause: true })
    expect(evaluateTiers(prepaidSnap(9.5, 0.19))).toMatchObject({ pauseGrading: false, prepaidPause: false })
    expect(evaluateTiers(prepaidSnap(11))).toMatchObject({ pauseGrading: true, prepaidPause: true, prepaidAlert: 0.8, freeOff: true })
  })
})

describe('spendSnapshotCached', () => {
  const t0 = new Date('2027-04-10T12:00:00Z')
  const at = (ms: number) => new Date(t0.getTime() + ms)

  it(`reuses a snapshot for ${SPEND_CACHE_MS / 1000} s, while spendSnapshot always reads D1`, async () => {
    await env.DB.batch([row('2027-04-10T08:00:00.000Z', 1)])
    expect((await spendSnapshotCached(base, t0)).todayUsd).toBe(1)
    await env.DB.batch([row('2027-04-10T11:00:00.000Z', 2)])
    expect((await spendSnapshotCached(base, at(SPEND_CACHE_MS - 1))).todayUsd).toBe(1)
    // the grade handlers' live check sees the new row at once
    expect((await spendSnapshot(base, at(SPEND_CACHE_MS - 1))).todayUsd).toBe(3)
    expect((await spendSnapshotCached(base, at(SPEND_CACHE_MS))).todayUsd).toBe(3)
  })

  it('reads again after clearSpendCache, on a new UTC day, when the settings change, or when the clock goes back', async () => {
    const day = new Date('2027-05-10T23:59:30Z')
    await env.DB.batch([row('2027-05-10T10:00:00.000Z', 1)])
    const first = await spendSnapshotCached(base, day)
    expect(first.todayUsd).toBe(1)
    expect(await spendSnapshotCached(base, new Date(day.getTime() + 1000))).toBe(first)

    clearSpendCache()
    expect(await spendSnapshotCached(base, new Date(day.getTime() + 1000))).not.toBe(first)

    // 40 s later but a new UTC day: today's spend starts again
    expect((await spendSnapshotCached(base, new Date('2027-05-11T00:00:10Z'))).todayUsd).toBe(0)

    const prepaid = withVars({ ANTHROPIC_PREPAID_USD: '10', ANTHROPIC_PREPAID_SINCE: '2027-05-01' })
    const withLedger = await spendSnapshotCached(prepaid, new Date('2027-05-11T00:00:20Z'))
    expect(withLedger.spentSincePrepaidUsd).toBe(1)
    expect((await spendSnapshotCached(base, new Date('2027-05-11T00:00:30Z'))).prepaidUsd).toBeNull()

    clearSpendCache()
    const back = await spendSnapshotCached(base, new Date('2027-05-11T00:00:40Z'))
    expect(await spendSnapshotCached(base, new Date('2027-05-11T00:00:40.5Z'))).toBe(back)
    expect(await spendSnapshotCached(base, new Date('2027-05-11T00:00:39Z'))).not.toBe(back)
  })

  it('does not cache a failed read', async () => {
    const broken = {
      ...base,
      DB: {
        prepare: () => {
          throw new Error('D1 unavailable')
        },
      } as unknown as D1Database,
    }
    await expect(spendSnapshotCached(broken, t0)).rejects.toThrow('D1 unavailable')
    const s = await spendSnapshotCached(base, t0)
    expect(s.limitUsd).toBe(SPEND.minMonthlyLimitUsd)
  })
})
