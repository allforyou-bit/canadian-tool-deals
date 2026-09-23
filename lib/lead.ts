// The JSON body the quote form POSTs to NEXT_PUBLIC_LEAD_ENDPOINT (a Google Apps Script
// web app, see integrations/google-apps-script/Code.gs). Keep both sides in sync.

export interface LeadPayload {
  /** schema version */
  v: 1
  submittedAt: string
  lang: 'en' | 'ko'
  page: string
  service: 'cleaning' | 'gutters' | 'snow' | 'other'
  /** human-readable summary of the calculator selections */
  selections: string
  estimateLow: number | null
  estimateHigh: number | null
  name: string
  phone: string
  email: string
  address: string
  preferredDates: string
  notes: string
  /** separate, unticked-by-default opt-in for marketing messages (CASL express consent) */
  marketingOptIn: boolean
  /** exact consent wording shown next to the checkbox, stored as evidence */
  marketingConsentText: string
  /** Cloudflare Turnstile token when a site key is configured */
  turnstileToken: string
  /** honeypot: must stay empty */
  website: string
}

export function leadSummary(p: LeadPayload): string {
  const est = p.estimateLow !== null ? `$${p.estimateLow}–$${p.estimateHigh}` : 'no estimate'
  return [
    `Quote request (${p.service}) — ${est}`,
    p.selections,
    `Name: ${p.name}`,
    `Phone: ${p.phone}`,
    p.email ? `Email: ${p.email}` : '',
    `Address: ${p.address}`,
    p.preferredDates ? `Preferred dates: ${p.preferredDates}` : '',
    p.notes ? `Notes: ${p.notes}` : '',
    // CASL consent record: the SMS/email fallback is the only copy when no lead endpoint is set.
    p.marketingOptIn ? `Marketing opt-in: YES — "${p.marketingConsentText}"` : 'Marketing opt-in: no',
  ]
    .filter(Boolean)
    .join('\n')
}
