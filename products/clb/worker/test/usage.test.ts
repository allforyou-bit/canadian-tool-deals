import { env } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import { CAPS, SPEAKING_DAILY_AUDIO_MINUTES } from '../../shared/config'
import { addDays, startOfUtcDay } from '../src/lib/time'
import {
  capReached,
  getUsage,
  type GradeReservation,
  noFeedbackToday,
  recordFreeSpeaking,
  recordFreeWriting,
  reserveGrade,
  speakingAvailableToday,
  speakingMinutesToday,
} from '../src/lib/usage'

const now = new Date('2026-10-05T12:00:00Z')

describe('free-sample claims are atomic', () => {
  it('lets only one of several parallel writing claims from one device succeed', async () => {
    const keys = { user: null, deviceHash: 'dev-atomic-1', ipHash: 'ip-atomic-1' }
    const results = await Promise.all(Array.from({ length: 5 }, () => recordFreeWriting(env, keys, now)))
    expect(results.filter(Boolean)).toHaveLength(1)
  })

  it('stops a fourth device on the same IP prefix in one day', async () => {
    const claim = (d: string) => recordFreeWriting(env, { user: null, deviceHash: d, ipHash: 'ip-atomic-2' }, now)
    expect(await claim('d1')).toBe(true)
    expect(await claim('d2')).toBe(true)
    expect(await claim('d3')).toBe(true)
    expect(await claim('d4')).toBe(false)
  })

  it('claims the free speaking sample once per user', async () => {
    await env.DB.prepare(
      `INSERT INTO users (id, email, email_hash, created_at, last_active_at) VALUES ('u_atomic', 'atomic@coach.test', 'h', ?1, ?1)`,
    )
      .bind(now.toISOString())
      .run()
    const results = await Promise.all([recordFreeSpeaking(env, 'u_atomic'), recordFreeSpeaking(env, 'u_atomic')])
    expect(results.filter(Boolean)).toHaveLength(1)
  })
})

describe('reserveGrade (decision 2)', () => {
  let n = 0
  const user = async () => {
    const id = `u_res_${++n}_${Date.now()}`
    await env.DB.prepare(`INSERT INTO users (id, email, email_hash, created_at, last_active_at) VALUES (?1, ?2, 'h', ?3, ?3)`)
      .bind(id, `${id}@coach.test`, now.toISOString())
      .run()
    return id
  }
  const slot = (userId: string | null, over: Partial<GradeReservation> = {}): GradeReservation => ({
    id: `g_res_${++n}`,
    userId,
    taskId: 'email',
    promptIndex: 0,
    kind: 'writing',
    free: false,
    model: 'claude-opus-5',
    costMicroUsd: 250_000,
    createdAt: now.toISOString(),
    ...over,
  })
  const insertRows = (userId: string, count: number, fields: { refused?: number; kind?: string; createdAt?: string } = {}) =>
    env.DB.batch(
      Array.from({ length: count }, () =>
        env.DB.prepare(
          `INSERT INTO grades (id, user_id, task_id, prompt_index, kind, refused, model, created_at) VALUES (?1, ?2, 'email', 0, ?3, ?4, 'm', ?5)`,
        ).bind(`g_seed_${++n}`, userId, fields.kind ?? 'writing', fields.refused ?? 0, fields.createdAt ?? now.toISOString()),
      ),
    )

  it('inserts a pending row with refused = 0, no device id and the estimated cost', async () => {
    const u = await user()
    const r = slot(u)
    expect(await reserveGrade(env, r, now, { fairUse: true })).toBeNull()
    const row = await env.DB.prepare('SELECT * FROM grades WHERE id = ?1').bind(r.id).first()
    expect(row).toMatchObject({ user_id: u, pending: 1, refused: 0, outcome: null, device_hash: null, free: 0, cost_micro_usd: 250_000 })
    // a reserved slot counts toward the caps while the call runs
    expect((await getUsage(env, u, now)).writingToday).toBe(1)
  })

  it(`lets parallel reservations through only up to the daily writing cap (${CAPS.writingPerDay})`, async () => {
    const u = await user()
    // 10 finished graded tasks today, so 5 slots remain — fewer than the in-flight limit, isolating the cap
    await insertRows(u, 10)
    const results = await Promise.all(Array.from({ length: 10 }, () => reserveGrade(env, slot(u), now, { fairUse: true })))
    expect(results.filter((r) => r === null)).toHaveLength(CAPS.writingPerDay - 10)
    expect(results.filter((r) => r === 'daily')).toHaveLength(10 - (CAPS.writingPerDay - 10))
    expect((await getUsage(env, u, now)).writingToday).toBe(CAPS.writingPerDay)
    // the speaking cap is separate
    expect(await reserveGrade(env, slot(u, { kind: 'speaking' }), now, { fairUse: true })).toBeNull()
  })

  it(`stops at ${CAPS.gradedPer30Days} graded tasks in 30 days`, async () => {
    const u = await user()
    await insertRows(u, CAPS.gradedPer30Days, { kind: 'speaking', createdAt: addDays(now, -3).toISOString() })
    expect(await reserveGrade(env, slot(u), now, { fairUse: true })).toBe('rolling30')
    // rows older than 30 days no longer count
    const later = addDays(now, 28)
    expect(await reserveGrade(env, slot(u, { createdAt: later.toISOString() }), later, { fairUse: true })).toBeNull()
  })

  it(`allows ${CAPS.noFeedbackPerDay} requests without feedback a day, for pass holders and free users alike`, async () => {
    const u = await user()
    await insertRows(u, CAPS.noFeedbackPerDay - 1, { refused: 1 })
    // the 10th may still be reserved; while it is in flight it counts, because it may end without feedback
    expect(await reserveGrade(env, slot(u), now, { fairUse: true })).toBeNull()
    expect(await reserveGrade(env, slot(u), now, { fairUse: true })).toBe('no_feedback')
    expect(await reserveGrade(env, slot(u, { free: true }), now, { fairUse: false })).toBe('no_feedback')
    expect(await noFeedbackToday(env, u, now)).toBe(CAPS.noFeedbackPerDay)
    // refused rows never count toward the fair-use caps, and yesterday's do not count today
    expect((await getUsage(env, u, now)).writingToday).toBe(1)
    const tomorrow = addDays(startOfUtcDay(now), 1)
    expect(await reserveGrade(env, slot(u, { createdAt: tomorrow.toISOString() }), tomorrow, { fairUse: true })).toBeNull()
  })

  it('ignores the fair-use caps for a free sample (it was claimed on its own)', async () => {
    const u = await user()
    await insertRows(u, CAPS.writingPerDay)
    expect(await reserveGrade(env, slot(u), now, { fairUse: true })).toBe('daily')
    expect(await reserveGrade(env, slot(u, { free: true }), now, { fairUse: false })).toBeNull()
  })

  it('always reserves an anonymous free sample', async () => {
    const results = await Promise.all(Array.from({ length: 3 }, () => reserveGrade(env, slot(null, { free: true }), now, { fairUse: false })))
    expect(results).toEqual([null, null, null])
  })

  it('names the cap that blocked the reservation', () => {
    expect(capReached({ writingToday: CAPS.writingPerDay, speakingToday: 0, graded30d: 0 }, 'writing')).toBe('daily')
    expect(capReached({ writingToday: 0, speakingToday: CAPS.speakingPerDay, graded30d: 0 }, 'speaking')).toBe('daily')
    expect(capReached({ writingToday: 0, speakingToday: 0, graded30d: CAPS.gradedPer30Days }, 'writing')).toBe('rolling30')
    expect(capReached({ writingToday: 0, speakingToday: 0, graded30d: 0 }, 'speaking')).toBeNull()
  })
})

describe('round-2 fixes', () => {
  const at = new Date('2026-10-06T12:00:00Z')
  const insertUser = (id: string) =>
    env.DB.prepare(`INSERT INTO users (id, email, email_hash, created_at, last_active_at) VALUES (?1, ?2, ?3, ?4, ?4)`)
      .bind(id, `${id}@coach.test`, `h-${id}`, at.toISOString())
      .run()
  const row = (id: string, userId: string | null, o: { refused?: number; pending?: number; free?: number; cost?: number }) =>
    env.DB.prepare(
      `INSERT INTO grades (id, user_id, task_id, prompt_index, kind, free, refused, pending, model, cost_micro_usd, created_at)
       VALUES (?1, ?2, 'email', 0, 'writing', ?3, ?4, ?5, 'claude-opus-5', ?6, ?7)`,
    ).bind(id, userId, o.free ?? 0, o.refused ?? 0, o.pending ?? 0, o.cost ?? 0, at.toISOString())

  it('counts calls in flight against the no-feedback limit, so parallel requests cannot exceed it', async () => {
    const { reserveGrade } = await import('../src/lib/usage')
    await insertUser('u_nf')
    await env.DB.batch(Array.from({ length: 9 }, (_, i) => row(`nf_${i}`, 'u_nf', { refused: 1 })))
    const results = await Promise.all(
      Array.from({ length: 15 }, (_, i) =>
        reserveGrade(
          env,
          { id: `nf_p_${i}`, userId: 'u_nf', taskId: 'email', promptIndex: 0, kind: 'writing', free: false, model: 'claude-opus-5', costMicroUsd: 1, createdAt: at.toISOString() },
          at,
          { fairUse: true },
        ),
      ),
    )
    expect(results.filter((r) => r === null)).toHaveLength(1)
    expect(results.filter((r) => r === 'no_feedback')).toHaveLength(14)
  })

  it('leaves pending worst-case placeholders out of the spend tiers', async () => {
    const { evaluateTiers, spendSnapshot } = await import('../src/lib/spend')
    await env.DB.batch(Array.from({ length: 12 }, (_, i) => row(`sp_${i}`, null, { free: 1, pending: 1, cost: 234_200 })))
    const s = await spendSnapshot(env, at)
    expect(s.freeTodayUsd).toBe(0)
    expect(evaluateTiers(s).freeOff).toBe(false)
  })
})

describe('shared daily speaking allowance (memo §7.2 Z2)', () => {
  let k = 0
  const speakingRow = (createdAt: string, o: { seconds?: number; pending?: number; kind?: string; userId?: string | null }) =>
    env.DB.prepare(
      `INSERT INTO grades (id, user_id, task_id, prompt_index, kind, pending, model, audio_seconds, created_at)
       VALUES (?1, ?2, 'advice', 0, ?3, ?4, 'm', ?5, ?6)`,
    ).bind(`g_allow_${++k}`, o.userId ?? null, o.kind ?? 'speaking', o.pending ?? 0, o.seconds ?? 0, createdAt)

  it('adds up audio minutes of every user today, counting calls in flight as full-length answers', async () => {
    const day = new Date('2026-11-20T15:00:00Z')
    expect(await speakingMinutesToday(env, day)).toBe(0)
    await env.DB.batch([
      speakingRow('2026-11-19T23:59:59.999Z', { seconds: 6000 }), // yesterday: not counted
      speakingRow('2026-11-20T00:00:00.000Z', { seconds: 90 }),
      speakingRow('2026-11-20T09:30:00.000Z', { seconds: 30, userId: 'u_a' }),
      speakingRow('2026-11-20T10:00:00.000Z', { pending: 1 }), // running: counts as CAPS.maxAudioSeconds
      speakingRow('2026-11-20T10:00:01.000Z', { pending: 1, kind: 'writing' }), // writing in flight: no audio
    ])
    expect(await speakingMinutesToday(env, day)).toBe((90 + 30 + CAPS.maxAudioSeconds) / 60)
    expect(await speakingAvailableToday(env, day)).toBe(true)
  })

  it(`closes speaking for the day at ${SPEAKING_DAILY_AUDIO_MINUTES} audio minutes and reopens at 00:00 UTC`, async () => {
    const day = new Date('2026-11-21T20:00:00Z')
    const limit = SPEAKING_DAILY_AUDIO_MINUTES * 60
    await env.DB.batch([speakingRow('2026-11-21T01:00:00.000Z', { seconds: limit - CAPS.maxAudioSeconds - 1 })])
    expect(await speakingAvailableToday(env, day)).toBe(true)
    // one more answer in flight takes it to one second short of the allowance
    await env.DB.batch([speakingRow('2026-11-21T19:59:00.000Z', { pending: 1 })])
    expect(await speakingMinutesToday(env, day)).toBeCloseTo(SPEAKING_DAILY_AUDIO_MINUTES - 1 / 60, 10)
    expect(await speakingAvailableToday(env, day)).toBe(true)
    await env.DB.batch([speakingRow('2026-11-21T19:59:30.000Z', { seconds: 1 })])
    expect(await speakingMinutesToday(env, day)).toBe(SPEAKING_DAILY_AUDIO_MINUTES)
    expect(await speakingAvailableToday(env, day)).toBe(false)
    expect(await speakingAvailableToday(env, new Date('2026-11-22T00:00:00Z'))).toBe(true)
  })

  it('stays within the Workers AI free allocation (10,000 neurons/day at 46.63 neurons per audio minute)', () => {
    expect(SPEAKING_DAILY_AUDIO_MINUTES * 46.63).toBeLessThan(10_000)
  })
})
