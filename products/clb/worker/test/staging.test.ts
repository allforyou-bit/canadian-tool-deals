import { env } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import { stagingAllows } from '../src/auth'
import type { Env } from '../src/env'

describe('staging allowlist (STAGING_ALLOWED_EMAILS)', () => {
  const withList = (list?: string) => ({ ...env, STAGING_ALLOWED_EMAILS: list }) as Env

  it('allows everyone when unset (production)', () => {
    expect(stagingAllows(withList(undefined), 'anyone@example.com')).toBe(true)
    expect(stagingAllows(withList('  '), 'anyone@example.com')).toBe(true)
    expect(stagingAllows(withList(undefined), null)).toBe(true)
  })

  it('allows only listed addresses when set, case-insensitively', () => {
    const e = withList('owner@coach.test, Second@Coach.test')
    expect(stagingAllows(e, 'owner@coach.test')).toBe(true)
    expect(stagingAllows(e, 'second@coach.test')).toBe(true)
    expect(stagingAllows(e, 'someone@else.test')).toBe(false)
    expect(stagingAllows(e, null)).toBe(false)
  })
})

describe('staging: no anonymous grading', () => {
  it('refuses an anonymous writing sample when STAGING_ALLOWED_EMAILS is set', async () => {
    const { gradeWriting } = await import('../src/grading')
    const req = new Request('https://coach.test/api/grade/writing', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://coach.test' },
      body: JSON.stringify({ taskId: 'email', promptIndex: 0, text: 'Dear neighbour, I am writing about the noise.', explanationLang: 'en' }),
    })
    const ctx = {
      env: { ...env, STAGING_ALLOWED_EMAILS: 'owner@coach.test' } as Env,
      exec: { waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext,
      user: null,
      ipHash: 'ip-staging',
      deviceHash: 'dev-staging',
      country: 'CA',
      region: 'ON',
      now: new Date(),
    }
    const res = await gradeWriting(req, ctx)
    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ error: 'unauthorized' })
  })
})
