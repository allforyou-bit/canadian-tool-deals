// Magic-link sign-in (memo B2): Turnstile, ≤3 links per email per hour, hashed single-use tokens with a
// 15-minute TTL, D1-backed sessions in an HttpOnly/Secure/SameSite=Lax cookie that rotates on sign-in.
// CASL marketing consent is captured at request time and applied only when the box was ticked.
import type { Lang, MagicLinkRequest, MagicLinkResponse, VerifyRequest, VerifyResponse } from '../../shared/api'
import { BRAND, MARKETING_CONSENT, SESSION } from '../../shared/config'
import { sendEmail } from './email'
import type { Ctx, Env } from './env'
import { randomId, randomToken, saltedHash } from './lib/crypto'
import { isDisposableEmail } from './lib/disposable'
import { error, getCookie, json, readJson, setCookie } from './lib/http'
import { dayKey } from './lib/time'
import { verifyTurnstile } from './turnstile'

const MAX_EMAIL_CHARS = 254
const MAX_CONSENT_CHARS = 1500
const HOUR_MS = 3_600_000

/** Modelled on the WHATWG "valid e-mail address" pattern, but requiring a dot in the domain. */
// [unverified: prior knowledge] the pattern is recalled from the HTML spec, not re-checked against it
const EMAIL_RE =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/

/** Consent and profile choices captured with the link; applied when the link is used. */
interface PendingSignup {
  lang: Lang
  adult: true
  marketingOptIn: boolean
  marketingConsentText?: string
  consentVersion: string
}

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export function isLang(v: unknown): v is Lang {
  return v === 'en' || v === 'ko'
}

/** Trimmed, lower-cased address, or null when it is not a plausible email. */
export function normaliseEmail(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const email = v.trim().toLowerCase()
  if (email.length > MAX_EMAIL_CHARS || !EMAIL_RE.test(email)) return null
  return email
}

/** The consent wording the user saw (trimmed), or null when missing or implausibly long. */
export function cleanConsentText(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const text = v.trim()
  return text.length > 0 && text.length <= MAX_CONSENT_CHARS ? text : null
}

export function sessionIdHash(env: Env, raw: string): Promise<string> {
  return saltedHash(env.HASH_SALT, `session:${raw}`)
}

/** Set-Cookie value that removes the session cookie. */
export function clearSessionCookie(): string {
  return setCookie(SESSION.cookieName, '', { maxAgeSeconds: 0 })
}

function signInEmail(lang: Lang, link: string): { subject: string; text: string } {
  const minutes = SESSION.magicLinkMinutes
  if (lang === 'ko') {
    return {
      subject: `${BRAND.ko} 로그인 링크`,
      text: [
        '안녕하세요.',
        `아래 링크를 눌러 ${BRAND.ko}에 로그인하세요.`,
        link,
        `이 링크는 ${minutes}분 후에 만료되며 한 번만 사용할 수 있어요.`,
        '로그인을 요청하지 않으셨다면 이 이메일을 무시하셔도 됩니다.\n이 링크가 없으면 누구도 로그인할 수 없어요.',
      ].join('\n\n'),
    }
  }
  return {
    subject: `Your sign-in link for ${BRAND.en}`,
    text: [
      'Hello,',
      `Use this link to sign in to ${BRAND.en}:`,
      link,
      `The link expires in ${minutes} minutes and works once.`,
      'If you did not ask to sign in, you can ignore this email. Nobody can sign in without this link.',
    ].join('\n\n'),
  }
}

/** POST /api/auth/magic-link — always answers {ok:true} on success, whether or not an account exists. */
export async function requestMagicLink(req: Request, ctx: Ctx): Promise<Response> {
  const { env, now } = ctx
  const body = await readJson<Partial<MagicLinkRequest>>(req, 8 * 1024)
  if (!isRecord(body)) return error('bad_request', 'Invalid request')

  const email = normaliseEmail(body.email)
  if (!email) return error('bad_request', 'Enter a valid email address')
  if (!isLang(body.lang)) return error('bad_request', 'Unsupported language')
  if (body.adult !== true) return error('bad_request', 'You must confirm that you are 18 or older')
  // CASL: only an explicit tick counts as consent; anything else is "no".
  const marketingOptIn = body.marketingOptIn === true
  const consentText = marketingOptIn ? cleanConsentText(body.marketingConsentText) : null
  if (marketingOptIn && !consentText) return error('bad_request', 'Missing consent wording')
  if (isDisposableEmail(email)) return error('bad_request', 'Please use a permanent email address')

  const token = typeof body.turnstileToken === 'string' ? body.turnstileToken : null
  if (!(await verifyTurnstile(env, token))) {
    return error('turnstile_failed', 'Please complete the verification and try again')
  }

  const recent = await env.DB.prepare('SELECT COUNT(*) AS n FROM magic_links WHERE email = ?1 AND created_at > ?2')
    .bind(email, new Date(now.getTime() - HOUR_MS).toISOString())
    .first<{ n: number }>()
  if ((recent?.n ?? 0) >= SESSION.magicLinksPerEmailPerHour) {
    return error('rate_limited', 'Too many sign-in links requested. Please try again in an hour.')
  }

  const raw = randomToken(32)
  const tokenHash = await saltedHash(env.HASH_SALT, `magic:${raw}`)
  const pending: PendingSignup = {
    lang: body.lang,
    adult: true,
    marketingOptIn,
    ...(consentText ? { marketingConsentText: consentText } : {}),
    consentVersion: MARKETING_CONSENT.version,
  }
  await env.DB.prepare(
    `INSERT INTO magic_links (token_hash, email, created_at, expires_at, used_at, pending_json)
     VALUES (?1, ?2, ?3, ?4, NULL, ?5)`,
  )
    .bind(
      tokenHash,
      email,
      now.toISOString(),
      new Date(now.getTime() + SESSION.magicLinkMinutes * 60_000).toISOString(),
      JSON.stringify(pending),
    )
    .run()

  // The token travels in the URL fragment, which browsers never send to the server (or its logs).
  const link = `${env.SITE_URL.replace(/\/+$/, '')}/auth/verify/#token=${raw}`
  const msg = signInEmail(body.lang, link)
  const sent = await sendEmail(env, { to: email, subject: msg.subject, text: msg.text, kind: 'transactional' })
  if (!sent) {
    // The link never left, so it must not count against the hourly limit.
    await env.DB.prepare('DELETE FROM magic_links WHERE token_hash = ?1').bind(tokenHash).run()
    return error('internal', 'We could not send the email. Please try again shortly.')
  }
  return json({ ok: true } satisfies MagicLinkResponse)
}

function parsePending(raw: string | null): PendingSignup {
  let v: unknown = null
  try {
    v = raw ? JSON.parse(raw) : null
  } catch {
    v = null
  }
  const p = isRecord(v) ? v : {}
  const consentText = cleanConsentText(p.marketingConsentText)
  const optIn = p.marketingOptIn === true && consentText !== null
  return {
    lang: isLang(p.lang) ? p.lang : 'en',
    adult: true,
    marketingOptIn: optIn,
    ...(optIn && consentText ? { marketingConsentText: consentText } : {}),
    consentVersion: typeof p.consentVersion === 'string' ? p.consentVersion : MARKETING_CONSENT.version,
  }
}

/**
 * Finds or creates the user for a verified email and applies the pending choices. A new user also
 * gets a server-side `signup` event, written in the same batch so it is recorded exactly once.
 */
async function upsertUser(env: Env, email: string, pending: PendingSignup, now: Date): Promise<string> {
  const nowIso = now.toISOString()
  const consentText = pending.marketingOptIn ? (pending.marketingConsentText ?? null) : null
  const findLive = () =>
    env.DB.prepare('SELECT id FROM users WHERE email = ?1 AND deleted_at IS NULL').bind(email).first<{ id: string }>()
  const existing = await findLive()

  if (!existing) {
    const id = randomId('u_')
    const emailHash = await saltedHash(env.HASH_SALT, `email:${email}`)
    const [inserted] = await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO users (id, email, email_hash, created_at, last_active_at, lang, adult_confirmed_at,
                            marketing_opt_in, marketing_consent_text, marketing_consent_at, marketing_consent_version)
         VALUES (?1, ?2, ?3, ?4, ?4, ?5, ?4, ?6, ?7, ?8, ?9)
         ON CONFLICT (email) DO NOTHING`,
      ).bind(
        id,
        email,
        emailHash,
        nowIso,
        pending.lang,
        consentText ? 1 : 0,
        consentText,
        consentText ? nowIso : null,
        consentText ? pending.consentVersion : null,
      ),
      env.DB.prepare(
        `INSERT INTO events (name, path, utm_json, day, created_at)
         SELECT 'signup', '/auth/verify/', NULL, ?2, ?3 WHERE EXISTS (SELECT 1 FROM users WHERE id = ?1)`,
      ).bind(id, dayKey(now), nowIso),
    ])
    if (inserted?.meta.changes === 1) return id
    // Lost a race with a concurrent verify for the same email: fall through and update that row.
  }

  const row = existing ?? (await findLive())
  if (!row) throw new Error('user upsert failed')

  // An unticked box never withdraws consent given earlier; withdrawal is explicit (account page).
  const update = consentText
    ? env.DB.prepare(
        `UPDATE users SET last_active_at = ?2, lang = ?3, adult_confirmed_at = COALESCE(adult_confirmed_at, ?2),
                marketing_opt_in = 1, marketing_consent_text = ?4, marketing_consent_at = ?2,
                marketing_consent_version = ?5, marketing_withdrawn_at = NULL
          WHERE id = ?1`,
      ).bind(row.id, nowIso, pending.lang, consentText, pending.consentVersion)
    : env.DB.prepare(
        `UPDATE users SET last_active_at = ?2, lang = ?3, adult_confirmed_at = COALESCE(adult_confirmed_at, ?2)
          WHERE id = ?1`,
      ).bind(row.id, nowIso, pending.lang)
  await update.run()
  return row.id
}

/** Creates a fresh session (deleting the one the request carried, if any); returns the Set-Cookie value. */
async function rotateSession(req: Request, env: Env, userId: string, now: Date): Promise<string> {
  const old = getCookie(req, SESSION.cookieName)
  const raw = randomToken(32)
  const stmts: D1PreparedStatement[] = []
  if (old) stmts.push(env.DB.prepare('DELETE FROM sessions WHERE id_hash = ?1').bind(await sessionIdHash(env, old)))
  stmts.push(
    env.DB.prepare('INSERT INTO sessions (id_hash, user_id, created_at, expires_at) VALUES (?1, ?2, ?3, ?4)').bind(
      await sessionIdHash(env, raw),
      userId,
      now.toISOString(),
      new Date(now.getTime() + SESSION.days * 86_400_000).toISOString(),
    ),
  )
  await env.DB.batch(stmts)
  return setCookie(SESSION.cookieName, raw, { maxAgeSeconds: SESSION.days * 86_400 })
}

/** POST /api/auth/verify — consumes a magic link (single use) and signs the user in. */
export async function verify(req: Request, ctx: Ctx): Promise<Response> {
  const { env, now } = ctx
  const body = await readJson<Partial<VerifyRequest>>(req, 4 * 1024)
  const token = isRecord(body) && typeof body.token === 'string' ? body.token : ''
  if (token.length < 20 || token.length > 200) return error('bad_request', 'Invalid sign-in link')

  const tokenHash = await saltedHash(env.HASH_SALT, `magic:${token}`)
  const used = await env.DB.prepare(
    'UPDATE magic_links SET used_at = ?1 WHERE token_hash = ?2 AND used_at IS NULL AND expires_at > ?1',
  )
    .bind(now.toISOString(), tokenHash)
    .run()
  if (used.meta.changes !== 1) return error('unauthorized', 'Link expired or already used')

  const link = await env.DB.prepare('SELECT email, pending_json FROM magic_links WHERE token_hash = ?1')
    .bind(tokenHash)
    .first<{ email: string; pending_json: string | null }>()
  if (!link) return error('unauthorized', 'Link expired or already used')

  const userId = await upsertUser(env, link.email, parsePending(link.pending_json), now)
  const cookie = await rotateSession(req, env, userId, now)
  return json({ ok: true, email: link.email } satisfies VerifyResponse, { headers: { 'set-cookie': cookie } })
}

/** POST /api/auth/logout — ends the session (if any) and clears the cookie. */
export async function logout(req: Request, ctx: Ctx): Promise<Response> {
  const raw = getCookie(req, SESSION.cookieName)
  if (raw) {
    await ctx.env.DB.prepare('DELETE FROM sessions WHERE id_hash = ?1').bind(await sessionIdHash(ctx.env, raw)).run()
  }
  return json({ ok: true }, { headers: { 'set-cookie': clearSessionCookie() } })
}
