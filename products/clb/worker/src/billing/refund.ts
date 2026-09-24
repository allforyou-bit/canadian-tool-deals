// POST /api/refund-request (memo §1.1, B6): self-serve refund of the latest pass within
// REFUND_POLICY.withinDays of payment when at most REFUND_POLICY.maxGradedTasksUsed paid graded tasks
// were used, once per email (surviving account deletion through users.email_hash) and once per card.
import type { RefundRequest, RefundResponse } from '../../../shared/api'
import { REFUND_POLICY } from '../../../shared/config'
import { alertOwner } from '../email'
import type { Ctx, Env } from '../env'
import { error, json, readJson } from '../lib/http'
import { addDays } from '../lib/time'
import { revokePasses } from './entitlement'
import { ERRORS, langOf, pick, selfRefundEmail } from './messages'
import { emailBuyer } from './notify'
import { EVENT_PATHS, deleteRefund, eventStatement, insertRefund, latestPaidPurchase, refundRowId } from './store'
import { type Refund, describeError, stripeFetch } from './stripe'

export async function refundRequest(req: Request, ctx: Ctx): Promise<Response> {
  const { env, user, now } = ctx
  if (!user) return error('unauthorized', ERRORS.signIn.en)
  const body = await readJson<RefundRequest>(req)
  if (!body || typeof body !== 'object') return error('bad_request', ERRORS.badRequest.en)
  const lang = langOf(body.lang)

  const purchase = await latestPaidPurchase(env, user.id)
  if (!purchase?.paid_at || !purchase.payment_intent) return error('forbidden', pick(lang, ERRORS.noRefundable))
  if (purchase.paid_at < addDays(now, -REFUND_POLICY.withinDays).toISOString()) {
    return error('forbidden', pick(lang, ERRORS.refundWindow))
  }
  if ((await gradedTasksSince(env, user.id, purchase.paid_at)) > REFUND_POLICY.maxGradedTasksUsed) {
    return error('forbidden', pick(lang, ERRORS.refundUsage))
  }
  if (user.selfRefundUsed || (await selfRefundAlreadyUsed(env, user.id, purchase.card_fingerprint))) {
    return error('forbidden', pick(lang, ERRORS.refundOnce))
  }

  // Claim first: blocks a double submit, and tells the charge.refunded webhook this refund is ours.
  const claim = await insertRefund(env, { reason: 'self_serve', purchase, amountCents: purchase.amount_cents, now }).run()
  if (claim.meta.changes === 0) return error('forbidden', pick(lang, ERRORS.refundInProgress))

  let refund: Refund
  try {
    refund = await stripeFetch<Refund>(env, 'POST', '/v1/refunds', {
      params: {
        payment_intent: purchase.payment_intent,
        reason: 'requested_by_customer',
        metadata: { reason: 'self_serve', purchase_id: purchase.id },
      },
      idempotencyKey: `self-${purchase.id}`,
    })
  } catch (e) {
    console.error('refund-request: stripe refund failed', describeError(e))
    await deleteRefund(env, 'self_serve', purchase.id)
    return error('internal', pick(lang, ERRORS.refundFailed))
  }
  if (refund.status === 'failed' || refund.status === 'canceled') {
    await deleteRefund(env, 'self_serve', purchase.id)
    await alertOwner(env, 'Self-serve refund failed', `Purchase ${purchase.id}: refund ${refund.id} is ${refund.status}.`)
    return error('internal', pick(lang, ERRORS.refundFailed))
  }

  const refundedCents = refund.amount
  await revokePasses(env, purchase.id, 'refunded', now, [
    env.DB.prepare("UPDATE purchases SET status = 'refunded', refunded_at = ?1 WHERE id = ?2").bind(now.toISOString(), purchase.id),
    env.DB.prepare('UPDATE refunds SET amount_cents = ?1 WHERE id = ?2').bind(refundedCents, refundRowId('self_serve', purchase.id)),
    env.DB.prepare('UPDATE users SET self_refund_used = 1 WHERE id = ?1').bind(user.id),
    eventStatement(env, 'refund', EVENT_PATHS.refund, now),
  ])
  // The refund is done: the response says so whether or not this (optional) email goes out.
  await emailBuyer(env, {
    to: user.email,
    ...selfRefundEmail(lang, refundedCents, purchase.receipt_url),
    idempotencyKey: `self-refund-${purchase.id}`,
  })
  return json({ ok: true, refundedCents } satisfies RefundResponse)
}

/** Paid graded tasks since the purchase (refused and free-sample grades do not count). */
async function gradedTasksSince(env: Env, userId: string, since: string): Promise<number> {
  const row = await env.DB.prepare(
    'SELECT COUNT(*) AS n FROM grades WHERE user_id = ?1 AND refused = 0 AND free = 0 AND created_at >= ?2',
  )
    .bind(userId, since)
    .first<{ n: number }>()
  return row?.n ?? 0
}

/**
 * Once per email and per card: any account with the same email_hash (including deleted accounts) that
 * used a self-serve refund, or any self-serve refund of a purchase paid with the same card fingerprint.
 */
async function selfRefundAlreadyUsed(env: Env, userId: string, cardFingerprint: string | null): Promise<boolean> {
  const row = await env.DB.prepare(
    `WITH me AS (SELECT email_hash FROM users WHERE id = ?1)
     SELECT
       EXISTS (SELECT 1 FROM users u, me WHERE u.email_hash = me.email_hash AND u.self_refund_used = 1)
       OR EXISTS (SELECT 1 FROM refunds r JOIN users u ON u.id = r.user_id, me
                   WHERE r.reason = 'self_serve' AND u.email_hash = me.email_hash)
       OR (?2 IS NOT NULL AND EXISTS (SELECT 1 FROM refunds r JOIN purchases p ON p.id = r.purchase_id
                                       WHERE r.reason = 'self_serve' AND p.card_fingerprint = ?2)) AS used`,
  )
    .bind(userId, cardFingerprint)
    .first<{ used: number }>()
  return row?.used === 1
}
