// POST /api/stripe/webhook (memo B6). Verifies Stripe-Signature on the raw body, de-duplicates on the
// event id, then grants a pass, refunds an out-of-region payment, or revokes on refund/dispute.
// If processing fails, the webhook_events row is removed and 500 is returned so Stripe retries.
// Payloads are never logged.
import { SKUS } from '../../../shared/config'
import { alertOwner, sendEmail } from '../email'
import type { Ctx, Env } from '../env'
import { error, json } from '../lib/http'
import { grantPass, revokePasses } from './entitlement'
import { formatCad, passActiveEmail, regionRefundEmail } from './messages'
import { evidenceAllowed, type PaymentEvidence } from './region'
import {
  CURRENCY,
  EVENT_PATHS,
  type PurchaseRow,
  deleteRefund,
  eventStatement,
  findPurchaseByCharge,
  getContact,
  getPurchase,
  insertPurchase,
  insertRefund,
  isSku,
  siteUrl,
} from './store'
import {
  type Charge,
  type CheckoutSession,
  type Dispute,
  type PaymentIntent,
  type Refund,
  StripeError,
  type StripeEvent,
  describeError,
  idOf,
  stripeFetch,
  verifyStripeSignature,
} from './stripe'

export const MAX_WEBHOOK_BYTES = 256 * 1024

export async function webhook(req: Request, ctx: Ctx): Promise<Response> {
  const { env, now } = ctx
  const raw = await readRawBody(req, MAX_WEBHOOK_BYTES)
  if (raw === null) return error('too_large', 'Payload too large')

  const check = await verifyStripeSignature(
    raw,
    req.headers.get('stripe-signature'),
    env.STRIPE_WEBHOOK_SECRET,
    Math.floor(now.getTime() / 1000),
  )
  if (!check.ok) {
    console.warn('stripe webhook: signature rejected', check.reason)
    return error('bad_request', 'Invalid signature')
  }
  const event = parseEvent(raw)
  if (!event) return error('bad_request', 'Invalid event')

  const claim = await env.DB.prepare(
    'INSERT INTO webhook_events (id, type, received_at) VALUES (?1, ?2, ?3) ON CONFLICT (id) DO NOTHING',
  )
    .bind(event.id, event.type, now.toISOString())
    .run()
  if (claim.meta.changes === 0) return json({ received: true, duplicate: true })

  try {
    await processEvent(event, ctx)
  } catch (e) {
    console.error('stripe webhook: processing failed', event.type, event.id, describeError(e))
    await env.DB.prepare('DELETE FROM webhook_events WHERE id = ?1').bind(event.id).run()
    return error('internal', 'Webhook processing failed')
  }
  return json({ received: true })
}

/** Raw body text, or null when it is larger than maxBytes. */
async function readRawBody(req: Request, maxBytes: number): Promise<string | null> {
  if (Number(req.headers.get('content-length') ?? '0') > maxBytes) return null
  const buf = await req.arrayBuffer()
  if (buf.byteLength > maxBytes) return null
  return new TextDecoder().decode(buf)
}

function parseEvent(raw: string): StripeEvent | null {
  try {
    const e = JSON.parse(raw) as Partial<StripeEvent> | null
    if (!e || typeof e.id !== 'string' || typeof e.type !== 'string') return null
    if (!e.data || typeof e.data.object !== 'object' || e.data.object === null) return null
    return e as StripeEvent
  } catch {
    return null
  }
}

async function processEvent(event: StripeEvent, ctx: Ctx): Promise<void> {
  const object = event.data.object
  switch (event.type) {
    // async_payment_succeeded covers delayed payment methods, should any be enabled in the Dashboard
    // (payment_status is 'unpaid' on their completion event) // [unverified: prior knowledge]
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
      return onCheckoutPaid(object as unknown as CheckoutSession, event.id, ctx)
    case 'charge.refunded':
      return onChargeRefunded(object as unknown as Charge, ctx)
    case 'charge.dispute.created':
      return onDisputeCreated(object as unknown as Dispute, ctx)
    default:
      return
  }
}

// ---------- checkout.session.completed ----------

async function onCheckoutPaid(session: CheckoutSession, eventId: string, ctx: Ctx): Promise<void> {
  const { env, now } = ctx
  if (session.payment_status !== 'paid') return
  const purchase = (await getPurchase(env, session.id)) ?? (await purchaseFromSession(env, session, now))
  if (!purchase) {
    await alertOwner(
      env,
      'Paid checkout without a buyer',
      `Checkout Session ${session.id} was paid but has no matching user or pass. ` +
        'Review it in the Stripe Dashboard and refund it if needed.',
    )
    return
  }
  if (purchase.status !== 'pending') return

  const paymentIntentId = idOf(session.payment_intent)
  if (!paymentIntentId) throw new Error('checkout session has no payment_intent')
  const pi = await stripeFetch<PaymentIntent>(env, 'GET', `/v1/payment_intents/${encodeURIComponent(paymentIntentId)}`, {
    params: { expand: ['latest_charge'] },
  })
  const charge = pi.latest_charge
  if (!charge || typeof charge === 'string') throw new Error('payment intent has no expanded latest_charge')

  const evidence = chargeEvidence(charge)
  await env.DB.prepare(
    `UPDATE purchases SET payment_intent = ?1, charge_id = ?2, card_fingerprint = ?3, card_country = ?4,
            billing_country = ?5, billing_region = ?6
      WHERE id = ?7`,
  )
    .bind(
      paymentIntentId,
      evidence.chargeId,
      evidence.cardFingerprint,
      evidence.cardCountry,
      evidence.billingCountry,
      evidence.billingRegion,
      purchase.id,
    )
    .run()

  // Events can arrive out of order: a charge refunded or disputed before we saw it gets no pass.
  if (charge.refunded || charge.disputed) {
    const status = charge.disputed ? 'disputed' : 'refunded'
    await env.DB.prepare('UPDATE purchases SET status = ?1 WHERE id = ?2').bind(status, purchase.id).run()
    await alertOwner(
      env,
      'Checkout completed after a refund or dispute',
      `Purchase ${purchase.id}: no pass was granted (charge ${status}).`,
    )
    return
  }

  if (!evidenceAllowed(evidence)) {
    await rejectForRegion(purchase, paymentIntentId, eventId, ctx)
    return
  }

  const pass = await grantPass(env, { userId: purchase.user_id, sku: purchase.sku, purchaseId: purchase.id, now }, [
    env.DB.prepare("UPDATE purchases SET status = 'paid', paid_at = ?1 WHERE id = ?2 AND status = 'pending'").bind(
      now.toISOString(),
      purchase.id,
    ),
    eventStatement(env, 'purchase', EVENT_PATHS.webhook, now),
  ])
  const contact = await getContact(env, purchase.user_id)
  if (contact) {
    const mail = passActiveEmail(contact.lang, purchase.sku, pass.endsAt, siteUrl(env))
    await sendEmail(env, { to: contact.email, ...mail, kind: 'transactional', idempotencyKey: eventId })
  }
}

/** Fallback when the pending row is missing: rebuild it from client_reference_id and metadata. */
async function purchaseFromSession(env: Env, session: CheckoutSession, now: Date): Promise<PurchaseRow | null> {
  const userId = session.client_reference_id ?? session.metadata?.user_id
  const sku = session.metadata?.sku
  if (!userId || !isSku(sku)) return null
  const user = await env.DB.prepare('SELECT id FROM users WHERE id = ?1').bind(userId).first<{ id: string }>()
  if (!user) return null
  await insertPurchase(env, {
    id: session.id,
    userId,
    sku,
    amountCents: session.amount_total ?? SKUS[sku].priceCents,
    currency: session.currency ?? CURRENCY,
    now,
  }).run()
  return getPurchase(env, session.id)
}

function chargeEvidence(charge: Charge): PaymentEvidence {
  const address = charge.billing_details?.address
  const card = charge.payment_method_details?.card
  return {
    chargeId: charge.id,
    billingCountry: address?.country ?? null,
    billingRegion: address?.state ?? null,
    cardCountry: card?.country ?? null,
    cardFingerprint: card?.fingerprint ?? null,
  }
}

/** Refunds a payment from outside the sales region; no pass is granted. */
async function rejectForRegion(purchase: PurchaseRow, paymentIntent: string, eventId: string, ctx: Ctx): Promise<void> {
  const { env, now } = ctx
  // The refunds row goes in first so a charge.refunded webhook racing this one sees the refund as ours.
  await insertRefund(env, { reason: 'region', purchase, amountCents: purchase.amount_cents, now }).run()
  let refund: Refund | null = null
  try {
    refund = await stripeFetch<Refund>(env, 'POST', '/v1/refunds', {
      params: { payment_intent: paymentIntent, metadata: { reason: 'region', purchase_id: purchase.id } },
      idempotencyKey: `region-${purchase.id}`,
    })
  } catch (e) {
    // A retry after Stripe's idempotency keys expire finds the charge already refunded: that is success.
    // (error code from stripe-go error.go; key expiry is [unverified: prior knowledge])
    if (!(e instanceof StripeError && e.code === 'charge_already_refunded')) {
      await deleteRefund(env, 'region', purchase.id)
      throw e
    }
  }
  await env.DB.prepare("UPDATE purchases SET status = 'rejected_region', refunded_at = COALESCE(refunded_at, ?1) WHERE id = ?2")
    .bind(now.toISOString(), purchase.id)
    .run()

  if (refund?.status === 'failed' || refund?.status === 'canceled') {
    await alertOwner(
      env,
      'Region refund failed',
      `Purchase ${purchase.id}: the automatic refund ${refund.id} is ${refund.status}. Refund it manually.`,
    )
    return
  }
  const contact = await getContact(env, purchase.user_id)
  if (contact) {
    const mail = regionRefundEmail(contact.lang, refund?.amount ?? purchase.amount_cents, siteUrl(env))
    await sendEmail(env, { to: contact.email, ...mail, kind: 'transactional', idempotencyKey: eventId })
  }
}

// ---------- charge.refunded ----------

async function onChargeRefunded(charge: Charge, ctx: Ctx): Promise<void> {
  const { env, now } = ctx
  // Partial refunds (charge.refunded stays false) keep the pass; the owner decides case by case.
  if (!charge.refunded) return
  const purchase = await findPurchaseByCharge(env, charge.id, idOf(charge.payment_intent))
  if (!purchase || purchase.status === 'refunded' || purchase.status === 'rejected_region') return

  const known = await env.DB.prepare('SELECT 1 AS found FROM refunds WHERE purchase_id = ?1 LIMIT 1')
    .bind(purchase.id)
    .first()
  const statements = [
    env.DB.prepare("UPDATE purchases SET status = 'refunded', refunded_at = COALESCE(refunded_at, ?1) WHERE id = ?2").bind(
      now.toISOString(),
      purchase.id,
    ),
  ]
  // Self-serve and region refunds record their own row and event; anything else was the owner.
  if (!known) {
    statements.push(
      insertRefund(env, { reason: 'owner', purchase, amountCents: charge.amount_refunded ?? purchase.amount_cents, now }),
      eventStatement(env, 'refund', EVENT_PATHS.webhook, now),
    )
  }
  await revokePasses(env, purchase.id, 'refunded', now, statements)
}

// ---------- charge.dispute.created ----------

async function onDisputeCreated(dispute: Dispute, ctx: Ctx): Promise<void> {
  const { env, now } = ctx
  const purchase = await findPurchaseByCharge(env, idOf(dispute.charge), idOf(dispute.payment_intent))
  if (!purchase) {
    await alertOwner(
      env,
      'Dispute on an unknown charge',
      `Dispute ${dispute.id} does not match any purchase. Check the Stripe Dashboard.`,
    )
    return
  }
  const revoked = await revokePasses(env, purchase.id, 'dispute', now, [
    env.DB.prepare("UPDATE purchases SET status = 'disputed' WHERE id = ?1").bind(purchase.id),
  ])
  await alertOwner(
    env,
    'Dispute opened',
    [
      `Purchase ${purchase.id} (${purchase.sku}, ${formatCad(purchase.amount_cents)}) has a new dispute ${dispute.id}` +
        (dispute.reason ? ` (reason: ${dispute.reason}).` : '.'),
      revoked > 0 ? 'Its pass was revoked.' : 'It had no active pass.',
      'Respond in the Stripe Dashboard before the deadline.',
    ].join('\n'),
  )
}
