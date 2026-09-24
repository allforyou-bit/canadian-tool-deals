// Magic-link sign-in (memo B2): Turnstile, ≤3 links per email per hour, hashed single-use tokens with a
// 15-minute TTL, D1-backed sessions in an HttpOnly/Secure/SameSite=Lax cookie that rotates on sign-in.
// Zero-capital launch (memo §7.2 Z3): learners sign in with Google (auth-google.ts); the email link is
// only for the owner unless MAGIC_LINK says otherwise ('owner' default | 'all' | 'off'). A staging Worker
// keeps its STAGING_ALLOWED_EMAILS list.
// CASL marketing consent (decision 10): the Worker builds the consent sentence itself and records an
// opt-in only when the box was ticked, the submitted sentence is exactly that one, the mailing address
// is set, and the link is opened on the device that asked for it. Otherwise sign-in works without it.
import type { Lang, MagicLinkRequest, MagicLinkResponse, VerifyRequest, VerifyResponse } from '../../shared/api'
import { AUTH_DEFAULTS, BRAND, MARKETING_CONSENT, SESSION } from '../../shared/config'
import { isOwnerAddress, sendEmail } from './email'
import type { Ctx, Env } from './env'
import { randomId, randomToken, saltedHash } from './lib/crypto'
import { isDisposableEmail } from './lib/disposable'
import { error, getCookie, json, readJson, setCookie } from './lib/http'
import { createSession, sessionIdHash } from './lib/session'
import { dayKey } from './lib/time'
import { verifyTurnstile } from './turnstile'

export { sessionIdHash }

const MAX_EMAIL_CHARS = 254
const HOUR_MS = 3_600_000
const DAY_SECONDS = 86_400

/** Modelled on the WHATWG "valid e-mail address" pattern, but requiring a dot in the domain. */
// [unverified: prior knowledge] the pattern is recalled from the HTML spec, not re-checked against it
const EMAIL_RE =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/

/** Consent and profile choices captured with the link (or the Google start); applied at sign-in. */
export interface PendingSignup {
  lang: Lang
  adult: true
  marketingOptIn: boolean
  /** the server's own consent sentence (never client text) */
  marketingConsentText?: string
  consentVersion: string
  /** salted device hash of the requesting browser; the opt-in applies only if verify comes from it */
  deviceHash?: string
}

/** KV keys owned by auth, keyed by users.email_hash so they survive account deletion. */
export const AUTH_KV = {
  /** ISO time of the last unsubscribe for this address (1-day TTL; blocks opt-ins requested before it) */
  unsubscribed: (emailHash: string) => `unsub:${emailHash}`,
} as const

/**
 * D1 free_usage kind for sign-in links sent (memo §7.2 Z2: counters live in D1, not KV, whose free plan
 * allows 1,000 writes a day). One row per send: key_hash = users.email_hash (so deleting the account does
 * not reset the limit, decision 9) and `day` = the send time as an ISO timestamp, so the hourly window is
 * exact. The daily cron deletes rows older than a day.
 */
export const MAGIC_LINK_USAGE_KIND = 'ml'

export type MagicLinkMode = 'owner' | 'all' | 'off'

/** MAGIC_LINK: 'owner' (default, also for unset or unknown values), 'all' or 'off'. */
export function magicLinkMode(env: Env): MagicLinkMode {
  const v = (env.MAGIC_LINK ?? '').trim().toLowerCase()
  return v === 'owner' || v === 'all' || v === 'off' ? v : AUTH_DEFAULTS.magicLink
}

/**
 * Who may ask for an email sign-in link: nobody with 'off'; on a staging Worker, the STAGING_ALLOWED_EMAILS
 * list (as before); otherwise only OWNER_EMAIL with 'owner', and anyone with 'all'.
 */
export function magicLinkAllows(env: Env, email: string): 'ok' | 'off' | 'staging' | 'owner_only' {
  const mode = magicLinkMode(env)
  if (mode === 'off') return 'off'
  if ((env.STAGING_ALLOWED_EMAILS ?? '').trim()) return stagingAllows(env, email) ? 'ok' : 'staging'
  if (mode === 'owner' && !isOwnerAddress(env, email)) return 'owner_only'
  return 'ok'
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

export function emailHash(env: Env, email: string): Promise<string> {
  return saltedHash(env.HASH_SALT, `email:${email}`)
}

/** True while MAILING_ADDRESS is unset or still the deploy placeholder: no CASL consent can be captured then. */
export function mailingAddressMissing(env: Env): boolean {
  const address = (env.MAILING_ADDRESS ?? '').trim()
  return address === '' || address.startsWith('SET-BEFORE-LAUNCH')
}

/** The consent sentence the site shows next to the box, built from the Worker's own settings. */
export function expectedConsentText(env: Env, lang: Lang): string {
  return MARKETING_CONSENT[lang](env.MAILING_ADDRESS.trim(), env.SITE_URL.replace(/\/+$/, ''))
}

/**
 * The server's copy of the consent sentence when `submitted` is exactly the sentence for `lang` (or,
 * without a language, for either language) and the mailing address is set; otherwise null.
 */
export function acceptedConsentText(env: Env, submitted: unknown, lang?: Lang): string | null {
  if (typeof submitted !== 'string' || mailingAddressMissing(env)) return null
  const langs: Lang[] = lang ? [lang] : ['en', 'ko']
  for (const l of langs) {
    const expected = expectedConsentText(env, l)
    if (submitted === expected) return expected
  }
  return null
}

/** Set-Cookie value that removes the session cookie. */
export function clearSessionCookie(): string {
  return setCookie(SESSION.cookieName, '', { maxAgeSeconds: 0 })
}

/** `marketing`: the request ticked the email box, so the email says so and when it takes effect. */
export function signInEmail(lang: Lang, link: string, marketing: boolean): { subject: string; text: string } {
  const minutes = SESSION.magicLinkMinutes
  if (lang === 'ko') {
    return {
      subject: `${BRAND.ko} 로그인 링크`,
      text: [
        '안녕하세요.',
        `아래 링크를 눌러 ${BRAND.ko}에 로그인하세요.`,
        link,
        `이 링크는 ${minutes}분 후에 만료되며 한 번만 사용할 수 있어요.`,
        ...(marketing
          ? [
              '새 연습 과제와 혜택에 관한 이메일 수신에도 동의하셨어요. 이 동의는 로그인을 요청한 기기와 브라우저에서 이 링크를 열 때만 적용돼요. 동의는 계정 페이지나 이메일의 수신 거부 링크로 언제든지 철회할 수 있어요.',
            ]
          : []),
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
      ...(marketing
        ? [
            'You also asked to get occasional emails about new practice tasks and offers. That choice is saved only if you open this link on the same device and browser where you asked for it. You can withdraw it at any time from your account page or with the unsubscribe link in any email.',
          ]
        : []),
      'If you did not ask to sign in, you can ignore this email. Nobody can sign in without this link.',
    ].join('\n\n'),
  }
}

/** Sign-in links sent to this address in the last hour (D1; the rows outlive account deletion). */
async function linksSentLastHour(env: Env, email: string, hash: string, now: Date): Promise<number> {
  // Two counts: links issued for a live address (magic_links, including one being sent right now) and sends
  // recorded under the email hash (free_usage 'ml'), which account deletion does not remove.
  const since = new Date(now.getTime() - HOUR_MS).toISOString()
  const row = await env.DB.prepare(
    `SELECT (SELECT COUNT(*) FROM magic_links WHERE email = ?1 AND created_at > ?2) AS links,
            (SELECT COALESCE(SUM(count), 0) FROM free_usage WHERE key_hash = ?3 AND kind = ?4 AND day > ?2) AS sent`,
  )
    .bind(email, since, hash, MAGIC_LINK_USAGE_KIND)
    .first<{ links: number; sent: number }>()
  return Math.max(row?.links ?? 0, row?.sent ?? 0)
}

async function countLinkSent(env: Env, hash: string, now: Date): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO free_usage (key_hash, kind, day, count) VALUES (?1, ?2, ?3, 1)
     ON CONFLICT (key_hash, kind, day) DO UPDATE SET count = count + 1`,
  )
    .bind(hash, MAGIC_LINK_USAGE_KIND, now.toISOString())
    .run()
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
  if (isDisposableEmail(email)) return error('bad_request', 'Please use a permanent email address')
  const allowed = magicLinkAllows(env, email)
  if (allowed === 'staging') return error('forbidden', 'This test site only accepts the owner’s email address')
  if (allowed !== 'ok') return error('forbidden', 'Please sign in with Google')
  // CASL: only an explicit tick with the exact sentence the Worker would show counts as a request for
  // consent. Anything else signs in without it (the client cannot fix a server-side wording mismatch).
  const consentText = body.marketingOptIn === true ? acceptedConsentText(env, body.marketingConsentText, body.lang) : null

  const token = typeof body.turnstileToken === 'string' ? body.turnstileToken : null
  if (!(await verifyTurnstile(env, token))) {
    return error('turnstile_failed', 'Please complete the verification and try again')
  }

  const hash = await emailHash(env, email)
  if ((await linksSentLastHour(env, email, hash, now)) >= SESSION.magicLinksPerEmailPerHour) {
    return error('rate_limited', 'Too many sign-in links requested. Please try again in an hour.')
  }

  const raw = randomToken(32)
  const tokenHash = await saltedHash(env.HASH_SALT, `magic:${raw}`)
  const pending: PendingSignup = {
    lang: body.lang,
    adult: true,
    marketingOptIn: consentText !== null,
    ...(consentText ? { marketingConsentText: consentText, deviceHash: ctx.deviceHash } : {}),
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
  const msg = signInEmail(body.lang, link, consentText !== null)
  const sent = await sendEmail(env, { to: email, subject: msg.subject, text: msg.text, kind: 'transactional' })
  if (!sent) {
    // The link never left, so it must not count against the hourly limit.
    await env.DB.prepare('DELETE FROM magic_links WHERE token_hash = ?1').bind(tokenHash).run()
    return error('internal', 'We could not send the email. Please try again shortly.')
  }
  await countLinkSent(env, hash, now)
  return json({ ok: true } satisfies MagicLinkResponse)
}

function parsePending(raw: string | null): PendingSignup {
  let v: unknown = null
  try {
    v = raw ? JSON.parse(raw) : null
  } catch {
    v = null
  }
  return pendingFrom(v)
}

/**
 * The stored choices, defensively: the opt-in survives only with its consent sentence and the device hash
 * of the browser that asked for it; the language falls back to English.
 */
export function pendingFrom(v: unknown): PendingSignup {
  const p = isRecord(v) ? v : {}
  const consentText = typeof p.marketingConsentText === 'string' && p.marketingConsentText !== '' ? p.marketingConsentText : null
  const deviceHash = typeof p.deviceHash === 'string' && p.deviceHash !== '' ? p.deviceHash : null
  const optIn = p.marketingOptIn === true && consentText !== null && deviceHash !== null
  return {
    lang: isLang(p.lang) ? p.lang : 'en',
    adult: true,
    marketingOptIn: optIn,
    ...(optIn && consentText && deviceHash ? { marketingConsentText: consentText, deviceHash } : {}),
    consentVersion: typeof p.consentVersion === 'string' ? p.consentVersion : MARKETING_CONSENT.version,
  }
}

export interface UpsertOptions {
  /** Google account id to store on the row (new users, or linking an existing live user by email) */
  googleSub?: string
  /** events.path of the `signup` event: where the sign-in finished */
  signupPath?: string
}

/**
 * Finds or creates the user for a verified email and applies the pending choices. A new user also
 * gets a server-side `signup` event, written in the same batch so it is recorded exactly once, and
 * inherits free_speaking_used / self_refund_used from earlier (deleted) accounts with the same email
 * hash, so deleting and re-signing up does not reset the once-per-email rules (decision 9).
 * `consent` is the opt-in to record, already checked by the caller (null: leave consent as it is).
 * With `opts.googleSub`, the row carries that Google account id afterwards (a live user found by email
 * is linked to it).
 */
export async function upsertUser(
  env: Env,
  email: string,
  hash: string,
  lang: Lang,
  consent: { text: string; version: string } | null,
  now: Date,
  opts: UpsertOptions = {},
): Promise<string> {
  const nowIso = now.toISOString()
  const consentText = consent?.text ?? null
  const googleSub = opts.googleSub ?? null
  const findLive = () =>
    env.DB.prepare('SELECT id FROM users WHERE email = ?1 AND deleted_at IS NULL').bind(email).first<{ id: string }>()
  const existing = await findLive()

  if (!existing) {
    const id = randomId('u_')
    // No conflict target: a concurrent sign-in for the same email or the same Google account (the unique
    // live google_sub index) makes this a no-op, and the row it lost to is updated below.
    const [inserted] = await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO users (id, email, email_hash, google_sub, created_at, last_active_at, lang, adult_confirmed_at,
                            marketing_opt_in, marketing_consent_text, marketing_consent_at, marketing_consent_version,
                            free_speaking_used, self_refund_used)
         VALUES (?1, ?2, ?3, ?10, ?4, ?4, ?5, ?4, ?6, ?7, ?8, ?9,
                 (SELECT COALESCE(MAX(free_speaking_used), 0) FROM users WHERE email_hash = ?3),
                 (SELECT COALESCE(MAX(self_refund_used), 0) FROM users WHERE email_hash = ?3))
         ON CONFLICT DO NOTHING`,
      ).bind(
        id,
        email,
        hash,
        nowIso,
        lang,
        consentText ? 1 : 0,
        consentText,
        consentText ? nowIso : null,
        consent?.version ?? null,
        googleSub,
      ),
      env.DB.prepare(
        `INSERT INTO events (name, path, utm_json, day, created_at)
         SELECT 'signup', ?4, NULL, ?2, ?3 WHERE EXISTS (SELECT 1 FROM users WHERE id = ?1)`,
      ).bind(id, dayKey(now), nowIso, opts.signupPath ?? '/auth/verify/'),
    ])
    if (inserted?.meta.changes === 1) return id
    // Lost a race with a concurrent sign-in for the same email: fall through and update that row.
  }

  const row = existing ?? (await findLive())
  if (!row) throw new Error('user upsert failed')
  await recordSignIn(env, row.id, lang, consent, now, googleSub)
  return row.id
}

/**
 * Updates an existing user at sign-in: activity, language, the 18+ confirmation and, when given, the
 * consent to record and the Google account id to link. An unticked box never withdraws consent given
 * earlier; withdrawal is explicit (account page or the unsubscribe link).
 */
export async function recordSignIn(
  env: Env,
  userId: string,
  lang: Lang,
  consent: { text: string; version: string } | null,
  now: Date,
  googleSub: string | null = null,
): Promise<void> {
  const nowIso = now.toISOString()
  const update = consent
    ? env.DB.prepare(
        `UPDATE users SET last_active_at = ?2, lang = ?3, adult_confirmed_at = COALESCE(adult_confirmed_at, ?2),
                google_sub = COALESCE(?6, google_sub),
                marketing_opt_in = 1, marketing_consent_text = ?4, marketing_consent_at = ?2,
                marketing_consent_version = ?5, marketing_withdrawn_at = NULL
          WHERE id = ?1`,
      ).bind(userId, nowIso, lang, consent.text, consent.version, googleSub)
    : env.DB.prepare(
        `UPDATE users SET last_active_at = ?2, lang = ?3, adult_confirmed_at = COALESCE(adult_confirmed_at, ?2),
                google_sub = COALESCE(?4, google_sub)
          WHERE id = ?1`,
      ).bind(userId, nowIso, lang, googleSub)
  await update.run()
}

/**
 * Whether the opt-in captured with the link (or the Google start) may be recorded now: it was requested,
 * the sign-in finishes on the same device (a link sent to someone else's address cannot sign them up for
 * email), and the address has not used an unsubscribe link since the request (the sign-in email itself
 * carries one).
 */
export async function consentToRecord(
  env: Env,
  pending: PendingSignup,
  hash: string,
  requestedAt: string,
  deviceHash: string,
): Promise<{ text: string; version: string } | null> {
  const text = pending.marketingOptIn ? pending.marketingConsentText : undefined
  if (!text || pending.deviceHash !== deviceHash) return null
  const unsubscribedAt = await env.FLAGS.get(AUTH_KV.unsubscribed(hash))
  if (unsubscribedAt && unsubscribedAt >= requestedAt) return null
  return { text, version: pending.consentVersion }
}

/** Remembers an unsubscribe for a day, so an opt-in requested before it is never recorded after it. */
export async function markUnsubscribed(env: Env, hash: string, now: Date): Promise<void> {
  try {
    await env.FLAGS.put(AUTH_KV.unsubscribed(hash), now.toISOString(), { expirationTtl: DAY_SECONDS })
  } catch {
    console.warn('unsubscribe marker write failed')
  }
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

  const link = await env.DB.prepare('SELECT email, created_at, pending_json FROM magic_links WHERE token_hash = ?1')
    .bind(tokenHash)
    .first<{ email: string; created_at: string; pending_json: string | null }>()
  if (!link) return error('unauthorized', 'Link expired or already used')

  const pending = parsePending(link.pending_json)
  const hash = await emailHash(env, link.email)
  const consent = await consentToRecord(env, pending, hash, link.created_at, ctx.deviceHash)
  const userId = await upsertUser(env, link.email, hash, pending.lang, consent, now)
  const cookie = await createSession(req, env, userId, now)
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

/** Staging allowlist (env.STAGING_ALLOWED_EMAILS); always true when the variable is unset (production). */
export function stagingAllows(env: Env, email: string | null): boolean {
  const list = (env.STAGING_ALLOWED_EMAILS ?? '').trim()
  if (!list) return true
  if (!email) return false
  const wanted = email.trim().toLowerCase()
  return list.split(',').some((e) => e.trim().toLowerCase() === wanted)
}
