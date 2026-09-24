// Account endpoints (memo B7): /api/me, account deletion (essays, transcripts and profile go; payment
// records and anonymous cost rows stay), CASL consent changes and the no-login unsubscribe link, and
// support tickets (signed-in only) forwarded to the owner.
import type {
  DeleteAccountResponse,
  MarketingRequest,
  MeResponse,
  SupportRequest,
  UnsubscribeRequest,
} from '../../shared/api'
import { MARKETING_CONSENT, type Sku } from '../../shared/config'
import { acceptedConsentText, clearSessionCookie, isLang, isRecord, mailingAddressMissing, markUnsubscribed } from './auth'
import { alertOwner, unsubscribeSignature } from './email'
import type { Ctx, Env } from './env'
import { randomId, timingSafeEqualHex } from './lib/crypto'
import { getFlags } from './lib/flags'
import { error, json, readJson } from './lib/http'
import { getActivePass } from './lib/session'
import { dayKey, startOfUtcDay } from './lib/time'
import { freeAvailability, getUsage } from './lib/usage'

const SUPPORT_PER_DAY = 5
/** Owner emails for support tickets per UTC day (all users together); later tickets are stored only (decision 7). */
export const SUPPORT_FORWARDS_PER_DAY = 30
const SUPPORT_MIN_CHARS = 10
const SUPPORT_MAX_CHARS = 4000
/** last_active_at is a retention clock measured in days; refresh it at most hourly to spare D1 writes. */
const ACTIVITY_REFRESH_MS = 3_600_000
/** users.email_hash and the unsubscribe HMAC are both lower-case SHA-256 hex */
const HEX64 = /^[0-9a-f]{64}$/

type PurchaseStatus = NonNullable<MeResponse['latestPurchase']>['status']

/**
 * End of the contiguous chain of passes that starts with the one running at `now`: running passes, then
 * each pass that starts no later than the chain's current end. `passes` are the user's unrevoked passes
 * that end after `now`, ordered by start. Null when no pass is running.
 */
export function accessEnd(passes: { starts_at: string; ends_at: string }[], now: Date): string | null {
  const t = now.getTime()
  let end = t
  let endIso: string | null = null
  for (const p of passes) {
    if (Date.parse(p.starts_at) > end) break
    const e = Date.parse(p.ends_at)
    if (e > end) {
      end = e
      endIso = p.ends_at
    }
  }
  return endIso
}

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

  const [pass, usage, consent, chain, purchase] = await Promise.all([
    getActivePass(env, user.id, now),
    getUsage(env, user.id, now),
    env.DB.prepare('SELECT marketing_opt_in FROM users WHERE id = ?1').bind(user.id).first<{ marketing_opt_in: number }>(),
    env.DB.prepare(
      `SELECT starts_at, ends_at FROM passes
        WHERE user_id = ?1 AND revoked_at IS NULL AND ends_at > ?2
        ORDER BY starts_at, ends_at`,
    )
      .bind(user.id, now.toISOString())
      .all<{ starts_at: string; ends_at: string }>(),
    env.DB.prepare('SELECT id, sku, status FROM purchases WHERE user_id = ?1 ORDER BY created_at DESC, rowid DESC LIMIT 1')
      .bind(user.id)
      .first<{ id: string; sku: Sku; status: PurchaseStatus }>(),
  ])
  await env.DB.prepare('UPDATE users SET last_active_at = ?2 WHERE id = ?1 AND last_active_at < ?3')
    .bind(user.id, now.toISOString(), new Date(now.getTime() - ACTIVITY_REFRESH_MS).toISOString())
    .run()
  const body: MeResponse = {
    signedIn: true,
    email: user.email,
    pass: pass ? { sku: pass.sku, startsAt: pass.starts_at, endsAt: pass.ends_at } : null,
    marketingOptIn: consent?.marketing_opt_in === 1,
    accessEndsAt: accessEnd(chain.results, now),
    latestPurchase: purchase ? { id: purchase.id, sku: purchase.sku, status: purchase.status } : null,
    free,
    usage,
    flags: publicFlags,
  }
  return json(body)
}

/**
 * POST /api/account/delete — removes essays/transcripts and feedback, sessions, support tickets and the
 * profile. The users row stays as a tombstone: purchases, passes and refunds reference it (payment
 * records), and email_hash is kept so the once-per-email rules survive re-signup (CONTRACT §3).
 * Grades rows are de-identified, not deleted (decision 5): they are also the spend ledger behind the
 * spend tiers, the free budget and the daily cost metrics, so model, tokens, cost, free, refused, kind
 * and created_at stay while user_id, device_hash, the text, the feedback and the error kinds go.
 */
export async function deleteAccount(_req: Request, ctx: Ctx): Promise<Response> {
  const { env, now, user } = ctx
  if (!user) return error('unauthorized', 'Please sign in first')
  const forwarded = await env.DB.prepare('SELECT id FROM support_tickets WHERE user_id = ?1 AND forwarded = 1 ORDER BY created_at')
    .bind(user.id)
    .all<{ id: string }>()
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE grades SET user_id = NULL, device_hash = NULL, input_text = NULL, result_json = NULL, error_kinds = NULL
        WHERE user_id = ?1`,
    ).bind(user.id),
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
  // Forwarded tickets also sit in the owner's mailbox; the owner deletes those copies (decision 7).
  // Ticket ids only: the address is already gone from D1.
  if (forwarded.results.length > 0) {
    await alertOwner(
      env,
      'Account deleted: remove its support emails',
      [
        'A learner deleted their account. Delete the forwarded support emails (and any replies) for these',
        `tickets from the mailbox:\n\n${forwarded.results.map((t) => t.id).join('\n')}`,
      ].join(' '),
    )
  }
  return json({ ok: true } satisfies DeleteAccountResponse, { headers: { 'set-cookie': clearSessionCookie() } })
}

/**
 * POST /api/account/marketing — give or withdraw CASL express consent. An opt-in is recorded only with
 * the exact consent sentence the Worker builds (either language) and while the mailing address is set;
 * the stored wording is the server's copy (decision 10).
 */
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
  if (mailingAddressMissing(env)) {
    return error('bad_request', 'Email preferences cannot be turned on yet. Please try again later.')
  }
  const consentText = acceptedConsentText(env, body.consentText)
  if (!consentText) return error('bad_request', 'This page is out of date. Please reload it and try again.')
  await env.DB.prepare(
    `UPDATE users SET marketing_opt_in = 1, marketing_consent_text = ?2, marketing_consent_at = ?3,
            marketing_consent_version = ?4, marketing_withdrawn_at = NULL
      WHERE id = ?1`,
  )
    .bind(user.id, consentText, now.toISOString(), MARKETING_CONSENT.version)
    .run()
  return json({ ok: true })
}

/** One owner alert per UTC day once the forwarding ceiling is reached; a failed send is retried later. */
async function forwardLimitDigest(env: Env, now: Date): Promise<void> {
  const day = dayKey(now)
  const guardId = `support-digest:${day}`
  const mark = await env.DB.prepare(
    "INSERT OR IGNORE INTO webhook_events (id, type, received_at) VALUES (?1, 'support_digest', ?2)",
  )
    .bind(guardId, now.toISOString())
    .run()
  if (mark.meta.changes !== 1) return
  const sent = await alertOwner(
    env,
    `Support forwarding limit reached (${day})`,
    [
      `${SUPPORT_FORWARDS_PER_DAY} support tickets were emailed to you today (UTC), so later tickets today are stored`,
      'but not emailed. This is the only notice today. List them from products/clb with:\n\n',
      'npx wrangler d1 execute DB --remote -c worker/wrangler.jsonc --command',
      `"SELECT id, lang, created_at, message FROM support_tickets WHERE forwarded = 0 AND created_at >= '${day}'"`,
    ].join(' '),
  )
  if (!sent) await env.DB.prepare('DELETE FROM webhook_events WHERE id = ?1').bind(guardId).run()
}

/**
 * POST /api/support — signed-in only (decision 7): stores a ticket and forwards it to the owner by email.
 * At most SUPPORT_PER_DAY tickets per user and SUPPORT_FORWARDS_PER_DAY owner emails per UTC day, so
 * support traffic can never use up the email quota that sign-in links depend on.
 */
export async function support(req: Request, ctx: Ctx): Promise<Response> {
  const { env, now, user } = ctx
  if (!user) return error('unauthorized', 'Please sign in first')
  const body = await readJson<Partial<SupportRequest>>(req, 32 * 1024)
  if (!isRecord(body) || typeof body.message !== 'string') return error('bad_request', 'Invalid request')
  const message = body.message.trim()
  if (message.length < SUPPORT_MIN_CHARS || message.length > SUPPORT_MAX_CHARS) {
    return error('bad_request', `Please write between ${SUPPORT_MIN_CHARS} and ${SUPPORT_MAX_CHARS} characters`)
  }
  if (!isLang(body.lang)) return error('bad_request', 'Unsupported language')

  const dayStart = startOfUtcDay(now).toISOString()
  const mine = await env.DB.prepare('SELECT COUNT(*) AS n FROM support_tickets WHERE user_id = ?1 AND created_at >= ?2')
    .bind(user.id, dayStart)
    .first<{ n: number }>()
  if ((mine?.n ?? 0) >= SUPPORT_PER_DAY) return error('rate_limited', 'Too many messages today. Please try again tomorrow.')

  // The ticket and its claim on one of today's forwarding slots commit together (one D1 batch), so
  // concurrent tickets cannot overshoot the ceiling.
  const id = randomId('t_')
  const [, claim] = await env.DB.batch([
    env.DB.prepare(
      'INSERT INTO support_tickets (id, user_id, message, lang, created_at, forwarded) VALUES (?1, ?2, ?3, ?4, ?5, 0)',
    ).bind(id, user.id, message, body.lang, now.toISOString()),
    env.DB.prepare(
      `UPDATE support_tickets SET forwarded = 1
        WHERE id = ?1 AND (SELECT COUNT(*) FROM support_tickets WHERE forwarded = 1 AND created_at >= ?2) < ?3`,
    ).bind(id, dayStart, SUPPORT_FORWARDS_PER_DAY),
  ])
  if (claim?.meta.changes !== 1) {
    await forwardLimitDigest(env, now)
    return json({ ok: true })
  }

  const text = [`Ticket: ${id}`, `Language: ${body.lang}`, `From: ${user.email} (signed in)`, '', message].join('\n')
  if (!(await alertOwner(env, `Support ticket ${id}`, text))) {
    // not delivered: give the slot back so the ticket shows up as unforwarded
    await env.DB.prepare('UPDATE support_tickets SET forwarded = 0 WHERE id = ?1').bind(id).run()
  }
  return json({ ok: true })
}

/**
 * POST /api/unsubscribe (CASL s.11, decision 11) — no sign-in. `h` is users.email_hash and `s` its HMAC
 * from the link in every learner email; a valid pair withdraws marketing consent for that address (a
 * no-op when no account has it). Always {ok:true} for a valid signature, bad_request otherwise.
 */
export async function unsubscribe(req: Request, ctx: Ctx): Promise<Response> {
  const { env, now } = ctx
  const body = await readJson<Partial<UnsubscribeRequest>>(req, 2 * 1024)
  const h = isRecord(body) && typeof body.h === 'string' ? body.h.toLowerCase() : ''
  const s = isRecord(body) && typeof body.s === 'string' ? body.s.toLowerCase() : ''
  if (!HEX64.test(h) || !HEX64.test(s)) return error('bad_request', 'Invalid unsubscribe link')
  if (!timingSafeEqualHex(s, await unsubscribeSignature(env, h))) return error('bad_request', 'Invalid unsubscribe link')

  await env.DB.prepare('UPDATE users SET marketing_opt_in = 0, marketing_withdrawn_at = ?2 WHERE email_hash = ?1')
    .bind(h, now.toISOString())
    .run()
  // also blocks an opt-in still waiting in an unused sign-in link (the sign-in email carries this link too)
  await markUnsubscribed(env, h, now)
  return json({ ok: true })
}
