// Site-wide values for the content pages. Numbers come from shared/config.ts (the single source of truth)
// so a price or limit change there flows into every page; nothing here restates them by hand.
// Public build-time settings are read here by their full literal name (Next inlines process.env.NEXT_PUBLIC_*
// only when spelled out), so the content pages do not depend on which fields lib/env.ts carries.
import { formatCad } from '../lib/i18n'
import { BRAND, CAPS, FREE, REFUND_POLICY, RETENTION_DAYS, SESSION, SKUS, type Sku } from '../shared/config'

/** Date the product pages were last reviewed; shown on every help, formats and legal page. */
export const LAST_REVIEWED = '2026-09-24'

/**
 * Canonical origin. Set NEXT_PUBLIC_SITE_URL at build time (CONTRACT §6); the fallback matches the
 * SITE_URL placeholder in worker/wrangler.jsonc so a local build still produces well-formed URLs.
 */
export const DEFAULT_SITE_URL = 'https://maple-practice-coach.example.workers.dev'
export const SITE_URL = ((process.env.NEXT_PUBLIC_SITE_URL || '').trim() || DEFAULT_SITE_URL).replace(/\/+$/, '')
export const absoluteUrl = (path: string): string => `${SITE_URL}${path}`

const optional = (value: string | undefined): string | null => (value || '').trim() || null

/**
 * The seller (memo §7.2 Z5): the owner's legal name, from NEXT_PUBLIC_LEGAL_NAME (deploy sets it from
 * MPC_LEGAL_NAME; production refuses to deploy without it). "Maple Practice Coach" is only the product title.
 * Until the name is set, every page shows a visible placeholder instead.
 */
export const LEGAL_NAME: string | null = optional(process.env.NEXT_PUBLIC_LEGAL_NAME)
export const LEGAL_NAME_PLACEHOLDER = "[Owner's legal name not set yet]"
export const legalNameOrPlaceholder = (name: string | null): string => name ?? LEGAL_NAME_PLACEHOLDER
export const legalNameText: string = legalNameOrPlaceholder(LEGAL_NAME)

/** "Maple Practice Coach is sold by <legal name>, a sole proprietor in Ontario." (terms, privacy, footer) */
export const sellerLine = (name: string | null) =>
  ({
    en: `${BRAND.en} is sold by ${legalNameOrPlaceholder(name)}, a sole proprietor in Ontario.`,
    // a space before the bracket: "](" would read as a link in rich text while the placeholder is shown
    ko: `${BRAND.ko}(${BRAND.en}) 판매자: ${legalNameOrPlaceholder(name)} (온타리오주 개인사업자)`,
  }) as const
export const SELLER = sellerLine(LEGAL_NAME)

/**
 * Owner's mailing address: optional since the zero-capital launch (Z5). No email and no consent request
 * goes to learners, so the pages show the address only when it is set and otherwise point to the support
 * form. The placeholder is no longer shown on any page; scripts/content-lint.ts still imports it.
 */
export const MAILING_ADDRESS: string | null = optional(process.env.NEXT_PUBLIC_MAILING_ADDRESS)
export const MAILING_ADDRESS_PLACEHOLDER = '[Mailing address not set yet. The owner must add it before launch.]'

/**
 * Optional public support address. Not in CONTRACT §6 yet (requested); without it the pages point to the
 * support form on the account page (and to the mailing address when one is set).
 */
export const SUPPORT_EMAIL: string | null = optional(process.env.NEXT_PUBLIC_SUPPORT_EMAIL)

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
  sessionDays: SESSION.days,
  freeWriting: FREE.anonymousWritingPerDevice,
  freeSpeaking: FREE.speakingAfterEmailVerification,
  noFeedbackPerDay: CAPS.noFeedbackPerDay,
} as const

/** Daily limits reset at 00:00 UTC (worker/src/lib/time.ts). */
export const DAILY_RESET_EN = 'midnight UTC (8 p.m. Eastern time during daylight saving time, 7 p.m. otherwise)'
export const DAILY_RESET_KO = 'UTC 자정(캐나다 동부 시간으로 서머타임 기간에는 오후 8시, 그 밖에는 오후 7시)'

/*
 * Sentences that several pages must state the same way (review decisions 2, 7, 12, 15, the filter
 * wording and the zero-capital decisions Z3–Z9). content.test.ts checks that the pages use them and that
 * no older variant is left.
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
 * Speech-to-text runs on the Workers AI free allocation, so the whole site shares one daily speaking budget
 * (SPEAKING_DAILY_AUDIO_MINUTES; the Worker answers at_capacity and /api/me reports flags.speakingAvailable).
 * It resets with the other daily limits (startOfUtcDay). It is not a pause, so it does not extend passes.
 */
export const SPEAKING_CAPACITY = {
  en: `Speaking feedback has a daily capacity that everyone using the site shares. On a busy day it can close before you reach your own limit, and it opens again at ${DAILY_RESET_EN}. This does not affect writing feedback or practising without feedback.`,
  ko: `말하기 피드백에는 사이트 이용자 모두가 함께 쓰는 하루 처리량이 있어요. 이용자가 많은 날에는 내 한도에 닿기 전에 말하기 피드백이 마감될 수 있고, ${DAILY_RESET_KO}에 다시 열려요. 쓰기 피드백과 피드백 없는 연습은 영향을 받지 않아요.`,
} as const

/**
 * Free practice mode (Z9): every practice page offers it; no AI, no sign-in, nothing uploaded. The label is
 * the button name on the practice pages (frontend-app), so help text can refer to it.
 */
export const PRACTICE_MODE = {
  label: { en: 'Practise without feedback', ko: '피드백 없이 연습하기' },
  audio: {
    en: 'Recordings you make while practising without feedback stay in your browser on your device. They are never uploaded, and no one else hears them.',
    ko: '피드백 없이 연습할 때 한 녹음은 내 기기의 브라우저 안에만 있어요. 어디에도 업로드되지 않고, 다른 누구도 듣지 않아요.',
  },
} as const

/** Sign-in with Google (Z3): what Google gives us. Used on the privacy, help and landing pages. */
export const GOOGLE_SIGN_IN = {
  en: 'We receive only your email address and your Google account id from Google. We never see your Google password.',
  ko: 'Google에서는 이메일 주소와 Google 계정 ID만 받아요. Google 비밀번호는 저희가 볼 수 없어요.',
} as const

/** No email to learners (Z4): pass status, refunds and Stripe's receipt link are on the account page. */
export const NO_LEARNER_EMAIL = {
  en: 'We do not send you emails about your account or your pass. Your account page shows your pass, any refund and a link to the Stripe receipt for your payment.',
  ko: '계정이나 이용권에 관한 이메일은 보내지 않아요. 이용권, 환불 내역, 결제에 대한 Stripe 영수증 링크는 계정 페이지에서 볼 수 있어요.',
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

export const SUPPORT_FORM_LINE = 'Use the support form on your [account page](/account/) (you need to be signed in).'

/**
 * How to reach us, as rich text for the legal and help pages: the signed-in support form, the public support
 * address when set, and the mailing address only when it is set (Z5).
 */
export function buildContactLines(opts: { supportEmail: string | null; mailingAddress: string | null; legalName: string | null }): string[] {
  return [
    SUPPORT_FORM_LINE,
    ...(opts.supportEmail ? [`Email us at [${opts.supportEmail}](mailto:${opts.supportEmail}).`] : []),
    ...(opts.mailingAddress
      ? [`Write to us by mail: ${legalNameOrPlaceholder(opts.legalName)} (${BRAND.en}), ${opts.mailingAddress}`]
      : []),
  ]
}

export const CONTACT_LINES_EN: string[] = buildContactLines({
  supportEmail: SUPPORT_EMAIL,
  mailingAddress: MAILING_ADDRESS,
  legalName: LEGAL_NAME,
})
