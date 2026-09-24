import { createScheduledController } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Env } from '../../src/env'
import {
  ALERT_GUARD_TYPE,
  ALERT_GUARDS,
  DAILY_CRON,
  handleScheduled,
  KV,
  ownerMarker,
  pauseShifts,
  recordPauseStart,
  runDaily,
  runSpendMonitor,
  SPEND_CRON,
} from '../../src/cron'
import { getFlags } from '../../src/lib/flags'
import { count, stubFetch, type FetchStub } from './helpers'

let seq = 0
const id = (p: string) => `${p}_${++seq}`

function at(iso: string): Date {
  return new Date(iso)
}

function schedule(cron: string, now: Date): Promise<void> {
  return handleScheduled(createScheduledController({ scheduledTime: now, cron }), env)
}

async function insertGrade(g: {
  createdAt: string
  costMicro?: number
  userId?: string | null
  kind?: 'writing' | 'speaking'
  free?: boolean
  refused?: boolean
  text?: string | null
  pending?: boolean
  outcome?: string | null
  deviceHash?: string | null
}): Promise<string> {
  const gid = id('g')
  await env.DB.prepare(
    `INSERT INTO grades (id, user_id, device_hash, task_id, prompt_index, kind, input_text, result_json, free, refused,
                         pending, outcome, model, cost_micro_usd, created_at)
     VALUES (?1, ?2, ?3, 'w1', 0, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 'claude-opus-5', ?11, ?12)`,
  )
    .bind(
      gid,
      g.userId ?? null,
      g.deviceHash ?? null,
      g.kind ?? 'writing',
      g.text === undefined ? 'essay' : g.text,
      g.text === null ? null : '{"refused":false}',
      g.free ? 1 : 0,
      g.refused ? 1 : 0,
      g.pending ? 1 : 0,
      g.outcome === undefined ? (g.pending ? null : g.refused ? 'scope_refused' : 'graded') : g.outcome,
      g.costMicro ?? 0,
      g.createdAt,
    )
    .run()
  return gid
}

async function gradeRow(gid: string) {
  return env.DB.prepare('SELECT pending, refused, outcome, device_hash FROM grades WHERE id = ?1')
    .bind(gid)
    .first<{ pending: number; refused: number; outcome: string | null; device_hash: string | null }>()
}

async function insertUser(lastActiveAt: string): Promise<string> {
  const uid = id('u')
  await env.DB.prepare(
    `INSERT INTO users (id, email, email_hash, created_at, last_active_at) VALUES (?1, ?2, 'hash', ?3, ?3)`,
  )
    .bind(uid, `${uid}@example.com`, lastActiveAt)
    .run()
  return uid
}

async function insertPass(userId: string, startsAt: string, endsAt: string, revoked = false): Promise<string> {
  const pid = id('p')
  await env.DB.prepare(
    `INSERT INTO passes (id, user_id, sku, starts_at, ends_at, purchase_id, revoked_at) VALUES (?1, ?2, 'pass30', ?3, ?4, ?5, ?6)`,
  )
    .bind(pid, userId, startsAt, endsAt, id('cs'), revoked ? startsAt : null)
    .run()
  return pid
}

async function passEnd(pid: string): Promise<string> {
  const row = await env.DB.prepare('SELECT ends_at FROM passes WHERE id = ?1').bind(pid).first<{ ends_at: string }>()
  return row!.ends_at
}

async function passDates(pid: string): Promise<[string, string]> {
  const row = await env.DB.prepare('SELECT starts_at, ends_at FROM passes WHERE id = ?1')
    .bind(pid)
    .first<{ starts_at: string; ends_at: string }>()
  return [row!.starts_at, row!.ends_at]
}

const plus = (iso: string, ms: number) => new Date(Date.parse(iso) + ms).toISOString()
const EXTENDED_LOG = 'passes extended after grading pause'

async function clearKv(): Promise<void> {
  const { keys } = await env.FLAGS.list()
  await Promise.all(keys.map((k) => env.FLAGS.delete(k.name)))
}

let stub: FetchStub
const alerts = () => stub.emails().filter((e) => e.to[0] === 'owner@coach.test')

beforeEach(async () => {
  await clearKv()
  await env.DB.batch(
    ['refunds', 'passes', 'purchases', 'grades', 'webhook_events', 'events', 'metrics_daily'].map((t) =>
      env.DB.prepare(`DELETE FROM ${t}`),
    ),
  )
  stub = stubFetch()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('spend monitor (*/15)', () => {
  it('at 90% of L turns free samples off while grading stays on; alerts once per day', async () => {
    // L = US$150 with no sales; 90% = US$135 spent earlier this month (today is quiet)
    await insertGrade({ createdAt: '2027-03-05T10:00:00.000Z', costMicro: 135_000_000 })
    await schedule(SPEND_CRON, at('2027-03-20T12:00:00.000Z'))

    const flags = await getFlags(env)
    expect(flags.free_enabled).toBe(false)
    expect(flags.grading_enabled).toBe(true)
    expect(await env.FLAGS.get(KV.autoFreeOff)).toBe('1')
    expect(alerts()).toHaveLength(1)
    expect(alerts()[0]?.subject).toContain('Free samples switched off')
    expect(alerts()[0]?.text).toContain('US$135.00')

    // owner turns free back on by hand; the cron turns it off again but does not re-alert today
    await env.FLAGS.put('flag:free_enabled', 'true')
    await schedule(SPEND_CRON, at('2027-03-20T12:15:00.000Z'))
    expect((await getFlags(env)).free_enabled).toBe(false)
    expect(alerts()).toHaveLength(1)
  })

  it('re-enables free samples once spend is below the threshold, but only if the cron turned them off', async () => {
    await insertGrade({ createdAt: '2027-03-05T10:00:00.000Z', costMicro: 120_000_000 })
    await runSpendMonitor(env, at('2027-03-31T23:45:00.000Z'))
    expect((await getFlags(env)).free_enabled).toBe(false)

    // new month: month-to-date spend is 0
    await runSpendMonitor(env, at('2027-04-01T00:00:00.000Z'))
    expect((await getFlags(env)).free_enabled).toBe(true)
    expect(await env.FLAGS.get(KV.autoFreeOff)).toBeNull()

    // an owner's manual "off" stays off
    await env.FLAGS.put('flag:free_enabled', 'false')
    await runSpendMonitor(env, at('2027-04-01T00:15:00.000Z'))
    expect((await getFlags(env)).free_enabled).toBe(false)
  })

  it("does not switch free samples back on when the owner's marker says off", async () => {
    await insertGrade({ createdAt: '2027-03-05T10:00:00.000Z', costMicro: 120_000_000 })
    await runSpendMonitor(env, at('2027-03-31T23:45:00.000Z'))
    expect(await env.FLAGS.get(KV.autoFreeOff)).toBe('1')
    // the owner switched free samples off with flags.yml while the cron held them off
    await env.FLAGS.put(ownerMarker('free_enabled'), 'false')
    await runSpendMonitor(env, at('2027-04-01T00:00:00.000Z'))
    expect((await getFlags(env)).free_enabled).toBe(false)
    expect(await env.FLAGS.get(KV.autoFreeOff)).toBeNull()
  })

  it('turns free samples off when the free budget for the day is used up', async () => {
    await insertGrade({ createdAt: '2027-03-10T09:00:00.000Z', costMicro: 2_000_000, free: true })
    await runSpendMonitor(env, at('2027-03-10T10:00:00.000Z'))
    const flags = await getFlags(env)
    expect(flags.free_enabled).toBe(false)
    expect(flags.grading_enabled).toBe(true)
  })

  it('pauses grading above the daily cap, then resumes next day and extends running and queued passes exactly once', async () => {
    const uid = await insertUser('2027-05-01T00:00:00.000Z')
    const active = await insertPass(uid, '2027-05-01T00:00:00.000Z', '2027-05-31T00:00:00.000Z')
    // bought a second pass: queued to start when the first ends
    const queued = await insertPass(uid, '2027-05-31T00:00:00.000Z', '2027-08-29T00:00:00.000Z')
    const active2 = await insertPass(await insertUser('2027-05-01T00:00:00.000Z'), '2027-04-20T08:30:00.000Z', '2027-07-19T08:30:00.000Z')
    const ended = await insertPass(uid, '2027-04-01T00:00:00.000Z', '2027-05-01T00:00:00.000Z')
    const revoked = await insertPass(uid, '2027-05-01T00:00:00.000Z', '2027-05-31T00:00:00.000Z', true)
    // bought during the pause (no earlier pass): its unusable hours move to the resume
    const boughtDuring = await insertPass(await insertUser('2027-05-10T12:00:00.000Z'), '2027-05-10T12:00:00.000Z', '2027-06-09T12:00:00.000Z')
    // ran out during the pause, with a pass queued behind it
    const uid4 = await insertUser('2027-04-10T20:00:00.000Z')
    const endedDuring = await insertPass(uid4, '2027-04-10T20:00:00.000Z', '2027-05-10T20:00:00.000Z')
    const queuedDuring = await insertPass(uid4, '2027-05-10T20:00:00.000Z', '2027-06-09T20:00:00.000Z')

    // daily cap = max(US$15, L/10) = US$15; spend US$16 today
    await insertGrade({ createdAt: '2027-05-10T09:00:00.000Z', costMicro: 16_000_000 })
    const pausedAt = at('2027-05-10T10:00:00.000Z')
    await schedule(SPEND_CRON, pausedAt)
    let flags = await getFlags(env)
    expect(flags.grading_enabled).toBe(false)
    expect(flags.free_enabled).toBe(true)
    expect(await env.FLAGS.get(KV.autoGradingOff)).toBe('1')
    expect(await env.FLAGS.get(KV.pauseStartedAt)).toBe(pausedAt.toISOString())
    expect(alerts().some((a) => a.subject.includes('Grading paused'))).toBe(true)

    // still paused later the same day: nothing changes, the pause start is kept
    await schedule(SPEND_CRON, at('2027-05-10T18:00:00.000Z'))
    expect(await env.FLAGS.get(KV.pauseStartedAt)).toBe(pausedAt.toISOString())
    expect(await passEnd(active)).toBe('2027-05-31T00:00:00.000Z')

    // next UTC day: two overlapping runs, then a stale re-run with the pause start restored
    const resume = at('2027-05-11T00:15:00.000Z')
    const log = vi.spyOn(console, 'log')
    await Promise.all([schedule(SPEND_CRON, resume), schedule(SPEND_CRON, resume)])
    flags = await getFlags(env)
    expect(flags.grading_enabled).toBe(true)
    expect(await env.FLAGS.get(KV.pauseStartedAt)).toBeNull()
    expect(await env.FLAGS.get(KV.autoGradingOff)).toBeNull()

    const x = resume.getTime() - pausedAt.getTime()
    const r = resume.toISOString()
    expect(await passDates(active)).toEqual(['2027-05-01T00:00:00.000Z', plus('2027-05-31T00:00:00.000Z', x)])
    // the queue stays contiguous: the queued pass moves back by the same amount
    expect(await passDates(queued)).toEqual([plus('2027-05-31T00:00:00.000Z', x), plus('2027-08-29T00:00:00.000Z', x)])
    expect(await passDates(active2)).toEqual(['2027-04-20T08:30:00.000Z', plus('2027-07-19T08:30:00.000Z', x)])
    expect(await passDates(ended)).toEqual(['2027-04-01T00:00:00.000Z', '2027-05-01T00:00:00.000Z'])
    expect(await passDates(revoked)).toEqual(['2027-05-01T00:00:00.000Z', '2027-05-31T00:00:00.000Z'])
    expect(await passDates(boughtDuring)).toEqual([r, plus(r, 30 * 86_400_000)])
    expect(await passDates(endedDuring)).toEqual(['2027-04-10T20:00:00.000Z', plus('2027-05-10T20:00:00.000Z', x)])
    expect(await passDates(queuedDuring)).toEqual([plus('2027-05-10T20:00:00.000Z', x), plus('2027-06-09T20:00:00.000Z', x)])
    expect(log).toHaveBeenCalledWith(EXTENDED_LOG, { passes: 6, candidates: 6, minutes: Math.round(x / 60_000) })

    await env.FLAGS.put(KV.pauseStartedAt, pausedAt.toISOString())
    await runSpendMonitor(env, at('2027-05-11T00:30:00.000Z'))
    expect(await passEnd(active)).toBe(plus('2027-05-31T00:00:00.000Z', x))
    expect(log.mock.calls.filter((c) => c[0] === EXTENDED_LOG)).toHaveLength(1)
    expect(await env.FLAGS.get(KV.pauseStartedAt)).toBeNull()
    expect(await count("SELECT COUNT(*) AS n FROM webhook_events WHERE type = 'cron_pause_extension'")).toBe(1)
  })

  it("an owner's pause (flags.yml) is tracked and extends passes when the owner switches grading back on", async () => {
    const pid = await insertPass(await insertUser('2027-05-01T00:00:00.000Z'), '2027-05-01T00:00:00.000Z', '2027-05-31T00:00:00.000Z')
    await env.FLAGS.put('flag:grading_enabled', 'false')
    await env.FLAGS.put(ownerMarker('grading_enabled'), 'false')
    const seenAt = at('2027-05-20T10:00:00.000Z')
    await runSpendMonitor(env, seenAt)
    await runSpendMonitor(env, at('2027-05-20T10:15:00.000Z'))
    // spend is normal, but the cron never switches on what the owner switched off
    expect((await getFlags(env)).grading_enabled).toBe(false)
    expect(await env.FLAGS.get(KV.pauseStartedAt)).toBe(seenAt.toISOString())
    expect(await passEnd(pid)).toBe('2027-05-31T00:00:00.000Z')
    expect(alerts()).toHaveLength(0)

    await env.FLAGS.put('flag:grading_enabled', 'true')
    await env.FLAGS.put(ownerMarker('grading_enabled'), 'true')
    const resume = at('2027-05-20T14:00:00.000Z')
    await runSpendMonitor(env, resume)
    expect(await passEnd(pid)).toBe(plus('2027-05-31T00:00:00.000Z', resume.getTime() - seenAt.getTime()))
    expect(await env.FLAGS.get(KV.pauseStartedAt)).toBeNull()
  })

  it('keeps grading off after an automatic pause when the owner has since switched it off', async () => {
    await insertGrade({ createdAt: '2027-05-10T09:00:00.000Z', costMicro: 16_000_000 })
    await runSpendMonitor(env, at('2027-05-10T10:00:00.000Z'))
    expect(await env.FLAGS.get(KV.autoGradingOff)).toBe('1')
    await env.FLAGS.put(ownerMarker('grading_enabled'), 'false')

    await runSpendMonitor(env, at('2027-05-11T00:15:00.000Z'))
    expect((await getFlags(env)).grading_enabled).toBe(false)
    expect(await env.FLAGS.get(KV.autoGradingOff)).toBeNull()
    // still a pause: the start is kept until grading is on again
    expect(await env.FLAGS.get(KV.pauseStartedAt)).toBe('2027-05-10T10:00:00.000Z')
  })

  it('extends passes for a pause a grade handler recorded before any cron run saw it', async () => {
    const pid = await insertPass(await insertUser('2027-05-01T00:00:00.000Z'), '2027-05-01T00:00:00.000Z', '2027-05-31T00:00:00.000Z')
    await recordPauseStart(env, at('2027-05-10T23:50:00.000Z'))
    // a later refusal keeps the first start
    await recordPauseStart(env, at('2027-05-10T23:55:00.000Z'))
    expect(await env.FLAGS.get(KV.pauseStartedAt)).toBe('2027-05-10T23:50:00.000Z')
    // the next run is after midnight: spend is back under the cap and grading was never switched off
    await runSpendMonitor(env, at('2027-05-11T00:00:00.000Z'))
    expect((await getFlags(env)).grading_enabled).toBe(true)
    expect(await passEnd(pid)).toBe('2027-05-31T00:10:00.000Z')
    expect(await env.FLAGS.get(KV.pauseStartedAt)).toBeNull()
  })

  it('drops an unusable pause start without touching passes', async () => {
    const pid = await insertPass(await insertUser('2027-05-01T00:00:00.000Z'), '2027-05-01T00:00:00.000Z', '2027-05-31T00:00:00.000Z')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await env.FLAGS.put(KV.pauseStartedAt, 'not a date')
    await runSpendMonitor(env, at('2027-05-11T00:00:00.000Z'))
    expect(warn).toHaveBeenCalledWith('pause extension skipped: unusable pause start')
    expect(await passEnd(pid)).toBe('2027-05-31T00:00:00.000Z')
    expect(await env.FLAGS.get(KV.pauseStartedAt)).toBeNull()
  })

  it('pauseShifts leaves passes that start after the resume alone unless they are queued behind a moved one', () => {
    const P = Date.parse('2027-05-10T10:00:00.000Z')
    const R = Date.parse('2027-05-10T12:00:00.000Z')
    const pass = (pid: string, user: string, s: string, e: string) => ({ id: pid, user_id: user, starts_at: s, ends_at: e })
    expect(pauseShifts([pass('far', 'u1', '2027-06-01T00:00:00.000Z', '2027-07-01T00:00:00.000Z')], P, R)).toEqual([])
    const shifts = pauseShifts(
      [
        pass('a', 'u2', '2027-05-01T00:00:00.000Z', '2027-05-10T11:00:00.000Z'),
        pass('b', 'u2', '2027-05-10T11:00:00.000Z', '2027-06-09T11:00:00.000Z'),
        // another user's pass never inherits u2's queue position
        pass('c', 'u3', '2027-06-01T00:00:00.000Z', '2027-07-01T00:00:00.000Z'),
      ],
      P,
      R,
    )
    expect(shifts).toEqual([
      {
        id: 'a',
        fromStart: '2027-05-01T00:00:00.000Z',
        fromEnd: '2027-05-10T11:00:00.000Z',
        toStart: '2027-05-01T00:00:00.000Z',
        toEnd: '2027-05-10T13:00:00.000Z',
      },
      {
        id: 'b',
        fromStart: '2027-05-10T11:00:00.000Z',
        fromEnd: '2027-06-09T11:00:00.000Z',
        toStart: '2027-05-10T13:00:00.000Z',
        toEnd: '2027-06-09T13:00:00.000Z',
      },
    ])
  })

  it('closes grade rows still pending after 15 minutes as failed', async () => {
    const stale = await insertGrade({ createdAt: '2027-05-20T09:40:00.000Z', pending: true })
    const fresh = await insertGrade({ createdAt: '2027-05-20T09:50:00.000Z', pending: true })
    const graded = await insertGrade({ createdAt: '2027-05-20T09:00:00.000Z' })
    const log = vi.spyOn(console, 'log')
    await runSpendMonitor(env, at('2027-05-20T10:00:00.000Z'))
    expect(await gradeRow(stale)).toMatchObject({ pending: 0, refused: 1, outcome: 'failed' })
    expect(await gradeRow(fresh)).toMatchObject({ pending: 1, refused: 0, outcome: null })
    expect(await gradeRow(graded)).toMatchObject({ pending: 0, refused: 0, outcome: 'graded' })
    expect(log).toHaveBeenCalledWith('stale pending grades closed', { rows: 1 })
  })

  it('alerts once per month at 95% of L', async () => {
    await insertGrade({ createdAt: '2027-06-02T10:00:00.000Z', costMicro: 145_000_000 })
    await runSpendMonitor(env, at('2027-06-15T12:00:00.000Z'))
    await runSpendMonitor(env, at('2027-06-16T12:00:00.000Z'))
    const tier = alerts().filter((a) => a.subject.includes('95%'))
    expect(tier).toHaveLength(1)
    expect(tier[0]?.text).toContain('Raise the Anthropic monthly limit or keep free samples off')
    // the guard is a D1 row (memo §7.2 Z2), not a KV key
    expect(await count('SELECT COUNT(*) AS n FROM webhook_events WHERE id = ?1 AND type = ?2', ALERT_GUARDS.tier95('2027-06'), ALERT_GUARD_TYPE)).toBe(1)
    expect((await env.FLAGS.list({ prefix: 'alerted:' })).keys).toHaveLength(0)
  })

  it('retries an alert whose email failed', async () => {
    stub = stubFetch({ resendOk: false })
    await insertGrade({ createdAt: '2027-06-02T10:00:00.000Z', costMicro: 145_000_000 })
    await runSpendMonitor(env, at('2027-06-15T12:00:00.000Z'))
    expect(await count("SELECT COUNT(*) AS n FROM webhook_events WHERE type = 'cron_alert'")).toBe(0)
    stub = stubFetch()
    await runSpendMonitor(env, at('2027-06-15T12:15:00.000Z'))
    expect(alerts().filter((a) => a.subject.includes('95%'))).toHaveLength(1)
    expect(alerts().filter((a) => a.subject.includes('Free samples switched off'))).toHaveLength(1)
  })
})

describe('spend monitor on Workers Free: KV write failures (memo §7.2 Z2)', () => {
  it('a failing KV write never aborts the run or repeats the alert; the switch is retried next run', async () => {
    await insertGrade({ createdAt: '2027-03-05T10:00:00.000Z', costMicro: 135_000_000 })
    const put = vi.spyOn(env.FLAGS, 'put').mockRejectedValue(new Error('KV put() limit exceeded for the day.'))
    const del = vi.spyOn(env.FLAGS, 'delete').mockRejectedValue(new Error('KV delete() limit exceeded for the day.'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    for (const t of ['2027-03-20T12:00:00.000Z', '2027-03-20T12:15:00.000Z', '2027-03-20T12:30:00.000Z']) {
      await expect(runSpendMonitor(env, at(t))).resolves.toBeUndefined()
    }
    expect(warn).toHaveBeenCalledWith('cron kv write failed', 'free_enabled')
    // one alert for the day, whatever KV does
    expect(alerts().filter((a) => a.subject.includes('Free samples switched off'))).toHaveLength(1)
    expect((await getFlags(env)).free_enabled).toBe(true)

    // quota back (next UTC day): the switch goes off and the day's alert is sent once
    put.mockRestore()
    del.mockRestore()
    await runSpendMonitor(env, at('2027-03-21T00:15:00.000Z'))
    expect((await getFlags(env)).free_enabled).toBe(false)
    expect(await env.FLAGS.get(KV.autoFreeOff)).toBe('1')
    expect(alerts().filter((a) => a.subject.includes('Free samples switched off'))).toHaveLength(2)
  })

  it('keeps the auto marker when switching back on fails, so a later run still restores the switch', async () => {
    await insertGrade({ createdAt: '2027-03-05T10:00:00.000Z', costMicro: 120_000_000 })
    await runSpendMonitor(env, at('2027-03-31T23:45:00.000Z'))
    expect((await getFlags(env)).free_enabled).toBe(false)
    const put = vi.spyOn(env.FLAGS, 'put').mockRejectedValue(new Error('quota'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    await runSpendMonitor(env, at('2027-04-01T00:00:00.000Z'))
    expect((await getFlags(env)).free_enabled).toBe(false)
    expect(await env.FLAGS.get(KV.autoFreeOff)).toBe('1')
    put.mockRestore()
    await runSpendMonitor(env, at('2027-04-01T00:15:00.000Z'))
    expect((await getFlags(env)).free_enabled).toBe(true)
    expect(await env.FLAGS.get(KV.autoFreeOff)).toBeNull()
  })
})

describe('prepaid Anthropic credits (memo §7.2 Z6)', () => {
  const prepaidEnv = (usd: string, since: string) => ({ ...(env as Env), ANTHROPIC_PREPAID_USD: usd, ANTHROPIC_PREPAID_SINCE: since }) as Env

  it('alerts once per level and top-up, switches free samples off at 70%, pauses grading at 97% until a top-up', async () => {
    const e = prepaidEnv('10', '2027-06-01')
    const uid = await insertUser('2027-06-01T00:00:00.000Z')
    const pass = await insertPass(uid, '2027-06-10T00:00:00.000Z', '2027-07-10T00:00:00.000Z')
    // spend before the ledger started does not count
    await insertGrade({ createdAt: '2027-05-30T10:00:00.000Z', costMicro: 9_000_000 })
    await insertGrade({ createdAt: '2027-06-02T10:00:00.000Z', costMicro: 5_500_000 })
    await runSpendMonitor(e, at('2027-06-15T12:00:00.000Z'))
    await runSpendMonitor(e, at('2027-06-15T12:15:00.000Z'))
    const prepaidAlerts = () => alerts().filter((a) => a.subject.startsWith('[MPC] Prepaid Anthropic credits'))
    expect(prepaidAlerts().map((a) => a.subject)).toEqual(['[MPC] Prepaid Anthropic credits 50% used'])
    expect(prepaidAlerts()[0]?.text).toContain('US$10.00 Anthropic credits bought on 2027-06-01')
    expect(prepaidAlerts()[0]?.text).toContain('Prepaid credits: US$5.50 of US$10.00 used since 2027-06-01 (55%')
    expect((await getFlags(env)).free_enabled).toBe(true)

    // 85%: the 80% alert, and free samples off
    await insertGrade({ createdAt: '2027-06-03T10:00:00.000Z', costMicro: 3_000_000 })
    await runSpendMonitor(e, at('2027-06-15T12:30:00.000Z'))
    await runSpendMonitor(e, at('2027-06-15T12:45:00.000Z'))
    expect(prepaidAlerts().map((a) => a.subject)).toEqual([
      '[MPC] Prepaid Anthropic credits 50% used',
      '[MPC] Prepaid Anthropic credits 80% used',
    ])
    expect((await getFlags(env)).free_enabled).toBe(false)
    expect((await getFlags(env)).grading_enabled).toBe(true)

    // 98% including a call still running: grading pauses with the top-up instructions
    await insertGrade({ createdAt: '2027-06-15T12:50:00.000Z', costMicro: 1_300_000, pending: true })
    await runSpendMonitor(e, at('2027-06-15T13:00:00.000Z'))
    expect((await getFlags(env)).grading_enabled).toBe(false)
    expect(await env.FLAGS.get(KV.pauseStartedAt)).toBe('2027-06-15T13:00:00.000Z')
    const pause = alerts().filter((a) => a.subject.includes('prepaid credits nearly used'))
    expect(pause).toHaveLength(1)
    expect(pause[0]?.text).toContain('buy more credits in the Anthropic Console')
    expect(alerts().filter((a) => a.subject.includes('daily spend cap'))).toHaveLength(0)

    // the owner tops up (new amount and date): grading resumes, passes are extended, alerts can come again
    const topped = prepaidEnv('20', '2027-06-16T09:00:00Z')
    await runSpendMonitor(topped, at('2027-06-16T09:15:00.000Z'))
    const flags = await getFlags(env)
    expect(flags.grading_enabled).toBe(true)
    expect(flags.free_enabled).toBe(true)
    expect(await env.FLAGS.get(KV.pauseStartedAt)).toBeNull()
    expect(await passEnd(pass)).toBe(plus('2027-07-10T00:00:00.000Z', Date.parse('2027-06-16T09:15:00.000Z') - Date.parse('2027-06-15T13:00:00.000Z')))
    expect(prepaidAlerts()).toHaveLength(2)
  })

  it('sends only the highest level reached when spend jumps past both', async () => {
    await insertGrade({ createdAt: '2027-06-02T10:00:00.000Z', costMicro: 9_000_000 })
    await runSpendMonitor(prepaidEnv('10', '2027-06-01'), at('2027-06-15T12:00:00.000Z'))
    expect(alerts().filter((a) => a.subject.startsWith('[MPC] Prepaid')).map((a) => a.subject)).toEqual([
      '[MPC] Prepaid Anthropic credits 80% used',
    ])
  })
})

describe('daily job (0 5 * * *)', () => {
  it('purges old essays after inactivity but keeps cost rows; cleans up expired data', async () => {
    const now = at('2027-07-01T05:00:00.000Z') // retention cutoff: 2027-04-02T05:00Z
    const inactive = await insertUser('2027-03-01T00:00:00.000Z')
    const activeUser = await insertUser('2027-06-30T00:00:00.000Z')
    const oldInactive = await insertGrade({ createdAt: '2027-03-01T00:00:00.000Z', userId: inactive, costMicro: 5000, deviceHash: 'd1' })
    const oldActive = await insertGrade({ createdAt: '2027-03-01T00:00:00.000Z', userId: activeUser, costMicro: 5000, deviceHash: 'd2' })
    const oldAnon = await insertGrade({ createdAt: '2027-03-01T00:00:00.000Z', costMicro: 5000, deviceHash: 'd3' })
    const recentAnon = await insertGrade({ createdAt: '2027-06-30T00:00:00.000Z', costMicro: 5000, deviceHash: 'd4' })
    // stuck in pending for days (the 15-minute run only looks back two days)
    const stuck = await insertGrade({ createdAt: '2027-06-20T00:00:00.000Z', pending: true })

    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO magic_links (token_hash, email, created_at, expires_at) VALUES ('ml_old', 'a@example.com', '2027-06-29T00:00:00.000Z', '2027-06-29T00:15:00.000Z')",
      ),
      env.DB.prepare(
        "INSERT INTO magic_links (token_hash, email, created_at, expires_at) VALUES ('ml_new', 'b@example.com', '2027-07-01T04:50:00.000Z', '2027-07-01T05:05:00.000Z')",
      ),
      env.DB.prepare(
        "INSERT INTO sessions (id_hash, user_id, created_at, expires_at) VALUES ('s_old', ?1, '2027-05-01T00:00:00.000Z', '2027-05-31T00:00:00.000Z')",
      ).bind(activeUser),
      env.DB.prepare(
        "INSERT INTO sessions (id_hash, user_id, created_at, expires_at) VALUES ('s_live', ?1, '2027-06-30T00:00:00.000Z', '2027-07-30T00:00:00.000Z')",
      ).bind(activeUser),
      env.DB.prepare("INSERT INTO free_usage (key_hash, kind, day, count) VALUES ('ip1', 'ip', '2027-06-28', 1)"),
      env.DB.prepare("INSERT INTO free_usage (key_hash, kind, day, count) VALUES ('ip1', 'ip', '2027-06-29', 1)"),
      env.DB.prepare("INSERT INTO free_usage (key_hash, kind, day, count) VALUES ('dev1', 'device', '2026-05-26', 1)"),
      env.DB.prepare("INSERT INTO free_usage (key_hash, kind, day, count) VALUES ('dev2', 'device', '2026-06-28', 1)"),
      env.DB.prepare(
        "INSERT INTO support_tickets (id, user_id, message, lang, created_at) VALUES ('t_old', NULL, 'old question text', 'en', '2027-03-01T00:00:00.000Z')",
      ),
      env.DB.prepare(
        "INSERT INTO support_tickets (id, user_id, message, lang, created_at) VALUES ('t_new', NULL, 'new question text', 'en', '2027-06-30T00:00:00.000Z')",
      ),
      // event budgets (per UTC day) and sign-in link sends (per send time) moved from KV to D1
      env.DB.prepare("INSERT INTO free_usage (key_hash, kind, day, count) VALUES ('evd', 'ev_device', '2027-06-30', 5)"),
      env.DB.prepare("INSERT INTO free_usage (key_hash, kind, day, count) VALUES ('evd', 'ev_device', '2027-07-01', 5)"),
      env.DB.prepare("INSERT INTO free_usage (key_hash, kind, day, count) VALUES ('evi', 'ev_ip', '2027-06-30', 5)"),
      env.DB.prepare("INSERT INTO free_usage (key_hash, kind, day, count) VALUES ('mlh', 'ml', '2027-06-30T04:00:00.000Z', 1)"),
      env.DB.prepare("INSERT INTO free_usage (key_hash, kind, day, count) VALUES ('mlh', 'ml', '2027-07-01T04:30:00.000Z', 1)"),
      env.DB.prepare(
        `INSERT INTO oauth_states (state_hash, created_at, expires_at, code_verifier, nonce, device_hash)
         VALUES ('st_old', '2027-07-01T04:00:00.000Z', '2027-07-01T04:10:00.000Z', 'v', 'n', 'd'),
                ('st_live', '2027-07-01T04:55:00.000Z', '2027-07-01T05:05:00.000Z', 'v', 'n', 'd')`,
      ),
    ])

    await schedule(DAILY_CRON, now)

    const text = async (gid: string) =>
      env.DB.prepare('SELECT input_text, result_json, cost_micro_usd FROM grades WHERE id = ?1')
        .bind(gid)
        .first<{ input_text: string | null; result_json: string | null; cost_micro_usd: number }>()
    expect(await text(oldInactive)).toEqual({ input_text: null, result_json: null, cost_micro_usd: 5000 })
    expect(await text(oldAnon)).toEqual({ input_text: null, result_json: null, cost_micro_usd: 5000 })
    expect((await text(oldActive))?.input_text).toBe('essay')
    expect((await text(recentAnon))?.input_text).toBe('essay')
    expect(await count('SELECT COUNT(*) AS n FROM grades')).toBe(5)
    // the device hash goes after RETENTION_DAYS whatever the owner's activity
    for (const gid of [oldInactive, oldActive, oldAnon]) expect((await gradeRow(gid))?.device_hash).toBeNull()
    expect((await gradeRow(recentAnon))?.device_hash).toBe('d4')
    expect(await gradeRow(stuck)).toMatchObject({ pending: 0, refused: 1, outcome: 'failed' })

    expect(await count("SELECT COUNT(*) AS n FROM magic_links WHERE token_hash IN ('ml_old', 'ml_new')")).toBe(1)
    expect(await count("SELECT COUNT(*) AS n FROM magic_links WHERE token_hash = 'ml_new'")).toBe(1)
    expect(await count("SELECT COUNT(*) AS n FROM sessions WHERE id_hash = 's_old'")).toBe(0)
    expect(await count("SELECT COUNT(*) AS n FROM sessions WHERE id_hash = 's_live'")).toBe(1)
    // today is 2027-07-01: ip rows before 06-29 and device rows before 2026-05-27 go
    expect(await count("SELECT COUNT(*) AS n FROM free_usage WHERE key_hash = 'ip1'")).toBe(1)
    expect(await count("SELECT COUNT(*) AS n FROM free_usage WHERE key_hash = 'dev1'")).toBe(0)
    expect(await count("SELECT COUNT(*) AS n FROM free_usage WHERE key_hash = 'dev2'")).toBe(1)
    expect(await count("SELECT COUNT(*) AS n FROM support_tickets WHERE id = 't_old' AND message = '[purged]'")).toBe(1)
    expect(await count("SELECT COUNT(*) AS n FROM support_tickets WHERE id = 't_new' AND message = 'new question text'")).toBe(1)
    expect(await count("SELECT COUNT(*) AS n FROM free_usage WHERE key_hash IN ('evd', 'evi')")).toBe(1)
    expect(await count("SELECT COUNT(*) AS n FROM free_usage WHERE key_hash = 'evd' AND day = '2027-07-01'")).toBe(1)
    expect(await count("SELECT COUNT(*) AS n FROM free_usage WHERE key_hash = 'mlh'")).toBe(1)
    expect(await count("SELECT COUNT(*) AS n FROM free_usage WHERE key_hash = 'mlh' AND day = '2027-07-01T04:30:00.000Z'")).toBe(1)
    expect(await count("SELECT COUNT(*) AS n FROM oauth_states WHERE state_hash IN ('st_old', 'st_live')")).toBe(1)
    expect(await count("SELECT COUNT(*) AS n FROM oauth_states WHERE state_hash = 'st_live'")).toBe(1)
  })

  it("writes yesterday's aggregate metrics row (and replaces it on a re-run)", async () => {
    const day = '2027-08-01'
    const uid = await insertUser('2027-08-01T00:00:00.000Z')
    const ev = (name: string, d = day, utm: string | null = null) =>
      env.DB.prepare('INSERT INTO events (name, path, utm_json, day, created_at) VALUES (?1, ?2, ?3, ?4, ?5)').bind(
        name,
        '/',
        utm,
        d,
        `${d}T12:00:00.000Z`,
      )
    await env.DB.batch([
      ev('landing', day, '{"gclid":"abc"}'),
      ev('landing', day, '{"utm_source":"newsletter","utm_medium":"email"}'),
      ev('landing'),
      ev('sample_start', day, '{"utm_medium":"cpc"}'),
      ev('sample_start'),
      ev('signup'),
      ev('landing', '2027-08-02'),
    ])
    await insertGrade({ createdAt: `${day}T01:00:00.000Z`, costMicro: 10_000, free: true })
    await insertGrade({ createdAt: `${day}T02:00:00.000Z`, costMicro: 20_000, userId: uid })
    await insertGrade({ createdAt: `${day}T03:00:00.000Z`, costMicro: 30_000, userId: uid, kind: 'speaking' })
    await insertGrade({ createdAt: `${day}T04:00:00.000Z`, costMicro: 1_000, userId: uid, refused: true })
    await insertGrade({ createdAt: `${day}T04:30:00.000Z`, costMicro: 0, userId: uid, refused: true, outcome: 'failed' })
    await insertGrade({ createdAt: '2027-08-02T01:00:00.000Z', costMicro: 99_000, userId: uid })

    // billing sets paid_at only when it grants a pass (see billing/webhook.ts)
    const purchase = (pid: string, status: string, cents: number, paidAt: string) =>
      env.DB.prepare(
        `INSERT INTO purchases (id, user_id, sku, amount_cents, currency, status, created_at, paid_at)
         VALUES (?1, ?2, 'pass30', ?3, 'cad', ?4, ?5, ?5)`,
      ).bind(pid, uid, cents, status, paidAt)
    await env.DB.batch([
      purchase('cs_paid', 'paid', 3900, `${day}T05:00:00.000Z`),
      purchase('cs_refunded', 'refunded', 7900, `${day}T06:00:00.000Z`),
      env.DB.prepare(
        "INSERT INTO purchases (id, user_id, sku, amount_cents, currency, status, created_at) VALUES ('cs_region', ?1, 'pass30', 3900, 'cad', 'rejected_region', ?2)",
      ).bind(uid, `${day}T07:00:00.000Z`),
      purchase('cs_disputed', 'disputed', 3900, '2027-07-20T00:00:00.000Z'),
      env.DB.prepare(
        "INSERT INTO purchases (id, user_id, sku, amount_cents, currency, status, created_at) VALUES ('cs_pending', ?1, 'pass30', 3900, 'cad', 'pending', ?2)",
      ).bind(uid, `${day}T08:00:00.000Z`),
      env.DB.prepare(
        "INSERT INTO refunds (id, purchase_id, user_id, amount_cents, reason, created_at) VALUES ('r1', 'cs_refunded', ?1, 7900, 'self_serve', ?2)",
      ).bind(uid, `${day}T09:00:00.000Z`),
      env.DB.prepare(
        "INSERT INTO refunds (id, purchase_id, user_id, amount_cents, reason, created_at) VALUES ('r2', 'cs_region', ?1, 3900, 'region', ?2)",
      ).bind(uid, `${day}T07:00:01.000Z`),
      env.DB.prepare(
        "INSERT INTO refunds (id, purchase_id, user_id, amount_cents, reason, created_at) VALUES ('r3', 'cs_disputed', ?1, 3900, 'dispute', ?2)",
      ).bind(uid, `${day}T10:00:00.000Z`),
      env.DB.prepare(
        "INSERT INTO webhook_events (id, type, received_at) VALUES ('evt_dispute', 'charge.dispute.created', ?1)",
      ).bind(`${day}T10:00:00.000Z`),
    ])

    const now = at('2027-08-02T05:00:00.000Z')
    await schedule(DAILY_CRON, now)
    await runDaily(env, now)

    expect(await count('SELECT COUNT(*) AS n FROM metrics_daily WHERE day = ?1', day)).toBe(1)
    const row = await env.DB.prepare('SELECT json FROM metrics_daily WHERE day = ?1').bind(day).first<{ json: string }>()
    expect(JSON.parse(row!.json)).toEqual({
      day,
      // no paidEvents: there are no ads (memo §7.2 Z1)
      events: { landing: 3, sample_start: 2, signup: 1 },
      grades: { writing: 2, speaking: 1, free: 1, refused: 2 },
      outcomes: { failed: 1, graded: 3, scope_refused: 1 },
      costUsd: 0.061,
      purchases: { paid: 2, grossCents: 11800 },
      refunds: { count: 1, cents: 7900 },
      disputes: 1,
    })
    expect(row!.json).not.toContain('@')
  })
})

it('ignores an unknown cron expression', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  await expect(schedule('0 0 1 1 *', at('2027-09-01T00:00:00.000Z'))).resolves.toBeUndefined()
  expect(warn).toHaveBeenCalledWith('unknown cron', '0 0 1 1 *')
  expect(await count('SELECT COUNT(*) AS n FROM metrics_daily')).toBe(0)
})
