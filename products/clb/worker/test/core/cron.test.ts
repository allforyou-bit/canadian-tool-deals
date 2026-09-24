import { createScheduledController } from 'cloudflare:test'
import { env } from 'cloudflare:workers'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DAILY_CRON, handleScheduled, KV, runDaily, runSpendMonitor, SPEND_CRON } from '../../src/cron'
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
}): Promise<string> {
  const gid = id('g')
  await env.DB.prepare(
    `INSERT INTO grades (id, user_id, task_id, prompt_index, kind, input_text, result_json, free, refused, model, cost_micro_usd, created_at)
     VALUES (?1, ?2, 'w1', 0, ?3, ?4, ?5, ?6, ?7, 'claude-opus-5', ?8, ?9)`,
  )
    .bind(
      gid,
      g.userId ?? null,
      g.kind ?? 'writing',
      g.text === undefined ? 'essay' : g.text,
      g.text === null ? null : '{"refused":false}',
      g.free ? 1 : 0,
      g.refused ? 1 : 0,
      g.costMicro ?? 0,
      g.createdAt,
    )
    .run()
  return gid
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

  it('turns free samples off when the free budget for the day is used up', async () => {
    await insertGrade({ createdAt: '2027-03-10T09:00:00.000Z', costMicro: 2_000_000, free: true })
    await runSpendMonitor(env, at('2027-03-10T10:00:00.000Z'))
    const flags = await getFlags(env)
    expect(flags.free_enabled).toBe(false)
    expect(flags.grading_enabled).toBe(true)
  })

  it('pauses grading above the daily cap, then resumes next day and extends active passes exactly once', async () => {
    const uid = await insertUser('2027-05-01T00:00:00.000Z')
    const active = await insertPass(uid, '2027-05-01T00:00:00.000Z', '2027-05-31T00:00:00.000Z')
    const active2 = await insertPass(await insertUser('2027-05-01T00:00:00.000Z'), '2027-04-20T08:30:00.000Z', '2027-07-19T08:30:00.000Z')
    const ended = await insertPass(uid, '2027-04-01T00:00:00.000Z', '2027-05-01T00:00:00.000Z')
    const revoked = await insertPass(uid, '2027-05-01T00:00:00.000Z', '2027-05-31T00:00:00.000Z', true)
    const later = await insertPass(uid, '2027-05-10T12:00:00.000Z', '2027-06-09T12:00:00.000Z')

    // daily cap = max(US$15, L/10) = US$15; spend US$16 today
    await insertGrade({ createdAt: '2027-05-10T09:00:00.000Z', costMicro: 16_000_000 })
    const pausedAt = at('2027-05-10T10:00:00.000Z')
    await schedule(SPEND_CRON, pausedAt)
    let flags = await getFlags(env)
    expect(flags.grading_enabled).toBe(false)
    expect(flags.free_enabled).toBe(true)
    expect(await env.FLAGS.get(KV.gradingPausedAt)).toBe(pausedAt.toISOString())
    expect(alerts().some((a) => a.subject.includes('Grading paused'))).toBe(true)

    // still paused later the same day: nothing changes, the pause start is kept
    await schedule(SPEND_CRON, at('2027-05-10T18:00:00.000Z'))
    expect(await env.FLAGS.get(KV.gradingPausedAt)).toBe(pausedAt.toISOString())
    expect(await passEnd(active)).toBe('2027-05-31T00:00:00.000Z')

    // next UTC day: two overlapping runs, then a stale re-run with the marker restored
    const resume = at('2027-05-11T00:15:00.000Z')
    const log = vi.spyOn(console, 'log')
    await Promise.all([schedule(SPEND_CRON, resume), schedule(SPEND_CRON, resume)])
    flags = await getFlags(env)
    expect(flags.grading_enabled).toBe(true)
    expect(await env.FLAGS.get(KV.gradingPausedAt)).toBeNull()

    const extendMs = resume.getTime() - pausedAt.getTime()
    const extended = new Date(Date.parse('2027-05-31T00:00:00.000Z') + extendMs).toISOString()
    expect(await passEnd(active)).toBe(extended)
    expect(await passEnd(active2)).toBe(new Date(Date.parse('2027-07-19T08:30:00.000Z') + extendMs).toISOString())
    expect(await passEnd(ended)).toBe('2027-05-01T00:00:00.000Z')
    expect(await passEnd(revoked)).toBe('2027-05-31T00:00:00.000Z')
    expect(await passEnd(later)).toBe('2027-06-09T12:00:00.000Z')
    expect(log).toHaveBeenCalledWith('spend monitor: passes extended after grading pause', {
      passes: 2,
      candidates: 2,
      minutes: Math.round(extendMs / 60_000),
    })

    await env.FLAGS.put(KV.gradingPausedAt, pausedAt.toISOString())
    await runSpendMonitor(env, at('2027-05-11T00:30:00.000Z'))
    expect(await passEnd(active)).toBe(extended)
    expect(log.mock.calls.filter((c) => c[0] === 'spend monitor: passes extended after grading pause')).toHaveLength(1)
    expect(await env.FLAGS.get(KV.gradingPausedAt)).toBeNull()
    expect(await count("SELECT COUNT(*) AS n FROM webhook_events WHERE type = 'cron_pause_extension'")).toBe(1)
  })

  it('leaves a manual grading pause alone', async () => {
    await env.FLAGS.put('flag:grading_enabled', 'false')
    await runSpendMonitor(env, at('2027-05-20T10:00:00.000Z'))
    expect((await getFlags(env)).grading_enabled).toBe(false)
  })

  it('alerts once per month at 95% of L', async () => {
    await insertGrade({ createdAt: '2027-06-02T10:00:00.000Z', costMicro: 145_000_000 })
    await runSpendMonitor(env, at('2027-06-15T12:00:00.000Z'))
    await runSpendMonitor(env, at('2027-06-16T12:00:00.000Z'))
    const tier = alerts().filter((a) => a.subject.includes('95%'))
    expect(tier).toHaveLength(1)
    expect(tier[0]?.text).toContain('Raise the Anthropic monthly limit or keep free samples off')
    expect(await env.FLAGS.get('alerted:tier95:2027-06')).toBe('1')
  })

  it('retries an alert whose email failed', async () => {
    stub = stubFetch({ resendOk: false })
    await insertGrade({ createdAt: '2027-06-02T10:00:00.000Z', costMicro: 145_000_000 })
    await runSpendMonitor(env, at('2027-06-15T12:00:00.000Z'))
    expect(await env.FLAGS.get('alerted:tier95:2027-06')).toBeNull()
    stub = stubFetch()
    await runSpendMonitor(env, at('2027-06-15T12:15:00.000Z'))
    expect(alerts().filter((a) => a.subject.includes('95%'))).toHaveLength(1)
    expect(alerts().filter((a) => a.subject.includes('Free samples switched off'))).toHaveLength(1)
  })
})

describe('daily job (0 5 * * *)', () => {
  it('purges old essays after inactivity but keeps cost rows; cleans up expired data', async () => {
    const now = at('2027-07-01T05:00:00.000Z') // retention cutoff: 2027-04-02T05:00Z
    const inactive = await insertUser('2027-03-01T00:00:00.000Z')
    const activeUser = await insertUser('2027-06-30T00:00:00.000Z')
    const oldInactive = await insertGrade({ createdAt: '2027-03-01T00:00:00.000Z', userId: inactive, costMicro: 5000 })
    const oldActive = await insertGrade({ createdAt: '2027-03-01T00:00:00.000Z', userId: activeUser, costMicro: 5000 })
    const oldAnon = await insertGrade({ createdAt: '2027-03-01T00:00:00.000Z', costMicro: 5000 })
    const recentAnon = await insertGrade({ createdAt: '2027-06-30T00:00:00.000Z', costMicro: 5000 })

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
    expect(await count('SELECT COUNT(*) AS n FROM grades')).toBe(4)

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
      events: { landing: 3, sample_start: 2, signup: 1 },
      paidEvents: { landing: 1, sample_start: 1 },
      grades: { writing: 2, speaking: 1, free: 1, refused: 1 },
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
