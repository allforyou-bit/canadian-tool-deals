// Pass entitlement (memo B6). A new pass starts now, or when the user's latest pass ends (so a second
// purchase extends access). Refunds and disputes revoke the purchase's pass, and passes queued behind
// it move forward so paid time is not lost.
import { SKUS, type Sku } from '../../../shared/config'
import type { Env } from '../env'
import { randomId } from '../lib/crypto'

export interface GrantedPass {
  id: string
  sku: Sku
  startsAt: string
  endsAt: string
}

export interface GrantInput {
  userId: string
  sku: Sku
  purchaseId: string
  now: Date
}

export type RevokeReason = 'refunded' | 'dispute'

interface PassRow {
  id: string
  user_id: string
  sku: Sku
  starts_at: string
  ends_at: string
}

/**
 * Grants the pass for a purchase: starts at max(now, end of the user's latest unrevoked pass) and lasts
 * SKUS[sku].days. The start is computed inside the INSERT, and `alongside` statements run in the same
 * D1 batch (one transaction). Idempotent per purchase: a second call returns the existing pass.
 */
export async function grantPass(env: Env, g: GrantInput, alongside: D1PreparedStatement[] = []): Promise<GrantedPass> {
  // ISO-8601 strings compare correctly as text, and strftime(..., '%fZ') reproduces toISOString()'s format.
  const insert = env.DB.prepare(
    `INSERT INTO passes (id, user_id, sku, starts_at, ends_at, purchase_id)
     SELECT ?1, ?2, ?3, start, strftime('%Y-%m-%dT%H:%M:%fZ', start, ?6), ?4
       FROM (SELECT MAX(?5, COALESCE(
               (SELECT MAX(ends_at) FROM passes WHERE user_id = ?2 AND revoked_at IS NULL), ?5)) AS start)
      WHERE NOT EXISTS (SELECT 1 FROM passes WHERE purchase_id = ?4)`,
  ).bind(randomId('pass_'), g.userId, g.sku, g.purchaseId, g.now.toISOString(), `+${SKUS[g.sku].days} days`)
  await env.DB.batch([...alongside, insert])

  const row = await env.DB.prepare('SELECT id, user_id, sku, starts_at, ends_at FROM passes WHERE purchase_id = ?1')
    .bind(g.purchaseId)
    .first<PassRow>()
  if (!row) throw new Error('pass was not recorded')
  return { id: row.id, sku: row.sku, startsAt: row.starts_at, endsAt: row.ends_at }
}

/**
 * Revokes the purchase's pass and pulls later queued passes forward; `alongside` statements run in the
 * same transaction. Returns the number of passes revoked (0 when none was active).
 */
export async function revokePasses(
  env: Env,
  purchaseId: string,
  reason: RevokeReason,
  now: Date,
  alongside: D1PreparedStatement[] = [],
): Promise<number> {
  const pass = await env.DB.prepare(
    'SELECT id, user_id, sku, starts_at, ends_at FROM passes WHERE purchase_id = ?1 AND revoked_at IS NULL',
  )
    .bind(purchaseId)
    .first<PassRow>()
  const statements = [...alongside]
  if (pass) {
    statements.push(
      env.DB.prepare('UPDATE passes SET revoked_at = ?1, revoke_reason = ?2 WHERE id = ?3 AND revoked_at IS NULL').bind(
        now.toISOString(),
        reason,
        pass.id,
      ),
      ...(await compactQueue(env, pass, now)),
    )
  }
  if (statements.length > 0) await env.DB.batch(statements)
  return pass ? 1 : 0
}

/**
 * After `revoked` is removed, moves the user's other future passes forward to close the gap it leaves.
 * Passes already running keep their dates; queued passes keep their length.
 */
async function compactQueue(env: Env, revoked: PassRow, now: Date): Promise<D1PreparedStatement[]> {
  const { results } = await env.DB.prepare(
    `SELECT id, user_id, sku, starts_at, ends_at FROM passes
      WHERE user_id = ?1 AND revoked_at IS NULL AND id != ?2 AND ends_at > ?3
      ORDER BY starts_at`,
  )
    .bind(revoked.user_id, revoked.id, now.toISOString())
    .all<PassRow>()
  const updates: D1PreparedStatement[] = []
  let cursor = now.getTime()
  for (const p of results) {
    const start = Date.parse(p.starts_at)
    const end = Date.parse(p.ends_at)
    if (start > cursor) {
      const newEnd = cursor + (end - start)
      updates.push(
        env.DB.prepare('UPDATE passes SET starts_at = ?1, ends_at = ?2 WHERE id = ?3').bind(
          new Date(cursor).toISOString(),
          new Date(newEnd).toISOString(),
          p.id,
        ),
      )
      cursor = newEnd
    } else {
      cursor = Math.max(cursor, end)
    }
  }
  return updates
}
