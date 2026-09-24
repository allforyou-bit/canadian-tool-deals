// Buyer emails never change a billing outcome: emailBuyer / emailBuyerOf resolve to false instead of
// rejecting, whatever fails underneath (Resend, the contact lookup, or sendEmail itself).
import { env } from 'cloudflare:test'
import { type MockInstance, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { emailBuyer, emailBuyerOf } from '../../src/billing/notify'
import type { Env } from '../../src/env'
import { FakeStripe, createUser, deleteAccount, learnerEmailOn } from './helpers'

/** An env whose every read throws, so sendEmail (and getContact) fail wherever they first touch it. */
const throwingEnv = (thrown: unknown): Env =>
  new Proxy({} as Env, {
    get() {
      throw thrown
    },
  })
const brokenEnv = throwingEnv(new Error('env unavailable'))

const compose = (lang: 'en' | 'ko') => ({ subject: `subject-${lang}`, text: `text-${lang}` })

describe('buyer notifications', () => {
  let stripe: FakeStripe
  let errors: MockInstance<typeof console.error>
  beforeEach(() => {
    stripe = new FakeStripe().install()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    errors = vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('emailBuyer sends a transactional email and reports delivery', async () => {
    const sent = await emailBuyer(learnerEmailOn(), { to: 'buyer@example.test', subject: 's', text: 't', idempotencyKey: 'k1' })
    expect(sent).toBe(true)
    expect(stripe.emails).toMatchObject([{ to: 'buyer@example.test', subject: 's', idempotencyKey: 'k1' }])
    // transactional mail carries the unsubscribe footer (alerts do not)
    expect(stripe.emails[0].text).toContain('/unsubscribe/#h=')
  })

  it('emailBuyer resolves to false when Resend refuses or the connection drops', async () => {
    stripe.resendFailure = 'status'
    expect(await emailBuyer(learnerEmailOn(), { to: 'buyer@example.test', subject: 's', text: 't' })).toBe(false)
    stripe.resendFailure = 'throw'
    expect(await emailBuyer(learnerEmailOn(), { to: 'buyer@example.test', subject: 's', text: 't' })).toBe(false)
    expect(stripe.emailAttempts).toBe(2)
  })

  it('emailBuyer resolves to false, and logs no address, when sending throws', async () => {
    await expect(emailBuyer(brokenEnv, { to: 'buyer@example.test', subject: 's', text: 't' })).resolves.toBe(false)
    expect(errors).toHaveBeenCalledWith('billing: buyer email failed', 'Error')
    expect(JSON.stringify(errors.mock.calls)).not.toContain('@')
    expect(stripe.emailAttempts).toBe(0)
  })

  it('logs only "unknown" for a thrown value that is not an Error', async () => {
    const odd = throwingEnv('buyer@example.test')
    await expect(emailBuyer(odd, { to: 'buyer@example.test', subject: 's', text: 't' })).resolves.toBe(false)
    await expect(emailBuyerOf(odd, 'u_any', compose, 'k0')).resolves.toBe(false)
    expect(errors.mock.calls).toEqual([
      ['billing: buyer email failed', 'unknown'],
      ['billing: buyer email failed', 'unknown'],
    ])
  })

  it("emailBuyerOf writes in the buyer's saved language", async () => {
    const { user } = await createUser({ lang: 'ko' })
    expect(await emailBuyerOf(learnerEmailOn(), user.id, compose, 'k2')).toBe(true)
    expect(stripe.emails).toMatchObject([{ to: user.email, subject: 'subject-ko', idempotencyKey: 'k2' }])
  })

  it('emailBuyerOf sends nothing for a deleted account or an unknown user', async () => {
    const { user } = await createUser()
    await deleteAccount(user.id)
    expect(await emailBuyerOf(learnerEmailOn(), user.id, compose, 'k3')).toBe(false)
    expect(await emailBuyerOf(learnerEmailOn(), 'u_missing', compose, 'k4')).toBe(false)
    expect(stripe.emailAttempts).toBe(0)
  })

  it('emailBuyerOf resolves to false when the contact lookup fails', async () => {
    const { user } = await createUser()
    await expect(emailBuyerOf(brokenEnv, user.id, compose, 'k5')).resolves.toBe(false)
    expect(errors).toHaveBeenCalledWith('billing: buyer email failed', 'Error')
    expect(JSON.stringify(errors.mock.calls)).not.toContain(user.email)
  })

  it('goes through sendEmail, so learner email off (the default) sends nothing', async () => {
    const { user } = await createUser()
    expect(await emailBuyerOf({ ...env, LEARNER_EMAIL: 'off' } as Env, user.id, compose, 'k6')).toBe(false)
    expect(stripe.emailAttempts).toBe(0)
  })
})
