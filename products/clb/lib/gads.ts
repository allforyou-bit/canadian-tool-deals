// Google Ads conversion tag, loaded ONLY by /checkout/success/ and only when
// NEXT_PUBLIC_GADS_SEND_TO is set (memo B8; disclosed in the privacy policy).
// [unverified: prior knowledge] gtag.js loader URL, the dataLayer/`arguments` convention and the
// 'conversion' event fields (send_to, value, currency, transaction_id) are from memory, not from a
// fetched Google document; check them against Google's current tag instructions before launch.

type Gtag = (...args: unknown[]) => void

interface GtagWindow {
  dataLayer?: unknown[]
  gtag?: Gtag
}

/** "AW-123456789/AbC-dEf" → "AW-123456789", or null when the value has another shape. */
export function adsAccountId(sendTo: string): string | null {
  const m = /^(AW-\d+)\/[A-Za-z0-9_-]+$/.exec(sendTo.trim())
  return m ? m[1] : null
}

function ensureGtag(accountId: string): Gtag {
  const w = window as unknown as GtagWindow
  if (w.gtag) return w.gtag
  const layer = (w.dataLayer = w.dataLayer ?? [])
  // gtag.js reads Arguments objects from dataLayer, so push `arguments` rather than an array
  w.gtag = function gtag() {
    layer.push(arguments)
  }
  w.gtag('js', new Date())
  w.gtag('config', accountId)
  const s = document.createElement('script')
  s.async = true
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(accountId)}`
  document.head.appendChild(s)
  return w.gtag
}

/**
 * Report one purchase conversion. `dedupeKey` keeps a reload of the success page from counting the
 * same purchase twice in this browser session.
 */
export function reportConversion(sendTo: string, valueCents: number, dedupeKey: string): boolean {
  const accountId = adsAccountId(sendTo)
  if (!accountId) return false
  const key = `mpc_conv_${dedupeKey}`
  try {
    if (window.sessionStorage.getItem(key)) return false
    window.sessionStorage.setItem(key, '1')
  } catch {
    // no storage: report anyway (at most one extra count on reload)
  }
  ensureGtag(accountId)('event', 'conversion', {
    send_to: sendTo.trim(),
    value: valueCents / 100,
    currency: 'CAD',
  })
  return true
}
