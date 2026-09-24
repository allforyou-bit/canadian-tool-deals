import { env } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import { recordFreeSpeaking, recordFreeWriting } from '../src/lib/usage'

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
