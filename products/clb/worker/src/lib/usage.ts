// Per-user usage counters (caps, memo B10), the atomic cap reservation (decision 2) and free-sample
// availability (memo B5). Rows without feedback (refused = 1: refusals, failures, no speech) never
// count toward the fair-use caps; they have their own daily bound, CAPS.noFeedbackPerDay. A row
// whose model call is still running (pending = 1) has refused = 0, so it holds its cap slot.
import { CAPS, FREE } from '../../../shared/config'
import type { Env, User } from '../env'
import { addDays, dayKey, startOfUtcDay } from './time'

export interface Usage {
  writingToday: number
  speakingToday: number
  graded30d: number
}

/** Graded tasks (including reserved, still-running ones) today and in the last 30 days. */
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

/** Requests without feedback this UTC day, counting calls still in flight (any of them may end without feedback). */
export async function noFeedbackToday(env: Env, userId: string, now: Date): Promise<number> {
  const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM grades WHERE user_id = ?1 AND (refused = 1 OR pending = 1) AND created_at >= ?2')
    .bind(userId, startOfUtcDay(now).toISOString())
    .first<{ n: number }>()
  return row?.n ?? 0
}

export type ReserveBlock = 'daily' | 'rolling30' | 'no_feedback'

/** The pending grades row that holds a slot while the model call runs. */
export interface GradeReservation {
  id: string
  /** null for the anonymous free sample */
  userId: string | null
  taskId: string
  promptIndex: number
  kind: 'writing' | 'speaking'
  free: boolean
  model: string
  /** worst-case cost of the call; a call that never finishes keeps this estimate in the cost log */
  costMicroUsd: number
  createdAt: string
}

/**
 * Reserve a slot before any model call (decision 2): one conditional INSERT … SELECT … WHERE of a
 * grades row with pending = 1 and refused = 0 (device_hash is not written: decision 5). D1 runs each
 * statement atomically, so parallel requests cannot all pass the check.
 * - fairUse (pass holders): graded rows of this kind today < the daily cap, and graded rows in the
 *   last 30 days < CAPS.gradedPer30Days; pending rows count, since they have refused = 0.
 * - every signed-in user: rows without feedback today < CAPS.noFeedbackPerDay.
 * - anonymous (free sample, already claimed atomically): inserted without conditions.
 * Returns null when reserved, or the limit that blocked it.
 */
export async function reserveGrade(env: Env, r: GradeReservation, now: Date, opts: { fairUse: boolean }): Promise<ReserveBlock | null> {
  const day = startOfUtcDay(now).toISOString()
  const since30 = addDays(now, -30).toISOString()
  const insert = () =>
    env.DB.prepare(
      `INSERT INTO grades (id, user_id, device_hash, task_id, prompt_index, kind, free, refused, pending, model, cost_micro_usd, created_at)
       SELECT ?1, ?2, NULL, ?3, ?4, ?5, ?6, 0, 1, ?7, ?8, ?9
        WHERE ?2 IS NULL OR (
          (SELECT COUNT(*) FROM grades WHERE user_id = ?2 AND (refused = 1 OR pending = 1) AND created_at >= ?10) < ?11
          AND (?12 = 0 OR (
            (SELECT COUNT(*) FROM grades WHERE user_id = ?2 AND refused = 0 AND kind = ?5 AND created_at >= ?10) < ?13
            AND (SELECT COUNT(*) FROM grades WHERE user_id = ?2 AND refused = 0 AND created_at >= ?14) < ?15
          ))
        )`,
    )
      .bind(
        r.id,
        r.userId,
        r.taskId,
        r.promptIndex,
        r.kind,
        r.free ? 1 : 0,
        r.model,
        r.costMicroUsd,
        r.createdAt,
        day,
        CAPS.noFeedbackPerDay,
        opts.fairUse ? 1 : 0,
        r.kind === 'writing' ? CAPS.writingPerDay : CAPS.speakingPerDay,
        since30,
        CAPS.gradedPer30Days,
      )
      .run()

  for (let attempt = 0; attempt < 2; attempt++) {
    if ((await insert()).meta.changes === 1) return null
    if (r.userId === null) break
    // name the limit for the message; if a parallel call freed its slot meanwhile, try once more
    const cap = opts.fairUse ? capReached(await getUsage(env, r.userId, now), r.kind) : null
    if (cap) return cap
    if ((await noFeedbackToday(env, r.userId, now)) >= CAPS.noFeedbackPerDay) return 'no_feedback'
  }
  return 'no_feedback'
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
