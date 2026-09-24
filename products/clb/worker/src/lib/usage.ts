// Per-user usage counters (caps, memo B10) and free-sample availability (memo B5).
// Refused requests (out-of-scope questions) do not count toward caps.
import { CAPS, FREE } from '../../../shared/config'
import type { Env, User } from '../env'
import { addDays, dayKey, startOfUtcDay } from './time'

export interface Usage {
  writingToday: number
  speakingToday: number
  graded30d: number
}

export async function getUsage(env: Env, userId: string, now: Date): Promise<Usage> {
  const row = await env.DB.prepare(
    `SELECT
       SUM(CASE WHEN kind = 'writing'  AND created_at >= ?2 THEN 1 ELSE 0 END) AS w,
       SUM(CASE WHEN kind = 'speaking' AND created_at >= ?2 THEN 1 ELSE 0 END) AS s,
       COUNT(*) AS t
     FROM grades
     WHERE user_id = ?1 AND refused = 0 AND created_at >= ?3`,
  )
    .bind(userId, startOfUtcDay(now).toISOString(), addDays(now, -30).toISOString())
    .first<{ w: number | null; s: number | null; t: number | null }>()
  return { writingToday: row?.w ?? 0, speakingToday: row?.s ?? 0, graded30d: row?.t ?? 0 }
}

/** Which cap, if any, blocks one more graded task of this kind. */
export function capReached(usage: Usage, kind: 'writing' | 'speaking'): 'daily' | 'rolling30' | null {
  if (usage.graded30d >= CAPS.gradedPer30Days) return 'rolling30'
  if (kind === 'writing' && usage.writingToday >= CAPS.writingPerDay) return 'daily'
  if (kind === 'speaking' && usage.speakingToday >= CAPS.speakingPerDay) return 'daily'
  return null
}

export interface FreeKeys {
  user: User | null
  deviceHash: string
  ipHash: string
}

/**
 * Free samples still available. Writing: 1 per device (lifetime) and 3 per IP prefix per UTC day.
 * Speaking: 1 per verified email. Both require the KV flag free_enabled.
 */
export async function freeAvailability(
  env: Env,
  keys: FreeKeys,
  now: Date,
  freeEnabled: boolean,
): Promise<{ writing: boolean; speaking: boolean }> {
  if (!freeEnabled) return { writing: false, speaking: false }
  const row = await env.DB.prepare(
    `SELECT
       (SELECT COALESCE(SUM(count), 0) FROM free_usage WHERE key_hash = ?1 AND kind = 'device') AS device_total,
       (SELECT COALESCE(SUM(count), 0) FROM free_usage WHERE key_hash = ?2 AND kind = 'ip' AND day = ?3) AS ip_today`,
  )
    .bind(keys.deviceHash, keys.ipHash, dayKey(now))
    .first<{ device_total: number; ip_today: number }>()
  const writing =
    (row?.device_total ?? 0) < FREE.anonymousWritingPerDevice && (row?.ip_today ?? 0) < FREE.anonymousWritingPerIpPerDay
  const speaking = keys.user !== null && !keys.user.freeSpeakingUsed
  return { writing, speaking }
}

/**
 * Claim one free writing sample for the device and IP prefix. The device claim is a single conditional
 * statement (limits re-checked inside it), so parallel requests cannot both succeed. Returns false when
 * the limits were already reached.
 */
export async function recordFreeWriting(env: Env, keys: FreeKeys, now: Date): Promise<boolean> {
  const day = dayKey(now)
  const claimed = await env.DB.prepare(
    `INSERT INTO free_usage (key_hash, kind, day, count)
     SELECT ?1, 'device', ?3, 1
      WHERE (SELECT COALESCE(SUM(count), 0) FROM free_usage WHERE key_hash = ?1 AND kind = 'device') < ?4
        AND (SELECT COALESCE(SUM(count), 0) FROM free_usage WHERE key_hash = ?2 AND kind = 'ip' AND day = ?3) < ?5
     ON CONFLICT (key_hash, kind, day) DO UPDATE SET count = count + 1`,
  )
    .bind(keys.deviceHash, keys.ipHash, day, FREE.anonymousWritingPerDevice, FREE.anonymousWritingPerIpPerDay)
    .run()
  if (claimed.meta.changes !== 1) return false
  await env.DB.prepare(
    `INSERT INTO free_usage (key_hash, kind, day, count) VALUES (?1, 'ip', ?2, 1)
     ON CONFLICT (key_hash, kind, day) DO UPDATE SET count = count + 1`,
  )
    .bind(keys.ipHash, day)
    .run()
  return true
}

/** Claim the one free speaking sample for this user; false when it was already used. */
export async function recordFreeSpeaking(env: Env, userId: string): Promise<boolean> {
  const res = await env.DB.prepare('UPDATE users SET free_speaking_used = 1 WHERE id = ?1 AND free_speaking_used = 0')
    .bind(userId)
    .run()
  return res.meta.changes === 1
}
