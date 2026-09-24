// Scheduled work (wrangler.jsonc triggers). Every 15 min: spend tiers → kill switches (memo B10).
// Daily 05:00 UTC: retention purge (memo §4.1) and one aggregate metrics row for yesterday (memo B8).
// Logs carry counts only — never emails, essays or ids.
import { RETENTION_DAYS, SPEND } from '../../shared/config'
import { alertOwner } from './email'
import type { Env } from './env'
import { getFlags, setFlag } from './lib/flags'
import { evaluateTiers, spendSnapshot, type SpendSnapshot } from './lib/spend'
import { addDays, dayKey, startOfUtcDay } from './lib/time'

export const SPEND_CRON = '*/15 * * * *'
export const DAILY_CRON = '0 5 * * *'

/** KV keys owned by the cron (the owner's flags live under `flag:*`, see lib/flags.ts). */
export const KV = {
  autoFreeOff: 'auto:free_off',
  gradingPausedAt: 'auto:grading_paused_at',
} as const

const TWO_DAYS_SECONDS = 2 * 86_400
const FORTY_DAYS_SECONDS = 40 * 86_400

export async function handleScheduled(event: ScheduledController, env: Env): Promise<void> {
  const now = new Date(event.scheduledTime)
  switch (event.cron) {
    case SPEND_CRON:
      await runSpendMonitor(env, now)
      return
    case DAILY_CRON:
      await runDaily(env, now)
      return
    default:
      console.warn('unknown cron', event.cron)
  }
}

const usd = (n: number) => `US$${n.toFixed(2)}`
const pct = (x: number) => `${Math.round(x * 100)}%`

function describe(s: SpendSnapshot): string {
  return [
    `Month to date: ${usd(s.monthToDateUsd)} (${pct(s.monthToDateUsd / s.limitUsd)} of L = ${usd(s.limitUsd)})`,
    `Today: ${usd(s.todayUsd)} (daily cap ${usd(s.dailyCapUsd)})`,
    `Free samples: ${usd(s.freeTodayUsd)} today, ${usd(s.freeMonthUsd)} this month`,
    `Trailing 30-day gross (conservative USD): ${usd(s.trailingGrossUsd)}`,
  ].join('\n')
}

/** Sends an owner alert unless one was already sent under this KV guard key. */
async function alertOnce(env: Env, guardKey: string, ttlSeconds: number, subject: string, text: string): Promise<void> {
  if (await env.FLAGS.get(guardKey)) return
  // Only a delivered alert sets the guard, so a failed send is retried on the next run.
  if (await alertOwner(env, subject, text)) await env.FLAGS.put(guardKey, '1', { expirationTtl: ttlSeconds })
}

/**
 * Spend monitor. The cron only undoes what it did itself: free samples come back on only when the
 * `auto:free_off` marker is present, and grading only when `auto:grading_paused_at` is. While the cron
 * holds a switch off, the owner gets at most one alert per UTC day (a failed send is retried next run).
 */
export async function runSpendMonitor(env: Env, now: Date): Promise<void> {
  const s = await spendSnapshot(env, now)
  const t = evaluateTiers(s)
  const flags = await getFlags(env)
  const day = dayKey(now)

  const autoFreeOff = await env.FLAGS.get(KV.autoFreeOff)
  if (t.freeOff) {
    if (flags.free_enabled) {
      await setFlag(env, 'free_enabled', false)
      await env.FLAGS.put(KV.autoFreeOff, '1')
      console.log('spend monitor: free samples off')
    }
    if (flags.free_enabled || autoFreeOff) {
      await alertOnce(
        env,
        `alerted:freeoff:${day}`,
        TWO_DAYS_SECONDS,
        'Free samples switched off (spend)',
        [
          `Free samples are switched off automatically (month spend is at least ${pct(SPEND.freeOffAt)} of L,`,
          'or the free budget is used up). Paid grading is not affected. Free samples come back on by themselves',
          `once spend is below the thresholds again.\n\n${describe(s)}`,
        ].join(' '),
      )
    }
  } else if (autoFreeOff) {
    await setFlag(env, 'free_enabled', true)
    await env.FLAGS.delete(KV.autoFreeOff)
    console.log('spend monitor: free samples back on')
  }

  const pausedAt = await env.FLAGS.get(KV.gradingPausedAt)
  if (t.pauseGrading) {
    if (flags.grading_enabled) {
      await setFlag(env, 'grading_enabled', false)
      // Keep the first pause time if the owner re-enabled grading mid-pause, so the extension covers it all.
      if (!pausedAt) await env.FLAGS.put(KV.gradingPausedAt, now.toISOString())
      console.log('spend monitor: grading paused')
    }
    if (flags.grading_enabled || pausedAt) {
      await alertOnce(
        env,
        `alerted:pause:${day}`,
        TWO_DAYS_SECONDS,
        'Grading paused (daily spend cap)',
        [
          "Today's spend is above the daily cap, so grading is paused until 00:00 UTC. It resumes by itself,",
          `and every pass that was active at the pause is extended by the pause length.\n\n${describe(s)}`,
        ].join(' '),
      )
    }
  } else if (pausedAt) {
    await resumeGrading(env, pausedAt, now)
  }

  if (t.alert) {
    await alertOnce(
      env,
      `alerted:tier95:${day.slice(0, 7)}`,
      FORTY_DAYS_SECONDS,
      `Spend at ${pct(SPEND.alertAt)} of the monthly limit`,
      [
        `Anthropic spend this month has reached ${pct(SPEND.alertAt)} of L.`,
        `Raise the Anthropic monthly limit or keep free samples off.\n\n${describe(s)}`,
      ].join(' '),
    )
  }
}

/**
 * Re-enables grading after an automatic pause and extends every pass that was active when grading
 * paused by the pause length — exactly once per pause, even if this runs twice or concurrently.
 * New end dates are computed here and sent as one JSON parameter, so the whole extension is a single
 * UPDATE however many passes there are. It shares a D1 batch (one SQL transaction: cloudflare-docs
 * d1/worker-api/d1-database.mdx, 2026-09-24) with the marker row `webhook_events.id = 'pause-ext:<pausedAt>'`:
 * the UPDATE applies only while the marker is absent and the marker is inserted after it, so only the
 * first batch to commit extends anything, and `meta.changes === 1` on the marker says this run did it.
 * Each pass is also compare-and-set on the `ends_at` read here, so a pass that billing changed in the
 * meantime is never overwritten with a stale value.
 */
async function resumeGrading(env: Env, pausedAt: string, now: Date): Promise<void> {
  const pausedMs = Date.parse(pausedAt)
  const guardId = `pause-ext:${pausedAt}`
  const done = await env.DB.prepare('SELECT 1 AS x FROM webhook_events WHERE id = ?1').bind(guardId).first()

  if (!done && Number.isFinite(pausedMs) && now.getTime() > pausedMs) {
    const extendMs = now.getTime() - pausedMs
    const { results } = await env.DB.prepare(
      'SELECT id, ends_at FROM passes WHERE revoked_at IS NULL AND starts_at <= ?1 AND ends_at > ?1',
    )
      .bind(pausedAt)
      .all<{ id: string; ends_at: string }>()
    const extensions = results.map((p) => ({
      id: p.id,
      from: p.ends_at,
      to: new Date(Date.parse(p.ends_at) + extendMs).toISOString(),
    }))
    const [update, marker] = await env.DB.batch([
      env.DB.prepare(
        `WITH ext (id, old_end, new_end) AS (
           SELECT json_extract(value, '$.id'), json_extract(value, '$.from'), json_extract(value, '$.to')
             FROM json_each(?1)
         )
         UPDATE passes SET ends_at = (SELECT new_end FROM ext WHERE ext.id = passes.id)
          WHERE EXISTS (SELECT 1 FROM ext WHERE ext.id = passes.id AND ext.old_end = passes.ends_at)
            AND NOT EXISTS (SELECT 1 FROM webhook_events WHERE id = ?2)`,
      ).bind(JSON.stringify(extensions), guardId),
      env.DB.prepare(
        "INSERT OR IGNORE INTO webhook_events (id, type, received_at) VALUES (?1, 'cron_pause_extension', ?2)",
      ).bind(guardId, now.toISOString()),
    ])
    if (marker?.meta.changes === 1) {
      console.log('spend monitor: passes extended after grading pause', {
        passes: update?.meta.changes ?? 0,
        candidates: extensions.length,
        minutes: Math.round(extendMs / 60_000),
      })
    }
  }

  await setFlag(env, 'grading_enabled', true)
  await env.FLAGS.delete(KV.gradingPausedAt)
  console.log('spend monitor: grading resumed')
}

export interface DailyMetrics {
  day: string
  events: Record<string, number>
  /** writing/speaking/free count graded (non-refused) tasks; refused counts out-of-scope refusals */
  grades: { writing: number; speaking: number; free: number; refused: number }
  /** Anthropic + Workers AI cost of every grade row that day (including refusals) */
  costUsd: number
  /** purchases that granted a pass that day (billing sets paid_at only then; region rejections never do) */
  purchases: { paid: number; grossCents: number }
  /** refunds of passes issued that day (self-serve, owner); region-rejection refunds and disputes excluded */
  refunds: { count: number; cents: number }
  /** Stripe charge.dispute.created events received that day */
  disputes: number
}

/** Aggregate funnel and cost numbers for the UTC day starting at `dayStart` (no personal data). */
export async function dailyMetrics(env: Env, dayStart: Date): Promise<DailyMetrics> {
  const from = dayStart.toISOString()
  const to = addDays(dayStart, 1).toISOString()
  const day = dayKey(dayStart)
  const [events, grades, purchases, refunds, disputes] = await Promise.all([
    env.DB.prepare('SELECT name, COUNT(*) AS n FROM events WHERE day = ?1 GROUP BY name ORDER BY name')
      .bind(day)
      .all<{ name: string; n: number }>(),
    env.DB.prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN kind = 'writing' AND refused = 0 THEN 1 ELSE 0 END), 0) AS writing,
         COALESCE(SUM(CASE WHEN kind = 'speaking' AND refused = 0 THEN 1 ELSE 0 END), 0) AS speaking,
         COALESCE(SUM(CASE WHEN free = 1 AND refused = 0 THEN 1 ELSE 0 END), 0) AS free,
         COALESCE(SUM(CASE WHEN refused = 1 THEN 1 ELSE 0 END), 0) AS refused,
         COALESCE(SUM(cost_micro_usd), 0) AS cost
       FROM grades WHERE created_at >= ?1 AND created_at < ?2`,
    )
      .bind(from, to)
      .first<{ writing: number; speaking: number; free: number; refused: number; cost: number }>(),
    env.DB.prepare(
      `SELECT COUNT(*) AS n, COALESCE(SUM(amount_cents), 0) AS cents FROM purchases
        WHERE paid_at >= ?1 AND paid_at < ?2 AND status IN ('paid', 'refunded', 'disputed')`,
    )
      .bind(from, to)
      .first<{ n: number; cents: number }>(),
    env.DB.prepare(
      `SELECT COUNT(*) AS n, COALESCE(SUM(amount_cents), 0) AS cents FROM refunds
        WHERE created_at >= ?1 AND created_at < ?2 AND reason NOT IN ('region', 'dispute')`,
    )
      .bind(from, to)
      .first<{ n: number; cents: number }>(),
    env.DB.prepare(
      `SELECT COUNT(*) AS n FROM webhook_events
        WHERE type = 'charge.dispute.created' AND received_at >= ?1 AND received_at < ?2`,
    )
      .bind(from, to)
      .first<{ n: number }>(),
  ])
  return {
    day,
    events: Object.fromEntries(events.results.map((r) => [r.name, r.n])),
    grades: {
      writing: grades?.writing ?? 0,
      speaking: grades?.speaking ?? 0,
      free: grades?.free ?? 0,
      refused: grades?.refused ?? 0,
    },
    costUsd: (grades?.cost ?? 0) / 1e6,
    purchases: { paid: purchases?.n ?? 0, grossCents: purchases?.cents ?? 0 },
    refunds: { count: refunds?.n ?? 0, cents: refunds?.cents ?? 0 },
    disputes: disputes?.n ?? 0,
  }
}

/** Daily job: retention purge, housekeeping, then yesterday's metrics row. */
export async function runDaily(env: Env, now: Date): Promise<DailyMetrics> {
  const nowIso = now.toISOString()
  const cutoff = addDays(now, -RETENTION_DAYS).toISOString()
  const today = startOfUtcDay(now)
  const [grades, links, sessions, ipUsage, deviceUsage, tickets] = await env.DB.batch([
    // Essays/transcripts go RETENTION_DAYS after the owner's last activity; cost rows stay for accounting.
    env.DB.prepare(
      `UPDATE grades SET input_text = NULL, result_json = NULL
        WHERE created_at < ?1 AND (input_text IS NOT NULL OR result_json IS NOT NULL)
          AND (user_id IS NULL OR user_id IN (SELECT id FROM users WHERE last_active_at < ?1))`,
    ).bind(cutoff),
    env.DB.prepare('DELETE FROM magic_links WHERE created_at < ?1').bind(addDays(now, -1).toISOString()),
    env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?1').bind(nowIso),
    env.DB.prepare("DELETE FROM free_usage WHERE kind = 'ip' AND day < ?1").bind(dayKey(addDays(today, -2))),
    // the device cookie lives 400 days, so its free-sample record is useless after that
    env.DB.prepare("DELETE FROM free_usage WHERE kind = 'device' AND day < ?1").bind(dayKey(addDays(today, -400))),
    env.DB.prepare(
      "UPDATE support_tickets SET message = '[purged]' WHERE created_at < ?1 AND message != '[purged]'",
    ).bind(cutoff),
  ])
  console.log('daily retention', {
    gradesPurged: grades?.meta.changes ?? 0,
    magicLinks: links?.meta.changes ?? 0,
    sessions: sessions?.meta.changes ?? 0,
    ipUsage: ipUsage?.meta.changes ?? 0,
    deviceUsage: deviceUsage?.meta.changes ?? 0,
    tickets: tickets?.meta.changes ?? 0,
  })

  const metrics = await dailyMetrics(env, addDays(today, -1))
  await env.DB.prepare('INSERT OR REPLACE INTO metrics_daily (day, json, created_at) VALUES (?1, ?2, ?3)')
    .bind(metrics.day, JSON.stringify(metrics), nowIso)
    .run()
  console.log('daily metrics written', {
    events: Object.values(metrics.events).reduce((a, b) => a + b, 0),
    grades: metrics.grades.writing + metrics.grades.speaking,
    purchases: metrics.purchases.paid,
  })
  return metrics
}
