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
  /** 120 s at 32 kbps ≈ 0.48 MB; 1 MB keeps the speaking request far below the Workers Free 10 ms CPU limit */
  maxAudioBytes: 1024 * 1024,
  /** MediaRecorder audioBitsPerSecond for speaking answers */
  recordingBitsPerSecond: 32_000,
  /** requests that produced no feedback (refusals, failures) per user per UTC day — bounds per-user model spend */
  noFeedbackPerDay: 10,
} as const

/** Free samples (memo B5): one anonymous writing task, one speaking task after email verification. */
export const FREE = {
  anonymousWritingPerDevice: 1,
  anonymousWritingPerIpPerDay: 3,
  speakingAfterEmailVerification: 1,
  /** zero-capital launch (memo §7.2): small until revenue exists */
  budgetUsdPerDay: 0.5,
  budgetUsdPerMonth: 5,
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
  /** covers adaptive thinking + the JSON answer on Opus 5 (max_tokens caps both); billed on use only */
  graderMaxTokens: 8000,
  /** Opus 5 / Sonnet 5 effort; API default. Owner may override with GRADER_EFFORT after an eval sweep */
  graderEffort: 'high' as 'low' | 'medium' | 'high' | 'xhigh' | 'max',
} as const

export const SESSION = {
  cookieName: 'mpc_session',
  days: 30,
  magicLinkMinutes: 15,
  magicLinksPerEmailPerHour: 3,
} as const

/**
 * Workers AI free allocation is 10,000 neurons/day; whisper-large-v3-turbo uses 46.63 neurons per audio minute
 * (cloudflare-docs workers-ai/platform/pricing.mdx, read 2026-09-24) → about 214 audio minutes/day. Keep a margin.
 */
export const SPEAKING_DAILY_AUDIO_MINUTES = 200

/**
 * Prepaid Anthropic credits (memo §7.2). With ANTHROPIC_PREPAID_USD and ANTHROPIC_PREPAID_SINCE set, spend since that
 * date is compared with the credits bought: free samples off at freeOffAt, owner alerts at alertAt, grading paused at
 * pauseAt so a call never fails half-way when the balance runs out.
 */
export const PREPAID = {
  freeOffAt: 0.7,
  alertAt: [0.5, 0.8],
  pauseAt: 0.97,
} as const

/** Sign-in and email defaults for the zero-capital launch (memo §7.2): Google sign-in, email link for the owner only. */
export const AUTH_DEFAULTS = {
  magicLink: 'owner' as 'owner' | 'all' | 'off',
  learnerEmail: 'off' as 'off' | 'on',
}

/** Privacy (memo §4.1 PIPEDA design): essays/transcripts purged this many days after last activity. */
export const RETENTION_DAYS = 90

/** Version of the terms of use and refund policy shown next to the buy button; stored on each purchase. */
export const TERMS_VERSION = '2026-09-24'

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

/**
 * CASL express-consent request (s.10(1)): states the purpose, identifies who is asking (name + mailing
 * address + a contact method) and says consent can be withdrawn. Shown next to an UNTICKED box; the
 * exact text sent with the form is stored with MARKETING_CONSENT.version (memo B2).
 * `address` is the owner's mailing address (build-time NEXT_PUBLIC_MAILING_ADDRESS on the site;
 * MAILING_ADDRESS var in the Worker).
 */
export const MARKETING_CONSENT = {
  version: '2026-09-24',
  en: (address: string, siteUrl: string) =>
    `Yes, send me occasional emails about new practice tasks and offers from Maple Practice Coach, ${address}, ${siteUrl}. I can withdraw my consent at any time from my account page or with the unsubscribe link in any email.`,
  ko: (address: string, siteUrl: string) =>
    `네, Maple Practice Coach(${address}, ${siteUrl})로부터 새 연습 과제와 혜택에 관한 이메일을 가끔 받겠습니다. 동의는 계정 페이지나 이메일의 수신 거부 링크로 언제든지 철회할 수 있습니다.`,
} as const
