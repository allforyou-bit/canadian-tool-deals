import { env } from 'cloudflare:workers'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MARKETING_CONSENT } from '../../../shared/config'
import { findClaims } from '../../../shared/content-rules'
import { isDisposableEmail } from '../../src/lib/disposable'
import {
  api,
  count,
  lastToken,
  magicLinkBody,
  sessionFromSetCookie,
  sessionHash,
  signIn,
  stubFetch,
  uniqueEmail,
  userByEmail,
} from './helpers'

const CONSENT = MARKETING_CONSENT.en('1 Test St, Toronto ON M5V 0A1', 'https://coach.test')

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
      magicLinkBody(uniqueEmail(), { marketingOptIn: true, marketingConsentText: '' }),
      magicLinkBody(uniqueEmail(), { marketingOptIn: true, marketingConsentText: 'x'.repeat(1501) }),
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
    await signIn(ticked, { extra: { marketingOptIn: true, marketingConsentText: `  ${CONSENT}  `, lang: 'ko' } })
    const u2 = await userByEmail(ticked)
    expect(u2?.marketing_opt_in).toBe(1)
    expect(u2?.marketing_consent_text).toBe(CONSENT)
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
      marketingConsentText: CONSENT,
      consentVersion: MARKETING_CONSENT.version,
    })

    // signing in again with the box unticked never withdraws earlier consent
    await signIn(ticked)
    const u3 = await userByEmail(ticked)
    expect(u3?.marketing_opt_in).toBe(1)
    expect(u3?.marketing_consent_text).toBe(CONSENT)
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
