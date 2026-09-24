// What /checkout/success/ shows for the purchase Stripe just sent us back from. The success URL
// carries ?session_id=<Checkout Session id>, which is also purchases.id, so the page waits for THAT
// purchase in /api/me (latestPurchase) instead of accepting any pass the learner already had.
import type { MeResponse } from '../shared/api'
import { SKUS, type Sku } from '../shared/config'
import { accessEndsAt } from './me'

export type PurchaseOutcome =
  | { kind: 'waiting' }
  | { kind: 'signedOut' }
  /** paid and granted: `endsAt` is the end of all the learner's passes, `valueCents` the bought SKU's price */
  | { kind: 'paid'; purchaseId: string; sku: Sku; endsAt: string; valueCents: number }
  /** refunded at once by the sales-region rule */
  | { kind: 'rejected' }
  | { kind: 'refunded' }
  | { kind: 'problem' }

/** Stripe Checkout Session id from the success URL (cs_test_… / cs_live_…), or null. */
export function checkoutSessionId(search: string): string | null {
  const v = new URLSearchParams(search).get('session_id')
  return v && /^cs_[A-Za-z0-9_]{1,250}$/.test(v) ? v : null
}

/**
 * Outcome for the purchase `sessionId` (or, without one, the latest purchase). Anything that is not
 * that purchase in a final state is 'waiting': an older pass never counts as this purchase.
 */
export function purchaseOutcome(me: MeResponse | null, sessionId: string | null, now = new Date()): PurchaseOutcome {
  if (!me) return { kind: 'waiting' }
  if (!me.signedIn) return { kind: 'signedOut' }
  const purchase = me.latestPurchase
  if (!purchase || (sessionId !== null && purchase.id !== sessionId)) return { kind: 'waiting' }
  switch (purchase.status) {
    case 'paid': {
      const endsAt = accessEndsAt(me, now)
      // paid but the pass is not visible yet: keep waiting for the next answer
      if (!endsAt) return { kind: 'waiting' }
      return {
        kind: 'paid',
        purchaseId: purchase.id,
        sku: purchase.sku,
        endsAt,
        valueCents: SKUS[purchase.sku]?.priceCents ?? 0,
      }
    }
    case 'rejected_region':
      return { kind: 'rejected' }
    case 'refunded':
      return { kind: 'refunded' }
    case 'disputed':
      return { kind: 'problem' }
    default:
      return { kind: 'waiting' }
  }
}

/** Only a confirmed purchase that Stripe sent us back from counts as an ads conversion. */
export function conversionFor(outcome: PurchaseOutcome, sessionId: string | null): { valueCents: number; dedupeKey: string } | null {
  if (outcome.kind !== 'paid' || sessionId === null || outcome.purchaseId !== sessionId) return null
  return { valueCents: outcome.valueCents, dedupeKey: sessionId }
}
