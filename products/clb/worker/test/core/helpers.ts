// Shared helpers for the core tests: a recording fetch stub for Resend/Turnstile and small API wrappers.
import { env, exports } from 'cloudflare:workers'
import { afterAll, beforeAll, vi } from 'vitest'
import { MARKETING_CONSENT } from '../../../shared/config'
import type { Env } from '../../src/env'
import { saltedHash } from '../../src/lib/crypto'

/**
 * Overrides Worker settings for the calls that follow; returns a function that restores them. The `env`
 * object from cloudflare:workers is the one exports.default.fetch hands to the Worker, so this reaches
 * requests made through `api()` too. `undefined` removes a setting.
 */
export function setEnv(overrides: Partial<Record<keyof Env, string | undefined>>): () => void {
  const target = env as unknown as Record<string, unknown>
  const saved = Object.keys(overrides).map((k) => [k, Object.prototype.hasOwnProperty.call(target, k), target[k]] as const)
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) delete target[k]
    else target[k] = v
  }
  return () => {
    for (const [k, had, v] of saved) {
      if (had) target[k] = v
      else delete target[k]
    }
  }
}

/**
 * The pre-launch sign-in setup these tests exercise: email links for everyone (MAGIC_LINK=all) and learner
 * email on (LEARNER_EMAIL=on), for the whole test file. The launch defaults (owner-only link, no learner
 * email) have their own tests.
 */
export function useEmailSignInForEveryone(): void {
  let restore: () => void = () => {}
  beforeAll(() => {
    restore = setEnv({ MAGIC_LINK: 'all', LEARNER_EMAIL: 'on' })
  })
  afterAll(() => restore())
}

export const ORIGIN = 'https://coach.test'
export const DEVICE = 'core-test-device'

export interface FetchCall {
  url: string
  body: Record<string, unknown> | null
}

export interface FetchStub {
  calls: FetchCall[]
  /** JSON bodies posted to Resend */
  emails(): { to: string[]; subject: string; text: string }[]
}

/** Stubs global fetch: Turnstile answers `turnstile`, Resend answers 200 (or 500 when `resendOk` is false). */
export function stubFetch(opts: { turnstile?: boolean; resendOk?: boolean } = {}): FetchStub {
  const calls: FetchCall[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : null
      calls.push({ url, body })
      if (url === 'https://challenges.cloudflare.com/turnstile/v0/siteverify') {
        return Response.json({ success: opts.turnstile ?? true })
      }
      if (url === 'https://api.resend.com/emails') {
        return opts.resendOk === false ? new Response('error', { status: 500 }) : Response.json({ id: 'email_test' })
      }
      throw new Error(`unexpected fetch in test: ${url}`)
    }),
  )
  return {
    calls,
    emails: () =>
      calls
        .filter((c) => c.url === 'https://api.resend.com/emails')
        .map((c) => c.body as { to: string[]; subject: string; text: string }),
  }
}

let seq = 0
/** A unique, valid email address per call. */
export function uniqueEmail(tag = 'user'): string {
  seq += 1
  return `${tag}.${Date.now().toString(36)}.${seq}@example.com`
}

/**
 * Calls the Worker with the site origin, a fixed device cookie (`device: null` sends none, like a client
 * that drops it) and an optional session cookie and client IP (cf-connecting-ip).
 */
export function api(
  path: string,
  init: { method?: 'GET' | 'POST'; body?: unknown; session?: string; device?: string | null; ip?: string } = {},
): Promise<Response> {
  const cookies = init.device === null ? [] : [`mpc_device=${init.device ?? DEVICE}`]
  if (init.session) cookies.push(`mpc_session=${init.session}`)
  const headers: Record<string, string> = { origin: ORIGIN }
  if (cookies.length > 0) headers.cookie = cookies.join('; ')
  if (init.ip) headers['cf-connecting-ip'] = init.ip
  if (init.body !== undefined) headers['content-type'] = 'application/json'
  return exports.default.fetch(`${ORIGIN}${path}`, {
    method: init.method ?? (init.body !== undefined ? 'POST' : 'GET'),
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
}

/** The consent sentence the Worker builds from the test bindings (MAILING_ADDRESS, SITE_URL). */
export const CONSENT_EN = MARKETING_CONSENT.en('1 Test St, Toronto ON M5V 0A1', 'https://coach.test')
export const CONSENT_KO = MARKETING_CONSENT.ko('1 Test St, Toronto ON M5V 0A1', 'https://coach.test')

export function magicLinkBody(email: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { email, lang: 'en', turnstileToken: 'tok', marketingOptIn: false, marketingConsentText: '', adult: true, ...extra }
}

/** Token from the last sign-in email in the stub. */
export function lastToken(stub: FetchStub): string {
  const text = stub.emails().at(-1)?.text ?? ''
  const m = /#token=([A-Za-z0-9_-]+)/.exec(text)
  if (!m?.[1]) throw new Error('no token in email')
  return m[1]
}

/** Raw session value from a Set-Cookie header. */
export function sessionFromSetCookie(res: Response): string | null {
  const m = /(?:^|,\s*)mpc_session=([^;]*)/.exec(res.headers.get('set-cookie') ?? '')
  return m?.[1] ? decodeURIComponent(m[1]) : null
}

/**
 * Requests a link, verifies it and returns the new session cookie value (stubs fetch as a side effect).
 * `verifyDevice` opens the link on another device than the one that asked for it.
 */
export async function signIn(
  email: string,
  opts: { extra?: Record<string, unknown>; session?: string; verifyDevice?: string } = {},
): Promise<{ session: string; res: Response; stub: FetchStub }> {
  const stub = stubFetch()
  const link = await api('/api/auth/magic-link', { body: magicLinkBody(email, opts.extra) })
  if (link.status !== 200) throw new Error(`magic-link failed: ${link.status}`)
  const res = await api('/api/auth/verify', {
    body: { token: lastToken(stub) },
    session: opts.session,
    device: opts.verifyDevice,
  })
  const session = sessionFromSetCookie(res)
  if (res.status !== 200 || !session) throw new Error(`verify failed: ${res.status}`)
  return { session, res, stub }
}

export function sessionHash(raw: string): Promise<string> {
  return saltedHash(env.HASH_SALT, `session:${raw}`)
}

export async function userByEmail(email: string) {
  return env.DB.prepare('SELECT * FROM users WHERE email = ?1').bind(email).first<{
    id: string
    email: string
    email_hash: string
    lang: string
    adult_confirmed_at: string | null
    marketing_opt_in: number
    marketing_consent_text: string | null
    marketing_consent_at: string | null
    marketing_withdrawn_at: string | null
    marketing_consent_version: string | null
    free_speaking_used: number
    self_refund_used: number
    last_active_at: string
    deleted_at: string | null
  }>()
}

export function emailHashOf(email: string): Promise<string> {
  return saltedHash(env.HASH_SALT, `email:${email.toLowerCase()}`)
}

export async function count(sql: string, ...params: unknown[]): Promise<number> {
  const row = await env.DB.prepare(sql)
    .bind(...params)
    .first<{ n: number }>()
  return row?.n ?? 0
}
