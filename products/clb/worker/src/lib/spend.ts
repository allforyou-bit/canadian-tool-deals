// Cost accounting and spend tiers (memo §3.1, §3.4, B10). All costs are micro-USD integers.
// Prices: config.MODELS (official per-1M-token rates). $X per 1M tokens == X micro-USD per token.
import { FREE, MODELS, SPEND } from '../../../shared/config'
import type { Env } from '../env'
import { addDays, startOfUtcDay, startOfUtcMonth } from './time'

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
}

export async function spendSnapshot(env: Env, now: Date): Promise<SpendSnapshot> {
  const day = startOfUtcDay(now).toISOString()
  const month = startOfUtcMonth(now).toISOString()
  const [costs, gross] = await Promise.all([
    env.DB.prepare(
      // Rows still pending carry a worst-case placeholder cost; they count once finished (or once the
      // cron sweep closes an orphaned call at that worst case), so a burst in flight cannot trip the tiers.
      `SELECT
         COALESCE(SUM(cost_micro_usd), 0) AS mtd,
         COALESCE(SUM(CASE WHEN created_at >= ?2 THEN cost_micro_usd ELSE 0 END), 0) AS today,
         COALESCE(SUM(CASE WHEN free = 1 AND created_at >= ?2 THEN cost_micro_usd ELSE 0 END), 0) AS free_today,
         COALESCE(SUM(CASE WHEN free = 1 THEN cost_micro_usd ELSE 0 END), 0) AS free_month
       FROM grades WHERE created_at >= ?1 AND pending = 0`,
    )
      .bind(month, day)
      .first<{ mtd: number; today: number; free_today: number; free_month: number }>(),
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
  return {
    monthToDateUsd: (costs?.mtd ?? 0) / 1e6,
    todayUsd: (costs?.today ?? 0) / 1e6,
    freeTodayUsd: (costs?.free_today ?? 0) / 1e6,
    freeMonthUsd: (costs?.free_month ?? 0) / 1e6,
    trailingGrossUsd,
    configuredLimitUsd,
    limitUsd,
    dailyCapUsd: Math.max(SPEND.dailyAnomalyMinUsd, limitUsd / SPEND.dailyAnomalyDivisor),
  }
}

export interface TierDecision {
  /** free samples must be off (month spend ≥ freeOffAt × L, or the free budget is used up) */
  freeOff: boolean
  /** owner alert + PR proposing a limit raise */
  alert: boolean
  /** grading paused for the rest of the UTC day; passes extended by the pause length */
  pauseGrading: boolean
}

export function evaluateTiers(s: SpendSnapshot): TierDecision {
  return {
    freeOff:
      s.monthToDateUsd >= SPEND.freeOffAt * s.limitUsd ||
      s.freeTodayUsd >= FREE.budgetUsdPerDay ||
      s.freeMonthUsd >= FREE.budgetUsdPerMonth,
    alert: s.monthToDateUsd >= SPEND.alertAt * s.limitUsd,
    pauseGrading: s.todayUsd > s.dailyCapUsd,
  }
}
