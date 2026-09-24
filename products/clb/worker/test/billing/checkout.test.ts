import { env } from 'cloudflare:test'
import { exports } from 'cloudflare:workers'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { checkout } from '../../src/billing'
import { FakeStripe, ORIGIN, createUser, eventCount, jsonRequest, makeCtx, purchaseRow, setCheckoutEnabled } from './helpers'

const body = (over: Record<string, unknown> = {}) => ({ sku: 'pass30', residentAttestation: true, lang: 'en', ...over })

describe('POST /api/checkout', () => {
  let stripe: FakeStripe

  beforeEach(async () => {
    stripe = new FakeStripe().install()
    await setCheckoutEnabled(true)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('rejects signed-out requests (through the router)', async () => {
    const res = await exports.default.fetch(`${ORIGIN}/api/checkout`, {
      method: 'POST',
      headers: { origin: ORIGIN, 'content-type': 'application/json' },
      body: JSON.stringify(body()),
    })
    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ error: 'unauthorized' })
    expect(stripe.calls).toHaveLength(0)
  })

  it('returns checkout_unavailable while the checkout_enabled flag is off', async () => {
    await setCheckoutEnabled(false)
    const { user } = await createUser()
    const res = await checkout(jsonRequest('/api/checkout', body()), makeCtx(user))
    expect(res.status).toBe(503)
    expect(await res.json()).toMatchObject({ error: 'checkout_unavailable' })
    expect(stripe.calls).toHaveLength(0)
  })

  it.each([
    ['missing', { residentAttestation: undefined }],
    ['false', { residentAttestation: false }],
    ['truthy but not true', { residentAttestation: 'yes' }],
  ])('requires the resident attestation (%s)', async (_label, over) => {
    const { user } = await createUser()
    const res = await checkout(jsonRequest('/api/checkout', body(over)), makeCtx(user))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'bad_request', message: expect.stringContaining('outside Quebec') })
    expect(stripe.calls).toHaveLength(0)
  })

  it('rejects unknown SKUs and invalid JSON', async () => {
    const { user } = await createUser()
    for (const sku of ['pass365', 'toString', 42]) {
      const res = await checkout(jsonRequest('/api/checkout', body({ sku })), makeCtx(user))
      expect(res.status).toBe(400)
    }
    const bad = await checkout(jsonRequest('/api/checkout', '{not json'), makeCtx(user))
    expect(bad.status).toBe(400)
    expect(stripe.calls).toHaveLength(0)
  })

  it.each([
    ['outside Canada', 'US', 'NY'],
    ['in Quebec', 'CA', 'QC'],
    ['with an unknown country', null, null],
  ])('refuses buyers %s', async (_label, country, region) => {
    const { user } = await createUser()
    const res = await checkout(jsonRequest('/api/checkout', body({ lang: 'ko' })), makeCtx(user, { country, region }))
    expect(res.status).toBe(403)
    const json = await res.json<{ error: string; message: string }>()
    expect(json.error).toBe('region_not_supported')
    expect(json.message).toContain('퀘벡')
    expect(stripe.calls).toHaveLength(0)
  })

  it('creates a Checkout Session, a pending purchase and a checkout_start event', async () => {
    const { user } = await createUser()
    const eventsBefore = await eventCount('checkout_start', '/api/checkout')

    const res = await checkout(jsonRequest('/api/checkout', body({ sku: 'pass90' })), makeCtx(user))
    expect(res.status).toBe(200)
    const { url } = await res.json<{ url: string }>()
    expect(url).toMatch(/^https:\/\/checkout\.stripe\.com\/c\/pay\/cs_test_/)

    const [call] = stripe.stripeCalls('POST /v1/checkout/sessions')
    expect(call.headers.get('authorization')).toBe(`Bearer ${env.STRIPE_SECRET_KEY}`)
    expect(call.headers.get('content-type')).toBe('application/x-www-form-urlencoded')
    expect(call.headers.get('stripe-version')).toBeNull()
    expect(call.body).toContain('line_items[0][price_data][currency]=cad')
    expect(Object.fromEntries(new URLSearchParams(call.body))).toEqual({
      mode: 'payment',
      'line_items[0][price_data][currency]': 'cad',
      'line_items[0][price_data][unit_amount]': '7900',
      'line_items[0][price_data][product_data][name]': 'Maple Practice Coach — 90-day pass',
      'line_items[0][quantity]': '1',
      billing_address_collection: 'required',
      customer_email: user.email,
      client_reference_id: user.id,
      'metadata[user_id]': user.id,
      'metadata[sku]': 'pass90',
      'payment_intent_data[metadata][user_id]': user.id,
      'payment_intent_data[metadata][sku]': 'pass90',
      locale: 'en',
      success_url: `${ORIGIN}/checkout/success/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${ORIGIN}/checkout/cancel/`,
    })

    const sessionId = url.split('/').pop() as string
    expect(await purchaseRow(sessionId)).toMatchObject({
      user_id: user.id,
      sku: 'pass90',
      amount_cents: 7900,
      currency: 'cad',
      status: 'pending',
      paid_at: null,
    })
    expect(await eventCount('checkout_start', '/api/checkout')).toBe(eventsBefore + 1)
  })

  it('uses the Korean Checkout locale for Korean buyers', async () => {
    const { user } = await createUser({ lang: 'ko' })
    const res = await checkout(jsonRequest('/api/checkout', body({ lang: 'ko' })), makeCtx(user))
    expect(res.status).toBe(200)
    expect(new URLSearchParams(stripe.stripeCalls('POST /v1/checkout/sessions')[0].body).get('locale')).toBe('ko')
  })

  it('returns internal and records nothing when Stripe fails', async () => {
    const { user } = await createUser()
    const eventsBefore = await eventCount('checkout_start')
    stripe.failures.set('POST /v1/checkout/sessions', { status: 500, code: 'api_error' })
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await checkout(jsonRequest('/api/checkout', body()), makeCtx(user))
    expect(res.status).toBe(500)
    expect(await res.json()).toMatchObject({ error: 'internal' })
    expect(await eventCount('checkout_start')).toBe(eventsBefore)
    const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM purchases WHERE user_id = ?1').bind(user.id).first<{ n: number }>()
    expect(row?.n).toBe(0)
    // the log line carries the status and code only, never Stripe's message text or the email
    expect(errors).toHaveBeenCalled()
    expect(JSON.stringify(errors.mock.calls)).not.toContain('@')
    errors.mockRestore()
  })
})
