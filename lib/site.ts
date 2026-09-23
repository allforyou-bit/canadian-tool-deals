import { business, formatPhone, missingSetup, priceBook } from '@/config/business'
import type { QuoteToolProps } from '@/components/QuoteTool'
import { marketingConsentText, type Lang } from '@/lib/i18n'

// Server-side helpers: config is read at build time and passed to client components as props
// (client bundles cannot read the dynamic process.env lookups in config/business.ts).

/**
 * NEXT_PUBLIC_PHONE as 1 + 10 digits (North American format), ready for tel:/sms: links.
 * A 10-digit entry such as 416-555-0123 gets the leading 1; anything else that is not
 * 1 + 10 digits returns '' so no Call/Text button dials a wrong (international) number,
 * and setupMissing() keeps the SAMPLE banner and watermark on.
 */
function dialPhone(): string {
  const d = business.contact.phone
  if (d.length === 10) return `1${d}`
  return d.length === 11 && d.startsWith('1') ? d : ''
}

export function quoteToolProps(lang: Lang): QuoteToolProps {
  return {
    lang,
    book: priceBook,
    services: business.services,
    gutterMaxStoreys: business.gutterMaxStoreys,
    tax: { registered: business.salesTaxRegistered, ratePct: business.tax.ratePct, label: business.tax.label },
    contact: { phone: dialPhone(), email: business.contact.email },
    brand: business.brand[lang],
    leadEndpoint: business.leadEndpoint,
    turnstileSiteKey: business.turnstileSiteKey,
    consentText: marketingConsentText(lang, {
      brand: business.brand[lang],
      mailingAddress: business.contact.mailingAddress,
      phone: business.contact.phone ? formatPhone(business.contact.phone) : '',
      email: business.contact.email,
    }),
  }
}

export function contactLinks() {
  const { email } = business.contact
  const phone = dialPhone()
  return {
    tel: phone ? `tel:+${phone}` : '',
    sms: phone ? `sms:+${phone}` : '',
    mail: email ? `mailto:${email}` : '',
    phoneDisplay: phone ? formatPhone(phone) : '',
    email,
  }
}

/** missingSetup() plus a phone that was entered but is not a 10-digit North American number */
export function setupMissing(): string[] {
  const missing = missingSetup()
  if (business.contact.phone && !dialPhone()) missing.push('NEXT_PUBLIC_PHONE (형식 오류 / invalid — e.g. 416-555-0123)')
  return missing
}

/** absolute URL on the configured site */
export const absolute = (path: string) => `${business.siteUrl}${path.startsWith('/') ? path : `/${path}`}`

/** printable asset clusters: each gets its own QR code (…/quote/?src=c1) to attribute leads */
export const CLUSTERS = ['c1', 'c2', 'c3'] as const
export type Cluster = (typeof CLUSTERS)[number]
