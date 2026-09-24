// Minimal Stripe REST client over fetch (no SDK). Checked against Stripe's own sources (read 2026-09-24):
// - stripe/stripe-node src/utils.ts (form encoding, `Authorization: Bearer`, `Idempotency-Key`),
//   src/RequestSender.ts (form bodies as application/x-www-form-urlencoded, GET params in the query),
//   src/stripe.core.ts (host api.stripe.com), src/Webhooks.ts + src/crypto/SubtleCryptoProvider.ts
//   (Stripe-Signature: `t=<unix>,v1=<hex HMAC-SHA256 of "<t>.<raw body>">`, default tolerance 300 s);
// - stripe/openapi openapi/spec3.json (endpoint paths, parameter names and object fields used below).
// Every request pins Stripe-Version (STRIPE_API_VERSION), so parameter names and response shapes do not
// depend on the account's default API version.
import type { Env } from '../env'
import { hmacSha256Hex, timingSafeEqualHex } from '../lib/crypto'

export const STRIPE_API = 'https://api.stripe.com'

/**
 * API version sent as `Stripe-Version` on every request (header name from stripe-node src/utils.ts and
 * src/RequestSender.ts). Verified 2026-09-24 against stripe/openapi tag v2516 (openapi/spec3.json,
 * info.version "2026-08-26.dahlia", the last spec of this version) and stripe-node 22.6.0, which pins it.
 * In this version Checkout restricts payment methods with `payment_method_types`; the next version
 * (2026-09-30.endive, tag v2517) replaces it with `allowed_payment_method_types`, so re-check checkout.ts
 * before moving the pin. Set the webhook endpoint to the same version so event payloads match.
 */
export const STRIPE_API_VERSION = '2026-08-26.dahlia'

/** Stripe-node's Webhook.DEFAULT_TOLERANCE (seconds). */
export const SIGNATURE_TOLERANCE_SECONDS = 300

// ---------- objects (only the fields this Worker reads) ----------

/** Expandable reference: an id, or the expanded object. */
export type Expandable<T extends { id: string }> = string | T | null | undefined

export interface StripeEvent {
  id: string
  type: string
  data: { object: Record<string, unknown> }
}

export interface CheckoutSession {
  id: string
  url?: string | null
  payment_status?: 'paid' | 'unpaid' | 'no_payment_required'
  payment_intent?: Expandable<{ id: string }>
  client_reference_id?: string | null
  metadata?: Record<string, string> | null
  amount_total?: number | null
  currency?: string | null
}

export interface Address {
  country?: string | null
  state?: string | null
}

export interface Charge {
  id: string
  payment_intent?: Expandable<{ id: string }>
  billing_details?: { address?: Address | null } | null
  /** `type` names the payment method (`card`, `link`, `klarna`…); a hash of that name holds its details */
  payment_method_details?: {
    type?: string | null
    card?: { country?: string | null; fingerprint?: string | null } | null
  } | null
  /** true only once the charge is fully refunded; a partial refund leaves it false */
  refunded?: boolean
  disputed?: boolean
  /** cumulative amount refunded so far (partial refunds included) */
  amount_refunded?: number
  /**
   * Stripe's hosted receipt for this charge, "kept up-to-date to the latest state of the charge, including
   * any refunds" (spec3.json 2026-08-26.dahlia, charge.receipt_url: nullable string, maxLength 5000)
   */
  receipt_url?: string | null
}

export interface PaymentIntent {
  id: string
  amount?: number
  latest_charge?: Expandable<Charge>
}

export interface Refund {
  id: string
  amount: number
  charge?: Expandable<{ id: string }>
  payment_intent?: Expandable<{ id: string }>
  status?: 'pending' | 'requires_action' | 'succeeded' | 'failed' | 'canceled' | null
  /** e.g. lost_or_stolen_card, expired_or_canceled_card, declined (set when status is failed) */
  failure_reason?: string | null
  metadata?: Record<string, string> | null
}

/** A page of a Stripe list endpoint. */
export interface StripeList<T> {
  data: T[]
  has_more?: boolean
}

export interface Dispute {
  id: string
  charge?: Expandable<{ id: string }>
  payment_intent?: Expandable<{ id: string }>
  reason?: string
}

/** Id of an expandable field, whether or not it was expanded. */
export function idOf(ref: Expandable<{ id: string }>): string | null {
  if (!ref) return null
  return typeof ref === 'string' ? ref : ref.id
}

/** charge.receipt_url's maxLength in the spec */
export const MAX_RECEIPT_URL_LENGTH = 5000

/**
 * The charge's receipt link, or null. The site shows it as a link (/account/, /checkout/success/), so
 * only an absolute https URL of at most MAX_RECEIPT_URL_LENGTH characters is kept. The host is not
 * checked: the spec documents none (its fixture uses a Stripe dev host).
 */
export function receiptUrlOf(charge: Pick<Charge, 'receipt_url'>): string | null {
  const raw = charge.receipt_url
  if (typeof raw !== 'string' || raw.length > MAX_RECEIPT_URL_LENGTH) return null
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' && url.hostname !== '' && url.username === '' && url.password === '' ? raw : null
  } catch {
    return null
  }
}

// ---------- form encoding ----------

export type FormValue = string | number | boolean | null | undefined | FormValue[] | { [key: string]: FormValue }
export type FormParams = { [key: string]: FormValue }

/** Percent-encodes like stripe-node: RFC 3986 reserved characters escaped, brackets left readable. */
function encodePart(s: string): string {
  return encodeURIComponent(s)
    .replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%5B/g, '[')
    .replace(/%5D/g, ']')
}

/**
 * application/x-www-form-urlencoded with Stripe's nested keys, matching stripe-node's
 * stringifyRequestData: `a[b]=1`, `list[0][c]=2`. `undefined` is skipped; `null` sends an empty value.
 */
export function formEncode(params: FormParams): string {
  const pairs: string[] = []
  const add = (key: string, value: FormValue): void => {
    if (value === undefined) return
    if (value === null || typeof value !== 'object') {
      pairs.push(`${encodePart(key)}=${encodePart(value === null ? '' : String(value))}`)
    } else if (Array.isArray(value)) {
      value.forEach((v, i) => add(`${key}[${i}]`, v))
    } else {
      for (const [k, v] of Object.entries(value)) add(`${key}[${k}]`, v)
    }
  }
  for (const [k, v] of Object.entries(params)) add(k, v)
  return pairs.join('&')
}

// ---------- requests ----------

/**
 * A failed Stripe call. The message holds only the HTTP status and Stripe's error type/code, never
 * Stripe's message text (it can echo request data such as an email address), so it is safe to log.
 */
export class StripeError extends Error {
  constructor(
    readonly status: number,
    readonly type: string | null,
    readonly code: string | null,
  ) {
    super(`Stripe request failed (${[status, type, code].filter(Boolean).join(', ')})`)
    this.name = 'StripeError'
  }
}

export interface StripeRequestOptions {
  params?: FormParams
  /** replays of the same key return the first result instead of acting twice */
  idempotencyKey?: string
}

/** Calls the Stripe REST API with the global fetch (looked up at call time, so tests can stub it). */
export async function stripeFetch<T>(
  env: Env,
  method: 'GET' | 'POST',
  path: string,
  opts: StripeRequestOptions = {},
): Promise<T> {
  const encoded = formEncode(opts.params ?? {})
  const headers: Record<string, string> = {
    Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
    'Stripe-Version': STRIPE_API_VERSION,
  }
  if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey
  let url = STRIPE_API + path
  const init: RequestInit = { method, headers }
  if (method === 'GET') {
    if (encoded) url += `?${encoded}`
  } else {
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
    init.body = encoded
  }
  const res = await fetch(url, init)
  const data = await res.json<unknown>().catch(() => null)
  if (!res.ok) {
    const err = (data as { error?: { type?: unknown; code?: unknown } } | null)?.error
    throw new StripeError(res.status, asString(err?.type), asString(err?.code))
  }
  return data as T
}

function asString(v: unknown): string | null {
  return typeof v === 'string' ? v : null
}

/** Log-safe description of an error thrown while talking to Stripe or D1 (no payloads, no personal data). */
export function describeError(e: unknown): string {
  return e instanceof Error ? e.message : 'unknown error'
}

// ---------- webhook signatures ----------

export type SignatureCheck = { ok: true } | { ok: false; reason: 'missing' | 'malformed' | 'mismatch' | 'stale' }

/**
 * Verifies a `Stripe-Signature` header the way stripe-node does: the header may carry several `v1`
 * entries and any match is accepted; events older than `toleranceSeconds` are rejected (0 disables
 * the age check).
 */
export async function verifyStripeSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  nowSeconds: number,
  toleranceSeconds = SIGNATURE_TOLERANCE_SECONDS,
): Promise<SignatureCheck> {
  if (!header || !secret) return { ok: false, reason: 'missing' }
  let timestamp = Number.NaN
  const signatures: string[] = []
  for (const item of header.split(',')) {
    const eq = item.indexOf('=')
    if (eq < 0) continue
    const key = item.slice(0, eq).trim()
    const value = item.slice(eq + 1).trim()
    if (key === 't') timestamp = /^\d+$/.test(value) ? Number(value) : Number.NaN
    else if (key === 'v1') signatures.push(value.toLowerCase())
  }
  if (!Number.isFinite(timestamp) || signatures.length === 0) return { ok: false, reason: 'malformed' }

  const expected = await hmacSha256Hex(secret, `${timestamp}.${rawBody}`)
  let matched = false
  for (const sig of signatures) matched = timingSafeEqualHex(expected, sig) || matched
  if (!matched) return { ok: false, reason: 'mismatch' }
  if (toleranceSeconds > 0 && nowSeconds - timestamp > toleranceSeconds) return { ok: false, reason: 'stale' }
  return { ok: true }
}
