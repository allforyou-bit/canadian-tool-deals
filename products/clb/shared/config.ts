// Single source of truth for the practice-coach product. Imported by the static site
// (products/clb/app) and by the Worker (products/clb/worker). Decisions and their sources:
// business/online/decision-memo.md (§1.1 product, §3 unit economics, §6 rules, §7 build spec).

export const BRAND = {
  // Working name. Must never contain "CELPIP", "IELTS" or "CLB" (trademark risk, memo §1.4).
  en: 'Maple Practice Coach',
  ko: '메이플 영어 연습 코치',
} as const

/** Canada only, excluding Quebec (memo §1.1: no foreign VAT, Quebec rules not researched). */
export const SALES_REGION = {
  country: 'CA',
  excludedRegions: ['QC'],
} as const

export type Sku = 'pass30' | 'pass90'

export interface SkuConfig {
  sku: Sku
  /** price in Canadian cents; no GST/HST while the owner is a small supplier (ETA s.148) */
  priceCents: number
  days: number
  en: string
  ko: string
}

export const SKUS: Record<Sku, SkuConfig> = {
  pass30: { sku: 'pass30', priceCents: 3900, days: 30, en: '30-day pass', ko: '30일 이용권' },
  pass90: { sku: 'pass90', priceCents: 7900, days: 90, en: '90-day pass', ko: '90일 이용권' },
}

/** Self-serve refund policy (memo §1.1): once per email and per card fingerprint. */
export const REFUND_POLICY = {
  withinDays: 14,
  maxGradedTasksUsed: 5,
} as const

/** Per-user fair-use caps (memo B10). */
export const CAPS = {
  writingPerDay: 15,
  speakingPerDay: 30,
  gradedPer30Days: 150,
  maxEssayChars: 6000,
  maxAudioSeconds: 120,
  maxAudioBytes: 3 * 1024 * 1024,
} as const

/** Free samples (memo B5): one anonymous writing task, one speaking task after email verification. */
export const FREE = {
  anonymousWritingPerDevice: 1,
  anonymousWritingPerIpPerDay: 3,
  speakingAfterEmailVerification: 1,
  budgetUsdPerDay: 2,
  budgetUsdPerMonth: 40,
} as const

/**
 * Anthropic spend tiers (memo §3.4, B10). L = max(minMonthlyLimitUsd, grossShare × trailing-30-day gross in USD).
 * ≥ freeOffAt × L → free samples off; ≥ alertAt × L → alert + PR proposing a raise;
 * daily spend > max(dailyAnomalyMinUsd, L / dailyAnomalyDivisor) → grading paused, passes extended.
 */
export const SPEND = {
  minMonthlyLimitUsd: 150,
  grossShare: 0.3,
  freeOffAt: 0.7,
  alertAt: 0.95,
  dailyAnomalyMinUsd: 15,
  dailyAnomalyDivisor: 10,
  /**
   * CAD→USD factor used ONLY for the tier math above. It is a deliberately low assumption, not a
   * quoted market rate: under-counting gross in USD keeps L lower, which is the safe direction.
   */
  cadToUsdConservative: 0.7,
} as const

/**
 * Models. Per the Claude API skill the default is claude-opus-5; the owner may override with
 * GRADER_MODEL (e.g. claude-sonnet-5 costs roughly 40% as much per grade — memo §3.1). Prices are
 * the official per-1M-token rates (cached 2026-06-24) used for cost accounting.
 */
export const MODELS = {
  defaultGrader: 'claude-opus-5',
  prices: {
    'claude-opus-5': { inUsd: 5, outUsd: 25 },
    'claude-sonnet-5': { inUsd: 2, outUsd: 10 },
    'claude-haiku-4-5': { inUsd: 1, outUsd: 5 },
  } as Record<string, { inUsd: number; outUsd: number }>,
  cacheReadMultiplier: 0.1,
  cacheWrite5mMultiplier: 1.25,
  /** Workers AI whisper-large-v3-turbo, per audio minute (cloudflare-docs, fetched 2026-09-24) */
  whisperUsdPerMinute: 0.000513,
  graderMaxTokens: 4000,
} as const

export const SESSION = {
  cookieName: 'mpc_session',
  days: 30,
  magicLinkMinutes: 15,
  magicLinksPerEmailPerHour: 3,
} as const

/** Privacy (memo §4.1 PIPEDA design): essays/transcripts purged this many days after last activity. */
export const RETENTION_DAYS = 90

/** Words that must never appear in grader output, pages or ads (memo §1.4, B3, B9, B13). */
export const FORBIDDEN_OUTPUT_TERMS = ['official', 'guarantee', 'guaranteed', 'CLB', 'band', 'level', 'score', 'accurate', 'aligned'] as const

/** Kill switches stored in KV (memo B10). band stays false through Jan 31 2027. */
export const FLAG_DEFAULTS = {
  free_enabled: true,
  grading_enabled: true,
  checkout_enabled: false,
  band_enabled: false,
  banner: '',
} as const
export type FlagName = keyof typeof FLAG_DEFAULTS

export const AI_DISCLOSURE = {
  en: 'You are getting feedback from an AI (Claude by Anthropic). It can make mistakes. It does not predict test results.',
  ko: 'AI(Anthropic의 Claude)가 피드백을 드려요. 틀릴 수 있으며, 시험 결과를 예측하지 않아요.',
} as const

export const NOT_AFFILIATED = {
  en: 'Independent practice tool. Not affiliated with or endorsed by Paragon Testing Enterprises, IDP, the British Council, Cambridge, or IRCC. Feedback is not calibrated against official scores.',
  ko: '독립적인 연습 도구입니다. Paragon Testing Enterprises, IDP, British Council, Cambridge, IRCC와 관련이 없으며 보증받지 않았습니다. 피드백은 공식 점수 기준으로 보정되지 않았습니다.',
} as const
