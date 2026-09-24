import { env } from 'cloudflare:test'
import { exports } from 'cloudflare:workers'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { refundRequest } from '../../src/billing'
import type { User } from '../../src/env'
import { addDays } from '../../src/lib/time'
import {
  FakeStripe,
  ORIGIN,
  addGrades,
  chargeRefundedEvent,
  createUser,
  deleteAccount,
  eventCount,
  jsonRequest,
  makeCtx,
  passesOf,
  postWebhook,
  purchaseRow,
  refundsOf,
  seedPaidPurchase,
} from './helpers'

const ask = (user: User, lang: 'en' | 'ko' = 'en') => refundRequest(jsonRequest('/api/refund-request', { lang }), makeCtx(user))

async function refused(res: Response, text: string): Promise<void> {
  expect(res.status).toBe(403)
  const body = await res.json<{ error: string; message: string }>()
  expect(body.error).toBe('forbidden')
  expect(body.message).toContain(text)
}

describe('POST /api/refund-request', () => {
  let stripe: FakeStripe

  beforeEach(() => {
    stripe = new FakeStripe().install()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('rejects signed-out requests (through the router)', async () => {
    const res = await exports.default.fetch(`${ORIGIN}/api/refund-request`, {
      method: 'POST',
      headers: { origin: ORIGIN, 'content-type': 'application/json' },
      body: JSON.stringify({ lang: 'en' }),
    })
    expect(res.status).toBe(401)
  })

  it('refunds within 14 days and 5 graded tasks, then revokes the pass', async () => {
    const { user, cookie } = await createUser()
    const paidAt = addDays(new Date(), -13)
    const p = await seedPaidPurchase(user.id, { paidAt })
    await addGrades(user.id, 5, { createdAt: addDays(paidAt, 1) })
    // refused requests, free samples and grades from before the purchase do not count
    await addGrades(user.id, 2, { createdAt: addDays(paidAt, 1), refused: true })
    await addGrades(user.id, 1, { createdAt: addDays(paidAt, 1), free: true })
    await addGrades(user.id, 3, { createdAt: addDays(paidAt, -1) })
    const refundsBefore = await eventCount('refund', '/api/refund-request')

    // through the router with the session cookie
    const res = await exports.default.fetch(`${ORIGIN}/api/refund-request`, {
      method: 'POST',
      headers: { origin: ORIGIN, 'content-type': 'application/json', cookie },
      body: JSON.stringify({ lang: 'en' }),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, refundedCents: 3900 })

    const [call] = stripe.stripeCalls('POST /v1/refunds')
    const params = new URLSearchParams(call.body)
    expect(params.get('payment_intent')).toBe(p.paymentIntentId)
    expect(params.get('reason')).toBe('requested_by_customer')
    expect(params.get('metadata[reason]')).toBe('self_serve')
    expect(call.headers.get('idempotency-key')).toBe(`self-${p.id}`)

    const row = await purchaseRow(p.id)
    expect(row?.status).toBe('refunded')
    expect(row?.refunded_at).not.toBeNull()
    expect((await passesOf(user.id))[0]).toMatchObject({ revoke_reason: 'refunded' })
    expect((await passesOf(user.id))[0].revoked_at).not.toBeNull()
    expect(await refundsOf(p.id)).toEqual([{ id: `self_serve_${p.id}`, reason: 'self_serve', amount_cents: 3900, user_id: user.id }])
    const flag = await env.DB.prepare('SELECT self_refund_used FROM users WHERE id = ?1').bind(user.id).first<{ self_refund_used: number }>()
    expect(flag?.self_refund_used).toBe(1)
    expect(await eventCount('refund', '/api/refund-request')).toBe(refundsBefore + 1)
    const mail = stripe.emails.find((m) => m.to === user.email)
    expect(mail?.text).toContain('We refunded C$39.00')
    expect(mail?.idempotencyKey).toBe(`self-refund-${p.id}`)

    // Stripe's charge.refunded for this refund does not add a second event or an owner refund row
    const allRefundEvents = await eventCount('refund')
    await postWebhook(chargeRefundedEvent({ chargeId: p.chargeId, paymentIntentId: p.paymentIntentId }))
    expect(await eventCount('refund')).toBe(allRefundEvents)
    expect(await refundsOf(p.id)).toHaveLength(1)
  })

  it('does not double-count when the charge.refunded webhook wins the race', async () => {
    const { user } = await createUser()
    const p = await seedPaidPurchase(user.id)
    const allRefundEvents = await eventCount('refund')
    // the webhook lands between the claim and the purchase update: it must see the refund as self-serve
    const original = stripe['handle'].bind(stripe)
    vi.spyOn(stripe as unknown as { handle: (r: Request) => Promise<Response> }, 'handle').mockImplementation(async (req) => {
      const res = await original(req)
      if (new URL(req.url).pathname === '/v1/refunds') {
        await postWebhook(chargeRefundedEvent({ chargeId: p.chargeId, paymentIntentId: p.paymentIntentId }))
      }
      return res
    })
    const res = await ask(user)
    expect(res.status).toBe(200)
    expect(await eventCount('refund')).toBe(allRefundEvents + 1)
    expect((await refundsOf(p.id)).map((r) => r.reason)).toEqual(['self_serve'])
    expect((await purchaseRow(p.id))?.status).toBe('refunded')
  })

  it('refuses after 14 days', async () => {
    const { user } = await createUser()
    await seedPaidPurchase(user.id, { paidAt: addDays(new Date(), -15) })
    await refused(await ask(user), 'within 14 days')
    expect(stripe.calls).toHaveLength(0)
  })

  it('refuses after 6 graded tasks', async () => {
    const { user } = await createUser()
    const paidAt = addDays(new Date(), -2)
    await seedPaidPurchase(user.id, { paidAt })
    await addGrades(user.id, 6, { createdAt: addDays(paidAt, 1) })
    await refused(await ask(user, 'ko'), '5개 이하')
    expect(stripe.calls).toHaveLength(0)
  })

  it('refuses when there is no paid purchase', async () => {
    const { user } = await createUser()
    await refused(await ask(user), 'no purchase')
  })

  it('refuses a second self-refund on the same account', async () => {
    const { user } = await createUser()
    await seedPaidPurchase(user.id, { paidAt: addDays(new Date(), -3) })
    expect((await ask(user)).status).toBe(200)
    await seedPaidPurchase(user.id)
    await refused(await ask(user), 'already used')
    await refused(await ask({ ...user, selfRefundUsed: true }), 'already used')
    expect(stripe.stripeCalls('POST /v1/refunds')).toHaveLength(1)
  })

  it('refuses the same email after account deletion and re-signup', async () => {
    const email = `again-${Date.now()}@example.test`
    const first = await createUser({ email })
    await seedPaidPurchase(first.user.id)
    expect((await ask(first.user)).status).toBe(200)

    await deleteAccount(first.user.id)
    const second = await createUser({ email })
    expect(second.user.id).not.toBe(first.user.id)
    expect(second.emailHash).toBe(first.emailHash)
    await seedPaidPurchase(second.user.id, { fingerprint: 'fp_new_card' })
    await refused(await ask(second.user), 'already used')
    expect(stripe.stripeCalls('POST /v1/refunds')).toHaveLength(1)
  })

  it('refuses the same card fingerprint on another account', async () => {
    const a = await createUser()
    const b = await createUser()
    const fingerprint = `fp_shared_${Date.now()}`
    await seedPaidPurchase(a.user.id, { fingerprint })
    expect((await ask(a.user)).status).toBe(200)
    await seedPaidPurchase(b.user.id, { fingerprint })
    await refused(await ask(b.user), 'already used')

    // a purchase without a fingerprint is not blocked by that rule
    const c = await createUser()
    await seedPaidPurchase(c.user.id, { fingerprint: null })
    expect((await ask(c.user)).status).toBe(200)
  })

  it('refunds only the latest paid purchase', async () => {
    const { user } = await createUser()
    const older = await seedPaidPurchase(user.id, { paidAt: addDays(new Date(), -5) })
    const latest = await seedPaidPurchase(user.id, { paidAt: addDays(new Date(), -1), sku: 'pass90' })
    stripe.paymentIntents.set(latest.paymentIntentId, { id: latest.paymentIntentId, amount: 7900 })
    const res = await ask(user)
    expect(await res.json()).toEqual({ ok: true, refundedCents: 7900 })
    expect((await purchaseRow(latest.id))?.status).toBe('refunded')
    expect((await purchaseRow(older.id))?.status).toBe('paid')
  })

  it('lets only one of two simultaneous requests through', async () => {
    const { user } = await createUser()
    await seedPaidPurchase(user.id)
    const [r1, r2] = await Promise.all([ask(user), ask(user)])
    expect([r1.status, r2.status].sort()).toEqual([200, 403])
    expect(stripe.stripeCalls('POST /v1/refunds')).toHaveLength(1)
  })

  it('releases the claim when Stripe fails, so the buyer can try again', async () => {
    const { user } = await createUser()
    const p = await seedPaidPurchase(user.id)
    stripe.failures.set('POST /v1/refunds', { status: 500, code: 'api_error' })
    const res = await ask(user)
    expect(res.status).toBe(500)
    expect(await res.json()).toMatchObject({ error: 'internal' })
    expect(await refundsOf(p.id)).toHaveLength(0)
    expect((await purchaseRow(p.id))?.status).toBe('paid')

    expect((await ask(user)).status).toBe(200)
    expect(stripe.stripeCalls('POST /v1/refunds').map((c) => c.headers.get('idempotency-key'))).toEqual([`self-${p.id}`, `self-${p.id}`])
  })

  it('alerts the owner when Stripe reports the refund as failed', async () => {
    const { user } = await createUser()
    const p = await seedPaidPurchase(user.id)
    stripe.refundStatus = 'failed'
    const res = await ask(user)
    expect(res.status).toBe(500)
    expect(await refundsOf(p.id)).toHaveLength(0)
    expect((await passesOf(user.id))[0].revoked_at).toBeNull()
    expect(stripe.emails.some((m) => m.to === env.OWNER_EMAIL && m.subject.includes('Self-serve refund failed'))).toBe(true)
  })

  it('rejects invalid JSON', async () => {
    const { user } = await createUser()
    const res = await refundRequest(jsonRequest('/api/refund-request', '{'), makeCtx(user))
    expect(res.status).toBe(400)
  })
})
