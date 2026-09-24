// D1 access shared by the billing handlers: purchases (with Stripe's receipt link), server-side funnel
// events, refund rows and the buyer's contact details for transactional email.
import type { Lang } from '../../../shared/api'
import { SKUS, type Sku } from '../../../shared/config'
import type { Env } from '../env'
import { dayKey } from '../lib/time'

/** Prices are in Canadian cents (config.SKUS). */
export const CURRENCY = 'cad'

export type PurchaseStatus = 'pending' | 'paid' | 'refunded' | 'disputed' | 'rejected_region'

export interface PurchaseRow {
  id: string
  user_id: string
  sku: Sku
  amount_cents: number
  currency: string
  payment_intent: string | null
  charge_id: string | null
  card_fingerprint: string | null
  payment_method_type: string | null
  status: PurchaseStatus
  /** cumulative amount Stripe reports as refunded (charge.amount_refunded); never decreases */
  amount_refunded_cents: number
  terms_version: string | null
  /** Stripe's hosted receipt for the charge (charge.receipt_url), shown on the site instead of an email */
  receipt_url: string | null
  paid_at: string | null
}

const PURCHASE_COLUMNS =
  'id, user_id, sku, amount_cents, currency, payment_intent, charge_id, card_fingerprint, payment_method_type, status, ' +
  'amount_refunded_cents, terms_version, receipt_url, paid_at'

/** Route paths recorded with server-side events (CONTRACT §6). */
export const EVENT_PATHS = {
  checkout: '/api/checkout',
  webhook: '/api/stripe/webhook',
  refund: '/api/refund-request',
} as const

export function isSku(value: unknown): value is Sku {
  return typeof value === 'string' && Object.hasOwn(SKUS, value)
}

export function getPurchase(env: Env, id: string): Promise<PurchaseRow | null> {
  return env.DB.prepare(`SELECT ${PURCHASE_COLUMNS} FROM purchases WHERE id = ?1`).bind(id).first<PurchaseRow>()
}

/** The purchase a charge belongs to, matched by charge id or PaymentIntent id. */
export function findPurchaseByCharge(env: Env, chargeId: string | null, paymentIntent: string | null) {
  return env.DB.prepare(
    `SELECT ${PURCHASE_COLUMNS} FROM purchases
      WHERE (?1 IS NOT NULL AND charge_id = ?1) OR (?2 IS NOT NULL AND payment_intent = ?2)
      LIMIT 1`,
  )
    .bind(chargeId, paymentIntent)
    .first<PurchaseRow>()
}

/** The user's most recent purchase in status 'paid'. */
export function latestPaidPurchase(env: Env, userId: string): Promise<PurchaseRow | null> {
  return env.DB.prepare(
    `SELECT ${PURCHASE_COLUMNS} FROM purchases WHERE user_id = ?1 AND status = 'paid' ORDER BY paid_at DESC LIMIT 1`,
  )
    .bind(userId)
    .first<PurchaseRow>()
}

export function insertPurchase(
  env: Env,
  p: { id: string; userId: string; sku: Sku; amountCents: number; currency: string; termsVersion: string | null; now: Date },
): D1PreparedStatement {
  return env.DB.prepare(
    `INSERT INTO purchases (id, user_id, sku, amount_cents, currency, status, terms_version, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, 'pending', ?6, ?7)`,
  ).bind(p.id, p.userId, p.sku, p.amountCents, p.currency, p.termsVersion, p.now.toISOString())
}

/** Server-side funnel event (no personal data). */
export function eventStatement(
  env: Env,
  name: 'checkout_start' | 'purchase' | 'refund',
  path: string,
  now: Date,
): D1PreparedStatement {
  return env.DB.prepare('INSERT INTO events (name, path, utm_json, day, created_at) VALUES (?1, ?2, NULL, ?3, ?4)').bind(
    name,
    path,
    dayKey(now),
    now.toISOString(),
  )
}

export type RefundReason = 'self_serve' | 'region' | 'owner'

/** Refunds this Worker issues itself; everything else Stripe reports is recorded as 'owner'. */
export type OwnRefundReason = Exclude<RefundReason, 'owner'>

/**
 * Our own refund rows use a deterministic id per purchase and reason, so a row can be written before
 * Stripe is called (its amount counts as already recorded when the charge.refunded webhook arrives) and
 * never twice.
 */
export function refundRowId(reason: OwnRefundReason, purchaseId: string): string {
  return `${reason}_${purchaseId}`
}

/**
 * Owner refunds (Dashboard, including partial ones) are recorded per charge.refunded event as the amount
 * not yet covered by any refunds row; the id carries the cumulative refunded amount, so each new total
 * gets one row and a redelivery of the same total gets none.
 */
export function ownerRefundRowId(purchaseId: string, cumulativeCents: number): string {
  return `owner_${purchaseId}_${cumulativeCents}`
}

export function insertRefund(
  env: Env,
  r: { reason: OwnRefundReason; purchase: PurchaseRow; amountCents: number; now: Date },
): D1PreparedStatement {
  return env.DB.prepare(
    `INSERT INTO refunds (id, purchase_id, user_id, amount_cents, reason, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6) ON CONFLICT (id) DO NOTHING`,
  ).bind(refundRowId(r.reason, r.purchase.id), r.purchase.id, r.purchase.user_id, r.amountCents, r.reason, r.now.toISOString())
}

/**
 * The owner refund row for a new cumulative refunded amount: the part of `cumulativeCents` not covered
 * by the purchase's refunds rows so far (inserts nothing when it is all covered, or on a redelivery).
 * Computed inside the INSERT, so concurrent charge.refunded events never count the same cents twice.
 */
export function insertOwnerRefund(env: Env, purchaseId: string, cumulativeCents: number, now: Date): D1PreparedStatement {
  return env.DB.prepare(
    `INSERT INTO refunds (id, purchase_id, user_id, amount_cents, reason, created_at)
     SELECT ?1, p.id, p.user_id, ?2 - r.recorded, 'owner', ?3
       FROM purchases p, (SELECT COALESCE(SUM(amount_cents), 0) AS recorded FROM refunds WHERE purchase_id = ?4) r
      WHERE p.id = ?4 AND ?2 > r.recorded
     ON CONFLICT (id) DO NOTHING`,
  ).bind(ownerRefundRowId(purchaseId, cumulativeCents), cumulativeCents, now.toISOString(), purchaseId)
}

/**
 * The 'refund' event for an owner refund row, written only when insertOwnerRefund inserted that row in
 * the same batch (same id and timestamp); run it right after insertOwnerRefund with the same arguments.
 */
export function ownerRefundEvent(env: Env, purchaseId: string, cumulativeCents: number, now: Date): D1PreparedStatement {
  return env.DB.prepare(
    `INSERT INTO events (name, path, utm_json, day, created_at)
     SELECT 'refund', ?1, NULL, ?2, ?3 WHERE EXISTS (SELECT 1 FROM refunds WHERE id = ?4 AND created_at = ?3)`,
  ).bind(EVENT_PATHS.webhook, dayKey(now), now.toISOString(), ownerRefundRowId(purchaseId, cumulativeCents))
}

/**
 * Stores (or refreshes) the receipt link of the purchase's charge. Only the charge recorded on the purchase
 * (or any charge while none is recorded yet) sets it; a null link never erases a stored one.
 */
export function setReceiptUrl(env: Env, purchaseId: string, chargeId: string, receiptUrl: string | null): D1PreparedStatement {
  return env.DB.prepare(
    `UPDATE purchases SET receipt_url = ?1
      WHERE id = ?2 AND ?1 IS NOT NULL AND (charge_id IS NULL OR charge_id = ?3)`,
  ).bind(receiptUrl, purchaseId, chargeId)
}

export function deleteRefund(env: Env, reason: OwnRefundReason, purchaseId: string): Promise<D1Result> {
  return env.DB.prepare('DELETE FROM refunds WHERE id = ?1').bind(refundRowId(reason, purchaseId)).run()
}

/** Email address and language for transactional mail; null once the account is deleted. */
export async function getContact(env: Env, userId: string): Promise<{ email: string; lang: Lang } | null> {
  const row = await env.DB.prepare('SELECT email, lang FROM users WHERE id = ?1 AND deleted_at IS NULL')
    .bind(userId)
    .first<{ email: string; lang: string }>()
  if (!row) return null
  return { email: row.email, lang: row.lang === 'ko' ? 'ko' : 'en' }
}

/** SITE_URL without a trailing slash. */
export function siteUrl(env: Env): string {
  return env.SITE_URL.replace(/\/+$/, '')
}
