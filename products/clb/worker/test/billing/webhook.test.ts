import { env } from 'cloudflare:test'
import { type MockInstance, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { findClaims } from '../../../shared/content-rules'
import { addDays } from '../../src/lib/time'
import {
  FakeStripe,
  chargeRefundedEvent,
  checkoutCompletedEvent,
  createUser,
  disputeCreatedEvent,
  eventCount,
  passesOf,
  paymentIntent,
  postWebhook,
  purchase,
  purchaseRow,
  refundsOf,
  setCheckoutEnabled,
  signatureHeader,
  startCheckout,
  uid,
  webhookEventExists,
} from './helpers'

const DAY_MS = 86_400_000

describe('POST /api/stripe/webhook', () => {
  let stripe: FakeStripe
  let warn: MockInstance<typeof console.warn>
  let err: MockInstance<typeof console.error>

  beforeEach(async () => {
    stripe = new FakeStripe().install()
    await setCheckoutEnabled(true)
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    err = vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe('signature', () => {
    const event = () => checkoutCompletedEvent({ sessionId: `cs_test_${uid()}`, paymentIntentId: `pi_${uid()}` })

    it('rejects a signature made with another secret', async () => {
      const e = event()
      const res = await postWebhook(e, { secret: 'whsec_wrong' })
      expect(res.status).toBe(400)
      expect(await res.json()).toMatchObject({ error: 'bad_request' })
      expect(await webhookEventExists(e.id as string)).toBe(false)
    })

    it('rejects a missing or malformed header', async () => {
      expect((await postWebhook(event(), { header: null })).status).toBe(400)
      expect((await postWebhook(event(), { header: 'v1=abc' })).status).toBe(400)
      expect((await postWebhook(event(), { header: 't=abc,v1=abc' })).status).toBe(400)
    })

    it('rejects a timestamp older than 300 seconds', async () => {
      const e = event()
      const res = await postWebhook(e, { timestamp: Math.floor(Date.now() / 1000) - 301 })
      expect(res.status).toBe(400)
      expect(await webhookEventExists(e.id as string)).toBe(false)
    })

    it('accepts a header carrying several v1 signatures when one matches', async () => {
      const e = { id: `evt_${uid()}`, type: 'customer.created', data: { object: { id: 'cus_1' } } }
      const payload = JSON.stringify(e)
      const good = await signatureHeader(payload)
      const t = good.split(',')[0]
      const header = `${t},v1=${'0'.repeat(64)},${good.split(',')[1]},v0=ignored`
      const res = await postWebhook(e, { header })
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ received: true })
    })

    it('rejects signed bodies that are not Stripe events, and oversized bodies', async () => {
      expect((await postWebhook(null, { rawBody: 'not json' })).status).toBe(400)
      expect((await postWebhook(null, { rawBody: JSON.stringify({ id: 'evt_x', type: 'x' }) })).status).toBe(400)
      const big = JSON.stringify({ id: 'evt_big', type: 'x', data: { object: { pad: 'x'.repeat(300 * 1024) } } })
      expect((await postWebhook(null, { rawBody: big })).status).toBe(413)
    })
  })

  describe('checkout.session.completed', () => {
    it('grants a pass for a Canadian billing address and card', async () => {
      const { user } = await createUser()
      const purchasesBefore = await eventCount('purchase', '/api/stripe/webhook')
      const started = Date.now()

      const p = await purchase(stripe, user, { billingState: 'BC', fingerprint: 'fp_grant_1' })
      expect(p.res.status).toBe(200)
      expect(await p.res.json()).toEqual({ received: true })

      const [piCall] = stripe.stripeCalls(`GET /v1/payment_intents/${p.paymentIntentId}`)
      expect(piCall.url.searchParams.get('expand[0]')).toBe('latest_charge')
      expect(piCall.headers.get('authorization')).toBe(`Bearer ${env.STRIPE_SECRET_KEY}`)

      const row = await purchaseRow(p.sessionId)
      expect(row).toMatchObject({
        status: 'paid',
        payment_intent: p.paymentIntentId,
        charge_id: p.chargeId,
        card_fingerprint: 'fp_grant_1',
        card_country: 'CA',
        billing_country: 'CA',
        billing_region: 'BC',
        refunded_at: null,
      })
      expect(Date.parse(row?.paid_at ?? '')).toBeGreaterThanOrEqual(started - 1000)

      const [pass] = await passesOf(user.id)
      expect(pass).toMatchObject({ sku: 'pass30', purchase_id: p.sessionId, revoked_at: null })
      expect(Date.parse(pass.ends_at) - Date.parse(pass.starts_at)).toBe(30 * DAY_MS)
      expect(Date.parse(pass.starts_at)).toBeGreaterThanOrEqual(started - 1000)

      expect(await eventCount('purchase', '/api/stripe/webhook')).toBe(purchasesBefore + 1)
      const mail = stripe.emails.find((m) => m.to === user.email)
      expect(mail?.idempotencyKey).toBe(p.eventId)
      expect(mail?.text).toContain(`active until ${pass.ends_at.slice(0, 10)} ${pass.ends_at.slice(11, 16)} UTC`)
      expect(stripe.stripeCalls('POST /v1/refunds')).toHaveLength(0)
    })

    it('extends: a second purchase starts when the first pass ends', async () => {
      const { user } = await createUser({ lang: 'ko' })
      await purchase(stripe, user, { sku: 'pass30' })
      await purchase(stripe, user, { sku: 'pass90' })
      const [first, second] = await passesOf(user.id)
      expect(first.sku).toBe('pass30')
      expect(second.sku).toBe('pass90')
      expect(second.starts_at).toBe(first.ends_at)
      expect(Date.parse(second.ends_at) - Date.parse(second.starts_at)).toBe(90 * DAY_MS)
      // Korean users get the Korean email
      expect(stripe.emails.filter((m) => m.to === user.email).every((m) => m.subject.includes('이용권'))).toBe(true)
    })

    it('processes a duplicate event id only once', async () => {
      const { user } = await createUser()
      const sessionId = await startCheckout(user)
      const pi = paymentIntent()
      stripe.paymentIntents.set(pi.id as string, pi)
      const event = checkoutCompletedEvent({ sessionId, paymentIntentId: pi.id as string, userId: user.id })

      expect(await (await postWebhook(event)).json()).toEqual({ received: true })
      const again = await postWebhook(event)
      expect(again.status).toBe(200)
      expect(await again.json()).toEqual({ received: true, duplicate: true })
      expect(stripe.stripeCalls('GET /v1/payment_intents')).toHaveLength(1)
      expect(await passesOf(user.id)).toHaveLength(1)
    })

    it.each([
      ['a billing address outside Canada', { billingCountry: 'US', billingState: 'WA' }],
      ['a Quebec billing address', { billingState: 'QC' }],
      ['a Quebec address written out', { billingState: 'Québec' }],
      ['a foreign card with a Canadian address', { cardCountry: 'US' }],
      ['a missing billing country', { billingCountry: null }],
    ])('refunds %s and grants nothing', async (_label, evidence) => {
      const { user } = await createUser()
      const p = await purchase(stripe, user, evidence)
      expect(p.res.status).toBe(200)

      const [refundCall] = stripe.stripeCalls('POST /v1/refunds')
      const params = new URLSearchParams(refundCall.body)
      expect(params.get('payment_intent')).toBe(p.paymentIntentId)
      expect(params.get('metadata[reason]')).toBe('region')
      expect(refundCall.headers.get('idempotency-key')).toBe(`region-${p.sessionId}`)

      const row = await purchaseRow(p.sessionId)
      expect(row?.status).toBe('rejected_region')
      expect(row?.refunded_at).not.toBeNull()
      expect(row?.paid_at).toBeNull()
      expect(row?.charge_id).toBe(p.chargeId)
      expect(await refundsOf(p.sessionId)).toEqual([
        { id: `region_${p.sessionId}`, reason: 'region', amount_cents: 3900, user_id: user.id },
      ])
      expect(await passesOf(user.id)).toHaveLength(0)

      const mail = stripe.emails.find((m) => m.to === user.email)
      expect(mail?.text).toContain('outside Quebec')
      expect(mail?.text).toContain('refunded it in full: C$39.00')
      expect(findClaims(mail?.text ?? '')).toEqual([])

      // Stripe's charge.refunded for that refund changes nothing and is not counted as a customer refund
      const refundsBefore = await eventCount('refund')
      await postWebhook(chargeRefundedEvent({ chargeId: p.chargeId, paymentIntentId: p.paymentIntentId }))
      expect((await purchaseRow(p.sessionId))?.status).toBe('rejected_region')
      expect(await eventCount('refund')).toBe(refundsBefore)
    })

    it('treats charge_already_refunded on a region refund retry as done', async () => {
      const { user } = await createUser()
      stripe.failures.set('POST /v1/refunds', { status: 400, code: 'charge_already_refunded' })
      const p = await purchase(stripe, user, { cardCountry: 'FR' })
      expect(p.res.status).toBe(200)
      expect((await purchaseRow(p.sessionId))?.status).toBe('rejected_region')
      expect(await refundsOf(p.sessionId)).toHaveLength(1)
    })

    it('alerts the owner when a region refund comes back failed', async () => {
      const { user } = await createUser()
      stripe.refundStatus = 'failed'
      const p = await purchase(stripe, user, { billingCountry: 'GB' })
      expect(p.res.status).toBe(200)
      expect((await purchaseRow(p.sessionId))?.status).toBe('rejected_region')
      expect(stripe.emails.some((m) => m.to === env.OWNER_EMAIL && m.subject.includes('Region refund failed'))).toBe(true)
      expect(stripe.emails.some((m) => m.to === user.email)).toBe(false)
    })

    it('keeps the event retryable when the region refund call fails', async () => {
      const { user } = await createUser()
      stripe.failures.set('POST /v1/refunds', { status: 500, code: 'api_error' })
      const p = await purchase(stripe, user, { billingState: 'QC' })
      expect(p.res.status).toBe(500)
      expect(await refundsOf(p.sessionId)).toHaveLength(0)
      expect(await webhookEventExists(p.eventId)).toBe(false)
    })

    it('returns 500 on a processing error and succeeds when Stripe retries the event', async () => {
      const { user } = await createUser()
      const sessionId = await startCheckout(user)
      const pi = paymentIntent()
      stripe.paymentIntents.set(pi.id as string, pi)
      const event = checkoutCompletedEvent({ sessionId, paymentIntentId: pi.id as string, userId: user.id })
      stripe.failures.set('GET /v1/payment_intents', { status: 500, code: 'api_error' })

      const first = await postWebhook(event)
      expect(first.status).toBe(500)
      expect(await webhookEventExists(event.id as string)).toBe(false)
      expect(await passesOf(user.id)).toHaveLength(0)
      expect((await purchaseRow(sessionId))?.status).toBe('pending')

      const retry = await postWebhook(event)
      expect(retry.status).toBe(200)
      expect(await retry.json()).toEqual({ received: true })
      expect(await webhookEventExists(event.id as string)).toBe(true)
      expect(await passesOf(user.id)).toHaveLength(1)
      expect((await purchaseRow(sessionId))?.status).toBe('paid')
    })

    it('rebuilds a missing purchase row from client_reference_id and metadata', async () => {
      const { user } = await createUser()
      const sessionId = `cs_test_${uid()}`
      const pi = paymentIntent()
      stripe.paymentIntents.set(pi.id as string, pi)
      const res = await postWebhook(checkoutCompletedEvent({ sessionId, paymentIntentId: pi.id as string, userId: user.id, sku: 'pass90' }))
      expect(res.status).toBe(200)
      expect(await purchaseRow(sessionId)).toMatchObject({ user_id: user.id, sku: 'pass90', amount_cents: 7900, status: 'paid' })
      expect(await passesOf(user.id)).toHaveLength(1)
    })

    it('alerts the owner when a paid session matches no user', async () => {
      const sessionId = `cs_test_${uid()}`
      const res = await postWebhook(checkoutCompletedEvent({ sessionId, paymentIntentId: `pi_${uid()}`, userId: `u_missing_${uid()}` }))
      expect(res.status).toBe(200)
      expect(await purchaseRow(sessionId)).toBeNull()
      const alert = stripe.emails.find((m) => m.to === env.OWNER_EMAIL)
      expect(alert?.subject).toContain('Paid checkout without a buyer')
      expect(alert?.text).toContain(sessionId)
    })

    it('ignores unpaid sessions and handles async_payment_succeeded like a completion', async () => {
      const { user } = await createUser()
      const sessionId = await startCheckout(user)
      const pi = paymentIntent()
      stripe.paymentIntents.set(pi.id as string, pi)
      const base = { sessionId, paymentIntentId: pi.id as string, userId: user.id }

      await postWebhook(checkoutCompletedEvent({ ...base, paymentStatus: 'unpaid' }))
      expect((await purchaseRow(sessionId))?.status).toBe('pending')
      expect(stripe.stripeCalls('GET /v1/payment_intents')).toHaveLength(0)

      await postWebhook(checkoutCompletedEvent({ ...base, type: 'checkout.session.async_payment_succeeded' }))
      expect((await purchaseRow(sessionId))?.status).toBe('paid')
    })

    it('grants nothing when the charge was already refunded or disputed', async () => {
      const { user } = await createUser()
      const refunded = await purchase(stripe, user, { refunded: true })
      const disputed = await purchase(stripe, user, { disputed: true })
      expect((await purchaseRow(refunded.sessionId))?.status).toBe('refunded')
      expect((await purchaseRow(disputed.sessionId))?.status).toBe('disputed')
      expect(await passesOf(user.id)).toHaveLength(0)
    })

    it('does not process a purchase twice when a second completion event arrives', async () => {
      const { user } = await createUser()
      const p = await purchase(stripe, user)
      const res = await postWebhook(checkoutCompletedEvent({ sessionId: p.sessionId, paymentIntentId: p.paymentIntentId, userId: user.id }))
      expect(res.status).toBe(200)
      expect(stripe.stripeCalls('GET /v1/payment_intents')).toHaveLength(1)
      expect(await passesOf(user.id)).toHaveLength(1)
    })
  })

  describe('charge.refunded', () => {
    it('revokes the pass and records an owner refund once', async () => {
      const { user } = await createUser()
      const p = await purchase(stripe, user)
      const refundsBefore = await eventCount('refund', '/api/stripe/webhook')

      const res = await postWebhook(chargeRefundedEvent({ chargeId: p.chargeId, paymentIntentId: p.paymentIntentId }))
      expect(res.status).toBe(200)
      const row = await purchaseRow(p.sessionId)
      expect(row?.status).toBe('refunded')
      expect(row?.refunded_at).not.toBeNull()
      const [pass] = await passesOf(user.id)
      expect(pass.revoked_at).not.toBeNull()
      expect(pass.revoke_reason).toBe('refunded')
      expect(await refundsOf(p.sessionId)).toEqual([{ id: `owner_${p.sessionId}`, reason: 'owner', amount_cents: 3900, user_id: user.id }])
      expect(await eventCount('refund', '/api/stripe/webhook')).toBe(refundsBefore + 1)

      // another delivery for the same charge (new event id) changes nothing
      await postWebhook(chargeRefundedEvent({ chargeId: p.chargeId, paymentIntentId: p.paymentIntentId }))
      expect(await eventCount('refund', '/api/stripe/webhook')).toBe(refundsBefore + 1)
      expect(await refundsOf(p.sessionId)).toHaveLength(1)
    })

    it('matches by payment_intent and keeps the pass on a partial refund', async () => {
      const { user } = await createUser()
      const p = await purchase(stripe, user)
      await postWebhook(chargeRefundedEvent({ chargeId: `ch_other_${uid()}`, paymentIntentId: p.paymentIntentId, amountRefunded: 1000, refunded: false }))
      expect((await purchaseRow(p.sessionId))?.status).toBe('paid')
      expect((await passesOf(user.id))[0].revoked_at).toBeNull()

      await postWebhook(chargeRefundedEvent({ chargeId: `ch_other_${uid()}`, paymentIntentId: p.paymentIntentId }))
      expect((await purchaseRow(p.sessionId))?.status).toBe('refunded')
    })

    it('moves a queued pass forward when the pass before it is refunded', async () => {
      const { user } = await createUser()
      const first = await purchase(stripe, user, { sku: 'pass30' })
      await purchase(stripe, user, { sku: 'pass90' })
      await postWebhook(chargeRefundedEvent({ chargeId: first.chargeId, paymentIntentId: first.paymentIntentId }))
      const [revoked, queued] = await passesOf(user.id)
      expect(revoked.revoked_at).not.toBeNull()
      expect(Date.parse(queued.starts_at)).toBeLessThanOrEqual(Date.now())
      expect(Date.parse(queued.ends_at) - Date.parse(queued.starts_at)).toBe(90 * DAY_MS)
    })

    it('ignores charges that match no purchase', async () => {
      const res = await postWebhook(chargeRefundedEvent({ chargeId: `ch_${uid()}`, paymentIntentId: `pi_${uid()}` }))
      expect(res.status).toBe(200)
    })
  })

  describe('charge.dispute.created', () => {
    it('marks the purchase disputed, revokes the pass and alerts the owner', async () => {
      const { user } = await createUser()
      const p = await purchase(stripe, user)
      const res = await postWebhook(disputeCreatedEvent({ chargeId: p.chargeId, paymentIntentId: null }))
      expect(res.status).toBe(200)
      expect((await purchaseRow(p.sessionId))?.status).toBe('disputed')
      const [pass] = await passesOf(user.id)
      expect(pass.revoke_reason).toBe('dispute')
      const alert = stripe.emails.find((m) => m.to === env.OWNER_EMAIL)
      expect(alert?.subject).toBe('[MPC] Dispute opened')
      expect(alert?.text).toContain(p.sessionId)
      expect(alert?.text).toContain('fraudulent')
      expect(alert?.text).toContain('Its pass was revoked.')
      expect(alert?.text).not.toContain(user.email)
    })

    it('alerts the owner about a dispute on an unknown charge', async () => {
      const res = await postWebhook(disputeCreatedEvent({ chargeId: `ch_${uid()}`, paymentIntentId: `pi_${uid()}` }))
      expect(res.status).toBe(200)
      expect(stripe.emails.find((m) => m.to === env.OWNER_EMAIL)?.subject).toContain('unknown charge')
    })
  })

  it('acknowledges other event types without doing anything', async () => {
    const res = await postWebhook({ id: `evt_${uid()}`, type: 'invoice.paid', data: { object: { id: 'in_1' } } })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ received: true })
    expect(stripe.calls).toHaveLength(0)
  })

  it('never logs the payload', async () => {
    const { user } = await createUser()
    stripe.failures.set('GET /v1/payment_intents', { status: 500 })
    await purchase(stripe, user)
    await postWebhook({ id: 'evt_bad', type: 'x', data: { object: { email: user.email } } }, { secret: 'whsec_wrong' })
    expect(warn).toHaveBeenCalled()
    expect(err).toHaveBeenCalled()
    const logged = JSON.stringify([...warn.mock.calls, ...err.mock.calls])
    expect(logged).not.toContain(user.email)
    expect(logged).not.toContain('buyer@example.test')
    expect(logged).not.toContain(user.id)
  })

  it('stores ISO timestamps that compare as strings', async () => {
    const { user } = await createUser()
    const p = await purchase(stripe, user)
    const [pass] = await passesOf(user.id)
    expect(pass.ends_at).toBe(addDays(new Date(pass.starts_at), 30).toISOString())
    expect((await purchaseRow(p.sessionId))?.created_at).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/)
  })
})
