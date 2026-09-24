// Sales region rules (memo §1.1, B6): Canada only, excluding Quebec. Used before checkout (request.cf)
// and after payment (billing address + card country).
import { SALES_REGION } from '../../../shared/config'

/**
 * Full province names that may appear instead of the ISO 3166-2 subdivision code. Checkout is expected to
 * store the code ("QC") in billing_details.address.state; names are handled defensively.
 * // [unverified: prior knowledge] (the OpenAPI spec only says "State, county, province, or region (ISO 3166-2)")
 */
const REGION_NAMES: Record<string, string> = { QUEBEC: 'QC' }

function normalizeCountry(country: string | null | undefined): string | null {
  const c = country?.trim().toUpperCase()
  return c ? c : null
}

/** Upper-cased subdivision code: "qc", "CA-QC", "Québec" and "Quebec" all become "QC". */
export function normalizeRegion(region: string | null | undefined): string | null {
  if (!region) return null
  const r = region
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .replace(/^CA-/, '')
  if (!r) return null
  return REGION_NAMES[r] ?? r
}

/** True when the country is the sales country and the region is not excluded. */
export function inSalesRegion(country: string | null | undefined, region: string | null | undefined): boolean {
  if (normalizeCountry(country) !== SALES_REGION.country) return false
  const r = normalizeRegion(region)
  return !(SALES_REGION.excludedRegions as readonly string[]).some((x) => x === r)
}

/** Payment evidence taken from the charge and stored on the purchase. */
export interface PaymentEvidence {
  chargeId: string
  billingCountry: string | null
  billingRegion: string | null
  cardCountry: string | null
  cardFingerprint: string | null
}

/** Grant only if billing country is CA, billing province is not QC and the card was issued in CA. */
export function evidenceAllowed(e: PaymentEvidence): boolean {
  return inSalesRegion(e.billingCountry, e.billingRegion) && normalizeCountry(e.cardCountry) === SALES_REGION.country
}
