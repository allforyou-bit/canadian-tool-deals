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
