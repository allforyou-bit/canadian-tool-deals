import { business, formatPhone, missingSetup, priceBook } from '@/config/business'
import type { QuoteToolProps } from '@/components/QuoteTool'
import type { Lang } from '@/lib/i18n'

// Server-side helpers: config is read at build time and passed to client components as props
// (client bundles cannot read the dynamic process.env lookups in config/business.ts).

export function quoteToolProps(lang: Lang): QuoteToolProps {
  return {
    lang,
    book: priceBook,
    services: business.services,
    tax: { registered: business.salesTaxRegistered, ratePct: business.tax.ratePct, label: business.tax.label },
    contact: { phone: business.contact.phone, email: business.contact.email },
    brand: business.brand[lang],
    leadEndpoint: business.leadEndpoint,
    turnstileSiteKey: business.turnstileSiteKey,
  }
}

export function contactLinks() {
  const { phone, email } = business.contact
  return {
    tel: phone ? `tel:+${phone}` : '',
    sms: phone ? `sms:+${phone}` : '',
    mail: email ? `mailto:${email}` : '',
    phoneDisplay: phone ? formatPhone(phone) : '',
    email,
  }
}

export const setupMissing = missingSetup

/** absolute URL on the configured site */
export const absolute = (path: string) => `${business.siteUrl}${path.startsWith('/') ? path : `/${path}`}`

/** printable asset clusters: each gets its own QR code (…/quote/?src=c1) to attribute leads */
export const CLUSTERS = ['c1', 'c2', 'c3'] as const
export type Cluster = (typeof CLUSTERS)[number]
