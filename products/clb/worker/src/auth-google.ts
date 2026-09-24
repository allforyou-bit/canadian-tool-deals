// Sign in with Google (memo §7.2 Z3): OpenID Connect authorization-code flow with PKCE, run in the Worker, so
// learners can sign in without us sending any email (no sending domain at C$0).
//
// POST /api/auth/google/start  — the same checks as the email link (language, 18+, Turnstile, optional CASL
//   consent), then a random state, nonce and PKCE verifier are stored in D1 oauth_states for 10 minutes and the
//   raw state goes into the short-lived mpc_oauth cookie. Answers {url} for Google's authorization endpoint
//   (scope 'openid email' only: no profile, PIPEDA 4.4).
// GET /api/auth/google/callback — the state must match the cookie and an unused, unexpired row (consumed
//   atomically), the code is exchanged at Google's token endpoint with the client secret and the verifier, and
//   the id_token is checked: RS256 signature against Google's JWKS (cached per isolate, refetched once for an
//   unknown kid), iss, aud, exp/iat with 300 s skew, nonce, sub, email_verified and the email. The user is found
//   by google_sub, else the live user with that email is linked, else created through upsertUser (email_hash
//   inheritance, 'signup' event). Then the session rotates and the browser goes to `next` (303). No Google token
//   is stored (access_type stays online, so there is no refresh token) and nothing personal is logged.
//
// Endpoint values: Google's discovery document https://accounts.google.com/.well-known/openid-configuration
// (fetched 2026-09-24: issuer, authorization/token endpoints, jwks_uri, RS256 only, S256 PKCE,
// client_secret_post, authorization_response_iss_parameter_supported: true), cross-checked against
// googleapis/google-auth-library-nodejs main src/auth/oauth2client.ts (raw.githubusercontent.com, read
// 2026-09-24): oauth2AuthBaseUrl, oauth2TokenUrl, oauth2FederatedSignonJwkCertsUrl, issuers
// ['accounts.google.com', 'https://accounts.google.com'], CLOCK_SKEW_SECS_ = 300,
// DEFAULT_MAX_TOKEN_LIFETIME_SECS_ = 86400, client_secret_post by default, prompt 'select_account'.
// Real callbacks logged in public GitHub repositories (2026) carry iss=https://accounts.google.com.
import type { GoogleStartRequest, GoogleStartResponse, Lang } from '../../shared/api'
import { MARKETING_CONSENT } from '../../shared/config'
import {
  acceptedConsentText,
  consentToRecord,
  emailHash,
  isLang,
  isRecord,
  normaliseEmail,
  pendingFrom,
  recordSignIn,
  stagingAllows,
  upsertUser,
} from './auth'
import type { Ctx, Env } from './env'
import { randomToken, saltedHash, timingSafeEqualHex } from './lib/crypto'
import { isDisposableEmail } from './lib/disposable'
import { error, getCookie, json, readJson } from './lib/http'
import { createSession } from './lib/session'
import { verifyTurnstile } from './turnstile'

export const GOOGLE_OIDC = {
  /** discovery `issuer`; also the RFC 9207 `iss` Google adds to the redirect */
  issuer: 'https://accounts.google.com',
  /** id_token `iss` values Google uses (google-auth-library-nodejs OAuth2Client.issuers) */
  idTokenIssuers: ['https://accounts.google.com', 'accounts.google.com'],
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  jwksUri: 'https://www.googleapis.com/oauth2/v3/certs',
  /** the email only: no name or photo (PIPEDA Sch. 1 4.4) */
  scope: 'openid email',
} as const

export const OAUTH_COOKIE = 'mpc_oauth'
/** the cookie is only sent to /api/auth/google/* (start sets it, the callback reads it) */
export const OAUTH_COOKIE_PATH = '/api/auth/google/'
export const OAUTH_STATE_MINUTES = 10
export const CALLBACK_PATH = '/api/auth/google/callback'
export const DEFAULT_NEXT = '/account/'
/** google-auth-library-nodejs CLOCK_SKEW_SECS_ and DEFAULT_MAX_TOKEN_LIFETIME_SECS_ */
const CLOCK_SKEW_SECONDS = 300
const MAX_TOKEN_LIFETIME_SECONDS = 86_400
/** JWKS cache bounds when Google's Cache-Control max-age is missing or odd (it said ~5.5 h on 2026-09-24) */
const JWKS_DEFAULT_SECONDS = 3_600
const JWKS_MIN_SECONDS = 60
const JWKS_MAX_SECONDS = 86_400
const MAX_NEXT_CHARS = 512
const MAX_PARAM_CHARS = 2_048

/** `?error=` codes the callback sends the browser back to /login/ with (the login page shows the messages). */
export type GoogleSignInError =
  /** the learner pressed Cancel on Google's screen */
  | 'google_cancelled'
  /** the 10-minute round trip ran out, or the same answer came back twice */
  | 'google_expired'
  /** anything else: wrong state or iss, token exchange or id_token check failed, Google not configured */
  | 'google_failed'
  /** Google says the address is not verified */
  | 'email_unverified'
  /** a throwaway address (same rule as the email link) */
  | 'disposable_email'
  /** staging Worker: only STAGING_ALLOWED_EMAILS may sign in */
  | 'staging_only'

/** Reasons in logs (never tokens, codes, emails or ids). */
type FailReason =
  | 'not_configured'
  | 'state_mismatch'
  | 'state_expired'
  | 'provider_error'
  | 'iss_param'
  | 'no_code'
  | 'token_exchange'
  | IdTokenFailure
  | 'disposable'
  | 'staging'
  | 'link_failed'

export type IdTokenFailure =
  | 'malformed'
  | 'alg'
  | 'unknown_kid'
  | 'signature'
  | 'iss'
  | 'aud'
  | 'exp'
  | 'iat'
  | 'nonce'
  | 'sub'
  | 'email_unverified'
  | 'email'

export interface GoogleIdentity {
  /** Google account id: stable and never reused (use it, not the email, as the key) */
  sub: string
  /** normalised (trimmed, lower-cased) and verified by Google */
  email: string
}

/** Google sign-in works only with both the client id (var) and the client secret (secret). */
export function googleConfigured(env: Env): boolean {
  return Boolean((env.GOOGLE_CLIENT_ID ?? '').trim() && (env.GOOGLE_CLIENT_SECRET ?? '').trim())
}

/** Absolute redirect_uri registered in the Google console: SITE_URL + /api/auth/google/callback. */
export function redirectUri(env: Env): string {
  return `${env.SITE_URL.replace(/\/+$/, '')}${CALLBACK_PATH}`
}

/**
 * A same-origin path to go to after sign-in, or null (server-side twin of lib/url.ts safeNextPath): no
 * absolute or protocol-relative URLs, backslashes or control characters, nothing outside the site, and never
 * back into the sign-in flow or the API.
 */
export function safeNextPath(value: unknown, siteUrl: string): string | null {
  if (typeof value !== 'string' || value.length > MAX_NEXT_CHARS) return null
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null
  if (/[\u0000-\u001f\u007f]/.test(value)) return null
  try {
    const origin = new URL(siteUrl).origin
    const url = new URL(value, origin)
    if (url.origin !== origin) return null
    if (/^\/(auth|login|api)\//.test(url.pathname)) return null
    return url.pathname + url.search + url.hash
  } catch {
    return null
  }
}

// ---------- small encoders ----------

const enc = new TextEncoder()

function bytesToBase64Url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlToBytes(s: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) return null
  try {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4))
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  } catch {
    return null
  }
}

function decodeJsonPart(part: string): Record<string, unknown> | null {
  const bytes = base64UrlToBytes(part)
  if (!bytes) return null
  try {
    const v: unknown = JSON.parse(new TextDecoder().decode(bytes))
    return isRecord(v) ? v : null
  } catch {
    return null
  }
}

/** RFC 7636 S256: BASE64URL(SHA-256(ASCII(code_verifier))). */
export async function pkceChallenge(verifier: string): Promise<string> {
  return bytesToBase64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(verifier))))
}

function stateHash(env: Env, state: string): Promise<string> {
  return saltedHash(env.HASH_SALT, `oauth:${state}`)
}

function oauthCookie(state: string, maxAgeSeconds: number): string {
  return [
    `${OAUTH_COOKIE}=${state}`,
    `Path=${OAUTH_COOKIE_PATH}`,
    `Max-Age=${maxAgeSeconds}`,
    'Secure',
    'HttpOnly',
    // Lax: Google comes back with a top-level GET, which Lax cookies accompany
    'SameSite=Lax',
  ].join('; ')
}

// ---------- Google's signing keys (JWKS) ----------

interface JwksCache {
  keys: Map<string, JsonWebKey>
  imported: Map<string, CryptoKey>
  expiresAt: number
}

/** Per isolate: Google's keys change every few days and are served with a multi-hour max-age. */
let jwks: JwksCache | null = null

/** Test hook: forget the cached keys. */
export function resetJwksCache(): void {
  jwks = null
}

function maxAgeSeconds(cacheControl: string | null): number {
  const m = /(?:^|[,\s])max-age=(\d+)/i.exec(cacheControl ?? '')
  const n = m?.[1] ? Number(m[1]) : JWKS_DEFAULT_SECONDS
  return Math.min(JWKS_MAX_SECONDS, Math.max(JWKS_MIN_SECONDS, n))
}

async function fetchJwks(nowMs: number): Promise<JwksCache | null> {
  let res: Response
  try {
    res = await fetch(GOOGLE_OIDC.jwksUri, { headers: { accept: 'application/json' } })
  } catch {
    return null
  }
  if (!res.ok) {
    console.warn('google jwks fetch failed', res.status)
    return null
  }
  let data: unknown
  try {
    data = await res.json()
  } catch {
    return null
  }
  const keys = new Map<string, JsonWebKey>()
  const list = isRecord(data) && Array.isArray(data.keys) ? data.keys : []
  for (const k of list) {
    if (!isRecord(k) || k.kty !== 'RSA' || typeof k.kid !== 'string' || typeof k.n !== 'string' || typeof k.e !== 'string') continue
    if (k.use !== undefined && k.use !== 'sig') continue
    if (k.alg !== undefined && k.alg !== 'RS256') continue
    keys.set(k.kid, { kty: 'RSA', n: k.n, e: k.e, alg: 'RS256', ext: true })
  }
  return { keys, imported: new Map(), expiresAt: nowMs + maxAgeSeconds(res.headers.get('cache-control')) * 1000 }
}

/**
 * The verification key for `kid`: from the cache while it is fresh, otherwise fetched; an unknown kid (Google
 * rotated its keys) triggers one refetch. A failed fetch keeps using the keys already held.
 */
async function googleKey(kid: string, nowMs: number): Promise<CryptoKey | null> {
  let fetched = false
  if (!jwks || jwks.expiresAt <= nowMs) {
    jwks = (await fetchJwks(nowMs)) ?? jwks
    fetched = true
  }
  if (!jwks?.keys.has(kid) && !fetched) jwks = (await fetchJwks(nowMs)) ?? jwks
  const cache = jwks
  const jwk = cache?.keys.get(kid)
  if (!cache || !jwk) return null
  const known = cache.imported.get(kid)
  if (known) return known
  try {
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'])
    cache.imported.set(kid, key)
    return key
  } catch {
    return null
  }
}

/**
 * Checks a Google id_token: RS256 signature against Google's JWKS, then the claims. `nonce` is the value
 * stored at /start. Google says a token taken straight from its token endpoint over TLS with the client
 * secret may skip the signature check [SECONDARY: quotes of developers.google.com]; we check it anyway.
 */
export async function verifyIdToken(
  env: Env,
  idToken: string,
  expected: { nonce: string; now: Date },
): Promise<{ ok: true; identity: GoogleIdentity } | { ok: false; reason: IdTokenFailure }> {
  const fail = (reason: IdTokenFailure) => ({ ok: false as const, reason })
  const parts = idToken.split('.')
  if (parts.length !== 3 || idToken.length > 16 * 1024) return fail('malformed')
  const [h, p, s] = parts as [string, string, string]
  const header = decodeJsonPart(h)
  const claims = decodeJsonPart(p)
  const signature = base64UrlToBytes(s)
  if (!header || !claims || !signature || signature.length === 0) return fail('malformed')
  if (header.alg !== 'RS256') return fail('alg')
  if (typeof header.kid !== 'string' || header.kid === '') return fail('unknown_kid')

  const key = await googleKey(header.kid, expected.now.getTime())
  if (!key) return fail('unknown_kid')
  let valid = false
  try {
    valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, enc.encode(`${h}.${p}`))
  } catch {
    valid = false
  }
  if (!valid) return fail('signature')

  const clientId = (env.GOOGLE_CLIENT_ID ?? '').trim()
  if (typeof claims.iss !== 'string' || !(GOOGLE_OIDC.idTokenIssuers as readonly string[]).includes(claims.iss)) return fail('iss')
  const aud = claims.aud
  const audOk =
    typeof aud === 'string'
      ? aud === clientId
      : Array.isArray(aud) && aud.includes(clientId) && (aud.length === 1 || claims.azp === clientId)
  if (!audOk || clientId === '') return fail('aud')
  const nowSec = expected.now.getTime() / 1000
  const { exp, iat } = claims
  if (typeof exp !== 'number' || !Number.isFinite(exp) || nowSec > exp + CLOCK_SKEW_SECONDS) return fail('exp')
  if (exp >= nowSec + MAX_TOKEN_LIFETIME_SECONDS) return fail('exp')
  if (typeof iat !== 'number' || !Number.isFinite(iat) || iat > nowSec + CLOCK_SKEW_SECONDS) return fail('iat')
  if (typeof claims.nonce !== 'string' || !(await sameSecret(env, claims.nonce, expected.nonce))) return fail('nonce')
  if (typeof claims.sub !== 'string' || claims.sub === '' || claims.sub.length > 255) return fail('sub')
  if (claims.email_verified !== true) return fail('email_unverified')
  const email = normaliseEmail(claims.email)
  if (!email) return fail('email')
  return { ok: true, identity: { sub: claims.sub, email } }
}

/** Constant-time equality of two secrets of any length (compares salted hashes). */
async function sameSecret(env: Env, a: string, b: string): Promise<boolean> {
  const [ha, hb] = await Promise.all([saltedHash(env.HASH_SALT, `cmp:${a}`), saltedHash(env.HASH_SALT, `cmp:${b}`)])
  return timingSafeEqualHex(ha, hb)
}

// ---------- routes ----------

type StartBody = Partial<GoogleStartRequest> & { marketingOptIn?: unknown; marketingConsentText?: unknown }

/** POST /api/auth/google/start → {url} plus the mpc_oauth cookie. */
export async function start(req: Request, ctx: Ctx): Promise<Response> {
  const { env, now } = ctx
  if (!googleConfigured(env)) return error('forbidden', 'Google sign-in is not available on this site')
  const body = await readJson<StartBody>(req, 8 * 1024)
  if (!isRecord(body)) return error('bad_request', 'Invalid request')
  if (!isLang(body.lang)) return error('bad_request', 'Unsupported language')
  if (body.adult !== true) return error('bad_request', 'You must confirm that you are 18 or older')
  const next = safeNextPath(body.next, env.SITE_URL) ?? DEFAULT_NEXT
  // CASL (decision 10): recorded at the callback only with the exact server sentence and the same device
  const consentText = body.marketingOptIn === true ? acceptedConsentText(env, body.marketingConsentText, body.lang) : null

  const token = typeof body.turnstileToken === 'string' ? body.turnstileToken : null
  if (!(await verifyTurnstile(env, token))) {
    return error('turnstile_failed', 'Please complete the verification and try again')
  }

  const state = randomToken(32)
  const nonce = randomToken(32)
  // 32 random bytes → 43 base64url characters, the RFC 7636 minimum length and alphabet
  const verifier = randomToken(32)
  const pending = {
    lang: body.lang,
    adult: true,
    marketingOptIn: consentText !== null,
    ...(consentText ? { marketingConsentText: consentText } : {}),
    consentVersion: MARKETING_CONSENT.version,
  }
  await env.DB.prepare(
    `INSERT INTO oauth_states (state_hash, created_at, expires_at, used_at, code_verifier, nonce, pending_json, device_hash, next_path)
     VALUES (?1, ?2, ?3, NULL, ?4, ?5, ?6, ?7, ?8)`,
  )
    .bind(
      await stateHash(env, state),
      now.toISOString(),
      new Date(now.getTime() + OAUTH_STATE_MINUTES * 60_000).toISOString(),
      verifier,
      nonce,
      JSON.stringify(pending),
      ctx.deviceHash,
      next,
    )
    .run()

  const params = new URLSearchParams({
    client_id: (env.GOOGLE_CLIENT_ID ?? '').trim(),
    redirect_uri: redirectUri(env),
    response_type: 'code',
    scope: GOOGLE_OIDC.scope,
    state,
    nonce,
    code_challenge: await pkceChallenge(verifier),
    code_challenge_method: 'S256',
    // always show the account chooser, so a shared computer does not silently reuse someone's account
    prompt: 'select_account',
  })
  const url = `${GOOGLE_OIDC.authorizationEndpoint}?${params.toString()}`
  return json({ url } satisfies GoogleStartResponse, {
    headers: { 'set-cookie': oauthCookie(state, OAUTH_STATE_MINUTES * 60) },
  })
}

interface OAuthRow {
  created_at: string
  code_verifier: string
  nonce: string
  pending_json: string | null
  device_hash: string
  next_path: string | null
}

/** 303 to a site path, always clearing mpc_oauth; `cookies` are extra Set-Cookie values. */
function redirect(env: Env, path: string, cookies: string[] = []): Response {
  const headers = new Headers({
    location: `${env.SITE_URL.replace(/\/+$/, '')}${path}`,
    'cache-control': 'no-store',
    'referrer-policy': 'no-referrer',
  })
  for (const c of [...cookies, oauthCookie('', 0)]) headers.append('set-cookie', c)
  return new Response(null, { status: 303, headers })
}

function loginPath(code: GoogleSignInError, lang: Lang | null, next: string | null): string {
  const params = new URLSearchParams({ error: code })
  if (lang === 'ko') params.set('lang', 'ko')
  if (next && next !== DEFAULT_NEXT) params.set('next', next)
  return `/login/?${params.toString().replace(/%2F/gi, '/')}`
}

/** Exchanges the code at Google's token endpoint (client_secret_post + PKCE); returns the id_token only. */
async function exchangeCode(env: Env, code: string, verifier: string): Promise<string | null> {
  let res: Response
  try {
    res = await fetch(GOOGLE_OIDC.tokenEndpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: new URLSearchParams({
        code,
        client_id: (env.GOOGLE_CLIENT_ID ?? '').trim(),
        client_secret: (env.GOOGLE_CLIENT_SECRET ?? '').trim(),
        redirect_uri: redirectUri(env),
        grant_type: 'authorization_code',
        code_verifier: verifier,
      }).toString(),
    })
  } catch {
    return null
  }
  if (!res.ok) {
    console.warn('google token exchange failed', res.status)
    return null
  }
  try {
    const data: unknown = await res.json()
    // the access token in the same answer is dropped here: nothing from Google is stored but sub and email
    return isRecord(data) && typeof data.id_token === 'string' ? data.id_token : null
  } catch {
    return null
  }
}

/** GET /api/auth/google/callback → 303 to `next` signed in, or to /login/?error=… (never a JSON error page). */
export async function callback(req: Request, ctx: Ctx): Promise<Response> {
  try {
    return await handleCallback(req, ctx)
  } catch (e) {
    console.error('google sign-in error', e instanceof Error ? e.name : 'unknown')
    return redirect(ctx.env, loginPath('google_failed', null, null))
  }
}

async function handleCallback(req: Request, ctx: Ctx): Promise<Response> {
  const { env, now } = ctx
  const q = new URL(req.url).searchParams
  let lang: Lang | null = null
  let next: string | null = null
  const fail = (code: GoogleSignInError, reason: FailReason): Response => {
    console.warn('google sign-in failed', { reason })
    return redirect(env, loginPath(code, lang, next))
  }
  if (!googleConfigured(env)) return fail('google_failed', 'not_configured')

  // The state must be the one this browser was given (login CSRF / fixation guard) ...
  const state = q.get('state') ?? ''
  const cookieState = getCookie(req, OAUTH_COOKIE) ?? ''
  if (state.length < 20 || state.length > 200 || !(await sameSecret(env, state, cookieState))) {
    return fail(q.has('error') ? 'google_cancelled' : 'google_failed', 'state_mismatch')
  }
  // ... and is used at most once, within its 10 minutes (consumed before anything else can fail).
  const hash = await stateHash(env, state)
  const nowIso = now.toISOString()
  const used = await env.DB.prepare(
    'UPDATE oauth_states SET used_at = ?1 WHERE state_hash = ?2 AND used_at IS NULL AND expires_at > ?1',
  )
    .bind(nowIso, hash)
    .run()
  const row =
    used.meta.changes === 1
      ? await env.DB.prepare(
          'SELECT created_at, code_verifier, nonce, pending_json, device_hash, next_path FROM oauth_states WHERE state_hash = ?1',
        )
          .bind(hash)
          .first<OAuthRow>()
      : null
  if (!row) return fail(q.has('error') ? 'google_cancelled' : 'google_expired', 'state_expired')

  let pendingValue: unknown = null
  try {
    pendingValue = row.pending_json ? JSON.parse(row.pending_json) : null
  } catch {
    pendingValue = null
  }
  const pending = pendingFrom(isRecord(pendingValue) ? { ...pendingValue, deviceHash: row.device_hash } : null)
  lang = pending.lang
  next = safeNextPath(row.next_path, env.SITE_URL) ?? DEFAULT_NEXT

  const providerError = q.get('error')
  if (providerError !== null) {
    return fail(providerError === 'access_denied' ? 'google_cancelled' : 'google_failed', 'provider_error')
  }
  // RFC 9207: Google's discovery document sets authorization_response_iss_parameter_supported
  if (q.get('iss') !== GOOGLE_OIDC.issuer) return fail('google_failed', 'iss_param')
  const code = q.get('code') ?? ''
  if (code === '' || code.length > MAX_PARAM_CHARS) return fail('google_failed', 'no_code')

  const idToken = await exchangeCode(env, code, row.code_verifier)
  if (!idToken) return fail('google_failed', 'token_exchange')
  const checked = await verifyIdToken(env, idToken, { nonce: row.nonce, now })
  if (!checked.ok) return fail(checked.reason === 'email_unverified' ? 'email_unverified' : 'google_failed', checked.reason)
  const { sub, email } = checked.identity
  if (isDisposableEmail(email)) return fail('disposable_email', 'disposable')
  if (!stagingAllows(env, email)) return fail('staging_only', 'staging')

  let userId: string
  try {
    const bySub = await env.DB.prepare('SELECT id, email_hash FROM users WHERE google_sub = ?1 AND deleted_at IS NULL')
      .bind(sub)
      .first<{ id: string; email_hash: string }>()
    const addressHash = bySub?.email_hash ?? (await emailHash(env, email))
    const consent = await consentToRecord(env, pending, addressHash, row.created_at, ctx.deviceHash)
    if (bySub) {
      userId = bySub.id
      await recordSignIn(env, userId, pending.lang, consent, now)
    } else {
      // links a live user with this email (an owner or earlier email-link account), or creates one
      userId = await upsertUser(env, email, addressHash, pending.lang, consent, now, { googleSub: sub, signupPath: CALLBACK_PATH })
    }
  } catch (e) {
    // e.g. a concurrent sign-in linked this Google account to another live user (unique google_sub index)
    console.error('google sign-in link failed', e instanceof Error ? e.name : 'unknown')
    return fail('google_failed', 'link_failed')
  }
  const session = await createSession(req, env, userId, now)
  return redirect(env, next, [session])
}
