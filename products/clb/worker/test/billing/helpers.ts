// Test helpers for billing: users with sessions, hand-built Ctx (request.cf is not settable through the
// router), a fake Stripe + Resend behind a stubbed global fetch, and signed webhook deliveries.
import { createExecutionContext, env } from 'cloudflare:test'
import { exports } from 'cloudflare:workers'
import { vi } from 'vitest'
import { SESSION, SKUS, type Sku, TERMS_VERSION } from '../../../shared/config'
import { checkout } from '../../src/billing'
import type { Ctx, User } from '../../src/env'
import { hmacSha256Hex, randomId, randomToken, saltedHash } from '../../src/lib/crypto'
import { addDays } from '../../src/lib/time'
import checkoutCompletedFixture from '../fixtures/billing/checkout.session.completed.json'
import disputeFixture from '../fixtures/billing/charge.dispute.created.json'
import chargeRefundedFixture from '../fixtures/billing/charge.refunded.json'
import paymentIntentFixture from '../fixtures/billing/payment_intent.json'

export const ORIGIN = 'https://coach.test'

const clone = <T>(v: T): T => structuredClone(v)

/** Unique suffix for ids: D1 state persists across tests within a file. */
export const uid = (): string => randomToken(9).replace(/[-_]/g, 'x')

// ---------- users and context ----------

export interface TestUser {
  user: User
  cookie: string
  emailHash: string
}

export async function createUser(opts: { email?: string; lang?: 'en' | 'ko' } = {}): Promise<TestUser> {
  const id = `u_${uid()}`
  const email = (opts.email ?? `${id}@example.test`).toLowerCase()
  const lang = opts.lang ?? 'en'
  const now = new Date().toISOString()
  const emailHash = await saltedHash(env.HASH_SALT, `email:${email}`)
  const raw = randomToken(32)
  await env.DB.batch([
    env.DB.prepare(
      'INSERT INTO users (id, email, email_hash, created_at, last_active_at, lang) VALUES (?1, ?2, ?3, ?4, ?4, ?5)',
    ).bind(id, email, emailHash, now, lang),
    env.DB.prepare('INSERT INTO sessions (id_hash, user_id, created_at, expires_at) VALUES (?1, ?2, ?3, ?4)').bind(
      await saltedHash(env.HASH_SALT, `session:${raw}`),
      id,
      now,
      addDays(new Date(), SESSION.days).toISOString(),
    ),
  ])
  return {
    user: { id, email, lang, freeSpeakingUsed: false, selfRefundUsed: false },
    cookie: `${SESSION.cookieName}=${raw}`,
    emailHash,
  }
}

/** Mirrors account deletion: the row stays (payments are kept) but the email is replaced. */
export async function deleteAccount(userId: string): Promise<void> {
  await env.DB.prepare("UPDATE users SET email = 'deleted:' || id, deleted_at = ?1 WHERE id = ?2")
    .bind(new Date().toISOString(), userId)
    .run()
}

export function makeCtx(user: User | null, over: Partial<Pick<Ctx, 'country' | 'region' | 'now'>> = {}): Ctx {
  return {
    env,
    exec: createExecutionContext(),
    user,
    ipHash: 'ip-hash',
    deviceHash: 'device-hash',
    country: 'CA',
    region: 'ON',
    now: new Date(),
    ...over,
  }
}

export async function setCheckoutEnabled(on: boolean): Promise<void> {
  await env.FLAGS.put('flag:checkout_enabled', String(on))
}

export function jsonRequest(path: string, body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(ORIGIN + path, {
    method: 'POST',
    headers: { origin: ORIGIN, 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

// ---------- fake Stripe + Resend ----------

export interface RecordedCall {
  method: string
  url: URL
  body: string
  headers: Headers
}

export interface SentEmail {
  to: string
  subject: string
  text: string
  idempotencyKey: string | null
}

type RefundStatus = 'pending' | 'succeeded' | 'failed' | 'canceled'

export interface FakeRefund {
  id: string
  object: 'refund'
  amount: number
  charge: string | null
  payment_intent: string | null
  status: RefundStatus
  failure_reason?: string | null
  metadata: Record<string, string>
}

/** Routes the stubbed global fetch to in-memory Stripe and Resend fakes; anything else throws. */
export class FakeStripe {
  calls: RecordedCall[] = []
  emails: SentEmail[] = []
  paymentIntents = new Map<string, Record<string, unknown>>()
  /** refunds created through POST /v1/refunds or ownerRefund(), listed by GET /v1/refunds?charge= */
  refunds: FakeRefund[] = []
  /** one-shot failures keyed by "METHOD /path" prefix */
  failures = new Map<string, { status: number; code?: string }>()
  refundStatus: RefundStatus = 'succeeded'
  private seq = 0

  install(): this {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => this.handle(new Request(input, init))),
    )
    return this
  }

  /** A refund made outside the Worker (the owner in the Dashboard or the CLI). */
  ownerRefund(r: { chargeId: string; paymentIntentId?: string | null; amount: number; metadata?: Record<string, string>; status?: RefundStatus }): FakeRefund {
    const refund: FakeRefund = {
      id: `re_${uid()}`,
      object: 'refund',
      amount: r.amount,
      charge: r.chargeId,
      payment_intent: r.paymentIntentId ?? null,
      status: r.status ?? 'succeeded',
      metadata: r.metadata ?? {},
    }
    this.refunds.push(refund)
    return refund
  }

  /** Stripe calls whose "METHOD /path" starts with prefix. */
  stripeCalls(prefix: string): RecordedCall[] {
    return this.calls.filter((c) => c.url.origin === 'https://api.stripe.com' && `${c.method} ${c.url.pathname}`.startsWith(prefix))
  }

  private async handle(req: Request): Promise<Response> {
    const url = new URL(req.url)
    const body = req.method === 'GET' ? '' : new TextDecoder().decode(await req.arrayBuffer())
    this.calls.push({ method: req.method, url, body, headers: req.headers })

    if (url.origin === 'https://api.resend.com' && url.pathname === '/emails') {
      const msg = JSON.parse(body) as { to: string[]; subject: string; text: string }
      this.emails.push({ to: msg.to[0], subject: msg.subject, text: msg.text, idempotencyKey: req.headers.get('idempotency-key') })
      return Response.json({ id: `email_${++this.seq}` })
    }
    if (url.origin !== 'https://api.stripe.com') throw new Error(`unexpected fetch to ${url.origin}`)

    const key = `${req.method} ${url.pathname}`
    for (const [prefix, f] of this.failures) {
      if (key.startsWith(prefix)) {
        this.failures.delete(prefix)
        return stripeError(f.status, f.code ?? 'test_failure')
      }
    }
    if (key === 'POST /v1/checkout/sessions') {
      const id = `cs_test_${uid()}`
      return Response.json({ id, object: 'checkout.session', url: `https://checkout.stripe.com/c/pay/${id}` })
    }
    if (req.method === 'GET' && url.pathname.startsWith('/v1/payment_intents/')) {
      const pi = this.paymentIntents.get(decodeURIComponent(url.pathname.slice('/v1/payment_intents/'.length)))
      return pi ? Response.json(pi) : stripeError(404, 'resource_missing')
    }
    if (key === 'POST /v1/refunds') {
      const params = new URLSearchParams(body)
      const pi = params.get('payment_intent') ?? ''
      const intent = this.paymentIntents.get(pi)
      const metadata: Record<string, string> = {}
      for (const [k, v] of params) if (k.startsWith('metadata[')) metadata[k.slice(9, -1)] = v
      const refund: FakeRefund = {
        id: `re_${uid()}`,
        object: 'refund',
        amount: (intent?.amount as number | undefined) ?? 3900,
        charge: ((intent?.latest_charge as { id?: string } | undefined)?.id ?? null) as string | null,
        payment_intent: pi,
        status: this.refundStatus,
        metadata,
      }
      this.refunds.push(refund)
      return Response.json(refund)
    }
    if (key === 'GET /v1/refunds') {
      const charge = url.searchParams.get('charge')
      const data = this.refunds.filter((r) => charge === null || r.charge === charge)
      return Response.json({ object: 'list', data, has_more: false, url: '/v1/refunds' })
    }
    return stripeError(404, 'unhandled_in_fake')
  }
}

function stripeError(status: number, code: string): Response {
  return Response.json(
    { error: { type: 'invalid_request_error', code, message: 'test error echoing buyer@example.test' } },
    { status },
  )
}

// ---------- Stripe objects and events ----------

export interface ChargeOptions {
  paymentIntentId?: string
  chargeId?: string
  amount?: number
  /** payment_method_details.type; anything but 'card' replaces the card hash with one of that name */
  paymentMethodType?: string
  /** cumulative amount already refunded when the PaymentIntent is fetched */
  amountRefunded?: number
  billingCountry?: string | null
  billingState?: string | null
  cardCountry?: string | null
  fingerprint?: string | null
  refunded?: boolean
  disputed?: boolean
}

/** A PaymentIntent with latest_charge expanded (Canadian card and Ontario address by default). */
export function paymentIntent(o: ChargeOptions = {}): Record<string, unknown> {
  const pi = clone(paymentIntentFixture) as unknown as Record<string, unknown> & { latest_charge: Record<string, unknown> & {
    billing_details: { address: Record<string, unknown> }
    payment_method_details: { card: Record<string, unknown> }
  } }
  const id = o.paymentIntentId ?? `pi_${uid()}`
  const charge = pi.latest_charge
  pi.id = id
  pi.amount = o.amount ?? 3900
  charge.id = o.chargeId ?? `ch_${uid()}`
  charge.payment_intent = id
  charge.amount = pi.amount
  if (o.billingCountry !== undefined) charge.billing_details.address.country = o.billingCountry
  if (o.billingState !== undefined) charge.billing_details.address.state = o.billingState
  if (o.cardCountry !== undefined) charge.payment_method_details.card.country = o.cardCountry
  charge.payment_method_details.card.fingerprint = o.fingerprint === undefined ? `fp_${uid()}` : o.fingerprint
  if (o.refunded) charge.refunded = true
  if (o.disputed) charge.disputed = true
  if (o.amountRefunded !== undefined) charge.amount_refunded = o.amountRefunded
  if (o.paymentMethodType && o.paymentMethodType !== 'card') {
    // e.g. Link paid from a bank account: {type:'link', link:{country, funding_source_group}} and no card
    charge.payment_method_details = { type: o.paymentMethodType, [o.paymentMethodType]: { country: 'CA' } } as never
  }
  return pi
}

export function checkoutCompletedEvent(s: {
  sessionId: string
  paymentIntentId: string
  userId?: string
  sku?: Sku
  paymentStatus?: string
  type?: string
}): Record<string, unknown> {
  const e = clone(checkoutCompletedFixture) as unknown as { id: string; type: string; data: { object: Record<string, unknown> } }
  const sku = s.sku ?? 'pass30'
  e.id = `evt_${uid()}`
  if (s.type) e.type = s.type
  Object.assign(e.data.object, {
    id: s.sessionId,
    payment_intent: s.paymentIntentId,
    payment_status: s.paymentStatus ?? 'paid',
    client_reference_id: s.userId ?? null,
    metadata: s.userId ? { user_id: s.userId, sku } : {},
    amount_total: SKUS[sku].priceCents,
  })
  return e
}

export function chargeRefundedEvent(c: { chargeId: string; paymentIntentId: string; amountRefunded?: number; refunded?: boolean }) {
  const e = clone(chargeRefundedFixture) as unknown as { id: string; data: { object: Record<string, unknown> } }
  e.id = `evt_${uid()}`
  Object.assign(e.data.object, {
    id: c.chargeId,
    payment_intent: c.paymentIntentId,
    amount_refunded: c.amountRefunded ?? 3900,
    refunded: c.refunded ?? true,
  })
  return e
}

export function refundFailedEvent(refund: Partial<FakeRefund> & { id: string; amount: number }) {
  return {
    id: `evt_${uid()}`,
    object: 'event',
    type: 'refund.failed',
    data: { object: { object: 'refund', status: 'failed', ...refund } },
  }
}

export function disputeCreatedEvent(d: { chargeId: string; paymentIntentId: string | null }) {
  const e = clone(disputeFixture) as unknown as { id: string; data: { object: Record<string, unknown> } }
  e.id = `evt_${uid()}`
  Object.assign(e.data.object, { id: `dp_${uid()}`, charge: d.chargeId, payment_intent: d.paymentIntentId })
  return e
}

// ---------- webhook delivery ----------

export async function signatureHeader(payload: string, opts: { timestamp?: number; secret?: string } = {}): Promise<string> {
  const t = opts.timestamp ?? Math.floor(Date.now() / 1000)
  return `t=${t},v1=${await hmacSha256Hex(opts.secret ?? env.STRIPE_WEBHOOK_SECRET, `${t}.${payload}`)}`
}

/** POSTs a signed event through the router (the webhook needs no request.cf data). */
export async function postWebhook(
  event: unknown,
  opts: { timestamp?: number; secret?: string; header?: string | null; rawBody?: string } = {},
): Promise<Response> {
  const payload = opts.rawBody ?? JSON.stringify(event)
  const header = opts.header === undefined ? await signatureHeader(payload, opts) : opts.header
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (header !== null) headers['stripe-signature'] = header
  return exports.default.fetch(`${ORIGIN}/api/stripe/webhook`, { method: 'POST', headers, body: payload })
}

// ---------- flows ----------

/** Runs POST /api/checkout for a Canadian buyer and returns the new Checkout Session id. */
export async function startCheckout(user: User, sku: Sku = 'pass30'): Promise<string> {
  const res = await checkout(
    jsonRequest('/api/checkout', { sku, residentAttestation: true, termsVersion: TERMS_VERSION, lang: user.lang }),
    makeCtx(user),
  )
  if (res.status !== 200) throw new Error(`checkout failed: ${res.status}`)
  const { url } = await res.json<{ url: string }>()
  return url.split('/').pop() as string
}

export interface Purchase {
  sessionId: string
  paymentIntentId: string
  chargeId: string
  fingerprint: string | null
  eventId: string
  res: Response
}

/** Checkout + a signed checkout.session.completed with the given payment evidence. */
export async function purchase(stripe: FakeStripe, user: User, opts: ChargeOptions & { sku?: Sku } = {}): Promise<Purchase> {
  const sessionId = await startCheckout(user, opts.sku)
  const pi = paymentIntent({ ...opts, amount: opts.amount ?? SKUS[opts.sku ?? 'pass30'].priceCents })
  stripe.paymentIntents.set(pi.id as string, pi)
  const charge = pi.latest_charge as { id: string; payment_method_details: { card?: { fingerprint: string | null } } }
  const event = checkoutCompletedEvent({ sessionId, paymentIntentId: pi.id as string, userId: user.id, sku: opts.sku })
  const res = await postWebhook(event)
  return {
    sessionId,
    paymentIntentId: pi.id as string,
    chargeId: charge.id,
    fingerprint: charge.payment_method_details.card?.fingerprint ?? null,
    eventId: event.id as string,
    res,
  }
}

// ---------- D1 readers and seeders ----------

export interface PurchaseDbRow {
  id: string
  user_id: string
  sku: string
  amount_cents: number
  currency: string
  payment_intent: string | null
  charge_id: string | null
  card_fingerprint: string | null
  card_country: string | null
  payment_method_type: string | null
  billing_country: string | null
  billing_region: string | null
  status: string
  amount_refunded_cents: number
  terms_version: string | null
  created_at: string
  paid_at: string | null
  refunded_at: string | null
}

export interface PassDbRow {
  id: string
  sku: string
  starts_at: string
  ends_at: string
  purchase_id: string
  revoked_at: string | null
  revoke_reason: string | null
}

export function purchaseRow(id: string): Promise<PurchaseDbRow | null> {
  return env.DB.prepare('SELECT * FROM purchases WHERE id = ?1').bind(id).first<PurchaseDbRow>()
}

export async function passesOf(userId: string): Promise<PassDbRow[]> {
  const { results } = await env.DB.prepare('SELECT * FROM passes WHERE user_id = ?1 ORDER BY starts_at').bind(userId).all<PassDbRow>()
  return results
}

export async function refundsOf(purchaseId: string): Promise<{ id: string; reason: string; amount_cents: number; user_id: string }[]> {
  const { results } = await env.DB.prepare('SELECT id, reason, amount_cents, user_id FROM refunds WHERE purchase_id = ?1')
    .bind(purchaseId)
    .all<{ id: string; reason: string; amount_cents: number; user_id: string }>()
  return results
}

/** Sum of the purchase's refunds rows (what the metrics count as refunded). */
export async function refundedCents(purchaseId: string): Promise<number> {
  return (await refundsOf(purchaseId)).reduce((sum, r) => sum + r.amount_cents, 0)
}

export async function eventCount(name: string, path?: string): Promise<number> {
  const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM events WHERE name = ?1 AND (?2 IS NULL OR path = ?2)')
    .bind(name, path ?? null)
    .first<{ n: number }>()
  return row?.n ?? 0
}

export async function webhookEventExists(id: string): Promise<boolean> {
  return (await env.DB.prepare('SELECT 1 AS x FROM webhook_events WHERE id = ?1').bind(id).first()) !== null
}

/** A paid purchase with its pass, as the webhook would leave it. */
export async function seedPaidPurchase(
  userId: string,
  o: { paidAt?: Date; sku?: Sku; fingerprint?: string | null; paymentIntentId?: string } = {},
): Promise<{ id: string; paymentIntentId: string; chargeId: string }> {
  const sku = o.sku ?? 'pass30'
  const paidAt = o.paidAt ?? new Date()
  const id = `cs_test_${uid()}`
  const paymentIntentId = o.paymentIntentId ?? `pi_${uid()}`
  const chargeId = `ch_${uid()}`
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO purchases (id, user_id, sku, amount_cents, currency, payment_intent, charge_id, card_fingerprint,
                              card_country, payment_method_type, billing_country, billing_region, status, created_at, paid_at)
       VALUES (?1, ?2, ?3, ?4, 'cad', ?5, ?6, ?7, 'CA', 'card', 'CA', 'ON', 'paid', ?8, ?8)`,
    ).bind(id, userId, sku, SKUS[sku].priceCents, paymentIntentId, chargeId, o.fingerprint === undefined ? `fp_${uid()}` : o.fingerprint, paidAt.toISOString()),
    env.DB.prepare('INSERT INTO passes (id, user_id, sku, starts_at, ends_at, purchase_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6)').bind(
      randomId('pass_'),
      userId,
      sku,
      paidAt.toISOString(),
      addDays(paidAt, SKUS[sku].days).toISOString(),
      id,
    ),
  ])
  return { id, paymentIntentId, chargeId }
}

export async function addGrades(userId: string, n: number, o: { createdAt?: Date; refused?: boolean; free?: boolean } = {}): Promise<void> {
  const createdAt = (o.createdAt ?? new Date()).toISOString()
  await env.DB.batch(
    Array.from({ length: n }, () =>
      env.DB.prepare(
        `INSERT INTO grades (id, user_id, task_id, prompt_index, kind, free, refused, model, created_at)
         VALUES (?1, ?2, 'writing-email', 0, 'writing', ?3, ?4, 'claude-opus-5', ?5)`,
      ).bind(randomId('g_'), userId, o.free ? 1 : 0, o.refused ? 1 : 0, createdAt),
    ),
  )
}
