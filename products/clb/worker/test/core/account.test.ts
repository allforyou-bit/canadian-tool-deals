import { env } from 'cloudflare:workers'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MeResponse } from '../../../shared/api'
import { MARKETING_CONSENT } from '../../../shared/config'
import {
  accessEnd,
  DELETED_TICKET_MESSAGE,
  setMarketing,
  SUPPORT_FORWARDS_PER_DAY,
  SUPPORT_KV,
  SUPPORT_PER_DAY,
  supportEmailsToday,
} from '../../src/account'
import { unsubscribeSignature, unsubscribeUrl } from '../../src/email'
import type { Ctx, Env } from '../../src/env'
import { getUser } from '../../src/lib/session'
import { clearSpendCache, spendSnapshot } from '../../src/lib/spend'
import { addDays, dayKey, startOfUtcDay } from '../../src/lib/time'
import {
  api,
  CONSENT_EN as CONSENT,
  CONSENT_KO,
  count,
  emailHashOf,
  ORIGIN,
  sessionHash,
  setEnv,
  signIn,
  stubFetch,
  uniqueEmail,
  useEmailSignInForEveryone,
  userByEmail,
} from './helpers'

useEmailSignInForEveryone()

// no test may reach the network: every outbound call hits a stub (tests re-stub when they need to)
beforeEach(() => {
  stubFetch()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function insertGrade(
  userId: string | null,
  id: string,
  createdAt = new Date().toISOString(),
  opts: { costMicro?: number; free?: boolean } = {},
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO grades (id, user_id, device_hash, task_id, prompt_index, kind, input_text, result_json, error_kinds,
                         free, outcome, model, cost_micro_usd, created_at)
     VALUES (?1, ?2, 'devhash', 'w1', 0, 'writing', 'essay text', '{}', 'grammar', ?3, 'graded', 'claude-opus-5', ?4, ?5)`,
  )
    .bind(id, userId, opts.free ? 1 : 0, opts.costMicro ?? 1000, createdAt)
    .run()
}

async function insertPass(
  userId: string,
  tag: string,
  startsAt: Date,
  endsAt: Date,
  opts: { sku?: 'pass30' | 'pass90'; revoked?: boolean; createdAt?: Date; status?: string } = {},
): Promise<void> {
  const created = (opts.createdAt ?? new Date()).toISOString()
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO purchases (id, user_id, sku, amount_cents, currency, status, created_at, paid_at)
       VALUES (?1, ?2, ?3, 3900, 'cad', ?4, ?5, ?5)`,
    ).bind(`cs_${tag}`, userId, opts.sku ?? 'pass30', opts.status ?? 'paid', created),
    env.DB.prepare(
      `INSERT INTO passes (id, user_id, sku, starts_at, ends_at, purchase_id, revoked_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
    ).bind(
      `p_${tag}`,
      userId,
      opts.sku ?? 'pass30',
      startsAt.toISOString(),
      endsAt.toISOString(),
      `cs_${tag}`,
      opts.revoked ? created : null,
    ),
  ])
}

/** Calls a handler directly with a hand-built Ctx (for env overrides). */
function directCtx(overrides: Partial<Env>, user: Ctx['user']): Ctx {
  return {
    env: Object.create(env, Object.fromEntries(Object.entries(overrides).map(([k, v]) => [k, { value: v }]))) as Env,
    exec: { waitUntil: () => {}, passThroughOnException: () => {} } as unknown as ExecutionContext,
    user,
    ipHash: 'ip-test',
    deviceHash: 'device-test',
    country: null,
    region: null,
    now: new Date(),
  }
}

function post(path: string, body: unknown): Request {
  return new Request(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: ORIGIN },
    body: JSON.stringify(body),
  })
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
      flags: { checkoutEnabled: false, gradingEnabled: true, freeEnabled: true, banner: '', speakingAvailable: true },
      auth: { google: false, magicLink: 'all' },
    })
  })

  it('auth: Google only with both the client id and the secret; the email-link mode, owner by default', async () => {
    const me = async () => ((await (await api('/api/me')).json()) as MeResponse).auth
    let restore = setEnv({ MAGIC_LINK: undefined, GOOGLE_CLIENT_ID: 'cid.apps.googleusercontent.com' })
    try {
      expect(await me()).toEqual({ google: false, magicLink: 'owner' })
    } finally {
      restore()
    }
    restore = setEnv({ MAGIC_LINK: 'off', GOOGLE_CLIENT_ID: 'cid.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET: 'secret' })
    try {
      expect(await me()).toEqual({ google: true, magicLink: 'off' })
    } finally {
      restore()
    }
  })

  it('flags.speakingAvailable: off once today\'s shared speaking minutes are used up, and while grading is off', async () => {
    const speaking = async () => ((await (await api('/api/me')).json()) as MeResponse).flags.speakingAvailable
    expect(await speaking()).toBe(true)
    const id = `g_minutes_${uniqueEmail('row')}`
    // 200 audio minutes transcribed today, all users together
    await env.DB.prepare(
      `INSERT INTO grades (id, user_id, task_id, prompt_index, kind, model, audio_seconds, created_at)
       VALUES (?1, NULL, 's1', 0, 'speaking', 'claude-opus-5', 12000, ?2)`,
    )
      .bind(id, new Date().toISOString())
      .run()
    try {
      expect(await speaking()).toBe(false)
    } finally {
      await env.DB.prepare('DELETE FROM grades WHERE id = ?1').bind(id).run()
    }
    expect(await speaking()).toBe(true)
    await env.FLAGS.put('flag:grading_enabled', 'false')
    try {
      expect(await speaking()).toBe(false)
    } finally {
      await env.FLAGS.delete('flag:grading_enabled')
    }
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
    expect(body.accessEndsAt).toBeNull()
    expect(body.latestPurchase).toBeNull()
    expect(body.free).toEqual({ writing: false, speaking: false })
    expect(body.flags.freeEnabled).toBe(false)
  })

  it('freeEnabled is false while the spend tiers switch free samples off (the KV flag still on)', async () => {
    const { session } = await signIn(uniqueEmail('freeoff'))
    const device = `dev-${uniqueEmail('freeoff')}`
    let body = (await (await api('/api/me', { session, device })).json()) as MeResponse
    expect(body.flags.freeEnabled).toBe(true)
    expect(body.free).toEqual({ writing: true, speaking: true })

    // the free budget (US$0.50 a day) is used up: the grade handlers refuse free samples from now on
    const id = `g_freeoff_${uniqueEmail('row')}`
    await insertGrade(null, id, undefined, { costMicro: 2_010_000, free: true })
    // /api/me reuses a spend snapshot for up to a minute (memo §7.2 Z2); start from a fresh one
    clearSpendCache()
    try {
      expect(await env.FLAGS.get('flag:free_enabled')).toBeNull()
      for (const s of [session, undefined]) {
        body = (await (await api('/api/me', { session: s, device })).json()) as MeResponse
        expect(body.flags.freeEnabled).toBe(false)
        expect(body.free).toEqual({ writing: false, speaking: false })
      }
    } finally {
      await env.DB.prepare('DELETE FROM grades WHERE id = ?1').bind(id).run()
    }
    clearSpendCache()
    body = (await (await api('/api/me', { session, device })).json()) as MeResponse
    expect(body.flags.freeEnabled).toBe(true)
  })

  it('reads the spend snapshot from the per-isolate cache, not from D1 on every call', async () => {
    clearSpendCache()
    const device = `dev-${uniqueEmail('cache')}`
    expect(((await (await api('/api/me', { device })).json()) as MeResponse).flags.freeEnabled).toBe(true)
    const id = `g_cache_${uniqueEmail('row')}`
    await insertGrade(null, id, undefined, { costMicro: 2_010_000, free: true })
    try {
      // within the minute the cached snapshot (free budget not used up) still answers
      expect(((await (await api('/api/me', { device })).json()) as MeResponse).flags.freeEnabled).toBe(true)
      clearSpendCache()
      expect(((await (await api('/api/me', { device })).json()) as MeResponse).flags.freeEnabled).toBe(false)
    } finally {
      await env.DB.prepare('DELETE FROM grades WHERE id = ?1').bind(id).run()
      clearSpendCache()
    }
  })

  it('accessEndsAt covers queued passes; latestPurchase is the newest purchase', async () => {
    const email = uniqueEmail('chain')
    const { session } = await signIn(email)
    const uid = (await userByEmail(email))!.id
    const now = new Date()
    const aEnd = addDays(now, 29)
    const bEnd = addDays(aEnd, 90)
    await insertPass(uid, `a_${uid}`, addDays(now, -1), aEnd, { createdAt: addDays(now, -1) })
    // bought a second pass: queued to start when the first ends
    await insertPass(uid, `b_${uid}`, aEnd, bEnd, { sku: 'pass90', createdAt: now })
    // a revoked pass right after would extend the chain if it counted
    await insertPass(uid, `r_${uid}`, bEnd, addDays(bEnd, 30), { revoked: true, createdAt: addDays(now, -2), status: 'refunded' })

    let body = (await (await api('/api/me', { session })).json()) as MeResponse
    expect(body.pass).toEqual({ sku: 'pass30', startsAt: addDays(now, -1).toISOString(), endsAt: aEnd.toISOString() })
    expect(body.accessEndsAt).toBe(bEnd.toISOString())
    expect(body.latestPurchase).toEqual({ id: `cs_b_${uid}`, sku: 'pass90', status: 'paid', receiptUrl: null })

    // Stripe's receipt link (memo §7.2 Z4: shown on the site instead of a receipt email); only https passes
    await env.DB.prepare('UPDATE purchases SET receipt_url = ?1 WHERE id = ?2')
      .bind('https://pay.stripe.com/receipts/payment/abc', `cs_b_${uid}`)
      .run()
    body = (await (await api('/api/me', { session })).json()) as MeResponse
    expect(body.latestPurchase?.receiptUrl).toBe('https://pay.stripe.com/receipts/payment/abc')
    await env.DB.prepare('UPDATE purchases SET receipt_url = ?1 WHERE id = ?2').bind('javascript:alert(1)', `cs_b_${uid}`).run()
    body = (await (await api('/api/me', { session })).json()) as MeResponse
    expect(body.latestPurchase?.receiptUrl).toBeNull()

    // a checkout that is still pending is the latest purchase (the success page waits for it)
    await env.DB.prepare(
      "INSERT INTO purchases (id, user_id, sku, amount_cents, currency, status, created_at) VALUES (?1, ?2, 'pass30', 3900, 'cad', 'pending', ?3)",
    )
      .bind(`cs_pending_${uid}`, uid, addDays(now, 0.001).toISOString())
      .run()
    body = (await (await api('/api/me', { session })).json()) as MeResponse
    expect(body.latestPurchase).toEqual({ id: `cs_pending_${uid}`, sku: 'pass30', status: 'pending', receiptUrl: null })
    expect(body.accessEndsAt).toBe(bEnd.toISOString())
  })

  it('accessEnd: follows only a contiguous chain that starts with a running pass', () => {
    const now = new Date('2026-10-01T00:00:00.000Z')
    const p = (s: string, e: string) => ({ starts_at: `2026-${s}T00:00:00.000Z`, ends_at: `2026-${e}T00:00:00.000Z` })
    expect(accessEnd([], now)).toBeNull()
    // only a future pass: nothing running
    expect(accessEnd([p('10-05', '11-04')], now)).toBeNull()
    expect(accessEnd([p('09-20', '10-20'), p('10-20', '11-19'), p('11-19', '12-19')], now)).toBe('2026-12-19T00:00:00.000Z')
    // a gap ends the chain
    expect(accessEnd([p('09-20', '10-20'), p('10-21', '11-20')], now)).toBe('2026-10-20T00:00:00.000Z')
    // overlapping running passes: the later end wins, and the queue continues from it
    expect(accessEnd([p('09-01', '10-10'), p('09-20', '10-20'), p('10-20', '11-19')], now)).toBe('2026-11-19T00:00:00.000Z')
  })
})

describe('POST /api/account/delete', () => {
  it('requires sign-in', async () => {
    const res = await api('/api/account/delete', { body: {} })
    expect(res.status).toBe(401)
  })

  it("removes the user's answers, feedback, sessions, support messages and profile; keeps payment records and anonymous cost rows", async () => {
    const email = uniqueEmail('delete')
    const { session } = await signIn(email)
    const other = await signIn(uniqueEmail('bystander'))
    const user = (await userByEmail(email))!
    const bystander = (await env.DB.prepare('SELECT user_id FROM sessions WHERE id_hash = ?1')
      .bind(await sessionHash(other.session))
      .first<{ user_id: string }>())!.user_id
    await insertPurchaseAndPass(user.id, `del_${user.id}`)
    for (let i = 0; i < 3; i++) await insertGrade(user.id, `g_del_${user.id}_${i}`, undefined, { costMicro: 500_000, free: i === 0 })
    await insertGrade(bystander, `g_keep_${bystander}`)
    await env.DB.prepare("INSERT INTO support_tickets (id, user_id, message, lang, created_at) VALUES (?1, ?2, 'help me please', 'en', ?3)")
      .bind(`t_del_${user.id}`, user.id, new Date().toISOString())
      .run()
    await env.DB.prepare(
      "INSERT INTO support_tickets (id, user_id, message, lang, created_at, forwarded) VALUES (?1, ?2, 'forwarded question', 'en', ?3, 1)",
    )
      .bind(`t_fwd_${user.id}`, user.id, new Date().toISOString())
      .run()
    await env.DB.prepare(
      'UPDATE users SET marketing_opt_in = 1, marketing_consent_text = ?2, marketing_consent_at = ?3, google_sub = ?4 WHERE id = ?1',
    )
      .bind(user.id, CONSENT, new Date().toISOString(), `sub-${user.id}`)
      .run()
    const spendBefore = await spendSnapshot(env, new Date())

    const stub = stubFetch()
    const res = await api('/api/account/delete', { body: {}, session })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(res.headers.get('set-cookie')).toMatch(/mpc_session=; Path=\/; Max-Age=0/)

    // memo B7: none of the user's grades rows remain; decision 5: they stay as anonymous cost rows
    expect(await count('SELECT COUNT(*) AS n FROM grades WHERE user_id = ?1', user.id)).toBe(0)
    const { results: ledger } = await env.DB.prepare(
      'SELECT user_id, device_hash, input_text, result_json, error_kinds, cost_micro_usd, model, kind FROM grades WHERE id LIKE ?1 ORDER BY id',
    )
      .bind(`g_del_${user.id}_%`)
      .all<Record<string, unknown>>()
    expect(ledger).toHaveLength(3)
    for (const row of ledger) {
      expect(row).toEqual({
        user_id: null,
        device_hash: null,
        input_text: null,
        result_json: null,
        error_kinds: null,
        cost_micro_usd: 500_000,
        model: 'claude-opus-5',
        kind: 'writing',
      })
    }
    // the spend tiers and the free budget still see the cost
    const spendAfter = await spendSnapshot(env, new Date())
    expect(spendAfter.monthToDateUsd).toBe(spendBefore.monthToDateUsd)
    expect(spendAfter.freeTodayUsd).toBe(spendBefore.freeTodayUsd)

    expect(await count('SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?1', user.id)).toBe(0)
    // support tickets lose the user id and the message; forwarded and created_at stay, so the rows still
    // count against the owner-email ceiling (decision 7)
    expect(await count('SELECT COUNT(*) AS n FROM support_tickets WHERE user_id = ?1', user.id)).toBe(0)
    expect(
      await count("SELECT COUNT(*) AS n FROM support_tickets WHERE message IN ('help me please', 'forwarded question')"),
    ).toBe(0)
    const { results: tickets } = await env.DB.prepare(
      'SELECT id, user_id, message, lang, forwarded FROM support_tickets WHERE id IN (?1, ?2) ORDER BY id',
    )
      .bind(`t_del_${user.id}`, `t_fwd_${user.id}`)
      .all<Record<string, unknown>>()
    expect(tickets).toEqual([
      { id: `t_del_${user.id}`, user_id: null, message: DELETED_TICKET_MESSAGE, lang: 'en', forwarded: 0 },
      { id: `t_fwd_${user.id}`, user_id: null, message: DELETED_TICKET_MESSAGE, lang: 'en', forwarded: 1 },
    ])
    expect(await count('SELECT COUNT(*) AS n FROM magic_links WHERE email = ?1', email)).toBe(0)
    expect(await count('SELECT COUNT(*) AS n FROM purchases WHERE user_id = ?1', user.id)).toBe(1)
    expect(await count('SELECT COUNT(*) AS n FROM passes WHERE user_id = ?1', user.id)).toBe(1)
    expect(await count('SELECT COUNT(*) AS n FROM grades WHERE user_id = ?1', bystander)).toBe(1)
    expect(
      await count("SELECT COUNT(*) AS n FROM grades WHERE user_id = ?1 AND input_text = 'essay text' AND device_hash = 'devhash'", bystander),
    ).toBe(1)

    // the owner is told which forwarded tickets to delete from the mailbox (ids only, no address)
    const alerts = stub.emails().filter((e) => e.to[0] === 'owner@coach.test')
    expect(alerts).toHaveLength(1)
    expect(alerts[0]?.subject).toContain('Account deleted')
    expect(alerts[0]?.text).toContain(`t_fwd_${user.id}`)
    expect(alerts[0]?.text).not.toContain(`t_del_${user.id}`)
    expect(alerts[0]?.text).not.toContain(email)

    const tomb = await env.DB.prepare('SELECT * FROM users WHERE id = ?1').bind(user.id).first<Record<string, unknown>>()
    expect(tomb).toMatchObject({
      email: `deleted:${user.id}`,
      email_hash: user.email_hash,
      // the Google account id is personal information: it goes with the profile
      google_sub: null,
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

  it('sends no owner alert when the user had no forwarded tickets', async () => {
    const { session } = await signIn(uniqueEmail('delquiet'))
    const stub = stubFetch()
    expect((await api('/api/account/delete', { body: {}, session })).status).toBe(200)
    expect(stub.emails()).toHaveLength(0)
  })

  it('a re-signup with the same email keeps the used free speaking sample and self-refund (decision 9)', async () => {
    const email = uniqueEmail('resignup')
    const { session } = await signIn(email)
    const first = (await userByEmail(email))!
    expect(first).toMatchObject({ free_speaking_used: 0, self_refund_used: 0 })
    await env.DB.prepare('UPDATE users SET free_speaking_used = 1, self_refund_used = 1 WHERE id = ?1').bind(first.id).run()
    expect((await api('/api/account/delete', { body: {}, session })).status).toBe(200)

    const { session: again } = await signIn(email)
    const second = (await userByEmail(email))!
    expect(second.id).not.toBe(first.id)
    expect(second).toMatchObject({ free_speaking_used: 1, self_refund_used: 1 })
    const me = (await (await api('/api/me', { session: again })).json()) as MeResponse
    expect(me.free.speaking).toBe(false)

    // another address starts fresh
    const fresh = uniqueEmail('resignup-other')
    await signIn(fresh)
    expect(await userByEmail(fresh)).toMatchObject({ free_speaking_used: 0, self_refund_used: 0 })
  })
})

describe('POST /api/account/marketing', () => {
  it('withdraws and re-gives consent with the exact server sentence (either language)', async () => {
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
    for (const consentText of ['anything at all', ` ${CONSENT}`, CONSENT.replace('1 Test St', '2 Other St')]) {
      const bad = await api('/api/account/marketing', { body: { optIn: true, consentText }, session })
      expect(bad.status).toBe(400)
      expect(await bad.json()).toMatchObject({ error: 'bad_request', message: expect.stringContaining('reload') })
    }
    expect((await userByEmail(email))?.marketing_opt_in).toBe(0)

    const on = await api('/api/account/marketing', { body: { optIn: true, consentText: CONSENT }, session })
    expect(on.status).toBe(200)
    const u2 = await userByEmail(email)
    expect(u2).toMatchObject({
      marketing_opt_in: 1,
      marketing_consent_text: CONSENT,
      marketing_consent_version: MARKETING_CONSENT.version,
      marketing_withdrawn_at: null,
    })

    expect((await api('/api/account/marketing', { body: { optIn: true, consentText: CONSENT_KO }, session })).status).toBe(200)
    expect((await userByEmail(email))?.marketing_consent_text).toBe(CONSENT_KO)
  })

  it('refuses an opt-in while MAILING_ADDRESS is the placeholder (withdrawal still works)', async () => {
    const email = uniqueEmail('mktplaceholder')
    const { session } = await signIn(email)
    const req = new Request(`${ORIGIN}/api/me`, { headers: { cookie: `mpc_session=${session}` } })
    const user = await getUser(req, env)
    const ctx = directCtx({ MAILING_ADDRESS: 'SET-BEFORE-LAUNCH (CASL: owner mailing address)' }, user)
    const consentText = MARKETING_CONSENT.en('SET-BEFORE-LAUNCH (CASL: owner mailing address)', 'https://coach.test')
    const res = await setMarketing(post('/api/account/marketing', { optIn: true, consentText }), ctx)
    expect(res.status).toBe(400)
    expect((await userByEmail(email))?.marketing_opt_in).toBe(0)
    expect((await setMarketing(post('/api/account/marketing', { optIn: false }), ctx)).status).toBe(200)
  })

  it('requires sign-in', async () => {
    expect((await api('/api/account/marketing', { body: { optIn: false } })).status).toBe(401)
  })
})

describe('POST /api/unsubscribe', () => {
  it('withdraws consent from the link in a learner email, without sign-in', async () => {
    const email = uniqueEmail('unsub')
    const { stub } = await signIn(email, { extra: { marketingOptIn: true, marketingConsentText: CONSENT } })
    expect((await userByEmail(email))?.marketing_opt_in).toBe(1)
    const m = /https:\/\/coach\.test\/unsubscribe\/#h=([0-9a-f]{64})&s=([0-9a-f]{64})/.exec(stub.emails()[0]?.text ?? '')
    expect(m?.[1]).toBe(await emailHashOf(email))

    const res = await api('/api/unsubscribe', { body: { h: m![1], s: m![2] }, device: null })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    const u = await userByEmail(email)
    expect(u?.marketing_opt_in).toBe(0)
    expect(u?.marketing_withdrawn_at).toBeTruthy()
    // the link keeps working (a second click is a harmless no-op)
    expect((await api('/api/unsubscribe', { body: { h: m![1], s: m![2].toUpperCase() } })).status).toBe(200)
  })

  it('rejects a wrong or malformed signature and changes nothing', async () => {
    const email = uniqueEmail('unsubbad')
    await signIn(email, { extra: { marketingOptIn: true, marketingConsentText: CONSENT } })
    const h = await emailHashOf(email)
    const s = await unsubscribeSignature(env, h)
    const wrong = `${s.slice(0, -1)}${s.endsWith('0') ? '1' : '0'}`
    for (const body of [{ h, s: wrong }, { h, s: s.slice(0, 63) }, { h: 'x'.repeat(64), s }, { h }, { h, s: 5 }, [h, s], 'nope']) {
      const res = await api('/api/unsubscribe', { body })
      expect(res.status).toBe(400)
      expect(await res.json()).toMatchObject({ error: 'bad_request' })
    }
    // a signature for another address does not work for this one
    const otherH = await emailHashOf(uniqueEmail('someone-else'))
    expect((await api('/api/unsubscribe', { body: { h, s: await unsubscribeSignature(env, otherH) } })).status).toBe(400)
    expect((await userByEmail(email))?.marketing_opt_in).toBe(1)
  })

  it('answers ok for a valid link whose address has no account', async () => {
    const url = await unsubscribeUrl(env, uniqueEmail('nobody'))
    const [, h, s] = /#h=([0-9a-f]{64})&s=([0-9a-f]{64})$/.exec(url)!
    const res = await api('/api/unsubscribe', { body: { h, s } })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
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

  it('requires sign-in, with or without a device cookie, and sends nothing', async () => {
    const stub = stubFetch()
    for (const device of [undefined, null, `dev-support-${uniqueEmail('x')}`]) {
      const res = await api('/api/support', { body: { message: 'anonymous question here', lang: 'en' }, device })
      expect(res.status).toBe(401)
      expect(await res.json()).toMatchObject({ error: 'unauthorized' })
    }
    expect(stub.emails()).toHaveLength(0)
    expect(await count("SELECT COUNT(*) AS n FROM support_tickets WHERE message = 'anonymous question here'")).toBe(0)
  })

  it('validates length and language', async () => {
    const { session } = await signIn(uniqueEmail('supval'))
    stubFetch()
    expect((await api('/api/support', { body: { message: 'too short', lang: 'en' }, session })).status).toBe(400)
    expect((await api('/api/support', { body: { message: 'x'.repeat(4001), lang: 'en' }, session })).status).toBe(400)
    expect((await api('/api/support', { body: { message: 'long enough message', lang: 'fr' }, session })).status).toBe(400)
    expect((await api('/api/support', { body: ['long enough message'], session })).status).toBe(400)
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

  it('keeps the ticket unforwarded when the alert email fails', async () => {
    const { session } = await signIn(uniqueEmail('supfail'))
    stubFetch({ resendOk: false })
    const res = await api('/api/support', { body: { message: 'please call me back', lang: 'en' }, session })
    expect(res.status).toBe(200)
    expect(await count("SELECT COUNT(*) AS n FROM support_tickets WHERE message = 'please call me back' AND forwarded = 0")).toBe(1)
  })

  it(`forwards at most ${SUPPORT_FORWARDS_PER_DAY} tickets per UTC day, then stores them and sends one digest`, async () => {
    const dayStart = startOfUtcDay(new Date()).toISOString()
    // forwarded tickets and account-deletion notices from earlier tests
    const already = await supportEmailsToday(env, new Date())
    const fill = SUPPORT_FORWARDS_PER_DAY - already - 1
    expect(fill).toBeGreaterThan(0)
    const nowIso = new Date().toISOString()
    await env.DB.batch(
      Array.from({ length: fill }, (_, i) =>
        env.DB.prepare(
          "INSERT INTO support_tickets (id, user_id, message, lang, created_at, forwarded) VALUES (?1, NULL, 'filler', 'en', ?2, 1)",
        ).bind(`t_fill_${i}`, nowIso),
      ),
    )
    const users: string[] = []
    for (const i of [1, 2, 3]) users.push((await signIn(uniqueEmail(`supcap${i}`))).session)
    const digestId = `support-digest:${dayStart.slice(0, 10)}`

    try {
      // the last slot of the day is still forwarded
      let stub = stubFetch()
      expect((await api('/api/support', { body: { message: 'the last forwarded one', lang: 'en' }, session: users[0] })).status).toBe(200)
      expect(stub.emails().map((e) => e.subject)).toEqual([expect.stringMatching(/Support ticket t_/)])

      // over the ceiling: stored unforwarded; a digest whose send fails is retried by the next ticket
      stub = stubFetch({ resendOk: false })
      expect((await api('/api/support', { body: { message: 'over the ceiling 1', lang: 'en' }, session: users[1] })).status).toBe(200)
      expect(await count('SELECT COUNT(*) AS n FROM webhook_events WHERE id = ?1', digestId)).toBe(0)

      stub = stubFetch()
      expect((await api('/api/support', { body: { message: 'over the ceiling 2', lang: 'en' }, session: users[1] })).status).toBe(200)
      expect((await api('/api/support', { body: { message: 'over the ceiling 3', lang: 'en' }, session: users[2] })).status).toBe(200)
      const sent = stub.emails()
      expect(sent).toHaveLength(1)
      expect(sent[0]?.subject).toContain('Support forwarding limit reached')
      expect(sent[0]?.text).toContain(`${SUPPORT_FORWARDS_PER_DAY} support emails`)
      expect(sent[0]?.text).toContain(`WHERE forwarded = 0 AND created_at >= '${dayStart.slice(0, 10)}'`)
      expect(sent[0]?.text).not.toContain('over the ceiling')
      expect(await count("SELECT COUNT(*) AS n FROM support_tickets WHERE message LIKE 'over the ceiling %' AND forwarded = 0")).toBe(3)
      expect(await supportEmailsToday(env, new Date())).toBe(SUPPORT_FORWARDS_PER_DAY)
    } finally {
      await env.DB.batch([
        env.DB.prepare("DELETE FROM support_tickets WHERE id LIKE 't_fill_%'"),
        env.DB.prepare('DELETE FROM webhook_events WHERE id = ?1').bind(digestId),
      ])
    }
  })

  it(`limits each address to ${SUPPORT_PER_DAY} tickets per UTC day, across account deletion and re-signup`, async () => {
    const email = uniqueEmail('supresign')
    let { session } = await signIn(email)
    stubFetch()
    for (let i = 0; i < 3; i++) {
      expect((await api('/api/support', { body: { message: `before deletion ${i}`, lang: 'en' }, session })).status).toBe(200)
    }
    expect((await api('/api/account/delete', { body: {}, session })).status).toBe(200)
    // the deleted rows have no user id; KV carries today's count for the address
    expect(await env.FLAGS.get(SUPPORT_KV.deletedTickets(dayKey(new Date()), await emailHashOf(email)))).toBe('3')

    ;({ session } = await signIn(email))
    stubFetch()
    for (let i = 0; i < SUPPORT_PER_DAY - 3; i++) {
      expect((await api('/api/support', { body: { message: `after re-signup ${i}`, lang: 'en' }, session })).status).toBe(200)
    }
    const over = await api('/api/support', { body: { message: 'one too many today', lang: 'en' }, session })
    expect(over.status).toBe(429)
    expect(await over.json()).toMatchObject({ error: 'rate_limited' })
    expect(await count("SELECT COUNT(*) AS n FROM support_tickets WHERE message = 'one too many today'")).toBe(0)

    // deleting again adds to the carry-over instead of resetting it
    expect((await api('/api/account/delete', { body: {}, session })).status).toBe(200)
    expect(await env.FLAGS.get(SUPPORT_KV.deletedTickets(dayKey(new Date()), await emailHashOf(email)))).toBe(String(SUPPORT_PER_DAY))
    ;({ session } = await signIn(email))
    stubFetch()
    expect((await api('/api/support', { body: { message: 'third account today', lang: 'en' }, session })).status).toBe(429)

    // another address is not affected
    const other = (await signIn(uniqueEmail('supresign-other'))).session
    stubFetch()
    expect((await api('/api/support', { body: { message: 'a different person asks', lang: 'en' }, session: other })).status).toBe(200)
  })

  it('an account-deletion notice holds a slot under the daily ceiling; an undelivered one gives it back', async () => {
    const [a, b] = [uniqueEmail('supnotice-a'), uniqueEmail('supnotice-b')]
    const sessions = [(await signIn(a)).session, (await signIn(b)).session]
    stubFetch()
    for (const session of sessions) {
      expect((await api('/api/support', { body: { message: 'please delete my data later', lang: 'en' }, session })).status).toBe(200)
    }
    const before = await supportEmailsToday(env, new Date())

    stubFetch({ resendOk: false })
    expect((await api('/api/account/delete', { body: {}, session: sessions[0] })).status).toBe(200)
    expect(await supportEmailsToday(env, new Date())).toBe(before)

    const stub = stubFetch()
    expect((await api('/api/account/delete', { body: {}, session: sessions[1] })).status).toBe(200)
    expect(await supportEmailsToday(env, new Date())).toBe(before + 1)
    const [notice] = stub.emails()
    expect(stub.emails()).toHaveLength(1)
    expect(notice?.subject).toContain('Account deleted')
    expect(notice?.text).not.toContain(b)
  })

  it('deleting accounts frees no slot; with none left, deletion notices go into the one daily digest', async () => {
    const dayStart = startOfUtcDay(new Date()).toISOString()
    const digestId = `support-digest:${dayStart.slice(0, 10)}`
    const emails = [uniqueEmail('supdel-a'), uniqueEmail('supdel-b')]
    const sessions = [(await signIn(emails[0]!)).session, (await signIn(emails[1]!)).session]
    const later = (await signIn(uniqueEmail('supdel-later'))).session
    const fill = SUPPORT_FORWARDS_PER_DAY - (await supportEmailsToday(env, new Date())) - sessions.length
    expect(fill).toBeGreaterThan(0)
    const nowIso = new Date().toISOString()
    await env.DB.batch(
      Array.from({ length: fill }, (_, i) =>
        env.DB.prepare(
          "INSERT INTO support_tickets (id, user_id, message, lang, created_at, forwarded) VALUES (?1, NULL, 'filler', 'en', ?2, 1)",
        ).bind(`t_dfill_${i}`, nowIso),
      ),
    )

    try {
      // the last two slots of the day: both tickets are emailed to the owner
      let stub = stubFetch()
      for (const [i, session] of sessions.entries()) {
        expect((await api('/api/support', { body: { message: `from a soon-deleted account ${i}`, lang: 'en' }, session })).status).toBe(200)
      }
      expect(stub.emails()).toHaveLength(2)
      expect(await supportEmailsToday(env, new Date())).toBe(SUPPORT_FORWARDS_PER_DAY)
      const ids = (
        await env.DB.prepare("SELECT id FROM support_tickets WHERE message LIKE 'from a soon-deleted account %' ORDER BY message").all<{
          id: string
        }>()
      ).results.map((r) => r.id)
      expect(ids).toHaveLength(2)

      // no slot left for a separate notice: the day's digest names the ticket instead
      stub = stubFetch()
      expect((await api('/api/account/delete', { body: {}, session: sessions[0] })).status).toBe(200)
      const sent = stub.emails()
      expect(sent.map((e) => e.subject)).toEqual([expect.stringContaining('Support forwarding limit reached')])
      expect(sent[0]?.text).toContain(ids[0])
      expect(sent[0]?.text).toContain(`message = '${DELETED_TICKET_MESSAGE}'`)
      expect(sent[0]?.text).not.toContain(emails[0])

      // the digest was already sent today: nothing more is emailed (its query lists this ticket)
      stub = stubFetch()
      expect((await api('/api/account/delete', { body: {}, session: sessions[1] })).status).toBe(200)
      expect(stub.emails()).toHaveLength(0)

      // the deleted accounts' tickets still fill the ceiling
      expect(await supportEmailsToday(env, new Date())).toBe(SUPPORT_FORWARDS_PER_DAY)
      stub = stubFetch()
      expect((await api('/api/support', { body: { message: 'asked after the deletions', lang: 'en' }, session: later })).status).toBe(200)
      expect(stub.emails()).toHaveLength(0)
      expect(await count("SELECT COUNT(*) AS n FROM support_tickets WHERE message = 'asked after the deletions' AND forwarded = 0")).toBe(1)

      const { results: rows } = await env.DB.prepare('SELECT user_id, message, forwarded FROM support_tickets WHERE id IN (?1, ?2)')
        .bind(ids[0], ids[1])
        .all<Record<string, unknown>>()
      expect(rows).toEqual([
        { user_id: null, message: DELETED_TICKET_MESSAGE, forwarded: 1 },
        { user_id: null, message: DELETED_TICKET_MESSAGE, forwarded: 1 },
      ])
    } finally {
      await env.DB.batch([
        env.DB.prepare("DELETE FROM support_tickets WHERE id LIKE 't_dfill_%'"),
        env.DB.prepare('DELETE FROM webhook_events WHERE id = ?1').bind(digestId),
      ])
    }
  })
})
