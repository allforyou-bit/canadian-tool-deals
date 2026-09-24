import { env } from 'cloudflare:test'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { magicLinkAllows, requestMagicLink, stagingAllows } from '../src/auth'
import type { Ctx, Env } from '../src/env'
import { magicLinkBody, stubFetch, uniqueEmail } from './core/helpers'

afterEach(() => {
  vi.unstubAllGlobals()
})

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

describe('staging: email sign-in links (memo §7.2 Z3: MAGIC_LINK modes keep the staging list)', () => {
  const STAGING = 'owner@coach.test, tester@example.com'
  const ctxFor = (over: Partial<Env>): Ctx => ({
    env: { ...(env as Env), STAGING_ALLOWED_EMAILS: STAGING, MAGIC_LINK: undefined, LEARNER_EMAIL: undefined, ...over } as Env,
    exec: { waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext,
    user: null,
    ipHash: 'ip-staging',
    deviceHash: 'dev-staging',
    country: 'CA',
    region: 'ON',
    now: new Date(),
  })
  const ask = (email: string, over: Partial<Env> = {}) =>
    requestMagicLink(
      new Request('https://coach.test/api/auth/magic-link', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'https://coach.test' },
        body: JSON.stringify(magicLinkBody(email)),
      }),
      ctxFor(over),
    )

  it('the staging list decides, whatever MAGIC_LINK says (except off)', async () => {
    const e = ctxFor({}).env
    expect(magicLinkAllows(e, 'tester@example.com')).toBe('ok')
    expect(magicLinkAllows({ ...e, MAGIC_LINK: 'all' }, 'someone@example.com')).toBe('staging')
    expect(magicLinkAllows({ ...e, MAGIC_LINK: 'off' }, 'owner@coach.test')).toBe('off')
  })

  it('refuses unlisted addresses with the staging message and sends the owner a link', async () => {
    const stub = stubFetch()
    const refused = await ask(uniqueEmail('stranger'))
    expect(refused.status).toBe(403)
    expect(await refused.json()).toMatchObject({ error: 'forbidden', message: 'This test site only accepts the owner’s email address' })
    const owner = await ask('owner@coach.test')
    expect(owner.status).toBe(200)
    expect(stub.emails().map((m) => m.to)).toEqual([['owner@coach.test']])
  })

  it('a listed tester who is not the owner gets no email while LEARNER_EMAIL is off (Resend sandbox)', async () => {
    const stub = stubFetch()
    expect((await ask('tester@example.com')).status).toBe(500)
    expect(stub.emails()).toHaveLength(0)
    expect((await ask('tester@example.com', { LEARNER_EMAIL: 'on' })).status).toBe(200)
    expect(stub.emails().map((m) => m.to)).toEqual([['tester@example.com']])
  })
})
