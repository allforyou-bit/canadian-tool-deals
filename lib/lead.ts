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

const SUMMARY_LABELS = {
  en: { title: 'Quote request', none: 'no estimate', name: 'Name', phone: 'Phone', email: 'Email', address: 'Address', dates: 'Preferred dates', notes: 'Notes', optYes: 'Marketing opt-in: YES', optNo: 'Marketing opt-in: no', service: { cleaning: 'cleaning', gutters: 'gutter cleaning', snow: 'snow clearing', other: 'other' } },
  ko: { title: '견적 요청', none: '견적 없음', name: '성함', phone: '전화', email: '이메일', address: '주소', dates: '희망 날짜', notes: '메모', optYes: '마케팅 수신 동의: 예', optNo: '마케팅 수신 동의: 아니요', service: { cleaning: '청소', gutters: '홈통 청소', snow: '제설', other: '기타' } },
}

/** Plain-text summary used for the SMS/email fallback, written in the visitor's language. */
export function leadSummary(p: LeadPayload): string {
  const L = SUMMARY_LABELS[p.lang] ?? SUMMARY_LABELS.en
  const est = p.estimateLow !== null ? `$${p.estimateLow}–$${p.estimateHigh}` : L.none
  return [
    `${L.title} (${L.service[p.service]}) — ${est}`,
    p.selections,
    `${L.name}: ${p.name}`,
    `${L.phone}: ${p.phone}`,
    p.email ? `${L.email}: ${p.email}` : '',
    `${L.address}: ${p.address}`,
    p.preferredDates ? `${L.dates}: ${p.preferredDates}` : '',
    p.notes ? `${L.notes}: ${p.notes}` : '',
    // CASL consent record: the SMS/email fallback is the only copy when no lead endpoint is set.
    p.marketingOptIn ? `${L.optYes} — "${p.marketingConsentText}"` : L.optNo,
  ]
    .filter(Boolean)
    .join('\n')
}
