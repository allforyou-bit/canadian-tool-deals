// D1 access shared by the billing handlers: purchases, server-side funnel events, refund rows and the
// buyer's contact details for transactional email.
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
  status: PurchaseStatus
  paid_at: string | null
}

const PURCHASE_COLUMNS =
  'id, user_id, sku, amount_cents, currency, payment_intent, charge_id, card_fingerprint, status, paid_at'

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
  p: { id: string; userId: string; sku: Sku; amountCents: number; currency: string; now: Date },
): D1PreparedStatement {
  return env.DB.prepare(
    `INSERT INTO purchases (id, user_id, sku, amount_cents, currency, status, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, 'pending', ?6)`,
  ).bind(p.id, p.userId, p.sku, p.amountCents, p.currency, p.now.toISOString())
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

/**
 * Refund rows use a deterministic id per purchase and reason, so a row can be written before Stripe is
 * called (it marks the refund as ours when the charge.refunded webhook arrives) and never twice.
 */
export function refundRowId(reason: RefundReason, purchaseId: string): string {
  return `${reason}_${purchaseId}`
}

export function insertRefund(
  env: Env,
  r: { reason: RefundReason; purchase: PurchaseRow; amountCents: number; now: Date },
): D1PreparedStatement {
  return env.DB.prepare(
    `INSERT INTO refunds (id, purchase_id, user_id, amount_cents, reason, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6) ON CONFLICT (id) DO NOTHING`,
  ).bind(refundRowId(r.reason, r.purchase.id), r.purchase.id, r.purchase.user_id, r.amountCents, r.reason, r.now.toISOString())
}

export function deleteRefund(env: Env, reason: RefundReason, purchaseId: string): Promise<D1Result> {
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
