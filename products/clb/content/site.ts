// Site-wide values for the content pages. Numbers come from shared/config.ts (the single source of truth)
// so a price or limit change there flows into every page; nothing here restates them by hand.
import { formatCad } from '../lib/i18n'
import { PUBLIC_ENV } from '../lib/env'
import { BRAND, CAPS, FREE, REFUND_POLICY, RETENTION_DAYS, SESSION, SKUS, type Sku } from '../shared/config'

/** Date the product pages were last reviewed; shown on every help, formats and legal page. */
export const LAST_REVIEWED = '2026-09-24'

/**
 * Canonical origin. Set NEXT_PUBLIC_SITE_URL at build time (CONTRACT §6); the fallback matches the
 * SITE_URL placeholder in worker/wrangler.jsonc so a local build still produces well-formed URLs.
 */
export const DEFAULT_SITE_URL = 'https://maple-practice-coach.example.workers.dev'
export const SITE_URL = (PUBLIC_ENV.siteUrl || DEFAULT_SITE_URL).replace(/\/+$/, '')
export const absoluteUrl = (path: string): string => `${SITE_URL}${path}`

/** Owner's mailing address (CASL and PIPEDA contact). A visible placeholder is shown until it is set. */
export const MAILING_ADDRESS: string | null = PUBLIC_ENV.mailingAddress.trim() || null
export const MAILING_ADDRESS_PLACEHOLDER = '[Mailing address not set yet. The owner must add it before launch.]'
export const mailingAddressText: string = MAILING_ADDRESS ?? MAILING_ADDRESS_PLACEHOLDER

/**
 * Optional public support address. Not in CONTRACT §6 yet (requested); without it the pages point to the
 * support form on the account page and to the mailing address.
 */
export const SUPPORT_EMAIL: string | null = (process.env.NEXT_PUBLIC_SUPPORT_EMAIL || '').trim() || null

export const BUSINESS_NAME = BRAND.en

/** "6000" → "6,000" (no Intl dependency, so tests and the build format numbers the same way). */
export const groupDigits = (n: number): string => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

export const SKU_ORDER: Sku[] = ['pass30', 'pass90']

/** Numbers quoted in the copy, all derived from shared/config.ts. */
export const FACTS = {
  price: { pass30: formatCad(SKUS.pass30.priceCents), pass90: formatCad(SKUS.pass90.priceCents) },
  days: { pass30: SKUS.pass30.days, pass90: SKUS.pass90.days },
  refundDays: REFUND_POLICY.withinDays,
  refundMaxTasks: REFUND_POLICY.maxGradedTasksUsed,
  writingPerDay: CAPS.writingPerDay,
  speakingPerDay: CAPS.speakingPerDay,
  gradedPer30Days: CAPS.gradedPer30Days,
  maxEssayChars: groupDigits(CAPS.maxEssayChars),
  audioMinutes: CAPS.maxAudioSeconds / 60,
  audioMb: CAPS.maxAudioBytes / (1024 * 1024),
  retentionDays: RETENTION_DAYS,
  linkMinutes: SESSION.magicLinkMinutes,
  linksPerHour: SESSION.magicLinksPerEmailPerHour,
  sessionDays: SESSION.days,
  freeWriting: FREE.anonymousWritingPerDevice,
  freeSpeaking: FREE.speakingAfterEmailVerification,
  noFeedbackPerDay: CAPS.noFeedbackPerDay,
} as const

/*
 * Sentences that several pages must state the same way (review decisions 2, 7, 12, 15 and the filter
 * wording). content.test.ts checks that the pages use them and that no older variant is left.
 */

/** Any grading pause extends active passes; queued passes shift (worker/src/cron.ts, decision 12). */
export const PAUSE_EXTENSION = {
  en: 'If feedback is paused, active passes are extended by the length of the pause.',
  ko: '피드백이 멈추면, 멈춘 시간만큼 이용 중인 이용권 기간이 늘어나요.',
} as const

/** The service can be used anywhere; only passes are restricted (decision 15). */
export const QUEBEC_RULE = {
  en: 'Passes are not sold in Quebec.',
  ko: '퀘벡에서는 이용권을 판매하지 않아요.',
} as const

/**
 * Fair use counts graded tasks only; requests without feedback (refusals, failures, no speech) have their
 * own daily cap, and reaching it blocks further submissions until the reset (decision 2, CAPS.noFeedbackPerDay).
 */
export const NO_FEEDBACK_LIMIT = {
  en: `Only tasks that get feedback count toward these limits. Requests that get no feedback, such as questions we cannot help with or attempts that fail, are limited separately to ${CAPS.noFeedbackPerDay} per account per day. After that, you can submit again when the daily limits reset.`,
  ko: `피드백을 받은 과제만 한도에 포함돼요. 도와드릴 수 없는 질문이나 처리에 실패한 요청처럼 피드백 없이 끝난 요청은 따로 계정당 하루 ${CAPS.noFeedbackPerDay}개까지만 가능해요. 그 뒤에는 하루 한도가 초기화되면 다시 제출할 수 있어요.`,
} as const

/**
 * What worker/src/grading/filter.ts really does: it drops sentences that match the FORBIDDEN_CLAIMS words
 * and the "n out of 12" number pattern. It does not detect predictions, so the copy must not say it does.
 */
export const FILTER_EN =
  'An automatic filter then removes sentences that use set words or number patterns that present a test result, such as a number out of 12. It can miss wording it does not look for, so ignore any comment that sounds like a test result or a prediction.'

/** "30-day pass: C$39" style label for one SKU. */
export const passLabel = (sku: Sku, lang: 'en' | 'ko'): string =>
  lang === 'en' ? `${SKUS[sku].en}: ${FACTS.price[sku]}` : `${SKUS[sku].ko} ${FACTS.price[sku]}`

/** How to reach us, as rich text for the legal and help pages. */
export const CONTACT_LINES_EN: string[] = [
  `Use the support form on your [account page](/account/) (you need to be signed in).`,
  ...(SUPPORT_EMAIL ? [`Email us at [${SUPPORT_EMAIL}](mailto:${SUPPORT_EMAIL}).`] : []),
  `Write to us by mail: ${BUSINESS_NAME}, ${mailingAddressText}`,
]

/** Daily limits reset at 00:00 UTC (worker/src/lib/time.ts). */
export const DAILY_RESET_EN = 'midnight UTC (8 p.m. Eastern time during daylight saving time, 7 p.m. otherwise)'
export const DAILY_RESET_KO = 'UTC 자정(캐나다 동부 시간으로 서머타임 기간에는 오후 8시, 그 밖에는 오후 7시)'
