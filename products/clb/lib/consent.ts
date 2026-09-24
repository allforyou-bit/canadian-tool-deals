// CASL consent wording shown next to the unticked marketing box (shared/config MARKETING_CONSENT).
// The exact string displayed is what we send as marketingConsentText / consentText.
import type { Lang } from '../shared/api'
import { MARKETING_CONSENT } from '../shared/config'

export const ADDRESS_FALLBACK: Record<Lang, string> = {
  en: 'mailing address on our Privacy page',
  ko: '개인정보 처리방침 페이지의 우편 주소',
}

/** `address` is NEXT_PUBLIC_MAILING_ADDRESS; `siteUrl` is NEXT_PUBLIC_SITE_URL or location.origin. */
export function consentText(lang: Lang, address: string, siteUrl: string): string {
  const addr = address.trim() || ADDRESS_FALLBACK[lang]
  return MARKETING_CONSENT[lang](addr, siteUrl)
}
