// Account endpoints (memo B7): /api/me, account deletion (essays, transcripts, support messages and
// profile go; payment records, anonymous cost rows and de-identified ticket rows stay), CASL consent
// changes and the no-login unsubscribe link, and support tickets (signed-in only) forwarded to the owner.
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
import { evaluateTiers, spendSnapshot } from './lib/spend'
import { dayKey, startOfUtcDay } from './lib/time'
import { freeAvailability, getUsage } from './lib/usage'

/** Support tickets per email address per UTC day (keyed on users.email_hash: deleting and signing up again does not reset it). */
export const SUPPORT_PER_DAY = 5
/**
 * Owner emails about support per UTC day, all users together (decision 7): forwarded tickets plus
 * "Account deleted" notices. Past it, tickets are stored only and deletion notices wait for the digest.
 */
export const SUPPORT_FORWARDS_PER_DAY = 30
/** What a deleted account's tickets keep in `message`; shorter than SUPPORT_MIN_CHARS, so no learner can send it. */
export const DELETED_TICKET_MESSAGE = '[deleted]'
/** webhook_events.type of the ledger row each "Account deleted" notice holds against the daily ceiling */
const DELETION_NOTICE_TYPE = 'support_deletion_notice'
/**
 * SQL for the owner emails about support so far today; `dayStart` is the placeholder bound to the start
 * of the UTC day. Deleted accounts' tickets keep `forwarded` and `created_at`, so deleting an account
 * never frees a slot.
 */
const emailsTodaySql = (dayStart: string) => `((SELECT COUNT(*) FROM support_tickets WHERE forwarded = 1 AND created_at >= ${dayStart})
    + (SELECT COUNT(*) FROM webhook_events WHERE type = '${DELETION_NOTICE_TYPE}' AND received_at >= ${dayStart}))`
/**
 * KV: today's tickets of accounts deleted today, per users.email_hash. The deleted rows lose their
 * user id, so this carries their count over to a re-signup with the same address (like AUTH_KV).
 */
export const SUPPORT_KV = {
  deletedTickets: (day: string, emailHash: string) => `support-deleted:${day}:${emailHash}`,
} as const
const SUPPORT_KV_TTL_SECONDS = 2 * 86_400
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

/**
 * GET /api/me — who is signed in, their pass and usage, free samples left and public flags.
 * flags.freeEnabled is what the grade handlers apply: the KV flag and the live spend tiers (which can
 * switch free samples off before the cron flips the flag). While it is false, `free` is all false.
 */
export async function me(_req: Request, ctx: Ctx): Promise<Response> {
  const { env, now, user } = ctx
  const flags = await getFlags(env)
  // one spend snapshot per request, and none while the owner (or the cron) has free samples off
  const freeEnabled = flags.free_enabled && !evaluateTiers(await spendSnapshot(env, now)).freeOff
  const keys = { user, deviceHash: ctx.deviceHash, ipHash: ctx.ipHash }
  const free = await freeAvailability(env, keys, now, freeEnabled)
  const publicFlags = {
    checkoutEnabled: flags.checkout_enabled,
    gradingEnabled: flags.grading_enabled,
    freeEnabled,
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
 * POST /api/account/delete — removes essays/transcripts and feedback, sessions, support messages and the
 * profile. The users row stays as a tombstone: purchases, passes and refunds reference it (payment
 * records), and email_hash is kept so the once-per-email rules survive re-signup (CONTRACT §3).
 * Grades rows are de-identified, not deleted (decision 5): they are also the spend ledger behind the
 * spend tiers, the free budget and the daily cost metrics, so model, tokens, cost, free, refused, kind
 * and created_at stay while user_id, device_hash, the text, the feedback and the error kinds go.
 * Support tickets are de-identified the same way (user_id and message go; forwarded, lang and
 * created_at stay), so deleting an account frees neither the owner-email ceiling nor, through
 * SUPPORT_KV, the per-address daily limit.
 */
export async function deleteAccount(_req: Request, ctx: Ctx): Promise<Response> {
  const { env, now, user } = ctx
  if (!user) return error('unauthorized', 'Please sign in first')
  const [forwarded, today] = await Promise.all([
    env.DB.prepare('SELECT id FROM support_tickets WHERE user_id = ?1 AND forwarded = 1 ORDER BY created_at')
      .bind(user.id)
      .all<{ id: string }>(),
    env.DB.prepare(
      'SELECT email_hash AS h, (SELECT COUNT(*) FROM support_tickets WHERE user_id = ?1 AND created_at >= ?2) AS n FROM users WHERE id = ?1',
    )
      .bind(user.id, startOfUtcDay(now).toISOString())
      .first<{ h: string; n: number }>(),
  ])
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE grades SET user_id = NULL, device_hash = NULL, input_text = NULL, result_json = NULL, error_kinds = NULL
        WHERE user_id = ?1`,
    ).bind(user.id),
    env.DB.prepare('DELETE FROM sessions WHERE user_id = ?1').bind(user.id),
    env.DB.prepare('UPDATE support_tickets SET user_id = NULL, message = ?2 WHERE user_id = ?1').bind(user.id, DELETED_TICKET_MESSAGE),
    // unused sign-in links still hold the address and consent choices
    env.DB.prepare('DELETE FROM magic_links WHERE email = ?1').bind(user.email),
    env.DB.prepare(
      `UPDATE users SET email = 'deleted:' || id, marketing_opt_in = 0, marketing_consent_text = NULL,
              marketing_consent_at = NULL, marketing_consent_version = NULL, deleted_at = ?2
        WHERE id = ?1`,
    ).bind(user.id, now.toISOString()),
  ])
  if (today && today.n > 0) await carryDeletedTickets(env, now, today.h, today.n)
  // Forwarded tickets also sit in the owner's mailbox; the owner deletes those copies (decision 7).
  if (forwarded.results.length > 0) await deletionNotice(env, now, forwarded.results.map((t) => t.id))
  return json({ ok: true } satisfies DeleteAccountResponse, { headers: { 'set-cookie': clearSessionCookie() } })
}

/** Today's tickets of accounts deleted today with this address (KV; 0 when unset or unreadable). */
async function deletedTicketsToday(env: Env, now: Date, emailHash: string): Promise<number> {
  try {
    const n = Number(await env.FLAGS.get(SUPPORT_KV.deletedTickets(dayKey(now), emailHash)))
    return Number.isInteger(n) && n > 0 ? n : 0
  } catch {
    return 0
  }
}

async function carryDeletedTickets(env: Env, now: Date, emailHash: string, n: number): Promise<void> {
  try {
    const key = SUPPORT_KV.deletedTickets(dayKey(now), emailHash)
    await env.FLAGS.put(key, String((await deletedTicketsToday(env, now, emailHash)) + n), { expirationTtl: SUPPORT_KV_TTL_SECONDS })
  } catch {
    console.warn('support carry-over write failed')
  }
}

/**
 * Tells the owner which forwarded tickets to delete from the mailbox (ticket ids only: the address is
 * already gone from D1). The notice takes a slot under the daily ceiling; with none left it is not
 * sent, and the ids go into the day's digest, or the digest already sent today says how to list them.
 */
async function deletionNotice(env: Env, now: Date, ticketIds: string[]): Promise<void> {
  const slotId = randomId('support-deletion:')
  const claim = await env.DB.prepare(
    `INSERT INTO webhook_events (id, type, received_at)
     SELECT ?1, '${DELETION_NOTICE_TYPE}', ?4 WHERE ${emailsTodaySql('?2')} < ?3`,
  )
    .bind(slotId, startOfUtcDay(now).toISOString(), SUPPORT_FORWARDS_PER_DAY, now.toISOString())
    .run()
  if (claim.meta.changes !== 1) {
    await forwardLimitDigest(env, now, ticketIds)
    return
  }
  const sent = await alertOwner(
    env,
    'Account deleted: remove its support emails',
    [
      'A learner deleted their account. Delete the forwarded support emails (and any replies) for these',
      `tickets from the mailbox:\n\n${ticketIds.join('\n')}`,
    ].join(' '),
  )
  if (!sent) {
    // not delivered: give the slot back (the digest query still lists these tickets)
    await env.DB.prepare('DELETE FROM webhook_events WHERE id = ?1').bind(slotId).run()
    console.warn('account deletion notice not delivered')
  }
}

/** Owner emails about support so far this UTC day (forwarded tickets and deletion notices). */
export async function supportEmailsToday(env: Env, now: Date): Promise<number> {
  const row = await env.DB.prepare(`SELECT ${emailsTodaySql('?1')} AS n`)
    .bind(startOfUtcDay(now).toISOString())
    .first<{ n: number }>()
  return row?.n ?? 0
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

/**
 * One owner alert per UTC day once the ceiling is reached; a failed send is retried later. It also
 * stands in for the deletion notices the ceiling holds back: `deletedTicketIds` (the account deleted
 * right now) are listed, and a query finds the tickets of accounts deleted later that day.
 */
async function forwardLimitDigest(env: Env, now: Date, deletedTicketIds: string[] = []): Promise<void> {
  const day = dayKey(now)
  const guardId = `support-digest:${day}`
  const mark = await env.DB.prepare(
    "INSERT OR IGNORE INTO webhook_events (id, type, received_at) VALUES (?1, 'support_digest', ?2)",
  )
    .bind(guardId, now.toISOString())
    .run()
  if (mark.meta.changes !== 1) return
  const d1 = 'npx wrangler d1 execute DB --remote -c worker/wrangler.jsonc --command'
  const lines = [
    `${SUPPORT_FORWARDS_PER_DAY} support emails (tickets and account-deletion notices) were sent to you today (UTC).`,
    'For the rest of the day new tickets are stored but not emailed, and deletion notices are not sent.',
    'This is the only notice today. Run these from products/clb.',
    '',
    'Tickets not emailed today:',
    `${d1} "SELECT id, lang, created_at, message FROM support_tickets WHERE forwarded = 0 AND created_at >= '${day}'"`,
    '',
    'Emailed tickets whose account was deleted (delete those emails and any replies from the mailbox):',
    `${d1} "SELECT id, created_at FROM support_tickets WHERE forwarded = 1 AND user_id IS NULL AND message = '${DELETED_TICKET_MESSAGE}'"`,
  ]
  if (deletedTicketIds.length > 0) {
    lines.push('', 'An account was deleted just now. Delete the emails for these tickets:', ...deletedTicketIds)
  }
  const sent = await alertOwner(env, `Support forwarding limit reached (${day})`, lines.join('\n'))
  if (!sent) await env.DB.prepare('DELETE FROM webhook_events WHERE id = ?1').bind(guardId).run()
}

/**
 * POST /api/support — signed-in only (decision 7): stores a ticket and forwards it to the owner by email.
 * At most SUPPORT_PER_DAY tickets per email address and SUPPORT_FORWARDS_PER_DAY owner emails per UTC
 * day, so support traffic can never use up the email quota that sign-in links depend on.
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
  // keyed on the address: every users row with this email_hash, plus the carry-over of accounts with
  // it that were deleted today (their tickets no longer have a user id)
  const mine = await env.DB.prepare(
    `SELECT u.email_hash AS h,
            (SELECT COUNT(*) FROM support_tickets t JOIN users o ON o.id = t.user_id
              WHERE o.email_hash = u.email_hash AND t.created_at >= ?2) AS n
       FROM users u WHERE u.id = ?1`,
  )
    .bind(user.id, dayStart)
    .first<{ h: string; n: number }>()
  const ticketsToday = (mine?.n ?? 0) + (mine ? await deletedTicketsToday(env, now, mine.h) : 0)
  if (ticketsToday >= SUPPORT_PER_DAY) return error('rate_limited', 'Too many messages today. Please try again tomorrow.')

  // The ticket and its claim on one of today's forwarding slots commit together (one D1 batch), so
  // concurrent tickets cannot overshoot the ceiling.
  const id = randomId('t_')
  const [, claim] = await env.DB.batch([
    env.DB.prepare(
      'INSERT INTO support_tickets (id, user_id, message, lang, created_at, forwarded) VALUES (?1, ?2, ?3, ?4, ?5, 0)',
    ).bind(id, user.id, message, body.lang, now.toISOString()),
    env.DB.prepare(`UPDATE support_tickets SET forwarded = 1 WHERE id = ?1 AND ${emailsTodaySql('?2')} < ?3`).bind(
      id,
      dayStart,
      SUPPORT_FORWARDS_PER_DAY,
    ),
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
