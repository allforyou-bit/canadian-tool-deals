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
} as const

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
