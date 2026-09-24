import { env } from 'cloudflare:workers'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MARKETING_CONSENT } from '../../../shared/config'
import { findClaims } from '../../../shared/content-rules'
import {
  acceptedConsentText,
  expectedConsentText,
  MAGIC_LINK_USAGE_KIND,
  magicLinkAllows,
  magicLinkMode,
  mailingAddressMissing,
  requestMagicLink,
  signInEmail,
} from '../../src/auth'
import type { Ctx, Env } from '../../src/env'
import { saltedHash } from '../../src/lib/crypto'
import { isDisposableEmail } from '../../src/lib/disposable'
import {
  api,
  CONSENT_EN as CONSENT,
  CONSENT_KO,
  count,
  DEVICE,
  emailHashOf,
  lastToken,
  magicLinkBody,
  ORIGIN,
  sessionFromSetCookie,
  sessionHash,
  setEnv,
  signIn,
  stubFetch,
  uniqueEmail,
  useEmailSignInForEveryone,
  userByEmail,
} from './helpers'

const PLACEHOLDER = 'SET-BEFORE-LAUNCH (CASL: owner mailing address)'

// most tests here exercise the email link for any address; the launch defaults are tested below
useEmailSignInForEveryone()

/** sign-in link sends recorded in D1 for this address (free_usage kind 'ml') */
async function linkSends(email: string): Promise<number> {
  return count(
    'SELECT COALESCE(SUM(count), 0) AS n FROM free_usage WHERE key_hash = ?1 AND kind = ?2',
    await emailHashOf(email),
    MAGIC_LINK_USAGE_KIND,
  )
}

// no test may reach the network: every outbound call hits a stub (tests re-stub when they need to)
beforeEach(() => {
  stubFetch()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('POST /api/auth/magic-link', () => {
  it('rejects a failed Turnstile check and sends nothing', async () => {
    const stub = stubFetch({ turnstile: false })
    const email = uniqueEmail()
    const res = await api('/api/auth/magic-link', { body: magicLinkBody(email) })
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ error: 'turnstile_failed' })
    expect(stub.emails()).toHaveLength(0)
    expect(await count('SELECT COUNT(*) AS n FROM magic_links WHERE email = ?1', email)).toBe(0)
  })

  it('requires the 18+ confirmation', async () => {
    stubFetch()
    for (const adult of [false, 'true', undefined]) {
      const res = await api('/api/auth/magic-link', { body: magicLinkBody(uniqueEmail(), { adult }) })
      expect(res.status).toBe(400)
      expect(await res.json()).toMatchObject({ error: 'bad_request' })
    }
  })

  it('rejects disposable domains (including subdomains)', async () => {
    const stub = stubFetch()
    for (const email of ['someone@mailinator.com', 'x@inbox.guerrillamail.com', 'Y@YOPMAIL.COM']) {
      const res = await api('/api/auth/magic-link', { body: magicLinkBody(email) })
      expect(res.status).toBe(400)
    }
    expect(stub.calls).toHaveLength(0)
    expect(isDisposableEmail('someone@gmail.com')).toBe(false)
  })

  it('rejects invalid email and language', async () => {
    stubFetch()
    for (const body of [
      magicLinkBody('not-an-email'),
      magicLinkBody('a@b'),
      magicLinkBody(`${'a'.repeat(250)}@example.com`),
      magicLinkBody(uniqueEmail(), { lang: 'fr' }),
    ]) {
      const res = await api('/api/auth/magic-link', { body })
      expect(res.status).toBe(400)
    }
    const junk = await api('/api/auth/magic-link', { body: [1, 2] })
    expect(junk.status).toBe(400)
  })

  it('allows 3 links per email per hour, then rate_limited', async () => {
    const stub = stubFetch()
    const email = uniqueEmail('rate')
    for (let i = 0; i < 3; i++) {
      const res = await api('/api/auth/magic-link', { body: magicLinkBody(email) })
      expect(res.status).toBe(200)
    }
    const fourth = await api('/api/auth/magic-link', { body: magicLinkBody(email.toUpperCase()) })
    expect(fourth.status).toBe(429)
    expect(await fourth.json()).toMatchObject({ error: 'rate_limited' })
    expect(stub.emails()).toHaveLength(3)
  })

  it('emails a fragment link that expires in 15 minutes, in the chosen language', async () => {
    const stub = stubFetch()
    const email = uniqueEmail('mail')
    const res = await api('/api/auth/magic-link', { body: magicLinkBody(`  ${email.toUpperCase()} `) })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    const [msg] = stub.emails()
    expect(msg?.to).toEqual([email])
    expect(msg?.text).toMatch(/https:\/\/coach\.test\/auth\/verify\/#token=[A-Za-z0-9_-]{40,}/)
    expect(msg?.text).toContain('15 minutes')
    expect(msg?.text).toContain('ignore this email')
    expect(findClaims(`${msg?.subject}\n${msg?.text}`)).toEqual([])

    // only the hash is stored
    const row = await env.DB.prepare('SELECT token_hash, expires_at, created_at FROM magic_links WHERE email = ?1')
      .bind(email)
      .first<{ token_hash: string; expires_at: string; created_at: string }>()
    expect(row?.token_hash).not.toContain(lastToken(stub))
    expect(Date.parse(row!.expires_at) - Date.parse(row!.created_at)).toBe(15 * 60_000)

    await api('/api/auth/magic-link', { body: magicLinkBody(uniqueEmail('ko'), { lang: 'ko' }) })
    const ko = stub.emails()[1]
    expect(ko?.text).toContain('15분')
    expect(ko?.text).toContain('#token=')
    expect(findClaims(`${ko?.subject}\n${ko?.text}`)).toEqual([])
  })

  it('returns internal and frees the slot when the email cannot be sent', async () => {
    stubFetch({ resendOk: false })
    const email = uniqueEmail('fail')
    const res = await api('/api/auth/magic-link', { body: magicLinkBody(email) })
    expect(res.status).toBe(500)
    expect(await count('SELECT COUNT(*) AS n FROM magic_links WHERE email = ?1', email)).toBe(0)
    expect(await linkSends(email)).toBe(0)
  })

  it('keeps the hourly limit in D1 under the email hash (free_usage "ml", one row per send), not in KV', async () => {
    const email = uniqueEmail('d1window')
    const hash = await emailHashOf(email)
    const put = vi.spyOn(env.FLAGS, 'put')
    const at = (msAgo: number) => new Date(Date.now() - msAgo).toISOString()
    const add = (day: string) =>
      env.DB.prepare("INSERT INTO free_usage (key_hash, kind, day, count) VALUES (?1, 'ml', ?2, 1)").bind(hash, day).run()

    // sends older than an hour do not count
    for (const ago of [3_601_000, 3_700_000, 7_200_000]) await add(at(ago))
    expect((await api('/api/auth/magic-link', { body: magicLinkBody(email) })).status).toBe(200)
    const row = await env.DB.prepare(
      "SELECT day, count FROM free_usage WHERE key_hash = ?1 AND kind = 'ml' ORDER BY day DESC LIMIT 1",
    )
      .bind(hash)
      .first<{ day: string; count: number }>()
    expect(row?.count).toBe(1)
    expect(Date.now() - Date.parse(row!.day)).toBeLessThan(60_000)
    expect(row?.day).not.toContain(email)

    // three sends in the last hour block the next one, even without magic_links rows (a deleted account)
    await env.DB.prepare('DELETE FROM magic_links WHERE email = ?1').bind(email).run()
    await add(at(1_000))
    await add(at(2_000))
    const blocked = await api('/api/auth/magic-link', { body: magicLinkBody(email) })
    expect(blocked.status).toBe(429)
    expect(put).not.toHaveBeenCalled()
    put.mockRestore()
  })

  it('the hourly limit survives account deletion (decision 9)', async () => {
    const email = uniqueEmail('delrate')
    const { session } = await signIn(email)
    stubFetch()
    for (let i = 0; i < 2; i++) expect((await api('/api/auth/magic-link', { body: magicLinkBody(email) })).status).toBe(200)
    expect((await api('/api/account/delete', { body: {}, session })).status).toBe(200)
    expect(await count('SELECT COUNT(*) AS n FROM magic_links WHERE email = ?1', email)).toBe(0)
    const again = await api('/api/auth/magic-link', { body: magicLinkBody(email) })
    expect(again.status).toBe(429)
  })
})

describe('MAGIC_LINK modes (memo §7.2 Z3: the email link is for the owner at launch)', () => {
  const base = { OWNER_EMAIL: 'Owner@Coach.test' } as Env

  it('reads the mode, defaulting to owner for unset or unknown values', () => {
    expect(magicLinkMode(base)).toBe('owner')
    expect(magicLinkMode({ ...base, MAGIC_LINK: ' ALL ' })).toBe('all')
    expect(magicLinkMode({ ...base, MAGIC_LINK: 'off' })).toBe('off')
    expect(magicLinkMode({ ...base, MAGIC_LINK: 'everyone' })).toBe('owner')
  })

  it('owner: only OWNER_EMAIL; all: anyone; off: nobody; a staging list overrides owner/all', () => {
    expect(magicLinkAllows(base, 'owner@coach.test')).toBe('ok')
    expect(magicLinkAllows(base, 'someone@example.com')).toBe('owner_only')
    expect(magicLinkAllows({ ...base, MAGIC_LINK: 'all' }, 'someone@example.com')).toBe('ok')
    expect(magicLinkAllows({ ...base, MAGIC_LINK: 'off' }, 'owner@coach.test')).toBe('off')
    const staging = { ...base, STAGING_ALLOWED_EMAILS: 'owner@coach.test, tester@example.com' } as Env
    expect(magicLinkAllows(staging, 'tester@example.com')).toBe('ok')
    expect(magicLinkAllows(staging, 'someone@example.com')).toBe('staging')
    expect(magicLinkAllows({ ...staging, MAGIC_LINK: 'off' }, 'owner@coach.test')).toBe('off')
  })

  it('with the launch defaults, a learner is told to use Google and nothing is sent or stored', async () => {
    const restore = setEnv({ MAGIC_LINK: undefined, LEARNER_EMAIL: undefined })
    try {
      const stub = stubFetch()
      const email = uniqueEmail('learner')
      const res = await api('/api/auth/magic-link', { body: magicLinkBody(email) })
      expect(res.status).toBe(403)
      expect(await res.json()).toEqual({ error: 'forbidden', message: 'Please sign in with Google' })
      expect(stub.calls).toHaveLength(0)
      expect(await count('SELECT COUNT(*) AS n FROM magic_links WHERE email = ?1', email)).toBe(0)

      // the owner still gets a link (Resend's sandbox delivers to the account owner only)
      const owner = await api('/api/auth/magic-link', { body: magicLinkBody('OWNER@coach.test') })
      expect(owner.status).toBe(200)
      expect(stub.emails().map((m) => m.to)).toEqual([['owner@coach.test']])
      const verified = await api('/api/auth/verify', { body: { token: lastToken(stub) } })
      expect(verified.status).toBe(200)
      expect(await verified.json()).toEqual({ ok: true, email: 'owner@coach.test' })
    } finally {
      restore()
    }
  })

  it('MAGIC_LINK=off refuses the owner too', async () => {
    const restore = setEnv({ MAGIC_LINK: 'off' })
    try {
      const stub = stubFetch()
      const res = await api('/api/auth/magic-link', { body: magicLinkBody('owner@coach.test') })
      expect(res.status).toBe(403)
      expect(stub.calls).toHaveLength(0)
    } finally {
      restore()
    }
  })

  it('MAGIC_LINK=all with learner email off: the link cannot be sent, so it is not stored or counted', async () => {
    const restore = setEnv({ MAGIC_LINK: 'all', LEARNER_EMAIL: 'off' })
    try {
      const stub = stubFetch()
      const email = uniqueEmail('noemail')
      const res = await api('/api/auth/magic-link', { body: magicLinkBody(email) })
      expect(res.status).toBe(500)
      expect(stub.emails()).toHaveLength(0)
      expect(await count('SELECT COUNT(*) AS n FROM magic_links WHERE email = ?1', email)).toBe(0)
      expect(await linkSends(email)).toBe(0)
    } finally {
      restore()
    }
  })
})

describe('CASL marketing consent (decision 10)', () => {
  const baseEnv = { SITE_URL: 'https://coach.test', MAILING_ADDRESS: '1 Test St, Toronto ON M5V 0A1' } as Env

  it('builds the sentence from the Worker settings and accepts only an exact match', () => {
    expect(expectedConsentText(baseEnv, 'en')).toBe(CONSENT)
    expect(expectedConsentText({ ...baseEnv, SITE_URL: 'https://coach.test/' }, 'ko')).toBe(CONSENT_KO)
    expect(acceptedConsentText(baseEnv, CONSENT, 'en')).toBe(CONSENT)
    expect(acceptedConsentText(baseEnv, CONSENT_KO)).toBe(CONSENT_KO)
    expect(acceptedConsentText(baseEnv, CONSENT_KO, 'en')).toBeNull()
    expect(acceptedConsentText(baseEnv, ` ${CONSENT}`, 'en')).toBeNull()
    expect(acceptedConsentText(baseEnv, CONSENT.replace('occasional', 'daily'), 'en')).toBeNull()
    expect(acceptedConsentText(baseEnv, 42, 'en')).toBeNull()
  })

  it('treats the placeholder or an empty mailing address as missing', () => {
    expect(mailingAddressMissing(baseEnv)).toBe(false)
    expect(mailingAddressMissing({ ...baseEnv, MAILING_ADDRESS: PLACEHOLDER })).toBe(true)
    expect(mailingAddressMissing({ ...baseEnv, MAILING_ADDRESS: '  ' })).toBe(true)
    const placeholderEnv = { ...baseEnv, MAILING_ADDRESS: PLACEHOLDER }
    expect(acceptedConsentText(placeholderEnv, expectedConsentText(placeholderEnv, 'en'), 'en')).toBeNull()
  })

  it('signs in without an opt-in when the sentence is not the server one', async () => {
    for (const marketingConsentText of ['anything at all', ` ${CONSENT} `, CONSENT_KO, '', 'x'.repeat(1501), 7]) {
      const email = uniqueEmail('badconsent')
      const { stub } = await signIn(email, { extra: { marketingOptIn: true, marketingConsentText } })
      expect(stub.emails()[0]?.text).not.toContain('occasional emails')
      const u = await userByEmail(email)
      expect(u).toMatchObject({ marketing_opt_in: 0, marketing_consent_text: null, marketing_consent_at: null })
      const pending = await env.DB.prepare('SELECT pending_json FROM magic_links WHERE email = ?1')
        .bind(email)
        .first<{ pending_json: string }>()
      expect(JSON.parse(pending!.pending_json)).toMatchObject({ marketingOptIn: false })
      expect(pending!.pending_json).not.toContain('anything at all')
    }
  })

  it('ignores the opt-in while MAILING_ADDRESS is the placeholder, but still sends the link', async () => {
    const stub = stubFetch()
    const email = uniqueEmail('placeholder')
    const testEnv = Object.create(env, { MAILING_ADDRESS: { value: PLACEHOLDER } }) as Env
    const ctx: Ctx = {
      env: testEnv,
      exec: { waitUntil: () => {}, passThroughOnException: () => {} } as unknown as ExecutionContext,
      user: null,
      ipHash: 'ip-test',
      deviceHash: 'device-test',
      country: null,
      region: null,
      now: new Date(),
    }
    const body = magicLinkBody(email, { marketingOptIn: true, marketingConsentText: expectedConsentText(testEnv, 'en') })
    const res = await requestMagicLink(
      new Request(`${ORIGIN}/api/auth/magic-link`, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }),
      ctx,
    )
    expect(res.status).toBe(200)
    expect(stub.emails()).toHaveLength(1)
    expect(stub.emails()[0]?.text).not.toContain('occasional emails')
    const pending = await env.DB.prepare('SELECT pending_json FROM magic_links WHERE email = ?1').bind(email).first<{ pending_json: string }>()
    expect(JSON.parse(pending!.pending_json)).toMatchObject({ marketingOptIn: false })
  })

  it('records the opt-in only when the link is opened on the requesting device', async () => {
    const email = uniqueEmail('otherdevice')
    await signIn(email, { extra: { marketingOptIn: true, marketingConsentText: CONSENT }, verifyDevice: 'some-other-device' })
    const u = await userByEmail(email)
    expect(u).toMatchObject({ marketing_opt_in: 0, marketing_consent_text: null })

    // the same request opened on the requesting device records it
    const same = uniqueEmail('samedevice')
    await signIn(same, { extra: { marketingOptIn: true, marketingConsentText: CONSENT } })
    expect(await userByEmail(same)).toMatchObject({ marketing_opt_in: 1, marketing_consent_text: CONSENT })
  })

  it('the sign-in email says the opt-in was requested and that it needs the same device', async () => {
    const { stub } = await signIn(uniqueEmail('mailwording'), { extra: { marketingOptIn: true, marketingConsentText: CONSENT } })
    const text = stub.emails()[0]?.text ?? ''
    expect(text).toContain('occasional emails about new practice tasks and offers')
    expect(text).toContain('same device and browser')
    expect(findClaims(text)).toEqual([])

    const { stub: ko } = await signIn(uniqueEmail('mailwordingko'), {
      extra: { marketingOptIn: true, marketingConsentText: CONSENT_KO, lang: 'ko' },
    })
    const koText = ko.emails()[0]?.text ?? ''
    expect(koText).toContain('로그인을 요청한 기기와 브라우저')
    expect(findClaims(koText)).toEqual([])
    for (const lang of ['en', 'ko'] as const) {
      const m = signInEmail(lang, 'https://coach.test/auth/verify/#token=x', true)
      expect(findClaims(`${m.subject}\n${m.text}`)).toEqual([])
    }
  })

  it('an unsubscribe after the request blocks the pending opt-in', async () => {
    const stub = stubFetch()
    const email = uniqueEmail('unsubfirst')
    await api('/api/auth/magic-link', { body: magicLinkBody(email, { marketingOptIn: true, marketingConsentText: CONSENT }) })
    const token = lastToken(stub)
    // the sign-in email itself carries the unsubscribe link
    const m = /\/unsubscribe\/#h=([0-9a-f]{64})&s=([0-9a-f]{64})/.exec(stub.emails()[0]?.text ?? '')
    expect(m).not.toBeNull()
    expect((await api('/api/unsubscribe', { body: { h: m![1], s: m![2] } })).status).toBe(200)

    expect((await api('/api/auth/verify', { body: { token } })).status).toBe(200)
    expect(await userByEmail(email)).toMatchObject({ marketing_opt_in: 0, marketing_consent_text: null })

    // a new request after the unsubscribe is a new, valid consent
    await signIn(email, { extra: { marketingOptIn: true, marketingConsentText: CONSENT } })
    expect(await userByEmail(email)).toMatchObject({ marketing_opt_in: 1, marketing_consent_text: CONSENT })
  })
})

describe('POST /api/auth/verify', () => {
  it('signs in once; the same token then returns 401', async () => {
    const stub = stubFetch()
    const email = uniqueEmail('single')
    await api('/api/auth/magic-link', { body: magicLinkBody(email) })
    const token = lastToken(stub)

    const first = await api('/api/auth/verify', { body: { token } })
    expect(first.status).toBe(200)
    expect(await first.json()).toEqual({ ok: true, email })

    const second = await api('/api/auth/verify', { body: { token } })
    expect(second.status).toBe(401)
    expect(await second.json()).toMatchObject({ error: 'unauthorized', message: 'Link expired or already used' })
  })

  it('rejects an expired token', async () => {
    const stub = stubFetch()
    const email = uniqueEmail('expired')
    await api('/api/auth/magic-link', { body: magicLinkBody(email) })
    await env.DB.prepare('UPDATE magic_links SET expires_at = ?1 WHERE email = ?2')
      .bind(new Date(Date.now() - 1000).toISOString(), email)
      .run()
    const res = await api('/api/auth/verify', { body: { token: lastToken(stub) } })
    expect(res.status).toBe(401)
    expect(await userByEmail(email)).toBeNull()
  })

  it('rejects malformed and unknown tokens', async () => {
    stubFetch()
    expect((await api('/api/auth/verify', { body: { token: 'short' } })).status).toBe(400)
    expect((await api('/api/auth/verify', { body: { token: 'x'.repeat(201) } })).status).toBe(400)
    expect((await api('/api/auth/verify', { body: { token: 'y'.repeat(43) } })).status).toBe(401)
  })

  it('records marketing consent only when marketingOptIn === true', async () => {
    const notTicked = uniqueEmail('nomkt')
    await signIn(notTicked, { extra: { marketingOptIn: 'true', marketingConsentText: CONSENT } })
    const u1 = await userByEmail(notTicked)
    expect(u1?.marketing_opt_in).toBe(0)
    expect(u1?.marketing_consent_text).toBeNull()
    expect(u1?.marketing_consent_at).toBeNull()

    const ticked = uniqueEmail('mkt')
    await signIn(ticked, { extra: { marketingOptIn: true, marketingConsentText: CONSENT_KO, lang: 'ko' } })
    const u2 = await userByEmail(ticked)
    expect(u2?.marketing_opt_in).toBe(1)
    expect(u2?.marketing_consent_text).toBe(CONSENT_KO)
    expect(u2?.marketing_consent_version).toBe(MARKETING_CONSENT.version)
    expect(u2?.marketing_consent_at).toBeTruthy()
    expect(u2?.lang).toBe('ko')
    expect(u2?.adult_confirmed_at).toBeTruthy()

    const pending = await env.DB.prepare('SELECT pending_json FROM magic_links WHERE email = ?1')
      .bind(ticked)
      .first<{ pending_json: string }>()
    expect(JSON.parse(pending!.pending_json)).toEqual({
      lang: 'ko',
      adult: true,
      marketingOptIn: true,
      marketingConsentText: CONSENT_KO,
      deviceHash: await saltedHash(env.HASH_SALT, `device:${DEVICE}`),
      consentVersion: MARKETING_CONSENT.version,
    })

    // signing in again with the box unticked never withdraws earlier consent
    await signIn(ticked)
    const u3 = await userByEmail(ticked)
    expect(u3?.marketing_opt_in).toBe(1)
    expect(u3?.marketing_consent_text).toBe(CONSENT_KO)
    expect(u3?.lang).toBe('en')
  })

  it('stores the salted email hash, not a plain one', async () => {
    const email = uniqueEmail('hash')
    await signIn(email)
    const u = await userByEmail(email)
    expect(u?.email_hash).toMatch(/^[0-9a-f]{64}$/)
    expect(u?.email_hash).not.toContain(email)
  })

  it('rotates the session: the old row is deleted and a new HttpOnly/Secure/Lax cookie is set', async () => {
    const email = uniqueEmail('rotate')
    const { session: first, res } = await signIn(email)
    const cookie = res.headers.get('set-cookie') ?? ''
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('Secure')
    expect(cookie).toContain('SameSite=Lax')
    expect(cookie).toContain('Path=/')
    expect(cookie).toContain(`Max-Age=${30 * 86400}`)
    expect(await count('SELECT COUNT(*) AS n FROM sessions WHERE id_hash = ?1', await sessionHash(first))).toBe(1)

    const { session: second } = await signIn(email, { session: first })
    expect(second).not.toBe(first)
    expect(await count('SELECT COUNT(*) AS n FROM sessions WHERE id_hash = ?1', await sessionHash(first))).toBe(0)
    expect(await count('SELECT COUNT(*) AS n FROM sessions WHERE id_hash = ?1', await sessionHash(second))).toBe(1)

    const me = await api('/api/me', { session: second })
    expect(await me.json()).toMatchObject({ signedIn: true, email })
    const stale = await api('/api/me', { session: first })
    expect(await stale.json()).toMatchObject({ signedIn: false })
  })

  it('records a signup event once, for a new user only', async () => {
    const signups = () => count("SELECT COUNT(*) AS n FROM events WHERE name = 'signup'")
    const before = await signups()
    const email = uniqueEmail('signup')
    await signIn(email)
    expect(await signups()).toBe(before + 1)
    await signIn(email)
    expect(await signups()).toBe(before + 1)
    const ev = await env.DB.prepare("SELECT path, utm_json, day FROM events WHERE name = 'signup' ORDER BY id DESC LIMIT 1").first<{
      path: string
      utm_json: string | null
      day: string
    }>()
    expect(ev).toMatchObject({ path: '/auth/verify/', utm_json: null })
    expect(ev?.day).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('POST /api/auth/logout', () => {
  it('deletes the session and clears the cookie', async () => {
    const { session } = await signIn(uniqueEmail('logout'))
    const res = await api('/api/auth/logout', { method: 'POST', body: {}, session })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(res.headers.get('set-cookie')).toMatch(/mpc_session=; Path=\/; Max-Age=0/)
    expect(await count('SELECT COUNT(*) AS n FROM sessions WHERE id_hash = ?1', await sessionHash(session))).toBe(0)
    expect(sessionFromSetCookie(res)).toBeNull()
  })

  it('answers ok when already signed out', async () => {
    const res = await api('/api/auth/logout', { method: 'POST', body: {} })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })
})
