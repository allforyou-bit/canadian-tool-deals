// Google sign-in (memo §7.2 Z3): the whole OpenID Connect round trip against stubbed Google endpoints, with
// id_tokens signed by an RSA key generated here and served from a stubbed JWKS. No test reaches the network.
import { env, exports } from 'cloudflare:workers'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MeResponse } from '../../shared/api'
import { MARKETING_CONSENT } from '../../shared/config'
import {
  CALLBACK_PATH,
  GOOGLE_OIDC,
  pkceChallenge,
  resetJwksCache,
  safeNextPath,
  verifyIdToken,
} from '../src/auth-google'
import type { Env } from '../src/env'
import { saltedHash } from '../src/lib/crypto'
import { CONSENT_EN, count, emailHashOf, ORIGIN, sessionHash, setEnv, uniqueEmail, userByEmail } from './core/helpers'

const CLIENT_ID = 'test-client-123.apps.googleusercontent.com'
const CLIENT_SECRET = 'test-client-secret'
const KID = 'test-kid-1'
const DEVICE = 'google-test-device'
const TURNSTILE_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const ACCESS_TOKEN = 'ya29.test-access-token-never-stored'
const CODE = '4/0Atest-authorization-code'

const enc = new TextEncoder()

function b64url(input: Uint8Array | string): string {
  const bytes = typeof input === 'string' ? enc.encode(input) : input
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function rsaKey(): Promise<CryptoKeyPair> {
  return (await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair
}

async function publicJwk(pair: CryptoKeyPair, kid: string): Promise<JsonWebKey & { kid: string }> {
  const jwk = (await crypto.subtle.exportKey('jwk', pair.publicKey)) as JsonWebKey
  return { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', use: 'sig', kid }
}

let keys: CryptoKeyPair
let otherKeys: CryptoKeyPair

async function signJwt(claims: Record<string, unknown>, opts: { kid?: string; alg?: string; key?: CryptoKey } = {}): Promise<string> {
  const header = { alg: opts.alg ?? 'RS256', kid: opts.kid ?? KID, typ: 'JWT' }
  const input = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', opts.key ?? keys.privateKey, enc.encode(input)))
  return `${input}.${b64url(sig)}`
}

let subSeq = 0
const newSub = () => `1098765432101234${String(++subSeq).padStart(5, '0')}`

function claimsFor(nonce: string, over: Record<string, unknown> = {}): Record<string, unknown> {
  const now = Math.floor(Date.now() / 1000)
  return {
    iss: 'https://accounts.google.com',
    azp: CLIENT_ID,
    aud: CLIENT_ID,
    sub: newSub(),
    email: uniqueEmail('google'),
    email_verified: true,
    at_hash: 'x1y2z3',
    nonce,
    iat: now,
    exp: now + 3600,
    ...over,
  }
}

// ---------- stubbed Google, Turnstile and Resend ----------

interface Stub {
  calls: { url: string; method: string; body: string }[]
  jwks: (JsonWebKey & { kid: string })[][]
  idToken: string | null
  tokenStatus: number
  turnstile: boolean
}

let stub: Stub

function installStub(): Stub {
  const s: Stub = { calls: [], jwks: [], idToken: null, tokenStatus: 200, turnstile: true }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const req = new Request(input, init)
      const body = req.method === 'POST' ? await req.text() : ''
      s.calls.push({ url: req.url, method: req.method, body })
      if (req.url === TURNSTILE_URL) return Response.json({ success: s.turnstile })
      if (req.url === GOOGLE_OIDC.jwksUri) {
        // each fetch serves the next key set (the last one repeats): a rotation is a new entry
        const index = s.calls.filter((c) => c.url === GOOGLE_OIDC.jwksUri).length - 1
        const set = s.jwks[Math.min(index, s.jwks.length - 1)] ?? []
        return Response.json({ keys: set }, { headers: { 'cache-control': 'public, max-age=19985, must-revalidate, no-transform' } })
      }
      if (req.url === GOOGLE_OIDC.tokenEndpoint) {
        if (s.tokenStatus !== 200) return Response.json({ error: 'invalid_grant', error_description: 'Bad Request' }, { status: s.tokenStatus })
        return Response.json({
          access_token: ACCESS_TOKEN,
          expires_in: 3599,
          scope: 'openid https://www.googleapis.com/auth/userinfo.email',
          token_type: 'Bearer',
          id_token: s.idToken,
        })
      }
      if (req.url === 'https://api.resend.com/emails') return Response.json({ id: 'email_test' })
      throw new Error(`unexpected fetch in test: ${req.url}`)
    }),
  )
  return s
}

const jwksCalls = () => stub.calls.filter((c) => c.url === GOOGLE_OIDC.jwksUri).length
const tokenCalls = () => stub.calls.filter((c) => c.url === GOOGLE_OIDC.tokenEndpoint)
const emailsSent = () => stub.calls.filter((c) => c.url === 'https://api.resend.com/emails')

// ---------- the round trip ----------

interface Started {
  res: Response
  auth: URL
  state: string
  nonce: string
  cookie: string
}

async function begin(opts: { device?: string; body?: Record<string, unknown> } = {}): Promise<Started> {
  const res = await exports.default.fetch(`${ORIGIN}/api/auth/google/start`, {
    method: 'POST',
    headers: { origin: ORIGIN, 'content-type': 'application/json', cookie: `mpc_device=${opts.device ?? DEVICE}` },
    body: JSON.stringify({ lang: 'en', adult: true, turnstileToken: 'tok', next: '/pricing/', ...opts.body }),
  })
  if (res.status !== 200) throw new Error(`start failed: ${res.status}`)
  const { url } = (await res.json()) as { url: string }
  const auth = new URL(url)
  const cookie = /mpc_oauth=([^;]*)/.exec(res.headers.get('set-cookie') ?? '')?.[1] ?? ''
  return { res, auth, state: auth.searchParams.get('state') ?? '', nonce: auth.searchParams.get('nonce') ?? '', cookie }
}

/** Google's redirect back: code, scope, iss and the state; `params` overrides (null removes). */
async function back(
  state: string,
  cookies: { oauth?: string | null; device?: string; session?: string } = {},
  params: Record<string, string | null> = {},
): Promise<Response> {
  const q = new URLSearchParams({
    state,
    iss: 'https://accounts.google.com',
    code: CODE,
    scope: 'email openid https://www.googleapis.com/auth/userinfo.email',
    authuser: '0',
    prompt: 'consent',
  })
  for (const [k, v] of Object.entries(params)) {
    if (v === null) q.delete(k)
    else q.set(k, v)
  }
  const cookie = [
    `mpc_device=${cookies.device ?? DEVICE}`,
    ...(cookies.oauth ? [`mpc_oauth=${cookies.oauth}`] : []),
    ...(cookies.session ? [`mpc_session=${cookies.session}`] : []),
  ].join('; ')
  return exports.default.fetch(`${ORIGIN}${CALLBACK_PATH}?${q.toString()}`, { headers: { cookie }, redirect: 'manual' })
}

/** Start, sign an id_token for the nonce Google would echo, come back. */
async function signInWithGoogle(
  over: Record<string, unknown> = {},
  opts: { device?: string; callbackDevice?: string; body?: Record<string, unknown>; token?: (nonce: string) => Promise<string> } = {},
) {
  const started = await begin(opts)
  const claims = claimsFor(started.nonce, over)
  stub.idToken = opts.token ? await opts.token(started.nonce) : await signJwt(claims)
  const res = await back(started.state, { oauth: started.cookie, device: opts.callbackDevice ?? opts.device })
  return { ...started, res, claims }
}

function sessionCookie(res: Response): string | null {
  const m = /(?:^|,\s*)mpc_session=([^;]*)/.exec(res.headers.get('set-cookie') ?? '')
  return m?.[1] ? decodeURIComponent(m[1]) : null
}

function expectLoginError(res: Response, code: string): void {
  expect(res.status).toBe(303)
  const loc = new URL(res.headers.get('location') ?? '')
  expect(loc.origin).toBe(ORIGIN)
  expect(loc.pathname).toBe('/login/')
  expect(loc.searchParams.get('error')).toBe(code)
  expect(sessionCookie(res)).toBeNull()
  // the round-trip cookie is always cleared
  expect(res.headers.get('set-cookie')).toMatch(/mpc_oauth=; Path=\/api\/auth\/google\/; Max-Age=0/)
}

let restoreEnv: () => void = () => {}

beforeAll(async () => {
  keys = await rsaKey()
  otherKeys = await rsaKey()
  // the launch defaults for email (owner-only link, no learner email), plus a configured Google client
  restoreEnv = setEnv({
    GOOGLE_CLIENT_ID: CLIENT_ID,
    GOOGLE_CLIENT_SECRET: CLIENT_SECRET,
    MAGIC_LINK: undefined,
    LEARNER_EMAIL: undefined,
  })
})

afterAll(() => restoreEnv())

beforeEach(async () => {
  resetJwksCache()
  stub = installStub()
  stub.jwks = [[await publicJwk(keys, KID)]]
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('POST /api/auth/google/start', () => {
  it('stores state, nonce and PKCE verifier for 10 minutes and answers Google’s authorization URL', async () => {
    const t0 = Date.now()
    const { res, auth, state, nonce } = await begin({ body: { next: '/practice/writing/w1/?x=1' } })
    expect(`${auth.origin}${auth.pathname}`).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    const p = auth.searchParams
    expect(p.get('client_id')).toBe(CLIENT_ID)
    expect(p.get('redirect_uri')).toBe('https://coach.test/api/auth/google/callback')
    expect(p.get('response_type')).toBe('code')
    // the email only: no profile (PIPEDA 4.4)
    expect(p.get('scope')).toBe('openid email')
    expect(p.get('code_challenge_method')).toBe('S256')
    expect(p.get('prompt')).toBe('select_account')
    expect(p.has('access_type')).toBe(false)
    expect(state).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(nonce).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(nonce).not.toBe(state)

    const cookie = res.headers.get('set-cookie') ?? ''
    expect(cookie).toContain(`mpc_oauth=${state}`)
    for (const part of ['Path=/api/auth/google/', 'Max-Age=600', 'Secure', 'HttpOnly', 'SameSite=Lax']) expect(cookie).toContain(part)

    // only the state's salted hash is stored; the verifier matches the challenge sent to Google
    const row = await env.DB.prepare('SELECT * FROM oauth_states WHERE state_hash = ?1')
      .bind(await saltedHash(env.HASH_SALT, `oauth:${state}`))
      .first<Record<string, string | null>>()
    expect(row).not.toBeNull()
    expect(JSON.stringify(row)).not.toContain(state)
    expect(row?.nonce).toBe(nonce)
    expect(row?.code_verifier).toMatch(/^[A-Za-z0-9_-]{43,128}$/)
    expect(await pkceChallenge(row!.code_verifier!)).toBe(p.get('code_challenge'))
    expect(row?.used_at).toBeNull()
    expect(row?.device_hash).toBe(await saltedHash(env.HASH_SALT, `device:${DEVICE}`))
    expect(row?.next_path).toBe('/practice/writing/w1/?x=1')
    expect(Date.parse(row!.expires_at!) - Date.parse(row!.created_at!)).toBe(10 * 60_000)
    expect(Date.parse(row!.created_at!)).toBeGreaterThanOrEqual(t0 - 1000)
    expect(JSON.parse(row!.pending_json!)).toEqual({ lang: 'en', adult: true, marketingOptIn: false, consentVersion: MARKETING_CONSENT.version })
  })

  it('validates language, the 18+ box and Turnstile, and stores nothing on failure', async () => {
    const before = await count('SELECT COUNT(*) AS n FROM oauth_states')
    const post = (body: unknown) =>
      exports.default.fetch(`${ORIGIN}/api/auth/google/start`, {
        method: 'POST',
        headers: { origin: ORIGIN, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
    for (const body of [
      { lang: 'fr', adult: true, turnstileToken: 'tok' },
      { lang: 'en', adult: false, turnstileToken: 'tok' },
      { lang: 'en', adult: 'true', turnstileToken: 'tok' },
      [1, 2],
    ]) {
      const res = await post(body)
      expect(res.status).toBe(400)
    }
    stub.turnstile = false
    const res = await post({ lang: 'en', adult: true, turnstileToken: 'tok' })
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ error: 'turnstile_failed' })
    expect(await count('SELECT COUNT(*) AS n FROM oauth_states')).toBe(before)
  })

  it('is unavailable until both the client id and the secret are set', async () => {
    const restore = setEnv({ GOOGLE_CLIENT_SECRET: undefined })
    try {
      const res = await exports.default.fetch(`${ORIGIN}/api/auth/google/start`, {
        method: 'POST',
        headers: { origin: ORIGIN, 'content-type': 'application/json' },
        body: JSON.stringify({ lang: 'en', adult: true, turnstileToken: 'tok' }),
      })
      expect(res.status).toBe(403)
      expect(stub.calls).toHaveLength(0)
      expect(((await (await exports.default.fetch(`${ORIGIN}/api/me`)).json()) as MeResponse).auth.google).toBe(false)
    } finally {
      restore()
    }
    expect(((await (await exports.default.fetch(`${ORIGIN}/api/me`)).json()) as MeResponse).auth).toEqual({ google: true, magicLink: 'owner' })
  })

  it('keeps only a safe same-site next path', async () => {
    for (const next of ['https://evil.test/', '//evil.test/x', '/\\evil.test', '/login/', '/auth/verify/', '/api/me', 'pricing/', '/a\u0000b', 42]) {
      const { state } = await begin({ body: { next } })
      const row = await env.DB.prepare('SELECT next_path FROM oauth_states WHERE state_hash = ?1')
        .bind(await saltedHash(env.HASH_SALT, `oauth:${state}`))
        .first<{ next_path: string }>()
      expect(row?.next_path).toBe('/account/')
    }
    expect(safeNextPath('/ko/pricing/?a=1#b', ORIGIN)).toBe('/ko/pricing/?a=1#b')
    expect(safeNextPath(`/${'a'.repeat(600)}`, ORIGIN)).toBeNull()
  })
})

describe('GET /api/auth/google/callback: happy path', () => {
  it('creates the user, rotates the session and redirects to next; stores no Google token, logs nothing personal', async () => {
    const logs: unknown[][] = []
    for (const m of ['log', 'warn', 'error', 'info', 'debug'] as const) {
      vi.spyOn(console, m).mockImplementation((...args: unknown[]) => {
        logs.push(args)
      })
    }
    const signupsBefore = await count("SELECT COUNT(*) AS n FROM events WHERE name = 'signup'")
    const email = uniqueEmail('Happy').replace('happy', 'HaPpY')
    const { res, claims, state } = await signInWithGoogle({ email })

    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('https://coach.test/pricing/')
    expect(res.headers.get('cache-control')).toBe('no-store')
    const session = sessionCookie(res)
    expect(session).toMatch(/^[A-Za-z0-9_-]{43}$/)
    const setCookie = res.headers.get('set-cookie') ?? ''
    for (const part of ['HttpOnly', 'Secure', 'SameSite=Lax', `Max-Age=${30 * 86400}`]) expect(setCookie).toContain(part)
    expect(setCookie).toMatch(/mpc_oauth=; Path=\/api\/auth\/google\/; Max-Age=0/)

    // the code went to Google's token endpoint with the secret and the PKCE verifier
    const [call] = tokenCalls()
    expect(tokenCalls()).toHaveLength(1)
    const sent = new URLSearchParams(call!.body)
    const row = await env.DB.prepare('SELECT * FROM oauth_states WHERE state_hash = ?1')
      .bind(await saltedHash(env.HASH_SALT, `oauth:${state}`))
      .first<Record<string, string | null>>()
    expect(Object.fromEntries(sent)).toEqual({
      code: CODE,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: 'https://coach.test/api/auth/google/callback',
      grant_type: 'authorization_code',
      code_verifier: row!.code_verifier,
    })
    expect(row?.used_at).toBeTruthy()
    expect(jwksCalls()).toBe(1)

    const lower = email.toLowerCase()
    const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?1').bind(lower).first<Record<string, unknown>>()
    expect(user).toMatchObject({
      email: lower,
      email_hash: await emailHashOf(lower),
      google_sub: claims.sub,
      lang: 'en',
      marketing_opt_in: 0,
      free_speaking_used: 0,
      self_refund_used: 0,
      deleted_at: null,
    })
    expect(user?.adult_confirmed_at).toBeTruthy()
    // no Google token anywhere
    for (const table of ['users', 'oauth_states', 'sessions', 'events']) {
      const { results } = await env.DB.prepare(`SELECT * FROM ${table}`).all()
      const dump = JSON.stringify(results)
      expect(dump).not.toContain(ACCESS_TOKEN)
      expect(dump).not.toContain(stub.idToken!.split('.')[2]!)
      expect(dump).not.toContain(CODE)
    }
    expect(await count('SELECT COUNT(*) AS n FROM sessions WHERE id_hash = ?1', await sessionHash(session!))).toBe(1)
    expect(await count("SELECT COUNT(*) AS n FROM events WHERE name = 'signup'")).toBe(signupsBefore + 1)
    const ev = await env.DB.prepare("SELECT path, utm_json FROM events WHERE name = 'signup' ORDER BY id DESC LIMIT 1").first()
    expect(ev).toEqual({ path: '/api/auth/google/callback', utm_json: null })
    // no email is sent to anyone
    expect(emailsSent()).toHaveLength(0)

    const me = (await (
      await exports.default.fetch(`${ORIGIN}/api/me`, { headers: { cookie: `mpc_device=${DEVICE}; mpc_session=${session}` } })
    ).json()) as MeResponse
    expect(me).toMatchObject({ signedIn: true, email: lower })

    const printed = JSON.stringify(logs)
    for (const secret of [lower, email, ACCESS_TOKEN, CODE, state, stub.idToken!, String(claims.sub)]) expect(printed).not.toContain(secret)
  })

  it('accepts the short issuer form and an audience list with azp; reuses cached keys', async () => {
    const first = await signInWithGoogle({ iss: 'accounts.google.com' })
    expect(first.res.status).toBe(303)
    const second = await signInWithGoogle({ aud: [CLIENT_ID], azp: CLIENT_ID })
    expect(second.res.status).toBe(303)
    expect(sessionCookie(second.res)).toBeTruthy()
    // Google's max-age (≈5.5 h) keeps the keys for the second sign-in
    expect(jwksCalls()).toBe(1)
  })

  it('a returning Google account signs in to the same user, even after its email changed; no second signup event', async () => {
    const sub = newSub()
    const email = uniqueEmail('returning')
    const first = await signInWithGoogle({ sub, email })
    expect(first.res.status).toBe(303)
    const id = (await userByEmail(email))!.id
    const signups = await count("SELECT COUNT(*) AS n FROM events WHERE name = 'signup'")

    const again = await signInWithGoogle({ sub, email: uniqueEmail('renamed') }, { body: { lang: 'ko', next: '/ko/' } })
    expect(again.res.status).toBe(303)
    expect(again.res.headers.get('location')).toBe('https://coach.test/ko/')
    const session = sessionCookie(again.res)!
    const owner = await env.DB.prepare('SELECT user_id FROM sessions WHERE id_hash = ?1').bind(await sessionHash(session)).first<{ user_id: string }>()
    expect(owner?.user_id).toBe(id)
    expect(await userByEmail(email)).toMatchObject({ id, lang: 'ko' })
    expect(await count("SELECT COUNT(*) AS n FROM events WHERE name = 'signup'")).toBe(signups)
  })

  it('rotates an existing session: the old one is deleted', async () => {
    const first = await signInWithGoogle()
    const old = sessionCookie(first.res)!
    const started = await begin()
    stub.idToken = await signJwt(claimsFor(started.nonce, { sub: first.claims.sub, email: first.claims.email }))
    const res = await back(started.state, { oauth: started.cookie, session: old })
    const fresh = sessionCookie(res)!
    expect(fresh).not.toBe(old)
    expect(await count('SELECT COUNT(*) AS n FROM sessions WHERE id_hash = ?1', await sessionHash(old))).toBe(0)
    expect(await count('SELECT COUNT(*) AS n FROM sessions WHERE id_hash = ?1', await sessionHash(fresh))).toBe(1)
  })

  it('links a live user who signed up with the email link to the Google account (no new user, no signup event)', async () => {
    const email = uniqueEmail('linked')
    const id = `u_link_${Date.now()}`
    const now = new Date().toISOString()
    await env.DB.prepare(
      `INSERT INTO users (id, email, email_hash, created_at, last_active_at, lang, marketing_opt_in, marketing_consent_text)
       VALUES (?1, ?2, ?3, ?4, ?4, 'ko', 1, 'earlier consent')`,
    )
      .bind(id, email, await emailHashOf(email), now)
      .run()
    const signups = await count("SELECT COUNT(*) AS n FROM events WHERE name = 'signup'")
    const sub = newSub()
    const { res } = await signInWithGoogle({ sub, email: email.toUpperCase() })
    expect(res.status).toBe(303)
    expect(await count('SELECT COUNT(*) AS n FROM users WHERE email = ?1', email)).toBe(1)
    // an unticked box never withdraws earlier consent
    expect(await env.DB.prepare('SELECT id, google_sub, marketing_opt_in FROM users WHERE email = ?1').bind(email).first()).toEqual({
      id,
      google_sub: sub,
      marketing_opt_in: 1,
    })
    expect(await count("SELECT COUNT(*) AS n FROM events WHERE name = 'signup'")).toBe(signups)
  })

  it('an address whose account is tied to another Google account moves to the one that proves the address now', async () => {
    // e.g. the learner deleted that Google account and made a new one with the same address (sub is never reused)
    const email = uniqueEmail('relink')
    const oldSub = newSub()
    const first = await signInWithGoogle({ sub: oldSub, email })
    const id = (await userByEmail(email))!.id
    expect(first.res.status).toBe(303)
    const newer = newSub()
    const again = await signInWithGoogle({ sub: newer, email })
    expect(again.res.status).toBe(303)
    expect(await env.DB.prepare('SELECT id, google_sub FROM users WHERE email = ?1').bind(email).first()).toEqual({ id, google_sub: newer })
    expect(await count('SELECT COUNT(*) AS n FROM users WHERE google_sub = ?1', oldSub)).toBe(0)
  })

  it('a new account with an address used before inherits the once-per-email flags (decision 9)', async () => {
    const email = uniqueEmail('inherit')
    const hash = await emailHashOf(email)
    await env.DB.prepare(
      `INSERT INTO users (id, email, email_hash, google_sub, created_at, last_active_at, free_speaking_used, self_refund_used, deleted_at)
       VALUES (?1, ?2, ?3, NULL, ?4, ?4, 1, 1, ?4)`,
    )
      .bind(`u_old_${Date.now()}`, `deleted:u_old_${Date.now()}`, hash, new Date().toISOString())
      .run()
    const { res } = await signInWithGoogle({ email })
    expect(res.status).toBe(303)
    expect(await userByEmail(email)).toMatchObject({ free_speaking_used: 1, self_refund_used: 1, deleted_at: null })
  })

  it('a deleted account loses its Google link, so the same Google account then starts a new user', async () => {
    const sub = newSub()
    const email = uniqueEmail('deleted')
    const first = await signInWithGoogle({ sub, email })
    const session = sessionCookie(first.res)!
    const oldId = (await userByEmail(email))!.id
    const del = await exports.default.fetch(`${ORIGIN}/api/account/delete`, {
      method: 'POST',
      headers: { origin: ORIGIN, 'content-type': 'application/json', cookie: `mpc_device=${DEVICE}; mpc_session=${session}` },
      body: '{}',
    })
    expect(del.status).toBe(200)
    expect(await env.DB.prepare('SELECT google_sub, deleted_at FROM users WHERE id = ?1').bind(oldId).first()).toMatchObject({
      google_sub: null,
    })
    const again = await signInWithGoogle({ sub, email })
    expect(again.res.status).toBe(303)
    const fresh = (await userByEmail(email))!
    expect(fresh.id).not.toBe(oldId)
    expect(fresh.email_hash).toBe(await emailHashOf(email))
  })

  it('records the marketing opt-in only when the sign-in finishes on the device that asked (same-device rule)', async () => {
    const body = { marketingOptIn: true, marketingConsentText: CONSENT_EN }
    const same = uniqueEmail('optin')
    const ok = await signInWithGoogle({ email: same }, { body })
    expect(ok.res.status).toBe(303)
    expect(await userByEmail(same)).toMatchObject({ marketing_opt_in: 1, marketing_consent_text: CONSENT_EN })

    const other = uniqueEmail('optin-other')
    const moved = await signInWithGoogle({ email: other }, { body, callbackDevice: 'another-device' })
    expect(moved.res.status).toBe(303)
    expect(await userByEmail(other)).toMatchObject({ marketing_opt_in: 0, marketing_consent_text: null })

    // a sentence that is not the server's own is never stored
    const wrong = uniqueEmail('optin-wrong')
    const { state } = await signInWithGoogle({ email: wrong }, { body: { marketingOptIn: true, marketingConsentText: 'yes please' } })
    expect(await userByEmail(wrong)).toMatchObject({ marketing_opt_in: 0 })
    const row = await env.DB.prepare('SELECT pending_json FROM oauth_states WHERE state_hash = ?1')
      .bind(await saltedHash(env.HASH_SALT, `oauth:${state}`))
      .first<{ pending_json: string }>()
    expect(row?.pending_json).not.toContain('yes please')
  })
})

describe('GET /api/auth/google/callback: rejections', () => {
  async function noUser(email: unknown): Promise<void> {
    expect(await count('SELECT COUNT(*) AS n FROM users WHERE email = ?1', String(email).toLowerCase())).toBe(0)
  }

  it('state: a missing or different cookie is refused before anything is consumed or exchanged', async () => {
    const started = await begin()
    stub.idToken = await signJwt(claimsFor(started.nonce))
    expectLoginError(await back(started.state, { oauth: null }), 'google_failed')
    const other = await begin()
    expectLoginError(await back(started.state, { oauth: other.cookie }), 'google_failed')
    expectLoginError(await back('short', { oauth: 'short' }), 'google_failed')
    expect(tokenCalls()).toHaveLength(0)
    // still usable by its own browser
    const res = await back(started.state, { oauth: started.cookie })
    expect(res.status).toBe(303)
    expect(sessionCookie(res)).toBeTruthy()
  })

  it('state: expired after 10 minutes', async () => {
    const started = await begin()
    stub.idToken = await signJwt(claimsFor(started.nonce))
    await env.DB.prepare('UPDATE oauth_states SET expires_at = ?1 WHERE state_hash = ?2')
      .bind(new Date(Date.now() - 1000).toISOString(), await saltedHash(env.HASH_SALT, `oauth:${started.state}`))
      .run()
    expectLoginError(await back(started.state, { oauth: started.cookie }), 'google_expired')
    expect(tokenCalls()).toHaveLength(0)
  })

  it('state: single use (a replayed callback is refused)', async () => {
    const { res, state, cookie, claims } = await signInWithGoogle()
    expect(res.status).toBe(303)
    const replay = await back(state, { oauth: cookie })
    expectLoginError(replay, 'google_expired')
    expect(tokenCalls()).toHaveLength(1)
    expect(await count('SELECT COUNT(*) AS n FROM users WHERE google_sub = ?1', claims.sub)).toBe(1)
  })

  it('the learner cancelled on Google: google_cancelled, with the language and next kept', async () => {
    const started = await begin({ body: { lang: 'ko', next: '/ko/pricing/' } })
    const res = await back(started.state, { oauth: started.cookie }, { error: 'access_denied', code: null, iss: null })
    expectLoginError(res, 'google_cancelled')
    expect(res.headers.get('location')).toBe('https://coach.test/login/?error=google_cancelled&lang=ko&next=/ko/pricing/')
    // the state is spent
    expectLoginError(await back(started.state, { oauth: started.cookie }), 'google_expired')
    // another provider error
    const s2 = await begin()
    expectLoginError(await back(s2.state, { oauth: s2.cookie }, { error: 'invalid_request', code: null }), 'google_failed')
    expect(tokenCalls()).toHaveLength(0)
  })

  it('the redirect must carry iss=https://accounts.google.com (RFC 9207) and a code', async () => {
    const cases: Record<string, string | null>[] = [
      { iss: null },
      { iss: 'https://evil.test' },
      { iss: 'accounts.google.com' },
      { code: null },
      { code: 'x'.repeat(2049) },
    ]
    for (const params of cases) {
      const started = await begin()
      stub.idToken = await signJwt(claimsFor(started.nonce))
      expectLoginError(await back(started.state, { oauth: started.cookie }, params), 'google_failed')
    }
    expect(tokenCalls()).toHaveLength(0)
  })

  it('the token endpoint refuses the code', async () => {
    stub.tokenStatus = 400
    const { res, claims } = await signInWithGoogle()
    expectLoginError(res, 'google_failed')
    await noUser(claims.email)
  })

  const claimCases: [string, Record<string, unknown>, string][] = [
    ['nonce mismatch', { nonce: 'not-the-nonce-we-stored-0123456789abcdefghijk' }, 'google_failed'],
    ['audience of another client', { aud: 'someone-else.apps.googleusercontent.com' }, 'google_failed'],
    ['audience list without our azp', { aud: [CLIENT_ID, 'other'], azp: 'other' }, 'google_failed'],
    ['foreign issuer', { iss: 'https://evil.test' }, 'google_failed'],
    ['expired (beyond the 300 s skew)', { exp: Math.floor(Date.now() / 1000) - 301, iat: Math.floor(Date.now() / 1000) - 4000 }, 'google_failed'],
    ['issued in the future', { iat: Math.floor(Date.now() / 1000) + 400 }, 'google_failed'],
    ['lifetime over 24 h', { exp: Math.floor(Date.now() / 1000) + 90_000 }, 'google_failed'],
    ['missing sub', { sub: undefined }, 'google_failed'],
    ['unverified email', { email_verified: false }, 'email_unverified'],
    ['email_verified as a string', { email_verified: 'true' }, 'email_unverified'],
    ['no usable email', { email: 'not-an-email' }, 'google_failed'],
    ['throwaway address', { email: 'someone@mailinator.com' }, 'disposable_email'],
  ]
  for (const [name, over, code] of claimCases) {
    it(`id_token claim check: ${name}`, async () => {
      const { res, claims } = await signInWithGoogle(over)
      expectLoginError(res, code)
      await noUser(claims.email)
    })
  }

  it('id_token signature: another key under our kid, a tampered payload, alg none or HS256', async () => {
    const forged = await signInWithGoogle({}, { token: (nonce) => signJwt(claimsFor(nonce), { key: otherKeys.privateKey }) })
    expectLoginError(forged.res, 'google_failed')
    const tampered = await signInWithGoogle(
      {},
      {
        token: async (nonce) => {
          const [h, , s] = (await signJwt(claimsFor(nonce))).split('.')
          return `${h}.${b64url(JSON.stringify(claimsFor(nonce, { email: 'victim@example.com' })))}.${s}`
        },
      },
    )
    expectLoginError(tampered.res, 'google_failed')
    await noUser('victim@example.com')
    for (const alg of ['none', 'HS256']) {
      const r = await signInWithGoogle({}, { token: async (nonce) => {
        const [h, p] = [b64url(JSON.stringify({ alg, kid: KID })), b64url(JSON.stringify(claimsFor(nonce)))]
        return `${h}.${p}.${alg === 'none' ? '' : b64url('sig')}`
      } })
      expectLoginError(r.res, 'google_failed')
    }
    expect(await signInWithGoogle({}, { token: async () => 'not.a-jwt' }).then((r) => r.res.headers.get('location'))).toContain('error=google_failed')
  })

  it('unknown kid: refetches the keys once (Google rotated them) and then succeeds', async () => {
    // first fetch: only the current key; second fetch: the new key as well
    stub.jwks = [[await publicJwk(keys, KID)], [await publicJwk(keys, KID), await publicJwk(otherKeys, 'rotated-kid')]]
    const warm = await signInWithGoogle()
    expect(sessionCookie(warm.res)).toBeTruthy()
    expect(jwksCalls()).toBe(1)
    const { res } = await signInWithGoogle({}, { token: (nonce) => signJwt(claimsFor(nonce), { kid: 'rotated-kid', key: otherKeys.privateKey }) })
    expect(res.status).toBe(303)
    expect(sessionCookie(res)).toBeTruthy()
    expect(jwksCalls()).toBe(2)
    // a cold cache that lacks the kid was just fetched: no second fetch for the same request
    resetJwksCache()
    stub.calls.length = 0
    stub.jwks = [[await publicJwk(keys, KID)]]
    const cold = await signInWithGoogle({}, { token: (nonce) => signJwt(claimsFor(nonce), { kid: 'rotated-kid', key: otherKeys.privateKey }) })
    expectLoginError(cold.res, 'google_failed')
    expect(jwksCalls()).toBe(1)
  })

  it('unknown kid that stays unknown: one refetch, then refused', async () => {
    const warm = await signInWithGoogle()
    expect(warm.res.status).toBe(303)
    expect(jwksCalls()).toBe(1)
    const { res } = await signInWithGoogle({}, { token: (nonce) => signJwt(claimsFor(nonce), { kid: 'nobody-knows' }) })
    expectLoginError(res, 'google_failed')
    expect(jwksCalls()).toBe(2)
  })

  it('Google not configured: the callback refuses without calling Google', async () => {
    const started = await begin()
    const restore = setEnv({ GOOGLE_CLIENT_ID: undefined })
    try {
      expectLoginError(await back(started.state, { oauth: started.cookie }), 'google_failed')
    } finally {
      restore()
    }
    expect(tokenCalls()).toHaveLength(0)
  })

  it('staging: only STAGING_ALLOWED_EMAILS may sign in with Google', async () => {
    const restore = setEnv({ STAGING_ALLOWED_EMAILS: 'owner@coach.test, tester@example.com' })
    try {
      const { res, claims } = await signInWithGoogle()
      expectLoginError(res, 'staging_only')
      await noUser(claims.email)
      const ok = await signInWithGoogle({ email: 'Tester@Example.com' })
      expect(ok.res.status).toBe(303)
      expect(sessionCookie(ok.res)).toBeTruthy()
    } finally {
      restore()
    }
  })
})

describe('verifyIdToken', () => {
  const e = () => ({ ...(env as Env), GOOGLE_CLIENT_ID: CLIENT_ID }) as Env

  it('returns the Google account id and the normalised email; tolerates 300 s of clock skew', async () => {
    const now = new Date()
    const t = Math.floor(now.getTime() / 1000)
    const token = await signJwt(claimsFor('n'.repeat(43), { sub: 'abc', email: ' Mixed@Example.COM ', exp: t - 250, iat: t - 3800 }))
    expect(await verifyIdToken(e(), token, { nonce: 'n'.repeat(43), now })).toEqual({
      ok: true,
      identity: { sub: 'abc', email: 'mixed@example.com' },
    })
    const future = await signJwt(claimsFor('n'.repeat(43), { iat: t + 250 }))
    expect((await verifyIdToken(e(), future, { nonce: 'n'.repeat(43), now })).ok).toBe(true)
  })

  it('names the failed check', async () => {
    const now = new Date()
    const nonce = 'n'.repeat(43)
    const check = async (token: string) => verifyIdToken(e(), token, { nonce, now })
    expect(await check(await signJwt(claimsFor(nonce, { aud: 'x' })))).toEqual({ ok: false, reason: 'aud' })
    expect(await check(await signJwt(claimsFor('other')))).toEqual({ ok: false, reason: 'nonce' })
    expect(await check(await signJwt(claimsFor(nonce), { key: otherKeys.privateKey }))).toEqual({ ok: false, reason: 'signature' })
    expect(await check(await signJwt(claimsFor(nonce), { alg: 'RS512' }))).toEqual({ ok: false, reason: 'alg' })
    expect(await check('a.b')).toEqual({ ok: false, reason: 'malformed' })
    expect(await verifyIdToken({ ...e(), GOOGLE_CLIENT_ID: '' } as Env, await signJwt(claimsFor(nonce, { aud: '' })), { nonce, now })).toEqual({
      ok: false,
      reason: 'aud',
    })
  })

  it('keeps the cached keys when a refetch fails', async () => {
    const now = new Date()
    const nonce = 'n'.repeat(43)
    expect((await verifyIdToken(e(), await signJwt(claimsFor(nonce)), { nonce, now })).ok).toBe(true)
    // the JWKS endpoint breaks: an unknown kid is refused, the known key still works
    stub.jwks = [[await publicJwk(keys, KID)], []]
    vi.stubGlobal('fetch', vi.fn(async () => new Response('unavailable', { status: 503 })))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(await verifyIdToken(e(), await signJwt(claimsFor(nonce), { kid: 'new' }), { nonce, now })).toEqual({ ok: false, reason: 'unknown_kid' })
    expect((await verifyIdToken(e(), await signJwt(claimsFor(nonce)), { nonce, now })).ok).toBe(true)
  })
})
