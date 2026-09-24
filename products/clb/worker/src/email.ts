// Transactional and alert email through Resend's REST API (base https://api.resend.com, POST /emails,
// `Authorization: Bearer <key>` — resend/resend-node src/resend.ts and src/emails/emails.ts, read 2026-09-24).
// No marketing email is sent by this build; marketing consent is only recorded (CASL evidence).
import type { Env } from './env'
import { hmacSha256Hex, saltedHash } from './lib/crypto'

export interface EmailMessage {
  to: string
  subject: string
  text: string
  /** transactional: magic links, receipts, refunds; alert: owner-only operational mail */
  kind: 'transactional' | 'alert'
  replyTo?: string
  /** Resend de-duplicates sends that reuse the key (use for webhook-driven mail) */
  idempotencyKey?: string
}

/** CASL s.6(2): identify the sender and give a mailing address in every commercial electronic message. */
export function senderFooter(env: Env): string {
  return ['—', 'Maple Practice Coach (independent practice tool)', env.MAILING_ADDRESS, env.SITE_URL].join('\n')
}

/**
 * CASL s.6(2)(c) and s.11: every email to a learner carries a working unsubscribe link. It identifies the
 * address only by its salted hash (users.email_hash) plus an HMAC, and sits in the URL fragment so it never
 * reaches server logs; /unsubscribe/ posts it to POST /api/unsubscribe. The link never expires.
 */
export async function unsubscribeUrl(env: Env, email: string): Promise<string> {
  const h = await saltedHash(env.HASH_SALT, `email:${email.trim().toLowerCase()}`)
  const s = await unsubscribeSignature(env, h)
  return `${env.SITE_URL}/unsubscribe/#h=${h}&s=${s}`
}

export function unsubscribeSignature(env: Env, emailHash: string): Promise<string> {
  return hmacSha256Hex(env.HASH_SALT, `unsub:${emailHash}`)
}

/** Sends one email; returns false (never throws) on failure so callers can degrade gracefully. */
export async function sendEmail(env: Env, msg: EmailMessage): Promise<boolean> {
  if (!env.RESEND_API_KEY) {
    console.warn('email skipped: RESEND_API_KEY not set')
    return false
  }
  const headers: Record<string, string> = {
    authorization: `Bearer ${env.RESEND_API_KEY}`,
    'content-type': 'application/json',
  }
  if (msg.idempotencyKey) headers['idempotency-key'] = msg.idempotencyKey
  const footer =
    msg.kind === 'alert'
      ? senderFooter(env)
      : `${senderFooter(env)}\nUnsubscribe from marketing emails / 마케팅 이메일 수신 거부: ${await unsubscribeUrl(env, msg.to)}`
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        from: env.FROM_EMAIL,
        to: [msg.to],
        subject: msg.subject,
        text: `${msg.text}\n\n${footer}`,
        ...(msg.replyTo ? { reply_to: msg.replyTo } : {}),
      }),
    })
    if (!res.ok) console.error('email send failed', res.status)
    return res.ok
  } catch (e) {
    console.error('email send error', e instanceof Error ? e.message : 'unknown')
    return false
  }
}

/** Owner alert (spend tiers, anomalies, support tickets). */
export function alertOwner(env: Env, subject: string, text: string): Promise<boolean> {
  return sendEmail(env, { to: env.OWNER_EMAIL, subject: `[MPC] ${subject}`, text, kind: 'alert' })
}
