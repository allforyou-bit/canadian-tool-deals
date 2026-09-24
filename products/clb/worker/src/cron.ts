// Scheduled work (wrangler.jsonc triggers). Every 15 min: spend tiers → kill switches (memo B10), pause
// tracking and pass extensions (decision 12), and closing grade rows stuck in `pending` (decision 2).
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
  /** the spend monitor switched free samples off; only then does it switch them back on */
  autoFreeOff: 'auto:free_off',
  /** the spend monitor switched grading off; only then does it switch it back on */
  autoGradingOff: 'auto:grading_off',
  /**
   * ISO time grading was first seen off, whatever the cause (spend monitor, the owner's switch, or a
   * grade handler's live spend check). Removed once passes are extended for the pause (decision 12).
   */
  pauseStartedAt: 'pause:started_at',
} as const

/** flags.yml writes `owner:<flag>` = 'true' | 'false' whenever the owner sets the switch; 'false' is never undone here. */
export function ownerMarker(flag: 'free_enabled' | 'grading_enabled'): string {
  return `owner:${flag}`
}

/** Grade requests still pending after this long are closed as failed (the model call cannot still be running). */
export const PENDING_TIMEOUT_MINUTES = 15

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

/**
 * Records the start of a grading pause unless one is already recorded. The grade handlers call this the
 * first time a live spend check refuses, so the pause is counted from then rather than from the next
 * cron run; the cron calls it whenever it sees grading switched off.
 */
export async function recordPauseStart(env: Env, now: Date): Promise<void> {
  if (await env.FLAGS.get(KV.pauseStartedAt)) return
  try {
    await env.FLAGS.put(KV.pauseStartedAt, now.toISOString())
  } catch {
    // KV allows one write per second per key: a concurrent writer recorded (almost) the same time
    console.warn('pause start write failed')
  }
}

/**
 * Closes grade rows whose model call never reported back (decision 2): pending → refused/failed, which
 * frees the reserved cap slot. `since` bounds the scan (null: all rows, used by the daily job).
 */
async function sweepStalePending(env: Env, now: Date, since: Date | null): Promise<void> {
  const before = new Date(now.getTime() - PENDING_TIMEOUT_MINUTES * 60_000).toISOString()
  const res = await env.DB.prepare(
    `UPDATE grades SET pending = 0, refused = 1, outcome = 'failed'
      WHERE pending = 1 AND created_at < ?1 AND created_at >= ?2`,
  )
    .bind(before, since ? since.toISOString() : '')
    .run()
  if (res.meta.changes > 0) console.log('stale pending grades closed', { rows: res.meta.changes })
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
 * Spend monitor (every 15 min). The cron only undoes what it did itself: free samples come back on only
 * when `auto:free_off` is present and grading only when `auto:grading_off` is, and never while the
 * owner's marker for that flag is 'false'. While the cron holds a switch off, the owner gets at most one
 * alert per UTC day (a failed send is retried next run).
 *
 * Separately, ANY period with grading off is a pause (decision 12): the first run that sees grading off
 * records `pause:started_at` (unless a grade handler already did), and the first run that sees it on
 * again extends passes by the pause length, exactly once.
 */
export async function runSpendMonitor(env: Env, now: Date): Promise<void> {
  await sweepStalePending(env, now, addDays(now, -2))
  const s = await spendSnapshot(env, now)
  const t = evaluateTiers(s)
  const flags = await getFlags(env)
  const day = dayKey(now)
  const [autoFreeOff, autoGradingOff, ownerFree, ownerGrading, pauseStartedAt] = await Promise.all([
    env.FLAGS.get(KV.autoFreeOff),
    env.FLAGS.get(KV.autoGradingOff),
    env.FLAGS.get(ownerMarker('free_enabled')),
    env.FLAGS.get(ownerMarker('grading_enabled')),
    env.FLAGS.get(KV.pauseStartedAt),
  ])

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
    // The owner's explicit "off" (flags.yml) outlives the cron's own switch-off.
    if (!flags.free_enabled && ownerFree !== 'false') {
      await setFlag(env, 'free_enabled', true)
      console.log('spend monitor: free samples back on')
    }
    await env.FLAGS.delete(KV.autoFreeOff)
  }

  let gradingOn = flags.grading_enabled
  if (t.pauseGrading) {
    if (gradingOn) {
      await setFlag(env, 'grading_enabled', false)
      await env.FLAGS.put(KV.autoGradingOff, '1')
      gradingOn = false
      console.log('spend monitor: grading paused')
    }
    if (flags.grading_enabled || autoGradingOff) {
      await alertOnce(
        env,
        `alerted:pause:${day}`,
        TWO_DAYS_SECONDS,
        'Grading paused (daily spend cap)',
        [
          "Today's spend is above the daily cap, so grading is paused until 00:00 UTC. It resumes by itself,",
          `and active and queued passes are extended by the length of the pause.\n\n${describe(s)}`,
        ].join(' '),
      )
    }
  } else if (autoGradingOff) {
    if (!gradingOn && ownerGrading !== 'false') {
      await setFlag(env, 'grading_enabled', true)
      gradingOn = true
      console.log('spend monitor: grading resumed')
    }
    await env.FLAGS.delete(KV.autoGradingOff)
  }

  if (!gradingOn) {
    if (!pauseStartedAt) await recordPauseStart(env, now)
  } else if (pauseStartedAt) {
    await extendPassesForPause(env, pauseStartedAt, now)
    await env.FLAGS.delete(KV.pauseStartedAt)
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

export interface PassDates {
  id: string
  user_id: string
  starts_at: string
  ends_at: string
}

export interface PassShift {
  id: string
  fromStart: string
  fromEnd: string
  toStart: string
  toEnd: string
}

/**
 * New dates after a pause from `pausedMs` to `resumedMs`, so every pass keeps the usable time it had:
 * time before the pause is untouched; the rest of a pass that was running at the pause, and the whole
 * of a pass that began during it, restart at the resume; passes queued behind move back so each user's
 * queue stays contiguous. `passes` are unrevoked passes ending after the pause began, ordered by user
 * and start. Passes whose dates do not change are left out.
 */
export function pauseShifts(passes: PassDates[], pausedMs: number, resumedMs: number): PassShift[] {
  const out: PassShift[] = []
  let user: string | null = null
  let cursor = Number.NEGATIVE_INFINITY
  for (const p of passes) {
    if (p.user_id !== user) {
      user = p.user_id
      cursor = Number.NEGATIVE_INFINITY
    }
    const start = Date.parse(p.starts_at)
    const end = Date.parse(p.ends_at)
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= pausedMs) continue
    // the part of the pass the pause took away (or delayed) begins here
    const lostFrom = Math.max(start, pausedMs)
    const restart = Math.max(lostFrom <= resumedMs ? resumedMs : lostFrom, cursor)
    const newEnd = restart + (end - lostFrom)
    const newStart = start <= pausedMs ? start : restart
    cursor = newEnd
    if (newStart === start && newEnd === end) continue
    out.push({
      id: p.id,
      fromStart: p.starts_at,
      fromEnd: p.ends_at,
      toStart: new Date(newStart).toISOString(),
      toEnd: new Date(newEnd).toISOString(),
    })
  }
  return out
}

/**
 * Extends passes for the pause that began at `pausedAt` and ended by `now` — exactly once per pause,
 * even if this runs twice or concurrently. New dates are computed here (pauseShifts) and sent as one
 * JSON parameter, so the whole extension is a single UPDATE however many passes there are. It shares a
 * D1 batch (one SQL transaction: cloudflare-docs d1/worker-api/d1-database.mdx, 2026-09-24) with the
 * marker row `webhook_events.id = 'pause-ext:<pausedAt>'`: the UPDATE applies only while the marker is
 * absent and the marker is inserted after it, so only the first batch to commit extends anything, and
 * `meta.changes === 1` on the marker says this run did it. Each pass is also compare-and-set on the
 * dates read here, so a pass that billing changed in the meantime is never overwritten with stale values.
 */
async function extendPassesForPause(env: Env, pausedAt: string, now: Date): Promise<void> {
  const pausedMs = Date.parse(pausedAt)
  if (!Number.isFinite(pausedMs) || now.getTime() <= pausedMs) {
    console.warn('pause extension skipped: unusable pause start')
    return
  }
  const guardId = `pause-ext:${pausedAt}`
  const done = await env.DB.prepare('SELECT 1 AS x FROM webhook_events WHERE id = ?1').bind(guardId).first()
  if (done) return

  const { results } = await env.DB.prepare(
    `SELECT id, user_id, starts_at, ends_at FROM passes
      WHERE revoked_at IS NULL AND ends_at > ?1
      ORDER BY user_id, starts_at, ends_at`,
  )
    .bind(pausedAt)
    .all<PassDates>()
  const shifts = pauseShifts(results, pausedMs, now.getTime())
  const [update, marker] = await env.DB.batch([
    env.DB.prepare(
      `WITH ext (id, old_start, old_end, new_start, new_end) AS (
         SELECT json_extract(value, '$.id'), json_extract(value, '$.fromStart'), json_extract(value, '$.fromEnd'),
                json_extract(value, '$.toStart'), json_extract(value, '$.toEnd')
           FROM json_each(?1)
       )
       UPDATE passes
          SET starts_at = (SELECT new_start FROM ext WHERE ext.id = passes.id),
              ends_at = (SELECT new_end FROM ext WHERE ext.id = passes.id)
        WHERE revoked_at IS NULL
          AND EXISTS (SELECT 1 FROM ext WHERE ext.id = passes.id
                        AND ext.old_start = passes.starts_at AND ext.old_end = passes.ends_at)
          AND NOT EXISTS (SELECT 1 FROM webhook_events WHERE id = ?2)`,
    ).bind(JSON.stringify(shifts), guardId),
    env.DB.prepare(
      "INSERT OR IGNORE INTO webhook_events (id, type, received_at) VALUES (?1, 'cron_pause_extension', ?2)",
    ).bind(guardId, now.toISOString()),
  ])
  if (marker?.meta.changes === 1) {
    console.log('passes extended after grading pause', {
      passes: update?.meta.changes ?? 0,
      candidates: shifts.length,
      minutes: Math.round((now.getTime() - pausedMs) / 60_000),
    })
  }
}

export interface DailyMetrics {
  day: string
  events: Record<string, number>
  /** events whose stored utm shows a paid click (gclid or utm_medium=cpc); K3 counts paid sample starts. Optional: files written before 2026-09-24 lack it */
  paidEvents?: Record<string, number>
  /** writing/speaking/free count graded (non-refused) tasks; refused counts requests that gave no feedback (refusals, failures) */
  grades: { writing: number; speaking: number; free: number; refused: number }
  /** grade rows by outcome (graded, scope_refused, safety_refused, failed, no_speech, too_long). Optional: files written before 2026-09-24 lack it */
  outcomes?: Record<string, number>
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
  const [events, paidEvents, grades, outcomes, purchases, refunds, disputes] = await Promise.all([
    env.DB.prepare('SELECT name, COUNT(*) AS n FROM events WHERE day = ?1 GROUP BY name ORDER BY name')
      .bind(day)
      .all<{ name: string; n: number }>(),
    env.DB.prepare(
      `SELECT name, COUNT(*) AS n FROM events
        WHERE day = ?1 AND utm_json IS NOT NULL
          AND (json_extract(utm_json, '$.gclid') IS NOT NULL OR json_extract(utm_json, '$.utm_medium') = 'cpc')
        GROUP BY name ORDER BY name`,
    )
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
      `SELECT COALESCE(outcome, CASE WHEN pending = 1 THEN 'pending' ELSE 'unknown' END) AS outcome, COUNT(*) AS n
         FROM grades WHERE created_at >= ?1 AND created_at < ?2
        GROUP BY 1 ORDER BY 1`,
    )
      .bind(from, to)
      .all<{ outcome: string; n: number }>(),
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
    paidEvents: Object.fromEntries(paidEvents.results.map((r) => [r.name, r.n])),
    grades: {
      writing: grades?.writing ?? 0,
      speaking: grades?.speaking ?? 0,
      free: grades?.free ?? 0,
      refused: grades?.refused ?? 0,
    },
    outcomes: Object.fromEntries(outcomes.results.map((r) => [r.outcome, r.n])),
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
  // yesterday's metrics must not count a row still marked pending (unbounded here, once a day)
  await sweepStalePending(env, now, null)
  const [grades, gradeDevices, links, sessions, ipUsage, deviceUsage, tickets] = await env.DB.batch([
    // Essays/transcripts go RETENTION_DAYS after the owner's last activity; cost rows stay for accounting.
    env.DB.prepare(
      `UPDATE grades SET input_text = NULL, result_json = NULL
        WHERE created_at < ?1 AND (input_text IS NOT NULL OR result_json IS NOT NULL)
          AND (user_id IS NULL OR user_id IN (SELECT id FROM users WHERE last_active_at < ?1))`,
    ).bind(cutoff),
    // grades no longer store the device hash; rows written before that lose it after RETENTION_DAYS
    env.DB.prepare('UPDATE grades SET device_hash = NULL WHERE created_at < ?1 AND device_hash IS NOT NULL').bind(cutoff),
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
    gradeDeviceHashes: gradeDevices?.meta.changes ?? 0,
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
