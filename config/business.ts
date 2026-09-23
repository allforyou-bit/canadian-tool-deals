import { PRICE_BOOKS, type CityKey, type PriceBook } from './prices'

// Business settings. Edit the defaults here, or override them without touching code by
// setting the NEXT_PUBLIC_* variables in Cloudflare Pages → Settings → Environment variables
// (they are baked in at build time, so redeploy after changing them).

export type Province = 'ON' | 'AB' | 'BC' | 'QC'

export interface TaxRule {
  province: Province
  /** combined sales-tax rate charged to customers once registered (percent) */
  ratePct: number
  label: string
  status: 'statute' | 'unverified'
  source: string
}

// GST 5% (ETA s.165(1)); Ontario participates in HST at 8% → 13% (ETA Schedule VIII).
// BC PST and Quebec QST were not verified in research.
export const TAX_RULES: Record<CityKey, TaxRule> = {
  gta: { province: 'ON', ratePct: 13, label: 'HST 13%', status: 'statute', source: 'https://github.com/justicecanada/laws-lois-xml/blob/main/eng/acts/E-15.xml' },
  ottawa: { province: 'ON', ratePct: 13, label: 'HST 13%', status: 'statute', source: 'https://github.com/justicecanada/laws-lois-xml/blob/main/eng/acts/E-15.xml' },
  calgary: { province: 'AB', ratePct: 5, label: 'GST 5%', status: 'statute', source: 'https://github.com/justicecanada/laws-lois-xml/blob/main/eng/acts/E-15.xml' },
  vancouver: { province: 'BC', ratePct: 5, label: 'GST 5% (+ BC PST if it applies to the service — unverified)', status: 'unverified', source: 'https://github.com/justicecanada/laws-lois-xml/blob/main/eng/acts/E-15.xml' },
  montreal: { province: 'QC', ratePct: 14.975, label: 'GST 5% + QST 9.975% (unverified)', status: 'unverified', source: 'not verified' },
}

const CITY_NAMES: Record<CityKey, { en: string; ko: string }> = {
  gta: { en: 'Greater Toronto Area', ko: '토론토 광역권(GTA)' },
  ottawa: { en: 'Ottawa', ko: '오타와' },
  calgary: { en: 'Calgary', ko: '캘거리' },
  vancouver: { en: 'Metro Vancouver', ko: '메트로 밴쿠버' },
  montreal: { en: 'Montreal', ko: '몬트리올' },
}

const CITY_KEYS: CityKey[] = ['gta', 'ottawa', 'calgary', 'vancouver', 'montreal']

function env(name: string): string | undefined {
  const v = process.env[name]
  return v && v.trim() ? v.trim() : undefined
}

function envFlag(name: string, fallback: boolean): boolean {
  const v = env(name)
  if (v === undefined) return fallback
  return v === '1' || v.toLowerCase() === 'true' || v.toLowerCase() === 'yes'
}

function envCity(): CityKey {
  const v = env('NEXT_PUBLIC_CITY')
  return v && (CITY_KEYS as string[]).includes(v) ? (v as CityKey) : 'gta'
}

const city = envCity()
const book: PriceBook = PRICE_BOOKS[city]

export const business = {
  brand: {
    en: env('NEXT_PUBLIC_BRAND_EN') ?? 'Neighbourhood Home Care',
    ko: env('NEXT_PUBLIC_BRAND_KO') ?? '우리동네 홈케어',
  },
  city,
  cityName: CITY_NAMES[city],
  /** the one neighbourhood cluster you actually serve, e.g. "Willowdale & Bayview Village" */
  serviceArea: {
    en: env('NEXT_PUBLIC_AREA_EN') ?? '',
    ko: env('NEXT_PUBLIC_AREA_KO') ?? '',
  },
  contact: {
    /** digits with country code, e.g. 14165550123 — used for tel: and sms: links */
    phone: (env('NEXT_PUBLIC_PHONE') ?? '').replace(/[^\d]/g, ''),
    email: env('NEXT_PUBLIC_EMAIL') ?? '',
    /** CASL requires a mailing address in every commercial email/SMS (SOR/2012-36 s.2(1)(d)) */
    mailingAddress: env('NEXT_PUBLIC_MAILING_ADDRESS') ?? '',
  },
  siteUrl: (env('NEXT_PUBLIC_SITE_URL') ?? 'https://example.pages.dev').replace(/\/$/, ''),
  services: {
    cleaning: true,
    // Track B is OFF until its gates pass (vehicle + ladder + written insurance + 5 booked jobs).
    gutters: envFlag('NEXT_PUBLIC_ENABLE_GUTTERS', false) && book.gutters !== null,
    // Snow is OFF until written snow insurance is bound (Gate S). Never enabled for Metro Vancouver.
    snow: envFlag('NEXT_PUBLIC_ENABLE_SNOW', false) && book.snow !== null,
  },
  /** highest storey count offered for gutters; 3-storey work is declined while working alone (checklists/04) */
  gutterMaxStoreys: (env('NEXT_PUBLIC_GUTTER_MAX_STOREYS') === '3' ? 3 : 2) as 2 | 3,
  /** set to true ONLY after a liability policy is bound — it shows an "Insured" line on the site */
  insured: envFlag('NEXT_PUBLIC_INSURED', false),
  /** GST/HST registration (small-supplier threshold $30,000 over four calendar quarters, ETA s.148) */
  salesTaxRegistered: envFlag('NEXT_PUBLIC_TAX_REGISTERED', false),
  tax: TAX_RULES[city],
  /** optional: Google Apps Script web-app URL that logs leads (see integrations/google-apps-script) */
  leadEndpoint: env('NEXT_PUBLIC_LEAD_ENDPOINT') ?? '',
  /** optional: Cloudflare Turnstile site key (verified server-side by the Apps Script) */
  turnstileSiteKey: env('NEXT_PUBLIC_TURNSTILE_SITE_KEY') ?? '',
}

export type Business = typeof business

export const priceBook: PriceBook = book

/** Settings that still need the owner's real details before the site goes to customers. */
export function missingSetup(): string[] {
  const missing: string[] = []
  if (!business.contact.phone) missing.push('NEXT_PUBLIC_PHONE')
  if (!business.contact.email) missing.push('NEXT_PUBLIC_EMAIL')
  if (!business.contact.mailingAddress) missing.push('NEXT_PUBLIC_MAILING_ADDRESS')
  if (!business.serviceArea.en) missing.push('NEXT_PUBLIC_AREA_EN')
  if (!business.serviceArea.ko) missing.push('NEXT_PUBLIC_AREA_KO')
  if (business.siteUrl.includes('example.pages.dev')) missing.push('NEXT_PUBLIC_SITE_URL')
  return missing
}

export function formatPhone(digits: string): string {
  const d = digits.startsWith('1') && digits.length === 11 ? digits.slice(1) : digits
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : digits
}
