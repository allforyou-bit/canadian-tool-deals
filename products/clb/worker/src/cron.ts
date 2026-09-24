// Scheduled work (wrangler.jsonc triggers). Every 15 min: spend tiers → kill switches (memo B10) and the
// prepaid-credit ledger (memo §7.2 Z6), pause tracking and pass extensions (decision 12), and closing grade
// rows stuck in `pending` (decision 2). Daily 05:00 UTC: retention purge (memo §4.1) and one aggregate
// metrics row for yesterday (memo B8).
// Workers Free (memo §7.2 Z2): KV allows 1,000 writes a day, so every KV write here is caught and logged
// instead of aborting the run, and the "alert sent" guards live in D1 (webhook_events), so a KV quota error
// can never make the owner's alert repeat every 15 minutes.
// Logs carry counts only — never emails, essays or ids.
import { PREPAID, RETENTION_DAYS, SPEND } from '../../shared/config'
import { MAGIC_LINK_USAGE_KIND } from './auth'
import { alertOwner } from './email'
import type { Env } from './env'
import { EVENT_USAGE_KINDS } from './events'
import { getFlags, setFlag } from './lib/flags'
import { evaluateTiers, prepaidConfig, spendSnapshot, type SpendSnapshot } from './lib/spend'
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
   * a grade handler switched grading off because Anthropic refused a call for lack of credit (grading/claude.ts
   * isCreditExhausted). JSON CreditsOutMarker. Unlike `auto:grading_off`, the spend monitor never lifts this pause
   * on its own spend figures: only a recorded top-up (the prepaid amount or date changed) or the owner's switch.
   */
  creditsOut: 'auto:grading_off_credits',
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

/** webhook_events.type of the rows that record an owner alert as sent (kept: a few rows a day at most) */
export const ALERT_GUARD_TYPE = 'cron_alert'

/** webhook_events.id of each alert guard: one alert per id, ever. */
export const ALERT_GUARDS = {
  /** free samples switched off by the spend monitor: once per UTC day while it lasts */
  freeOff: (day: string) => `alert:freeoff:${day}`,
  /** grading paused over the daily cap: once per UTC day */
  pause: (day: string) => `alert:pause:${day}`,
  /** grading paused because the prepaid credits are nearly used: once per UTC day until the top-up */
  prepaidPause: (day: string) => `alert:prepaid-pause:${day}`,
  /** grading paused because Anthropic refused a call for lack of credit: once per UTC day while it lasts */
  creditsOut: (day: string) => `alert:credits-out:${day}`,
  /** month spend at SPEND.alertAt of L: once per month */
  tier95: (month: string) => `alert:tier95:${month}`,
  /** a PREPAID.alertAt level of one top-up (amount and date): once per level and top-up */
  prepaid: (since: string, usd: number, level: number) => `alert:prepaid:${since}:${usd}:${level}`,
} as const

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
    ...(s.prepaidUsd !== null && s.spentSincePrepaidUsd !== null
      ? [
          `Prepaid credits: ${usd(s.spentSincePrepaidUsd)} of ${usd(s.prepaidUsd)} used since ${(s.prepaidSince ?? '').slice(0, 10)}` +
            ` (${pct(s.spentSincePrepaidUsd / s.prepaidUsd)}; ${usd(s.prepaidInFlightUsd ?? 0)} more in calls still running)`,
        ]
      : []),
  ].join('\n')
}

/**
 * Sends an owner alert once per guard id. The guard row is claimed in D1 before sending (so overlapping
 * runs cannot both send) and released when the email was not delivered, so a failed send is retried on
 * the next run. Returns true when this call sent the alert.
 */
async function alertOnce(env: Env, guardId: string, now: Date, subject: string, text: string): Promise<boolean> {
  const claim = await env.DB.prepare('INSERT OR IGNORE INTO webhook_events (id, type, received_at) VALUES (?1, ?2, ?3)')
    .bind(guardId, ALERT_GUARD_TYPE, now.toISOString())
    .run()
  if (claim.meta.changes !== 1) return false
  if (await alertOwner(env, subject, text)) return true
  await env.DB.prepare('DELETE FROM webhook_events WHERE id = ?1').bind(guardId).run()
  return false
}

/** A KV write or delete that never throws (free plan: 1,000 a day, one per key per second). False on failure. */
async function kvWrite(what: string, op: () => Promise<unknown>): Promise<boolean> {
  try {
    await op()
    return true
  } catch {
    console.warn('cron kv write failed', what)
    return false
  }
}

/** Value of KV.creditsOut. */
export interface CreditsOutMarker {
  /** ISO time a grade handler recorded the credits pause */
  at: string
  /** prepaidLedgerKey(env) at that time; a different value later means a top-up has been deployed */
  ledger: string
}

/** The prepaid ledger in force: `<ANTHROPIC_PREPAID_SINCE>|<ANTHROPIC_PREPAID_USD>`, or 'none' while it is off. */
export function prepaidLedgerKey(env: Env): string {
  const p = prepaidConfig(env)
  return p ? `${p.since}|${p.usd}` : 'none'
}

/**
 * KV is eventually consistent across locations, so a cron run shortly after a handler's credits pause may still
 * read grading as on [unverified: KV propagation time, prior knowledge of Cloudflare's KV docs]. Within this many
 * minutes of the marker, "grading on" is read as the handler's switch-off not having arrived yet; after it, as the
 * owner having switched grading back on.
 */
export const CREDITS_SETTLE_MINUTES = 5

/** An unreadable marker (never written by this code) is held until the owner switches grading on. */
function parseCreditsMarker(raw: string, env: Env): CreditsOutMarker {
  try {
    const v = JSON.parse(raw) as Partial<CreditsOutMarker> | null
    if (v && typeof v.at === 'string' && typeof v.ledger === 'string') return { at: v.at, ledger: v.ledger }
  } catch {
    // fall through
  }
  return { at: '', ledger: prepaidLedgerKey(env) }
}

/** Subject of the credits-pause alert; it names the credits, so the daily Routine files it under the top-up issue. */
export const CREDITS_OUT_SUBJECT = 'Grading paused (Anthropic credits used up)'

function creditsOutText(s: SpendSnapshot | null): string {
  return [
    'Anthropic refused a grading call because the prepaid credit balance is used up or a usage limit in the',
    'Anthropic Console is reached, so grading is paused. The refused call cost nothing, any free sample was given',
    'back, learners see the pause notice, and active and queued passes are extended by the length of the pause.',
    'Eval runs, staging checks and level-B runs spend the same credits, which the Worker cannot count, so the',
    "balance can run out before the Worker's own count says so.",
    '\n\nTo resume: buy credits in the Anthropic Console (leave auto-reload off), reply in the GitHub issue',
    '"Anthropic credits: top up" with the balance the Console shows now, and merge the pull request the daily',
    'Routine opens. Grading resumes by itself once the new prepaid amount and date are deployed. If a Console',
    'usage limit was the cause instead, raise it, then switch grading back on with the "Set a kill switch"',
    'workflow (grading_enabled = true).',
    ...(s ? [`\n\n${describe(s)}`] : []),
  ].join(' ')
}

/**
 * The credits-pause alert, once per UTC day (D1 guard, like the monitor's own alerts). The spend snapshot for
 * the text is read only when today's alert has not been sent yet.
 */
async function alertCreditsOut(env: Env, now: Date, snapshot?: SpendSnapshot): Promise<void> {
  const guardId = ALERT_GUARDS.creditsOut(dayKey(now))
  if (await env.DB.prepare('SELECT 1 AS x FROM webhook_events WHERE id = ?1').bind(guardId).first()) return
  let s: SpendSnapshot | null = snapshot ?? null
  if (!s) {
    try {
      s = await spendSnapshot(env, now)
    } catch {
      s = null
    }
  }
  await alertOnce(env, guardId, now, CREDITS_OUT_SUBJECT, creditsOutText(s))
}

/**
 * Pauses grading because Anthropic refused a call for lack of credit (grading/index.ts, isCreditExhausted). The
 * same steps as the spend monitor's own pause — the marker first, then the switch — with the credits marker
 * (KV.creditsOut), which runSpendMonitor lifts only after a deployed top-up or the owner's switch; then the pause
 * start (passes are extended by the pause) and the owner alert, once per UTC day. Never throws: KV writes are
 * caught (Workers Free quota) and anything else is logged, so the handler can still answer grading_paused.
 */
export async function pauseGradingForCredits(env: Env, now: Date): Promise<void> {
  try {
    if ((await env.FLAGS.get(KV.creditsOut)) === null) {
      const marker: CreditsOutMarker = { at: now.toISOString(), ledger: prepaidLedgerKey(env) }
      await kvWrite('credits_out', () => env.FLAGS.put(KV.creditsOut, JSON.stringify(marker)))
    }
    if ((await getFlags(env)).grading_enabled && (await kvWrite('grading_enabled', () => setFlag(env, 'grading_enabled', false)))) {
      console.log('grading paused: Anthropic credits used up')
    }
    await recordPauseStart(env, now)
    await alertCreditsOut(env, now)
  } catch {
    console.warn('credits pause incomplete')
  }
}

/**
 * Spend monitor (every 15 min). The cron only undoes what it did itself: free samples come back on only
 * when `auto:free_off` is present and grading only when `auto:grading_off` is, and never while the
 * owner's marker for that flag is 'false'. While the cron holds a switch off, the owner gets at most one
 * alert per UTC day (a failed send is retried next run). The `auto:*` marker is written before the switch,
 * so a failed switch write is simply retried next run, and the marker is removed only after the switch
 * is back on.
 *
 * Separately, ANY period with grading off is a pause (decision 12): the first run that sees grading off
 * records `pause:started_at` (unless a grade handler already did), and the first run that sees it on
 * again extends passes by the pause length, exactly once.
 *
 * Prepaid credits (memo §7.2 Z6, when ANTHROPIC_PREPAID_USD/_SINCE are set): free samples off at
 * PREPAID.freeOffAt, one alert per PREPAID.alertAt level and top-up, and grading paused at PREPAID.pauseAt
 * until the owner tops up (evaluateTiers decides; this applies it).
 *
 * A credits pause (KV.creditsOut: Anthropic itself refused a call for lack of credit, pauseGradingForCredits) is
 * never lifted on the Worker's own spend figures, which cannot see eval or staging spend: grading comes back on
 * only when the prepaid amount or date differs from the one recorded with the pause (a top-up was deployed;
 * handed to `auto:grading_off` if a spend tier still pauses) or when the owner has switched grading on. While it
 * holds, `auto:grading_off` never switches grading on, and the owner gets one reminder per UTC day.
 */
export async function runSpendMonitor(env: Env, now: Date): Promise<void> {
  await sweepStalePending(env, now, addDays(now, -2))
  const s = await spendSnapshot(env, now)
  const t = evaluateTiers(s)
  const flags = await getFlags(env)
  const day = dayKey(now)
  const [autoFreeOff, autoGradingOff, ownerFree, ownerGrading, pauseStartedAt, creditsOutRaw] = await Promise.all([
    env.FLAGS.get(KV.autoFreeOff),
    env.FLAGS.get(KV.autoGradingOff),
    env.FLAGS.get(ownerMarker('free_enabled')),
    env.FLAGS.get(ownerMarker('grading_enabled')),
    env.FLAGS.get(KV.pauseStartedAt),
    env.FLAGS.get(KV.creditsOut),
  ])

  if (t.freeOff) {
    if (flags.free_enabled) {
      await kvWrite('auto_free_off', () => env.FLAGS.put(KV.autoFreeOff, '1'))
      if (await kvWrite('free_enabled', () => setFlag(env, 'free_enabled', false))) console.log('spend monitor: free samples off')
    }
    if (flags.free_enabled || autoFreeOff) {
      await alertOnce(
        env,
        ALERT_GUARDS.freeOff(day),
        now,
        'Free samples switched off (spend)',
        [
          `Free samples are switched off automatically (month spend is at least ${pct(SPEND.freeOffAt)} of L,`,
          `the free budget is used up, or ${pct(PREPAID.freeOffAt)} of the prepaid credits are used).`,
          'Paid grading is not affected. Free samples come back on by themselves',
          `once spend is below the thresholds again.\n\n${describe(s)}`,
        ].join(' '),
      )
    }
  } else if (autoFreeOff) {
    // The owner's explicit "off" (flags.yml) outlives the cron's own switch-off.
    let restored = true
    if (!flags.free_enabled && ownerFree !== 'false') {
      restored = await kvWrite('free_enabled', () => setFlag(env, 'free_enabled', true))
      if (restored) console.log('spend monitor: free samples back on')
    }
    if (restored) await kvWrite('auto_free_off', () => env.FLAGS.delete(KV.autoFreeOff))
  }

  let gradingOn = flags.grading_enabled
  let creditsHold = false
  if (creditsOutRaw !== null) {
    const marker = parseCreditsMarker(creditsOutRaw, env)
    const markedMs = Date.parse(marker.at)
    const settled = !Number.isFinite(markedMs) || now.getTime() - markedMs >= CREDITS_SETTLE_MINUTES * 60_000
    if (marker.ledger !== prepaidLedgerKey(env)) {
      // a top-up was deployed: switch grading back on (or hand it to the spend pause), unless the owner said off
      let handed = true
      if (!gradingOn && ownerGrading !== 'false') {
        if (t.pauseGrading) {
          handed = await kvWrite('auto_grading_off', () => env.FLAGS.put(KV.autoGradingOff, '1'))
        } else {
          handed = await kvWrite('grading_enabled', () => setFlag(env, 'grading_enabled', true))
          if (handed) {
            gradingOn = true
            console.log('spend monitor: grading resumed after a credit top-up')
          }
        }
      }
      if (handed) await kvWrite('credits_out', () => env.FLAGS.delete(KV.creditsOut))
      else creditsHold = true
    } else if (gradingOn && settled) {
      // the owner switched grading back on (flags.yml): the credits pause is over
      await kvWrite('credits_out', () => env.FLAGS.delete(KV.creditsOut))
    } else {
      creditsHold = true
      if (!gradingOn) await alertCreditsOut(env, now, s)
    }
  }

  if (t.pauseGrading) {
    if (gradingOn) {
      await kvWrite('auto_grading_off', () => env.FLAGS.put(KV.autoGradingOff, '1'))
      if (await kvWrite('grading_enabled', () => setFlag(env, 'grading_enabled', false))) {
        gradingOn = false
        console.log('spend monitor: grading paused')
      }
    }
    if (flags.grading_enabled || autoGradingOff) {
      if (t.prepaidPause) {
        await alertOnce(
          env,
          ALERT_GUARDS.prepaidPause(day),
          now,
          'Grading paused (prepaid credits nearly used)',
          [
            `The prepaid Anthropic credits are ${pct(PREPAID.pauseAt)} used, counting calls still running, so grading`,
            'is paused before a call could fail half-way. To resume: buy more credits in the Anthropic Console, then',
            'update the prepaid amount and date in ops/config/anthropic-limit.json and deploy. Grading resumes by itself',
            `after that, and active and queued passes are extended by the length of the pause.\n\n${describe(s)}`,
          ].join(' '),
        )
      } else {
        await alertOnce(
          env,
          ALERT_GUARDS.pause(day),
          now,
          'Grading paused (daily spend cap)',
          [
            "Today's spend is above the daily cap, so grading is paused until 00:00 UTC. It resumes by itself,",
            `and active and queued passes are extended by the length of the pause.\n\n${describe(s)}`,
          ].join(' '),
        )
      }
    }
  } else if (autoGradingOff) {
    // a credits pause outlives the spend monitor's own pause: the marker goes, grading stays off
    let restored = true
    if (!gradingOn && ownerGrading !== 'false' && !creditsHold) {
      restored = await kvWrite('grading_enabled', () => setFlag(env, 'grading_enabled', true))
      if (restored) {
        gradingOn = true
        console.log('spend monitor: grading resumed')
      }
    }
    if (restored) await kvWrite('auto_grading_off', () => env.FLAGS.delete(KV.autoGradingOff))
  }

  // a fresh credits pause counts as off even if this run still reads grading on (KV propagation)
  if (!gradingOn || creditsHold) {
    if (!pauseStartedAt) await recordPauseStart(env, now)
  } else if (pauseStartedAt) {
    await extendPassesForPause(env, pauseStartedAt, now)
    // if this delete fails, the next run finds the extension already done (D1 marker) and tries again
    await kvWrite('pause_started_at', () => env.FLAGS.delete(KV.pauseStartedAt))
  }

  if (t.alert) {
    await alertOnce(
      env,
      ALERT_GUARDS.tier95(day.slice(0, 7)),
      now,
      `Spend at ${pct(SPEND.alertAt)} of the monthly limit`,
      [
        `Anthropic spend this month has reached ${pct(SPEND.alertAt)} of L.`,
        `Raise the Anthropic monthly limit or keep free samples off.\n\n${describe(s)}`,
      ].join(' '),
    )
  }

  if (t.prepaidAlert !== null && s.prepaidSince !== null && s.prepaidUsd !== null) {
    await alertOnce(
      env,
      ALERT_GUARDS.prepaid(s.prepaidSince, s.prepaidUsd, t.prepaidAlert),
      now,
      `Prepaid Anthropic credits ${pct(t.prepaidAlert)} used`,
      [
        `Grading has used at least ${pct(t.prepaidAlert)} of the ${usd(s.prepaidUsd)} Anthropic credits bought on`,
        `${s.prepaidSince.slice(0, 10)} (counted on the high side). Free samples switch off at ${pct(PREPAID.freeOffAt)}`,
        `and grading pauses at ${pct(PREPAID.pauseAt)}. To keep going, buy more credits in the Anthropic Console`,
        '(leave auto-reload off) and update the prepaid amount and date in ops/config/anthropic-limit.json.',
        `\n\n${describe(s)}`,
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
  /**
   * events whose stored utm showed a paid click. No longer written: there are no ads (memo §7.2 Z1), so the
   * field is always absent now; kept optional so older metrics rows still parse.
   */
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
  const [events, grades, outcomes, purchases, refunds, disputes] = await Promise.all([
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
      `SELECT COUNT(DISTINCT purchase_id) AS n, COALESCE(SUM(amount_cents), 0) AS cents FROM refunds
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
  const [grades, gradeDevices, links, sessions, ipUsage, deviceUsage, tickets, eventCounters, linkCounters, oauthStates] = await env.DB.batch([
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
    // event budgets count per UTC day: only today's rows are ever read
    env.DB.prepare('DELETE FROM free_usage WHERE kind IN (?1, ?2) AND day < ?3').bind(
      EVENT_USAGE_KINDS.device,
      EVENT_USAGE_KINDS.ip,
      dayKey(today),
    ),
    // sign-in link sends (`day` holds the send time): the hourly limit looks back one hour
    env.DB.prepare('DELETE FROM free_usage WHERE kind = ?1 AND day < ?2').bind(MAGIC_LINK_USAGE_KIND, addDays(now, -1).toISOString()),
    // Google sign-in round trips live 10 minutes (used ones hold nothing further of use)
    env.DB.prepare('DELETE FROM oauth_states WHERE expires_at < ?1').bind(nowIso),
  ])
  console.log('daily retention', {
    gradesPurged: grades?.meta.changes ?? 0,
    gradeDeviceHashes: gradeDevices?.meta.changes ?? 0,
    magicLinks: links?.meta.changes ?? 0,
    sessions: sessions?.meta.changes ?? 0,
    ipUsage: ipUsage?.meta.changes ?? 0,
    deviceUsage: deviceUsage?.meta.changes ?? 0,
    tickets: tickets?.meta.changes ?? 0,
    eventCounters: eventCounters?.meta.changes ?? 0,
    linkCounters: linkCounters?.meta.changes ?? 0,
    oauthStates: oauthStates?.meta.changes ?? 0,
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
