import { env } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import { CAPS } from '../../shared/config'
import { addDays, startOfUtcDay } from '../src/lib/time'
import {
  capReached,
  getUsage,
  type GradeReservation,
  noFeedbackToday,
  recordFreeSpeaking,
  recordFreeWriting,
  reserveGrade,
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

  it(`lets exactly ${CAPS.writingPerDay} of 20 parallel reservations through the daily writing cap`, async () => {
    const u = await user()
    const results = await Promise.all(Array.from({ length: 20 }, () => reserveGrade(env, slot(u), now, { fairUse: true })))
    expect(results.filter((r) => r === null)).toHaveLength(CAPS.writingPerDay)
    expect(results.filter((r) => r === 'daily')).toHaveLength(20 - CAPS.writingPerDay)
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
    expect(await reserveGrade(env, slot(u), now, { fairUse: true })).toBeNull()
    await insertRows(u, 1, { refused: 1 })
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
