// Cost accounting and spend tiers (memo §3.1, §3.4, B10), and the prepaid-credit ledger (memo §7.2 Z6).
// All costs are micro-USD integers. Prices: config.MODELS (official per-1M-token rates). $X per 1M
// tokens == X micro-USD per token. The ledger sees only the Worker's own grade rows: spend from the same
// Anthropic organisation elsewhere (evals, the Console) must be left out of ANTHROPIC_PREPAID_USD.
import { FREE, MODELS, PREPAID, SPEND } from '../../../shared/config'
import type { Env } from '../env'
import { addDays, dayKey, startOfUtcDay, startOfUtcMonth } from './time'

export interface TokenUsage {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens?: number | null
  cache_creation_input_tokens?: number | null
}

/** Unknown models are priced at the most expensive known rate, so accounting never under-counts. */
export function modelPrice(model: string): { inUsd: number; outUsd: number } {
  const known = MODELS.prices[model]
  if (known) return known
  const all = Object.values(MODELS.prices)
  return { inUsd: Math.max(...all.map((p) => p.inUsd)), outUsd: Math.max(...all.map((p) => p.outUsd)) }
}

/** Output tokens include thinking tokens (billed as output). */
export function tokenCostMicroUsd(model: string, u: TokenUsage): number {
  const p = modelPrice(model)
  const cost =
    u.input_tokens * p.inUsd +
    u.output_tokens * p.outUsd +
    (u.cache_read_input_tokens ?? 0) * p.inUsd * MODELS.cacheReadMultiplier +
    (u.cache_creation_input_tokens ?? 0) * p.inUsd * MODELS.cacheWrite5mMultiplier
  return Math.ceil(cost)
}

export function whisperCostMicroUsd(audioSeconds: number): number {
  return Math.ceil((audioSeconds / 60) * MODELS.whisperUsdPerMinute * 1_000_000)
}

export interface SpendSnapshot {
  monthToDateUsd: number
  todayUsd: number
  freeTodayUsd: number
  freeMonthUsd: number
  trailingGrossUsd: number
  /** the Anthropic Console monthly limit from ANTHROPIC_MONTHLY_LIMIT_USD, when set */
  configuredLimitUsd: number | null
  /** L = min(max(minMonthlyLimitUsd, grossShare × trailing-30-day gross), configuredLimitUsd) */
  limitUsd: number
  /** daily anomaly cap = max(dailyAnomalyMinUsd, L / dailyAnomalyDivisor) */
  dailyCapUsd: number
  // ---- prepaid ledger (memo §7.2 Z6); all null unless ANTHROPIC_PREPAID_USD and _SINCE are both valid ----
  /** credits bought (ANTHROPIC_PREPAID_USD) */
  prepaidUsd: number | null
  /** start of the ledger as ISO-8601 UTC (ANTHROPIC_PREPAID_SINCE; a date means 00:00 UTC that day) */
  prepaidSince: string | null
  /**
   * cost of finished grade rows since prepaidSince. It includes the small Workers AI speech-to-text cost
   * and failed calls at their worst case, so it can only over-count Anthropic spend (the safe direction).
   */
  spentSincePrepaidUsd: number | null
  /** worst-case cost of calls still running since prepaidSince */
  prepaidInFlightUsd: number | null
  /** spentSincePrepaidUsd / prepaidUsd (finished calls only) */
  prepaidRatio: number | null
}

/** YYYY-MM-DD, optionally followed by a time and Z or an offset (ISO-8601). */
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2}))?$/

/** ANTHROPIC_PREPAID_SINCE as ISO-8601 UTC; null unless it is a real calendar date (2026-02-30 is not). */
export function parsePrepaidSince(raw: string | undefined): string | null {
  const v = raw?.trim() ?? ''
  const m = ISO_DATE.exec(v)
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const day = new Date(Date.UTC(y, mo - 1, d))
  if (day.getUTCFullYear() !== y || day.getUTCMonth() !== mo - 1 || day.getUTCDate() !== d) return null
  const ms = Date.parse(v)
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null
}

/** The prepaid ledger's settings, or null when either variable is missing or invalid (ledger off). */
export function prepaidConfig(env: Env): { usd: number; since: string } | null {
  const usd = Number(env.ANTHROPIC_PREPAID_USD?.trim() || 'NaN')
  const since = parsePrepaidSince(env.ANTHROPIC_PREPAID_SINCE)
  return Number.isFinite(usd) && usd > 0 && since !== null ? { usd, since } : null
}

export async function spendSnapshot(env: Env, now: Date): Promise<SpendSnapshot> {
  const day = startOfUtcDay(now).toISOString()
  const month = startOfUtcMonth(now).toISOString()
  const prepaid = prepaidConfig(env)
  // one range scan over grades.created_at, reaching back to the ledger start only when it is earlier
  const from = prepaid && prepaid.since < month ? prepaid.since : month
  const [costs, gross] = await Promise.all([
    env.DB.prepare(
      // Rows still pending carry a worst-case placeholder cost; they count once finished (or once the
      // cron sweep closes an orphaned call at that worst case), so a burst in flight cannot trip the
      // monthly tiers. The prepaid ledger reports them separately (prepaidInFlightUsd).
      `SELECT
         COALESCE(SUM(CASE WHEN pending = 0 AND created_at >= ?1 THEN cost_micro_usd ELSE 0 END), 0) AS mtd,
         COALESCE(SUM(CASE WHEN pending = 0 AND created_at >= ?2 THEN cost_micro_usd ELSE 0 END), 0) AS today,
         COALESCE(SUM(CASE WHEN pending = 0 AND free = 1 AND created_at >= ?2 THEN cost_micro_usd ELSE 0 END), 0) AS free_today,
         COALESCE(SUM(CASE WHEN pending = 0 AND free = 1 AND created_at >= ?1 THEN cost_micro_usd ELSE 0 END), 0) AS free_month,
         COALESCE(SUM(CASE WHEN pending = 0 AND ?3 IS NOT NULL AND created_at >= ?3 THEN cost_micro_usd ELSE 0 END), 0) AS prepaid_spent,
         COALESCE(SUM(CASE WHEN pending = 1 AND ?3 IS NOT NULL AND created_at >= ?3 THEN cost_micro_usd ELSE 0 END), 0) AS prepaid_in_flight
       FROM grades WHERE created_at >= ?4`,
    )
      .bind(month, day, prepaid?.since ?? null, from)
      .first<{ mtd: number; today: number; free_today: number; free_month: number; prepaid_spent: number; prepaid_in_flight: number }>(),
    // purchases_paid index (status, paid_at): reads only the last 30 days of paid rows
    env.DB.prepare(`SELECT COALESCE(SUM(amount_cents), 0) AS cents FROM purchases WHERE status = 'paid' AND paid_at >= ?1`)
      .bind(addDays(now, -30).toISOString())
      .first<{ cents: number }>(),
  ])
  const trailingGrossUsd = ((gross?.cents ?? 0) / 100) * SPEND.cadToUsdConservative
  const formulaLimitUsd = Math.max(SPEND.minMonthlyLimitUsd, SPEND.grossShare * trailingGrossUsd)
  // The Anthropic Console limit is what actually stops the API; never plan above it.
  const configured = Number(env.ANTHROPIC_MONTHLY_LIMIT_USD ?? '')
  const configuredLimitUsd = Number.isFinite(configured) && configured > 0 ? configured : null
  const limitUsd = configuredLimitUsd === null ? formulaLimitUsd : Math.min(formulaLimitUsd, configuredLimitUsd)
  const spentSincePrepaidUsd = prepaid ? (costs?.prepaid_spent ?? 0) / 1e6 : null
  return {
    monthToDateUsd: (costs?.mtd ?? 0) / 1e6,
    todayUsd: (costs?.today ?? 0) / 1e6,
    freeTodayUsd: (costs?.free_today ?? 0) / 1e6,
    freeMonthUsd: (costs?.free_month ?? 0) / 1e6,
    trailingGrossUsd,
    configuredLimitUsd,
    limitUsd,
    dailyCapUsd: Math.max(SPEND.dailyAnomalyMinUsd, limitUsd / SPEND.dailyAnomalyDivisor),
    prepaidUsd: prepaid?.usd ?? null,
    prepaidSince: prepaid?.since ?? null,
    spentSincePrepaidUsd,
    prepaidInFlightUsd: prepaid ? (costs?.prepaid_in_flight ?? 0) / 1e6 : null,
    prepaidRatio: prepaid && spentSincePrepaidUsd !== null ? spentSincePrepaidUsd / prepaid.usd : null,
  }
}

/** How long /api/me may reuse a snapshot in one isolate (Workers Free: 5M D1 rows read per day). */
export const SPEND_CACHE_MS = 60_000

let cached: { at: number; key: string; snapshot: SpendSnapshot } | null = null

/**
 * spendSnapshot, reused for up to SPEND_CACHE_MS within this isolate, the same UTC day and the same
 * spend settings — for display paths such as /api/me (memo §7.2 Z2). The grade handlers' live checks
 * and the cron must call spendSnapshot. Only plain values are cached (never a promise shared between
 * requests), and a failed read is not cached.
 */
export async function spendSnapshotCached(env: Env, now: Date): Promise<SpendSnapshot> {
  const t = now.getTime()
  const key = [dayKey(now), env.ANTHROPIC_MONTHLY_LIMIT_USD, env.ANTHROPIC_PREPAID_USD, env.ANTHROPIC_PREPAID_SINCE].join('|')
  if (cached && cached.key === key && t >= cached.at && t - cached.at < SPEND_CACHE_MS) return cached.snapshot
  const snapshot = await spendSnapshot(env, now)
  cached = { at: t, key, snapshot }
  return snapshot
}

/** Forget the cached snapshot (tests; the next spendSnapshotCached call reads D1). */
export function clearSpendCache(): void {
  cached = null
}

export interface TierDecision {
  /**
   * free samples must be off: month spend ≥ freeOffAt × L, a free budget is used up, or the prepaid
   * ledger has reached PREPAID.freeOffAt of the credits
   */
  freeOff: boolean
  /** owner alert + PR proposing a limit raise (month spend ≥ alertAt × L) */
  alert: boolean
  /**
   * grading paused; passes extended by the pause length. Either today's spend is over the daily cap
   * (until 00:00 UTC) or prepaidPause.
   */
  pauseGrading: boolean
  /**
   * the prepaid ledger paused grading: finished spend plus the worst case of calls in flight ≥
   * PREPAID.pauseAt × credits, so no call can run out of credit half-way. Lifts only after a top-up
   * (new ANTHROPIC_PREPAID_USD / _SINCE), or when calls in flight finish below their worst case.
   */
  prepaidPause: boolean
  /** the highest PREPAID.alertAt level the prepaid ledger has reached (0.5 or 0.8), or null */
  prepaidAlert: (typeof PREPAID.alertAt)[number] | null
}

export function evaluateTiers(s: SpendSnapshot): TierDecision {
  const ratio = s.prepaidRatio
  const committed =
    s.prepaidUsd !== null && s.spentSincePrepaidUsd !== null
      ? (s.spentSincePrepaidUsd + (s.prepaidInFlightUsd ?? 0)) / s.prepaidUsd
      : null
  const prepaidPause = committed !== null && committed >= PREPAID.pauseAt
  let prepaidAlert: TierDecision['prepaidAlert'] = null
  for (const level of PREPAID.alertAt) {
    if (ratio !== null && ratio >= level && (prepaidAlert === null || level > prepaidAlert)) prepaidAlert = level
  }
  return {
    freeOff:
      s.monthToDateUsd >= SPEND.freeOffAt * s.limitUsd ||
      s.freeTodayUsd >= FREE.budgetUsdPerDay ||
      s.freeMonthUsd >= FREE.budgetUsdPerMonth ||
      (ratio !== null && ratio >= PREPAID.freeOffAt),
    alert: s.monthToDateUsd >= SPEND.alertAt * s.limitUsd,
    pauseGrading: s.todayUsd > s.dailyCapUsd || prepaidPause,
    prepaidPause,
    prepaidAlert,
  }
}
