// CASL consent wording shown next to the unticked marketing box (shared/config MARKETING_CONSENT).
// The Worker rebuilds the same sentence from its own MAILING_ADDRESS and SITE_URL
// (worker/src/auth.ts expectedConsentText: address trimmed, trailing slashes removed from the URL) and
// records opt-in only when the text we send is identical. The site gets the same values at build
// time as NEXT_PUBLIC_MAILING_ADDRESS / NEXT_PUBLIC_SITE_URL and normalises them the same way.
import type { Lang } from '../shared/api'
import { MARKETING_CONSENT } from '../shared/config'

/** wrangler.jsonc's MAILING_ADDRESS placeholder starts with this; the Worker ignores opt-in while it is set. */
export const ADDRESS_PLACEHOLDER_PREFIX = 'SET-BEFORE-LAUNCH'

/** Marketing consent can be asked for only when the owner's real mailing address is configured. */
export function canAskMarketingConsent(address: string): boolean {
  return address.trim() !== '' && !address.trim().startsWith(ADDRESS_PLACEHOLDER_PREFIX)
}

/**
 * The exact consent sentence, or null when no mailing address is configured (then the marketing box
 * is not shown at all: a consent request without the sender's mailing address would not meet CASL,
 * and the Worker would ignore it anyway). `siteUrl` is NEXT_PUBLIC_SITE_URL or location.origin.
 */
export function consentText(lang: Lang, address: string, siteUrl: string): string | null {
  if (!canAskMarketingConsent(address)) return null
  return MARKETING_CONSENT[lang](address.trim(), siteUrl.replace(/\/+$/, ''))
}
