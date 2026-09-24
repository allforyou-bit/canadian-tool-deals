import { env } from 'cloudflare:test'
import { type MockInstance, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TERMS_VERSION } from '../../../shared/config'
import { findClaims } from '../../../shared/content-rules'
import { webhook } from '../../src/billing'
import { MAX_RECEIPT_URL_LENGTH, STRIPE_API_VERSION } from '../../src/billing/stripe'
import type { Env } from '../../src/env'
import { addDays } from '../../src/lib/time'
import {
  FakeStripe,
  ORIGIN,
  chargeRefundedEvent,
  checkoutCompletedEvent,
  createUser,
  deleteAccount,
  disputeCreatedEvent,
  eventCount,
  learnerEmailOn,
  makeCtx,
  passesOf,
  paymentIntent,
  postWebhook,
  purchase,
  purchaseRow,
  receiptUrlFor,
  refundFailedEvent,
  refundedCents,
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

    it('stops reading a streamed body without Content-Length once it passes the limit', async () => {
      let pulled = 0
      const chunk = new TextEncoder().encode('x'.repeat(64 * 1024))
      const body = new ReadableStream<Uint8Array>({
        pull(controller) {
          pulled++
          if (pulled > 40) controller.close() // 2.5 MB if read to the end
          else controller.enqueue(chunk)
        },
      })
      const req = new Request(`${ORIGIN}/api/stripe/webhook`, { method: 'POST', body, headers: { 'stripe-signature': 't=1,v1=00' } })
      expect(req.headers.get('content-length')).toBeNull()
      const res = await webhook(req, makeCtx(null))
      expect(res.status).toBe(413)
      expect(pulled).toBeLessThan(10)
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
      expect(piCall.headers.get('stripe-version')).toBe(STRIPE_API_VERSION)

      const row = await purchaseRow(p.sessionId)
      expect(row).toMatchObject({
        status: 'paid',
        payment_intent: p.paymentIntentId,
        charge_id: p.chargeId,
        card_fingerprint: 'fp_grant_1',
        card_country: 'CA',
        payment_method_type: 'card',
        billing_country: 'CA',
        billing_region: 'BC',
        terms_version: TERMS_VERSION,
        amount_refunded_cents: 0,
        receipt_url: receiptUrlFor(p.chargeId),
        refunded_at: null,
      })
      expect(Date.parse(row?.paid_at ?? '')).toBeGreaterThanOrEqual(started - 1000)

      const [pass] = await passesOf(user.id)
      expect(pass).toMatchObject({ sku: 'pass30', purchase_id: p.sessionId, revoked_at: null })
      expect(Date.parse(pass.ends_at) - Date.parse(pass.starts_at)).toBe(30 * DAY_MS)
      expect(Date.parse(pass.starts_at)).toBeGreaterThanOrEqual(started - 1000)

      expect(await eventCount('purchase', '/api/stripe/webhook')).toBe(purchasesBefore + 1)
      expect(stripe.stripeCalls('POST /v1/refunds')).toHaveLength(0)
    })

    it('emails the buyer the pass end and the receipt link when learner email is on', async () => {
      const { user } = await createUser()
      const p = await purchase(stripe, user, { env: learnerEmailOn() })
      expect(p.res.status).toBe(200)
      const [pass] = await passesOf(user.id)
      const mail = stripe.emails.find((m) => m.to === user.email)
      expect(mail?.idempotencyKey).toBe(p.eventId)
      expect(mail?.text).toContain(`active until ${pass.ends_at.slice(0, 10)} ${pass.ends_at.slice(11, 16)} UTC`)
      expect(mail?.text).toContain(`Receipt (Stripe): ${receiptUrlFor(p.chargeId)}`)
      expect(findClaims(mail?.text ?? '')).toEqual([])
    })

    it('extends: a second purchase starts when the first pass ends', async () => {
      const { user } = await createUser({ lang: 'ko' })
      await purchase(stripe, user, { sku: 'pass30', env: learnerEmailOn() })
      await purchase(stripe, user, { sku: 'pass90', env: learnerEmailOn() })
      const [first, second] = await passesOf(user.id)
      expect(first.sku).toBe('pass30')
      expect(second.sku).toBe('pass90')
      expect(second.starts_at).toBe(first.ends_at)
      expect(Date.parse(second.ends_at) - Date.parse(second.starts_at)).toBe(90 * DAY_MS)
      // Korean users get the Korean email
      const mails = stripe.emails.filter((m) => m.to === user.email)
      expect(mails).toHaveLength(2)
      expect(mails.every((m) => m.subject.includes('이용권') && m.text.includes('영수증(Stripe): https://'))).toBe(true)
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
      const p = await purchase(stripe, user, { ...evidence, env: learnerEmailOn() })
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
      // the account page shows the receipt (it shows the refund) instead of relying on the email below
      expect(row?.receipt_url).toBe(receiptUrlFor(p.chargeId))
      expect(await refundsOf(p.sessionId)).toEqual([
        { id: `region_${p.sessionId}`, reason: 'region', amount_cents: 3900, user_id: user.id },
      ])
      expect(await passesOf(user.id)).toHaveLength(0)

      const mail = stripe.emails.find((m) => m.to === user.email)
      expect(mail?.text).toContain('outside Quebec')
      expect(mail?.text).toContain('refunded it in full: C$39.00')
      expect(mail?.text).toContain(`Receipt (Stripe): ${receiptUrlFor(p.chargeId)}`)
      expect(findClaims(mail?.text ?? '')).toEqual([])

      // Stripe's charge.refunded for that refund is not counted as a customer refund; only the amount is kept
      const refundsBefore = await eventCount('refund')
      await postWebhook(chargeRefundedEvent({ chargeId: p.chargeId, paymentIntentId: p.paymentIntentId }))
      expect(await purchaseRow(p.sessionId)).toMatchObject({ status: 'rejected_region', amount_refunded_cents: 3900 })
      expect(await eventCount('refund')).toBe(refundsBefore)
      expect((await refundsOf(p.sessionId)).map((r) => r.reason)).toEqual(['region'])
    })

    it.each([
      ['Link paid from a bank account', 'link'],
      ['Klarna', 'klarna'],
    ])('refunds a non-card payment (%s) by the region rule and alerts the owner', async (_label, type) => {
      const { user } = await createUser()
      const p = await purchase(stripe, user, { paymentMethodType: type, env: learnerEmailOn() })
      expect(p.res.status).toBe(200)
      expect(await purchaseRow(p.sessionId)).toMatchObject({
        status: 'rejected_region',
        payment_method_type: type,
        card_country: null,
        card_fingerprint: null,
        billing_country: 'CA',
        billing_region: 'ON',
      })
      expect(await passesOf(user.id)).toHaveLength(0)
      expect(stripe.stripeCalls('POST /v1/refunds')).toHaveLength(1)
      expect(await refundsOf(p.sessionId)).toMatchObject([{ reason: 'region', amount_cents: 3900 }])

      const alert = stripe.emails.find((m) => m.to === env.OWNER_EMAIL)
      expect(alert?.subject).toBe('[MPC] Non-card payment refunded')
      expect(alert?.text).toContain(p.sessionId)
      expect(alert?.text).toContain(`"${type}"`)
      expect(alert?.text).not.toContain(user.email)
      const mail = stripe.emails.find((m) => m.to === user.email)
      expect(mail?.text).toContain('payment method')
    })

    it('does not alert about the payment method for a foreign card', async () => {
      const { user } = await createUser()
      await purchase(stripe, user, { cardCountry: 'US' })
      expect(stripe.emails.some((m) => m.subject.includes('Non-card'))).toBe(false)
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
      const p = await purchase(stripe, user, { billingCountry: 'GB', env: learnerEmailOn() })
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
      const refunded = await purchase(stripe, user, { refunded: true, amountRefunded: 3900 })
      const disputed = await purchase(stripe, user, { disputed: true })
      expect(await purchaseRow(refunded.sessionId)).toMatchObject({
        status: 'refunded',
        amount_refunded_cents: 3900,
        receipt_url: receiptUrlFor(refunded.chargeId),
      })
      expect(await purchaseRow(disputed.sessionId)).toMatchObject({ status: 'disputed', receipt_url: receiptUrlFor(disputed.chargeId) })
      expect(await passesOf(user.id)).toHaveLength(0)
    })

    it('records a partial refund made before the completion event and still grants the pass', async () => {
      const { user } = await createUser()
      const refundsBefore = await eventCount('refund', '/api/stripe/webhook')
      const p = await purchase(stripe, user, { amountRefunded: 1000, chargeId: `ch_${uid()}` })
      expect(p.res.status).toBe(200)
      expect(await purchaseRow(p.sessionId)).toMatchObject({ status: 'paid', amount_refunded_cents: 1000 })
      expect(await refundsOf(p.sessionId)).toEqual([
        { id: `owner_${p.sessionId}_1000`, reason: 'owner', amount_cents: 1000, user_id: user.id },
      ])
      expect(await eventCount('refund', '/api/stripe/webhook')).toBe(refundsBefore + 1)
      expect((await passesOf(user.id))[0].revoked_at).toBeNull()
      expect(stripe.stripeCalls('GET /v1/refunds')[0].url.searchParams.get('charge')).toBe(p.chargeId)
    })

    it('grants nothing when a partial refund with end_pass was made before the completion event', async () => {
      const { user } = await createUser()
      const chargeId = `ch_${uid()}`
      stripe.ownerRefund({ chargeId, amount: 2000, metadata: { end_pass: 'true' } })
      const p = await purchase(stripe, user, { chargeId, amountRefunded: 2000 })
      expect(p.res.status).toBe(200)
      expect(await purchaseRow(p.sessionId)).toMatchObject({ status: 'refunded', paid_at: null, amount_refunded_cents: 2000 })
      expect(await passesOf(user.id)).toHaveLength(0)
      expect(stripe.emails.some((m) => m.to === env.OWNER_EMAIL && m.subject.includes('after a refund'))).toBe(true)
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
      expect(await refundsOf(p.sessionId)).toEqual([{ id: `owner_${p.sessionId}_3900`, reason: 'owner', amount_cents: 3900, user_id: user.id }])
      expect(row?.amount_refunded_cents).toBe(3900)
      expect(await eventCount('refund', '/api/stripe/webhook')).toBe(refundsBefore + 1)
      // a full refund ends the pass without asking Stripe for the refunds' metadata
      expect(stripe.stripeCalls('GET /v1/refunds')).toHaveLength(0)

      // another delivery for the same charge (new event id) changes nothing
      await postWebhook(chargeRefundedEvent({ chargeId: p.chargeId, paymentIntentId: p.paymentIntentId }))
      expect(await eventCount('refund', '/api/stripe/webhook')).toBe(refundsBefore + 1)
      expect(await refundsOf(p.sessionId)).toHaveLength(1)
    })

    it('records partial refunds as owner deltas and keeps the pass until the charge is fully refunded', async () => {
      const { user } = await createUser()
      const p = await purchase(stripe, user)
      const refundsBefore = await eventCount('refund', '/api/stripe/webhook')
      const partial = (total: number, refunded = false) =>
        postWebhook(chargeRefundedEvent({ chargeId: p.chargeId, paymentIntentId: p.paymentIntentId, amountRefunded: total, refunded }))

      // first partial refund (e.g. a pro-rated refund without end_pass)
      stripe.ownerRefund({ chargeId: p.chargeId, amount: 1000 })
      expect((await partial(1000)).status).toBe(200)
      expect(await purchaseRow(p.sessionId)).toMatchObject({ status: 'paid', amount_refunded_cents: 1000, refunded_at: null })
      expect((await passesOf(user.id))[0].revoked_at).toBeNull()
      expect(await refundsOf(p.sessionId)).toEqual([
        { id: `owner_${p.sessionId}_1000`, reason: 'owner', amount_cents: 1000, user_id: user.id },
      ])
      expect(await eventCount('refund', '/api/stripe/webhook')).toBe(refundsBefore + 1)
      const [list] = stripe.stripeCalls('GET /v1/refunds')
      expect(list.url.searchParams.get('charge')).toBe(p.chargeId)
      expect(list.headers.get('stripe-version')).toBe(STRIPE_API_VERSION)

      // a second partial refund: only the new part is recorded
      stripe.ownerRefund({ chargeId: p.chargeId, amount: 1500 })
      await partial(2500)
      expect((await purchaseRow(p.sessionId))?.amount_refunded_cents).toBe(2500)
      expect((await refundsOf(p.sessionId)).map((r) => [r.id, r.amount_cents])).toEqual([
        [`owner_${p.sessionId}_1000`, 1000],
        [`owner_${p.sessionId}_2500`, 1500],
      ])
      expect((await passesOf(user.id))[0].revoked_at).toBeNull()

      // redelivery of the same total (new event id) and a late, older event change nothing
      await partial(2500)
      await partial(1000)
      expect((await purchaseRow(p.sessionId))?.amount_refunded_cents).toBe(2500)
      expect(await refundedCents(p.sessionId)).toBe(2500)
      expect(await eventCount('refund', '/api/stripe/webhook')).toBe(refundsBefore + 2)

      // the rest: now fully refunded, so the pass ends
      await partial(3900, true)
      expect(await purchaseRow(p.sessionId)).toMatchObject({ status: 'refunded', amount_refunded_cents: 3900 })
      expect(await refundedCents(p.sessionId)).toBe(3900)
      expect((await passesOf(user.id))[0].revoke_reason).toBe('refunded')
      expect(await eventCount('refund', '/api/stripe/webhook')).toBe(refundsBefore + 3)
    })

    it('ends the pass on a partial refund whose metadata has end_pass=true', async () => {
      const { user } = await createUser()
      const p = await purchase(stripe, user)
      stripe.ownerRefund({ chargeId: p.chargeId, amount: 2600, metadata: { end_pass: ' TRUE ' } })
      await postWebhook(chargeRefundedEvent({ chargeId: p.chargeId, paymentIntentId: p.paymentIntentId, amountRefunded: 2600, refunded: false }))
      const row = await purchaseRow(p.sessionId)
      expect(row).toMatchObject({ status: 'refunded', amount_refunded_cents: 2600 })
      expect(row?.refunded_at).not.toBeNull()
      const [pass] = await passesOf(user.id)
      expect(pass.revoked_at).not.toBeNull()
      expect(pass.revoke_reason).toBe('refunded')
      expect(await refundsOf(p.sessionId)).toMatchObject([{ reason: 'owner', amount_cents: 2600 }])
    })

    it.each([
      ['a failed refund', { end_pass: 'true' }, 'failed'],
      ['a canceled refund', { end_pass: 'true' }, 'canceled'],
      ['another metadata value', { end_pass: 'no' }, 'succeeded'],
    ] as const)('ignores end_pass on %s', async (_label, metadata, status) => {
      const { user } = await createUser()
      const p = await purchase(stripe, user)
      stripe.ownerRefund({ chargeId: p.chargeId, amount: 1000, metadata, status })
      stripe.ownerRefund({ chargeId: p.chargeId, amount: 500 })
      await postWebhook(chargeRefundedEvent({ chargeId: p.chargeId, paymentIntentId: p.paymentIntentId, amountRefunded: 1500, refunded: false }))
      expect((await purchaseRow(p.sessionId))?.status).toBe('paid')
      expect((await passesOf(user.id))[0].revoked_at).toBeNull()
    })

    it('counts each refunded cent once when partial refund events are processed at the same time', async () => {
      const { user } = await createUser()
      const p = await purchase(stripe, user)
      const events = [1000, 2500, 3000].map((total) =>
        chargeRefundedEvent({ chargeId: p.chargeId, paymentIntentId: p.paymentIntentId, amountRefunded: total, refunded: false }),
      )
      const results = await Promise.all(events.map((e) => postWebhook(e)))
      expect(results.map((r) => r.status)).toEqual([200, 200, 200])
      expect(await refundedCents(p.sessionId)).toBe(3000)
      expect((await purchaseRow(p.sessionId))?.amount_refunded_cents).toBe(3000)
      const rows = await refundsOf(p.sessionId)
      expect(rows.every((r) => r.reason === 'owner' && r.amount_cents > 0)).toBe(true)
    })

    it('matches by payment_intent and keeps the event retryable when listing refunds fails', async () => {
      const { user } = await createUser()
      const p = await purchase(stripe, user)
      const event = chargeRefundedEvent({ chargeId: `ch_other_${uid()}`, paymentIntentId: p.paymentIntentId, amountRefunded: 1000, refunded: false })
      stripe.failures.set('GET /v1/refunds', { status: 500, code: 'api_error' })
      expect((await postWebhook(event)).status).toBe(500)
      expect(await refundsOf(p.sessionId)).toHaveLength(0)
      expect((await purchaseRow(p.sessionId))?.amount_refunded_cents).toBe(0)

      expect((await postWebhook(event)).status).toBe(200)
      expect(await refundsOf(p.sessionId)).toMatchObject([{ reason: 'owner', amount_cents: 1000 }])
      expect((await purchaseRow(p.sessionId))?.status).toBe('paid')
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

  describe('receipt link (shown on the site instead of an email)', () => {
    it.each([
      ['no receipt', null],
      ['a plain http link', 'http://pay.stripe.com/receipts/payment/x'],
      ['a script link', 'javascript:alert(1)'],
      ['a relative link', '/receipts/payment/x'],
      ['a link with credentials', 'https://user:pw@pay.stripe.com/receipts/payment/x'],
      ['an over-long link', `https://pay.stripe.com/${'x'.repeat(MAX_RECEIPT_URL_LENGTH)}`],
    ])('stores nothing for %s and still grants the pass', async (_label, receiptUrl) => {
      const { user } = await createUser()
      const p = await purchase(stripe, user, { receiptUrl, env: learnerEmailOn() })
      expect(p.res.status).toBe(200)
      expect(await purchaseRow(p.sessionId)).toMatchObject({ status: 'paid', receipt_url: null })
      expect(await passesOf(user.id)).toHaveLength(1)
      const mail = stripe.emails.find((m) => m.to === user.email)
      expect(mail?.text).toContain('is active until')
      expect(mail?.text).not.toContain('Receipt')
    })

    it('refreshes the receipt from charge.refunded, for partial and full refunds', async () => {
      const { user } = await createUser()
      const p = await purchase(stripe, user)
      const event = (total: number, refunded: boolean, receiptUrl: string) =>
        chargeRefundedEvent({ chargeId: p.chargeId, paymentIntentId: p.paymentIntentId, amountRefunded: total, refunded, receiptUrl })

      await postWebhook(event(1000, false, `${receiptUrlFor(p.chargeId)}?v=partial`))
      expect(await purchaseRow(p.sessionId)).toMatchObject({ status: 'paid', receipt_url: `${receiptUrlFor(p.chargeId)}?v=partial` })

      await postWebhook(event(3900, true, `${receiptUrlFor(p.chargeId)}?v=full`))
      expect(await purchaseRow(p.sessionId)).toMatchObject({ status: 'refunded', receipt_url: `${receiptUrlFor(p.chargeId)}?v=full` })
    })

    it('keeps the stored receipt when charge.refunded has none or an unusable one', async () => {
      const { user } = await createUser()
      const p = await purchase(stripe, user)
      const base = { chargeId: p.chargeId, paymentIntentId: p.paymentIntentId, refunded: false }
      await postWebhook(chargeRefundedEvent({ ...base, amountRefunded: 500, omitReceipt: true }))
      await postWebhook(chargeRefundedEvent({ ...base, amountRefunded: 700, receiptUrl: null }))
      await postWebhook(chargeRefundedEvent({ ...base, amountRefunded: 900, receiptUrl: 'javascript:alert(1)' }))
      expect(await purchaseRow(p.sessionId)).toMatchObject({ amount_refunded_cents: 900, receipt_url: receiptUrlFor(p.chargeId) })
    })

    it("does not take the receipt of another charge that matched by payment_intent", async () => {
      const { user } = await createUser()
      const p = await purchase(stripe, user)
      const other = `ch_other_${uid()}`
      await postWebhook(chargeRefundedEvent({ chargeId: other, paymentIntentId: p.paymentIntentId, amountRefunded: 1000, refunded: false }))
      // the refund is still recorded on the purchase; only the receipt link stays the paid charge's
      expect(await purchaseRow(p.sessionId)).toMatchObject({ amount_refunded_cents: 1000, receipt_url: receiptUrlFor(p.chargeId) })
    })

    it('refreshes the receipt of a purchase refunded under the region rule', async () => {
      const { user } = await createUser()
      const p = await purchase(stripe, user, { billingState: 'QC' })
      const fresh = `${receiptUrlFor(p.chargeId)}?refunded=1`
      await postWebhook(chargeRefundedEvent({ chargeId: p.chargeId, paymentIntentId: p.paymentIntentId, receiptUrl: fresh }))
      expect(await purchaseRow(p.sessionId)).toMatchObject({ status: 'rejected_region', receipt_url: fresh })
    })
  })

  describe('buyer email is optional', () => {
    it.each([
      ['Resend refuses the address (sandbox)', 'status'],
      ['the connection to Resend drops', 'throw'],
    ] as const)('grants the pass and stores the receipt when %s', async (_label, mode) => {
      const { user } = await createUser()
      stripe.resendFailure = mode
      const p = await purchase(stripe, user, { env: learnerEmailOn() })
      expect(p.res.status).toBe(200)
      expect(await p.res.json()).toEqual({ received: true })
      expect(await webhookEventExists(p.eventId)).toBe(true)
      expect(stripe.emailAttempts).toBeGreaterThan(0)
      expect(stripe.emails).toHaveLength(0)
      expect(await purchaseRow(p.sessionId)).toMatchObject({ status: 'paid', receipt_url: receiptUrlFor(p.chargeId) })
      expect(await passesOf(user.id)).toHaveLength(1)
      expect(JSON.stringify([...warn.mock.calls, ...err.mock.calls])).not.toContain(user.email)
    })

    it('completes a region refund when the buyer email fails', async () => {
      const { user } = await createUser()
      stripe.resendFailure = 'throw'
      const p = await purchase(stripe, user, { cardCountry: 'US', env: learnerEmailOn() })
      expect(p.res.status).toBe(200)
      expect(await purchaseRow(p.sessionId)).toMatchObject({ status: 'rejected_region', receipt_url: receiptUrlFor(p.chargeId) })
      expect(await refundsOf(p.sessionId)).toMatchObject([{ reason: 'region' }])
      expect(await webhookEventExists(p.eventId)).toBe(true)
    })

    it('grants the pass and stores the receipt with learner email off (the default)', async () => {
      const { user } = await createUser()
      const p = await purchase(stripe, user, { env: { ...env, LEARNER_EMAIL: 'off' } as Env })
      expect(p.res.status).toBe(200)
      expect(await purchaseRow(p.sessionId)).toMatchObject({ status: 'paid', receipt_url: receiptUrlFor(p.chargeId) })
      expect(await passesOf(user.id)).toHaveLength(1)
      // billing mails through sendEmail, which drops learner mail in this mode
      expect(stripe.emails.some((m) => m.to === user.email)).toBe(false)
    })

    it('grants the pass without an email when the account was deleted after checkout', async () => {
      const { user } = await createUser()
      const sessionId = await startCheckout(user)
      await deleteAccount(user.id)
      const pi = paymentIntent()
      stripe.paymentIntents.set(pi.id as string, pi)
      const res = await postWebhook(checkoutCompletedEvent({ sessionId, paymentIntentId: pi.id as string, userId: user.id }), {
        env: learnerEmailOn(),
      })
      expect(res.status).toBe(200)
      expect((await purchaseRow(sessionId))?.status).toBe('paid')
      expect(stripe.emailAttempts).toBe(0)
    })
  })

  describe('refund.failed', () => {
    it('alerts the owner about a failed self-serve refund with the purchase and the reason', async () => {
      const { user } = await createUser()
      const p = await purchase(stripe, user)
      const res = await postWebhook(
        refundFailedEvent({
          id: `re_${uid()}`,
          amount: 3900,
          charge: p.chargeId,
          payment_intent: p.paymentIntentId,
          failure_reason: 'expired_or_canceled_card',
          metadata: { reason: 'self_serve', purchase_id: p.sessionId },
        }),
      )
      expect(res.status).toBe(200)
      const alert = stripe.emails.find((m) => m.to === env.OWNER_EMAIL)
      expect(alert?.subject).toBe('[MPC] Refund failed')
      expect(alert?.text).toContain('C$39.00')
      expect(alert?.text).toContain('expired_or_canceled_card')
      expect(alert?.text).toContain(`Purchase ${p.sessionId} (pass30), status paid.`)
      expect(alert?.text).toContain('self-serve refund')
      expect(alert?.text).not.toContain(user.email)
    })

    it.each([
      ['a region refund', { reason: 'region' }, 'region refund'],
      ['an owner refund', {}, 'outside the Worker'],
    ])('alerts about %s, matched by payment_intent alone', async (_label, metadata, text) => {
      const { user } = await createUser()
      const p = await purchase(stripe, user)
      await postWebhook(refundFailedEvent({ id: `re_${uid()}`, amount: 1000, charge: null, payment_intent: p.paymentIntentId, metadata }))
      const alert = stripe.emails.find((m) => m.to === env.OWNER_EMAIL)
      expect(alert?.text).toContain(p.sessionId)
      expect(alert?.text).toContain(text)
      expect(alert?.text).toContain('failed.')
    })

    it('alerts even when the refund matches no purchase', async () => {
      const res = await postWebhook(refundFailedEvent({ id: `re_${uid()}`, amount: 500, charge: `ch_${uid()}`, payment_intent: null }))
      expect(res.status).toBe(200)
      expect(stripe.emails.find((m) => m.to === env.OWNER_EMAIL)?.text).toContain('does not match any purchase')
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
