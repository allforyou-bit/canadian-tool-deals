// Account endpoints (memo B7): /api/me, account deletion (essays, transcripts and profile go; payment
// records stay), CASL consent changes, and support tickets forwarded to the owner.
import type { DeleteAccountResponse, MarketingRequest, MeResponse, SupportRequest } from '../../shared/api'
import { clearSessionCookie, cleanConsentText, isLang, isRecord } from './auth'
import { MARKETING_CONSENT } from '../../shared/config'
import { alertOwner } from './email'
import type { Ctx } from './env'
import { randomId } from './lib/crypto'
import { getFlags } from './lib/flags'
import { error, json, readJson } from './lib/http'
import { getActivePass } from './lib/session'
import { dayKey, startOfUtcDay } from './lib/time'
import { freeAvailability, getUsage } from './lib/usage'

const SUPPORT_PER_DAY = 5
const SUPPORT_MIN_CHARS = 10
const SUPPORT_MAX_CHARS = 4000
const TWO_DAYS_SECONDS = 2 * 86_400
/** last_active_at is a retention clock measured in days; refresh it at most hourly to spare D1 writes. */
const ACTIVITY_REFRESH_MS = 3_600_000

/** GET /api/me — who is signed in, their pass and usage, free samples left and public flags. */
export async function me(_req: Request, ctx: Ctx): Promise<Response> {
  const { env, now, user } = ctx
  const flags = await getFlags(env)
  const keys = { user, deviceHash: ctx.deviceHash, ipHash: ctx.ipHash }
  const free = await freeAvailability(env, keys, now, flags.free_enabled)
  const publicFlags = {
    checkoutEnabled: flags.checkout_enabled,
    gradingEnabled: flags.grading_enabled,
    banner: flags.banner,
  }

  if (!user) {
    const body: MeResponse = {
      signedIn: false,
      pass: null,
      free,
      usage: { writingToday: 0, speakingToday: 0, graded30d: 0 },
      flags: publicFlags,
    }
    return json(body)
  }

  const [pass, usage, consent] = await Promise.all([
    getActivePass(env, user.id, now),
    getUsage(env, user.id, now),
    env.DB.prepare('SELECT marketing_opt_in FROM users WHERE id = ?1').bind(user.id).first<{ marketing_opt_in: number }>(),
  ])
  await env.DB.prepare('UPDATE users SET last_active_at = ?2 WHERE id = ?1 AND last_active_at < ?3')
    .bind(user.id, now.toISOString(), new Date(now.getTime() - ACTIVITY_REFRESH_MS).toISOString())
    .run()
  const body: MeResponse = {
    signedIn: true,
    email: user.email,
    pass: pass ? { sku: pass.sku, startsAt: pass.starts_at, endsAt: pass.ends_at } : null,
    marketingOptIn: consent?.marketing_opt_in === 1,
    free,
    usage,
    flags: publicFlags,
  }
  return json(body)
}

/**
 * POST /api/account/delete — removes essays/transcripts (grades), sessions, support tickets and the
 * profile. The users row stays as a tombstone: purchases, passes and refunds reference it (payment
 * records), and email_hash is kept so the once-per-email refund rule survives re-signup (CONTRACT §3).
 */
export async function deleteAccount(_req: Request, ctx: Ctx): Promise<Response> {
  const { env, now, user } = ctx
  if (!user) return error('unauthorized', 'Please sign in first')
  await env.DB.batch([
    env.DB.prepare('DELETE FROM grades WHERE user_id = ?1').bind(user.id),
    env.DB.prepare('DELETE FROM sessions WHERE user_id = ?1').bind(user.id),
    env.DB.prepare('DELETE FROM support_tickets WHERE user_id = ?1').bind(user.id),
    // unused sign-in links still hold the address and consent choices
    env.DB.prepare('DELETE FROM magic_links WHERE email = ?1').bind(user.email),
    env.DB.prepare(
      `UPDATE users SET email = 'deleted:' || id, marketing_opt_in = 0, marketing_consent_text = NULL,
              marketing_consent_at = NULL, marketing_consent_version = NULL, deleted_at = ?2
        WHERE id = ?1`,
    ).bind(user.id, now.toISOString()),
  ])
  return json({ ok: true } satisfies DeleteAccountResponse, { headers: { 'set-cookie': clearSessionCookie() } })
}

/** POST /api/account/marketing — give or withdraw CASL express consent. */
export async function setMarketing(req: Request, ctx: Ctx): Promise<Response> {
  const { env, now, user } = ctx
  if (!user) return error('unauthorized', 'Please sign in first')
  const body = await readJson<Partial<MarketingRequest>>(req, 8 * 1024)
  if (!isRecord(body) || typeof body.optIn !== 'boolean') return error('bad_request', 'Invalid request')

  if (!body.optIn) {
    await env.DB.prepare('UPDATE users SET marketing_opt_in = 0, marketing_withdrawn_at = ?2 WHERE id = ?1')
      .bind(user.id, now.toISOString())
      .run()
    return json({ ok: true })
  }
  const consentText = cleanConsentText(body.consentText)
  if (!consentText) return error('bad_request', 'Missing consent wording')
  await env.DB.prepare(
    `UPDATE users SET marketing_opt_in = 1, marketing_consent_text = ?2, marketing_consent_at = ?3,
            marketing_consent_version = ?4, marketing_withdrawn_at = NULL
      WHERE id = ?1`,
  )
    .bind(user.id, consentText, now.toISOString(), MARKETING_CONSENT.version)
    .run()
  return json({ ok: true })
}

/** Whether this user (or, signed out, this device) may open another ticket today; counts the attempt. */
async function supportAllowed(ctx: Ctx): Promise<boolean> {
  const { env, now, user } = ctx
  if (user) {
    const row = await env.DB.prepare(
      'SELECT COUNT(*) AS n FROM support_tickets WHERE user_id = ?1 AND created_at >= ?2',
    )
      .bind(user.id, startOfUtcDay(now).toISOString())
      .first<{ n: number }>()
    return (row?.n ?? 0) < SUPPORT_PER_DAY
  }
  const key = `support:${ctx.deviceHash}:${dayKey(now)}`
  const n = Number(await env.FLAGS.get(key)) || 0
  if (n >= SUPPORT_PER_DAY) return false
  try {
    await env.FLAGS.put(key, String(n + 1), { expirationTtl: TWO_DAYS_SECONDS })
  } catch {
    // KV allows one write per second per key; a missed increment only loosens the limit slightly
    console.warn('support counter write failed')
  }
  return true
}

/** POST /api/support — stores a ticket and forwards it to the owner by email. */
export async function support(req: Request, ctx: Ctx): Promise<Response> {
  const { env, now, user } = ctx
  const body = await readJson<Partial<SupportRequest>>(req, 32 * 1024)
  if (!isRecord(body) || typeof body.message !== 'string') return error('bad_request', 'Invalid request')
  const message = body.message.trim()
  if (message.length < SUPPORT_MIN_CHARS || message.length > SUPPORT_MAX_CHARS) {
    return error('bad_request', `Please write between ${SUPPORT_MIN_CHARS} and ${SUPPORT_MAX_CHARS} characters`)
  }
  if (!isLang(body.lang)) return error('bad_request', 'Unsupported language')
  if (!(await supportAllowed(ctx))) return error('rate_limited', 'Too many messages today. Please try again tomorrow.')

  const id = randomId('t_')
  await env.DB.prepare(
    'INSERT INTO support_tickets (id, user_id, message, lang, created_at, forwarded) VALUES (?1, ?2, ?3, ?4, ?5, 0)',
  )
    .bind(id, user?.id ?? null, message, body.lang, now.toISOString())
    .run()

  const text = [
    `Ticket: ${id}`,
    `Language: ${body.lang}`,
    user ? `From: ${user.email} (signed in)` : 'From: signed-out visitor (no email on file)',
    '',
    message,
  ].join('\n')
  if (await alertOwner(env, `Support ticket ${id}`, text)) {
    await env.DB.prepare('UPDATE support_tickets SET forwarded = 1 WHERE id = ?1').bind(id).run()
  }
  return json({ ok: true })
}

/** STUB — implemented by the core fixer: POST /api/unsubscribe (UnsubscribeRequest). */
export async function unsubscribe(_req: Request, _ctx: Ctx): Promise<Response> {
  return error('not_found', 'Not implemented')
}
