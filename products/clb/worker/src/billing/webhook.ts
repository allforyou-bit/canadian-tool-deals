// POST /api/stripe/webhook (memo B6). Verifies Stripe-Signature on the raw body, de-duplicates on the
// event id, then grants a pass, refunds an out-of-region or non-card payment, records refunds (partial
// ones too), revokes on a full refund, an end_pass refund or a dispute, and alerts the owner about
// failed refunds. The charge's Stripe receipt link is stored on the purchase (and refreshed from
// charge.refunded) because the site, not an email, shows it to the buyer (memo §7.2 Z4). If processing
// fails, the webhook_events row is removed and 500 is returned so Stripe retries. Payloads are never logged.
import type { Lang } from '../../../shared/api'
import { SKUS } from '../../../shared/config'
import { alertOwner } from '../email'
import type { Ctx, Env } from '../env'
import { error, json, readTextLimited } from '../lib/http'
import { grantPass, revokePasses } from './entitlement'
import { formatCad, passActiveEmail, regionRefundEmail } from './messages'
import { emailBuyerOf } from './notify'
import { evidenceAllowed, type PaymentEvidence } from './region'
import {
  CURRENCY,
  EVENT_PATHS,
  type PurchaseRow,
  deleteRefund,
  eventStatement,
  findPurchaseByCharge,
  getPurchase,
  insertPurchase,
  insertOwnerRefund,
  insertRefund,
  isSku,
  ownerRefundEvent,
  setReceiptUrl,
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
  type StripeList,
  describeError,
  idOf,
  receiptUrlOf,
  stripeFetch,
  verifyStripeSignature,
} from './stripe'

export const MAX_WEBHOOK_BYTES = 256 * 1024

/**
 * Refund metadata key the owner sets (to "true") on a partial refund that should also end the pass, e.g.
 * a pro-rated refund of the unused days. A full refund always ends it.
 */
export const END_PASS_METADATA_KEY = 'end_pass'

export async function webhook(req: Request, ctx: Ctx): Promise<Response> {
  const { env, now } = ctx
  // streamed byte limit: a chunked body without Content-Length cannot make the Worker buffer more
  const raw = await readTextLimited(req, MAX_WEBHOOK_BYTES)
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
    // async_payment_succeeded covers delayed payment methods (payment_status is 'unpaid' on their
    // completion event) // [unverified: prior knowledge]. Checkout is card-only, so it is only a fallback.
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
      return onCheckoutPaid(object as unknown as CheckoutSession, event.id, ctx)
    case 'charge.refunded':
      return onChargeRefunded(object as unknown as Charge, ctx)
    case 'refund.failed':
      return onRefundFailed(object as unknown as Refund, ctx)
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
  // the receipt is stored whatever happens next (pass, region refund or nothing): the buyer sees it on the site
  const receiptUrl = receiptUrlOf(charge)
  await env.DB.prepare(
    `UPDATE purchases SET payment_intent = ?1, charge_id = ?2, card_fingerprint = ?3, card_country = ?4,
            billing_country = ?5, billing_region = ?6, payment_method_type = ?7,
            amount_refunded_cents = MAX(amount_refunded_cents, ?8), receipt_url = COALESCE(?10, receipt_url)
      WHERE id = ?9`,
  )
    .bind(
      paymentIntentId,
      evidence.chargeId,
      evidence.cardFingerprint,
      evidence.cardCountry,
      evidence.billingCountry,
      evidence.billingRegion,
      evidence.paymentMethodType,
      charge.amount_refunded ?? 0,
      purchase.id,
      receiptUrl,
    )
    .run()

  // Events can arrive out of order: a charge refunded (fully, or partly with end_pass) or disputed before
  // we saw it gets no pass. Its charge.refunded event found no purchase to match, so it is handled here.
  const refundedBefore = charge.amount_refunded ?? 0
  const endedBefore = charge.refunded === true || (refundedBefore > 0 && (await refundEndsPass(env, charge.id)))
  if (endedBefore || charge.disputed) {
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
    await rejectForRegion(purchase, paymentIntentId, eventId, receiptUrl, ctx)
    // Checkout asks for cards only, so another payment method means the Stripe settings let one through.
    if (evidence.paymentMethodType !== 'card') {
      await alertOwner(
        env,
        'Non-card payment refunded',
        [
          `Purchase ${purchase.id} was paid with "${evidence.paymentMethodType ?? 'unknown'}", not a card, so it was ` +
            'refunded under the region rule and no pass was granted.',
          'Checkout asks for cards only: check the payment method settings in the Stripe Dashboard.',
        ].join('\n'),
      )
    }
    return
  }

  const pass = await grantPass(env, { userId: purchase.user_id, sku: purchase.sku, purchaseId: purchase.id, now }, [
    env.DB.prepare("UPDATE purchases SET status = 'paid', paid_at = ?1 WHERE id = ?2 AND status = 'pending'").bind(
      now.toISOString(),
      purchase.id,
    ),
    eventStatement(env, 'purchase', EVENT_PATHS.webhook, now),
    // a partial refund (without end_pass) made before this event: recorded with the grant, pass kept
    ...(refundedBefore > 0
      ? [insertOwnerRefund(env, purchase.id, refundedBefore, now), ownerRefundEvent(env, purchase.id, refundedBefore, now)]
      : []),
  ])
  // /checkout/success/ and /account/ show the pass and the receipt; this email is extra and may be skipped
  const compose = (lang: Lang) => passActiveEmail(lang, purchase.sku, pass.endsAt, siteUrl(env), receiptUrl)
  await emailBuyerOf(env, purchase.user_id, compose, eventId)
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
    termsVersion: session.metadata?.terms_version ?? null,
    now,
  }).run()
  return getPurchase(env, session.id)
}

function chargeEvidence(charge: Charge): PaymentEvidence {
  const address = charge.billing_details?.address
  const card = charge.payment_method_details?.card
  return {
    chargeId: charge.id,
    paymentMethodType: paymentMethodType(charge.payment_method_details?.type),
    billingCountry: address?.country ?? null,
    billingRegion: address?.state ?? null,
    cardCountry: card?.country ?? null,
    cardFingerprint: card?.fingerprint ?? null,
  }
}

/** Stripe's payment method type name ("card", "link", "us_bank_account"…); anything else is dropped. */
function paymentMethodType(type: string | null | undefined): string | null {
  return typeof type === 'string' && /^[a-z0-9_]{1,40}$/.test(type) ? type : null
}

/** Refunds a payment from outside the sales region (or not paid by card); no pass is granted. */
async function rejectForRegion(
  purchase: PurchaseRow,
  paymentIntent: string,
  eventId: string,
  receiptUrl: string | null,
  ctx: Ctx,
): Promise<void> {
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
  // the account page shows the refunded status and the receipt; this email is extra and may be skipped
  const amount = refund?.amount ?? purchase.amount_cents
  await emailBuyerOf(env, purchase.user_id, (lang) => regionRefundEmail(lang, amount, siteUrl(env), receiptUrl), eventId)
}

// ---------- charge.refunded ----------

async function onChargeRefunded(charge: Charge, ctx: Ctx): Promise<void> {
  const purchase = await findPurchaseByCharge(ctx.env, charge.id, idOf(charge.payment_intent))
  // A charge without a purchase yet (checkout.session.completed not processed) is handled there.
  if (!purchase) return
  await applyChargeRefund(purchase, charge, ctx)
}

/**
 * Records what Stripe reports as refunded on the purchase's charge, partial refunds included:
 * - amount_refunded_cents keeps the cumulative amount (never lowered by a late, older event);
 * - the part of it not yet covered by a refunds row (our self-serve and region rows are written before
 *   Stripe is called) becomes an 'owner' row plus a 'refund' event, once per cumulative amount;
 * - the pass ends only when the charge is fully refunded or a refund carries metadata end_pass=true
 *   (a pro-rated refund of unused days); other partial refunds keep it;
 * - the event carries the charge, so its receipt link (which now shows the refund) is stored again.
 * Everything is written in one D1 batch, so a failed attempt leaves nothing behind for Stripe's retry.
 */
async function applyChargeRefund(purchase: PurchaseRow, charge: Charge, ctx: Ctx): Promise<void> {
  const { env, now } = ctx
  const fully = charge.refunded === true
  const total = charge.amount_refunded ?? (fully ? purchase.amount_cents : 0)
  const endsPass = purchase.status === 'paid' && (fully || (await refundEndsPass(env, charge.id)))

  const statements = [
    insertOwnerRefund(env, purchase.id, total, now),
    ownerRefundEvent(env, purchase.id, total, now),
    env.DB.prepare('UPDATE purchases SET amount_refunded_cents = ?1 WHERE id = ?2 AND amount_refunded_cents < ?1').bind(
      total,
      purchase.id,
    ),
    setReceiptUrl(env, purchase.id, charge.id, receiptUrlOf(charge)),
  ]
  if (!endsPass) {
    await env.DB.batch(statements)
    return
  }
  statements.push(
    env.DB.prepare(
      "UPDATE purchases SET status = 'refunded', refunded_at = COALESCE(refunded_at, ?1) WHERE id = ?2 AND status = 'paid'",
    ).bind(now.toISOString(), purchase.id),
  )
  await revokePasses(env, purchase.id, 'refunded', now, statements)
}

/** True when a live (not failed or canceled) refund of the charge has metadata end_pass=true. */
async function refundEndsPass(env: Env, chargeId: string): Promise<boolean> {
  // One page of up to 100 refunds: far more than one pass purchase ever gets.
  const list = await stripeFetch<StripeList<Refund>>(env, 'GET', '/v1/refunds', { params: { charge: chargeId, limit: 100 } })
  return list.data.some(
    (r) =>
      r.status !== 'failed' &&
      r.status !== 'canceled' &&
      r.metadata?.[END_PASS_METADATA_KEY]?.trim().toLowerCase() === 'true',
  )
}

// ---------- refund.failed ----------

/**
 * A refund can fail days later (e.g. the card was closed). The buyer then has neither the money nor,
 * after a self-serve refund, the pass: the owner has to sort it out, so alert them.
 */
async function onRefundFailed(refund: Refund, ctx: Ctx): Promise<void> {
  const { env } = ctx
  const purchase = await findPurchaseByCharge(env, idOf(refund.charge), idOf(refund.payment_intent))
  const origin = refund.metadata?.reason
  await alertOwner(
    env,
    'Refund failed',
    [
      `Refund ${refund.id} of ${formatCad(refund.amount)} failed` +
        (refund.failure_reason ? ` (reason: ${refund.failure_reason}).` : '.'),
      purchase
        ? `Purchase ${purchase.id} (${purchase.sku}), status ${purchase.status}.`
        : 'It does not match any purchase.',
      origin === 'self_serve'
        ? 'It was a self-serve refund: the pass has already ended and the buyer was told the money is on its way.'
        : origin === 'region'
          ? 'It was an automatic region refund: no pass was granted.'
          : 'It was issued outside the Worker (Dashboard or API).',
      'The buyer has not received this money. Find the payment in the Stripe Dashboard and arrange the refund with the buyer.',
    ].join('\n'),
  )
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
