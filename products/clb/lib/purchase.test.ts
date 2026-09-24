import { describe, expect, it } from 'vitest'
import type { MeResponse } from '../shared/api'
import { SKUS } from '../shared/config'
import { checkoutSessionId, conversionFor, purchaseOutcome } from './purchase'

const NOW = new Date('2026-09-24T12:00:00.000Z')
const OLD_PASS = { sku: 'pass30' as const, startsAt: '2026-09-20T12:00:00.000Z', endsAt: '2026-10-20T12:00:00.000Z' }

function me(extra: Partial<MeResponse> = {}): MeResponse {
  return {
    signedIn: true,
    email: 'learner@example.test',
    pass: null,
    free: { writing: false, speaking: false },
    usage: { writingToday: 0, speakingToday: 0, graded30d: 0 },
    flags: { checkoutEnabled: true, gradingEnabled: true, banner: '' },
    ...extra,
  }
}

describe('checkoutSessionId', () => {
  it('reads a Stripe Checkout Session id from the success URL', () => {
    expect(checkoutSessionId('?session_id=cs_test_a1B2c3')).toBe('cs_test_a1B2c3')
    expect(checkoutSessionId('?session_id=cs_live_XYZ&x=1')).toBe('cs_live_XYZ')
  })

  it('ignores anything else', () => {
    for (const bad of ['', '?session_id=', '?session_id={CHECKOUT_SESSION_ID}', '?session_id=pi_123', '?session_id=cs_<x>']) {
      expect(checkoutSessionId(bad)).toBeNull()
    }
  })
})

describe('purchaseOutcome', () => {
  it('keeps waiting while an older pass is active and the new purchase is still pending (repeat buyer)', () => {
    const state = me({ pass: OLD_PASS, accessEndsAt: OLD_PASS.endsAt, latestPurchase: { id: 'cs_test_new', sku: 'pass90', status: 'pending' } })
    expect(purchaseOutcome(state, 'cs_test_new', NOW)).toEqual({ kind: 'waiting' })
    expect(conversionFor(purchaseOutcome(state, 'cs_test_new', NOW), 'cs_test_new')).toBeNull()
  })

  it('keeps waiting while the latest purchase is a different one (webhook not processed yet)', () => {
    const state = me({ pass: OLD_PASS, accessEndsAt: OLD_PASS.endsAt, latestPurchase: { id: 'cs_test_old', sku: 'pass30', status: 'paid' } })
    expect(purchaseOutcome(state, 'cs_test_new', NOW)).toEqual({ kind: 'waiting' })
  })

  it('confirms the bought pass with the end of all passes and reports the bought SKU price once', () => {
    const state = me({
      pass: OLD_PASS,
      accessEndsAt: '2027-01-18T12:00:00.000Z',
      latestPurchase: { id: 'cs_test_new', sku: 'pass90', status: 'paid' },
    })
    const outcome = purchaseOutcome(state, 'cs_test_new', NOW)
    expect(outcome).toEqual({
      kind: 'paid',
      purchaseId: 'cs_test_new',
      sku: 'pass90',
      endsAt: '2027-01-18T12:00:00.000Z',
      valueCents: SKUS.pass90.priceCents,
    })
    expect(conversionFor(outcome, 'cs_test_new')).toEqual({ valueCents: 7900, dedupeKey: 'cs_test_new' })
  })

  it('never reports a conversion without the session id from Stripe', () => {
    const state = me({ accessEndsAt: '2026-10-24T12:00:00.000Z', latestPurchase: { id: 'cs_test_1', sku: 'pass30', status: 'paid' } })
    const outcome = purchaseOutcome(state, null, NOW)
    expect(outcome.kind).toBe('paid')
    expect(conversionFor(outcome, null)).toBeNull()
  })

  it('falls back to the active pass end when accessEndsAt is missing, and waits when nothing is granted yet', () => {
    const paid = { id: 'cs_test_1', sku: 'pass30' as const, status: 'paid' as const }
    expect(purchaseOutcome(me({ pass: OLD_PASS, latestPurchase: paid }), 'cs_test_1', NOW)).toMatchObject({ endsAt: OLD_PASS.endsAt })
    expect(purchaseOutcome(me({ latestPurchase: paid, accessEndsAt: null }), 'cs_test_1', NOW)).toEqual({ kind: 'waiting' })
  })

  it('reports region refunds, refunds and disputes without a conversion', () => {
    const at = (status: 'rejected_region' | 'refunded' | 'disputed') =>
      purchaseOutcome(me({ pass: OLD_PASS, latestPurchase: { id: 'cs_test_1', sku: 'pass30', status } }), 'cs_test_1', NOW)
    expect(at('rejected_region')).toEqual({ kind: 'rejected' })
    expect(at('refunded')).toEqual({ kind: 'refunded' })
    expect(at('disputed')).toEqual({ kind: 'problem' })
    expect(conversionFor(at('rejected_region'), 'cs_test_1')).toBeNull()
  })

  it('asks signed-out visitors to sign in', () => {
    expect(purchaseOutcome(me({ signedIn: false }), 'cs_test_1', NOW)).toEqual({ kind: 'signedOut' })
    expect(purchaseOutcome(null, 'cs_test_1', NOW)).toEqual({ kind: 'waiting' })
  })
})
