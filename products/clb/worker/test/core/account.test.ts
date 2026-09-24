import { env } from 'cloudflare:workers'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MeResponse } from '../../../shared/api'
import { MARKETING_CONSENT } from '../../../shared/config'
import { addDays } from '../../src/lib/time'
import { api, count, sessionHash, signIn, stubFetch, uniqueEmail, userByEmail } from './helpers'

const CONSENT = MARKETING_CONSENT.en('1 Test St, Toronto ON M5V 0A1', 'https://coach.test')

// no test may reach the network: every outbound call hits a stub (tests re-stub when they need to)
beforeEach(() => {
  stubFetch()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function insertGrade(userId: string | null, id: string, createdAt = new Date().toISOString()): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO grades (id, user_id, task_id, prompt_index, kind, input_text, result_json, model, cost_micro_usd, created_at)
     VALUES (?1, ?2, 'w1', 0, 'writing', 'essay text', '{}', 'claude-opus-5', 1000, ?3)`,
  )
    .bind(id, userId, createdAt)
    .run()
}

async function insertPurchaseAndPass(userId: string, tag: string, now = new Date()): Promise<void> {
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO purchases (id, user_id, sku, amount_cents, currency, status, created_at, paid_at)
       VALUES (?1, ?2, 'pass30', 3900, 'cad', 'paid', ?3, ?3)`,
    ).bind(`cs_${tag}`, userId, now.toISOString()),
    env.DB.prepare(
      `INSERT INTO passes (id, user_id, sku, starts_at, ends_at, purchase_id) VALUES (?1, ?2, 'pass30', ?3, ?4, ?5)`,
    ).bind(`p_${tag}`, userId, addDays(now, -1).toISOString(), addDays(now, 29).toISOString(), `cs_${tag}`),
  ])
}

describe('GET /api/me', () => {
  it('signed out: zero usage, free writing available, public flags', async () => {
    const res = await api('/api/me', { device: `dev-${uniqueEmail('d')}` })
    expect(res.status).toBe(200)
    const body = (await res.json()) as MeResponse
    expect(body).toEqual({
      signedIn: false,
      pass: null,
      free: { writing: true, speaking: false },
      usage: { writingToday: 0, speakingToday: 0, graded30d: 0 },
      flags: { checkoutEnabled: false, gradingEnabled: true, banner: '' },
    })
  })

  it('signed in: email, active pass, usage, free speaking; refreshes last_active_at', async () => {
    const email = uniqueEmail('me')
    const { session } = await signIn(email)
    const user = await userByEmail(email)
    await insertPurchaseAndPass(user!.id, user!.id)
    await insertGrade(user!.id, `g_me_${user!.id}`)
    const old = addDays(new Date(), -10).toISOString()
    await env.DB.prepare('UPDATE users SET last_active_at = ?1 WHERE id = ?2').bind(old, user!.id).run()
    await env.FLAGS.put('flag:banner', 'Scheduled maintenance tonight')

    const body = (await (await api('/api/me', { session })).json()) as MeResponse
    await env.FLAGS.delete('flag:banner')
    expect(body.signedIn).toBe(true)
    expect(body.email).toBe(email)
    expect(body.pass).toMatchObject({ sku: 'pass30' })
    expect(Date.parse(body.pass!.endsAt)).toBeGreaterThan(Date.now())
    expect(body.usage).toEqual({ writingToday: 1, speakingToday: 0, graded30d: 1 })
    expect(body.free.speaking).toBe(true)
    expect(body.flags.banner).toBe('Scheduled maintenance tonight')
    expect((await userByEmail(email))!.last_active_at > old).toBe(true)
  })

  it('signed in without a pass: pass is null; free samples off when the flag is off', async () => {
    const { session } = await signIn(uniqueEmail('nopass'))
    await env.FLAGS.put('flag:free_enabled', 'false')
    const body = (await (await api('/api/me', { session })).json()) as MeResponse
    await env.FLAGS.delete('flag:free_enabled')
    expect(body.pass).toBeNull()
    expect(body.free).toEqual({ writing: false, speaking: false })
  })
})

describe('POST /api/account/delete', () => {
  it('requires sign-in', async () => {
    const res = await api('/api/account/delete', { body: {} })
    expect(res.status).toBe(401)
  })

  it("removes the user's grades, sessions, tickets and profile but keeps payment records", async () => {
    const email = uniqueEmail('delete')
    const { session } = await signIn(email)
    const other = await signIn(uniqueEmail('bystander'))
    const user = (await userByEmail(email))!
    const bystander = (await env.DB.prepare('SELECT user_id FROM sessions WHERE id_hash = ?1')
      .bind(await sessionHash(other.session))
      .first<{ user_id: string }>())!.user_id
    await insertPurchaseAndPass(user.id, `del_${user.id}`)
    for (let i = 0; i < 3; i++) await insertGrade(user.id, `g_del_${user.id}_${i}`)
    await insertGrade(bystander, `g_keep_${bystander}`)
    await env.DB.prepare("INSERT INTO support_tickets (id, user_id, message, lang, created_at) VALUES (?1, ?2, 'help me please', 'en', ?3)")
      .bind(`t_del_${user.id}`, user.id, new Date().toISOString())
      .run()
    await env.DB.prepare('UPDATE users SET marketing_opt_in = 1, marketing_consent_text = ?2, marketing_consent_at = ?3 WHERE id = ?1')
      .bind(user.id, CONSENT, new Date().toISOString())
      .run()

    const res = await api('/api/account/delete', { body: {}, session })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(res.headers.get('set-cookie')).toMatch(/mpc_session=; Path=\/; Max-Age=0/)

    expect(await count('SELECT COUNT(*) AS n FROM grades WHERE user_id = ?1', user.id)).toBe(0)
    expect(await count('SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?1', user.id)).toBe(0)
    expect(await count('SELECT COUNT(*) AS n FROM support_tickets WHERE user_id = ?1', user.id)).toBe(0)
    expect(await count('SELECT COUNT(*) AS n FROM magic_links WHERE email = ?1', email)).toBe(0)
    expect(await count('SELECT COUNT(*) AS n FROM purchases WHERE user_id = ?1', user.id)).toBe(1)
    expect(await count('SELECT COUNT(*) AS n FROM passes WHERE user_id = ?1', user.id)).toBe(1)
    expect(await count('SELECT COUNT(*) AS n FROM grades WHERE user_id = ?1', bystander)).toBe(1)

    const tomb = await env.DB.prepare('SELECT * FROM users WHERE id = ?1').bind(user.id).first<Record<string, unknown>>()
    expect(tomb).toMatchObject({
      email: `deleted:${user.id}`,
      email_hash: user.email_hash,
      marketing_opt_in: 0,
      marketing_consent_text: null,
      marketing_consent_at: null,
    })
    expect(tomb?.deleted_at).toBeTruthy()

    const after = (await (await api('/api/me', { session })).json()) as MeResponse
    expect(after.signedIn).toBe(false)

    // the same address can sign up again as a new user
    await signIn(email)
    const again = await userByEmail(email)
    expect(again?.id).not.toBe(user.id)
    expect(again?.email_hash).toBe(user.email_hash)
  })
})

describe('POST /api/account/marketing', () => {
  it('withdraws and re-gives consent', async () => {
    const email = uniqueEmail('mkt')
    const { session } = await signIn(email, { extra: { marketingOptIn: true, marketingConsentText: CONSENT } })
    expect((await userByEmail(email))?.marketing_opt_in).toBe(1)

    const off = await api('/api/account/marketing', { body: { optIn: false }, session })
    expect(off.status).toBe(200)
    const u1 = await userByEmail(email)
    expect(u1?.marketing_opt_in).toBe(0)
    expect(u1?.marketing_withdrawn_at).toBeTruthy()

    expect((await api('/api/account/marketing', { body: { optIn: true }, session })).status).toBe(400)
    expect((await api('/api/account/marketing', { body: { optIn: 'yes' }, session })).status).toBe(400)
    const on = await api('/api/account/marketing', { body: { optIn: true, consentText: CONSENT }, session })
    expect(on.status).toBe(200)
    const u2 = await userByEmail(email)
    expect(u2).toMatchObject({ marketing_opt_in: 1, marketing_consent_text: CONSENT, marketing_withdrawn_at: null })
  })

  it('requires sign-in', async () => {
    expect((await api('/api/account/marketing', { body: { optIn: false } })).status).toBe(401)
  })
})

describe('POST /api/support', () => {
  it('stores the ticket and forwards it to the owner', async () => {
    const email = uniqueEmail('support')
    const { session } = await signIn(email)
    const stub = stubFetch()
    const res = await api('/api/support', { body: { message: '  My recording did not upload.  ', lang: 'ko' }, session })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })

    const [alert] = stub.emails()
    expect(alert?.to).toEqual(['owner@coach.test'])
    expect(alert?.subject).toMatch(/^\[MPC\] Support ticket t_/)
    expect(alert?.text).toContain('My recording did not upload.')
    expect(alert?.text).toContain(email)
    expect(alert?.text).toContain('Language: ko')

    const user = await userByEmail(email)
    const ticket = await env.DB.prepare('SELECT * FROM support_tickets WHERE user_id = ?1').bind(user!.id).first<Record<string, unknown>>()
    expect(ticket).toMatchObject({ message: 'My recording did not upload.', lang: 'ko', forwarded: 1 })
  })

  it('validates length and language', async () => {
    stubFetch()
    expect((await api('/api/support', { body: { message: 'too short', lang: 'en' } })).status).toBe(400)
    expect((await api('/api/support', { body: { message: 'x'.repeat(4001), lang: 'en' } })).status).toBe(400)
    expect((await api('/api/support', { body: { message: 'long enough message', lang: 'fr' } })).status).toBe(400)
  })

  it('limits signed-in users to 5 tickets per UTC day', async () => {
    const { session } = await signIn(uniqueEmail('suplimit'))
    stubFetch()
    for (let i = 0; i < 5; i++) {
      expect((await api('/api/support', { body: { message: `question number ${i}`, lang: 'en' }, session })).status).toBe(200)
    }
    const sixth = await api('/api/support', { body: { message: 'question number 6', lang: 'en' }, session })
    expect(sixth.status).toBe(429)
    expect(await sixth.json()).toMatchObject({ error: 'rate_limited' })
  })

  it('limits signed-out visitors to 5 tickets per device per day; alerts say they are signed out', async () => {
    const stub = stubFetch()
    const device = `dev-support-${uniqueEmail('x')}`
    for (let i = 0; i < 5; i++) {
      expect((await api('/api/support', { body: { message: `anonymous question ${i}`, lang: 'en' }, device })).status).toBe(200)
    }
    expect((await api('/api/support', { body: { message: 'anonymous question 6', lang: 'en' }, device })).status).toBe(429)
    expect((await api('/api/support', { body: { message: 'other device question', lang: 'en' }, device: `${device}-2` })).status).toBe(200)
    expect(stub.emails()).toHaveLength(6)
    expect(stub.emails()[0]?.text).toContain('signed-out visitor')
  })

  it('keeps the ticket unforwarded when the alert email fails', async () => {
    stubFetch({ resendOk: false })
    const device = `dev-support-fail-${uniqueEmail('x')}`
    const res = await api('/api/support', { body: { message: 'please call me back', lang: 'en' }, device })
    expect(res.status).toBe(200)
    expect(await count("SELECT COUNT(*) AS n FROM support_tickets WHERE message = 'please call me back' AND forwarded = 0")).toBe(1)
  })
})
