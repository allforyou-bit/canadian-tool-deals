import { SESSION } from '../../../shared/config'
import type { Env, User } from '../env'
import { saltedHash } from './crypto'
import { getCookie } from './http'

/** Resolve the signed-in user from the session cookie, or null. */
export async function getUser(req: Request, env: Env, now = new Date()): Promise<User | null> {
  const raw = getCookie(req, SESSION.cookieName)
  if (!raw) return null
  const idHash = await saltedHash(env.HASH_SALT, `session:${raw}`)
  const row = await env.DB.prepare(
    `SELECT u.id, u.email, u.lang, u.free_speaking_used, u.self_refund_used
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.id_hash = ?1 AND s.expires_at > ?2 AND u.deleted_at IS NULL`,
  )
    .bind(idHash, now.toISOString())
    .first<{ id: string; email: string; lang: string; free_speaking_used: number; self_refund_used: number }>()
  if (!row) return null
  return {
    id: row.id,
    email: row.email,
    lang: row.lang === 'ko' ? 'ko' : 'en',
    freeSpeakingUsed: row.free_speaking_used === 1,
    selfRefundUsed: row.self_refund_used === 1,
  }
}

/** Active (not revoked, not expired) pass for a user, if any. */
export async function getActivePass(env: Env, userId: string, now = new Date()) {
  return env.DB.prepare(
    `SELECT sku, starts_at, ends_at FROM passes
      WHERE user_id = ?1 AND revoked_at IS NULL AND starts_at <= ?2 AND ends_at > ?2
      ORDER BY ends_at DESC LIMIT 1`,
  )
    .bind(userId, now.toISOString())
    .first<{ sku: 'pass30' | 'pass90'; starts_at: string; ends_at: string }>()
}
