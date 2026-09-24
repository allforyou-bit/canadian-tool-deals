import { env } from 'cloudflare:test'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  MAX_RECEIPT_URL_LENGTH,
  STRIPE_API_VERSION,
  StripeError,
  describeError,
  formEncode,
  idOf,
  receiptUrlOf,
  stripeFetch,
  verifyStripeSignature,
} from '../../src/billing/stripe'
import { hmacSha256Hex } from '../../src/lib/crypto'

const SECRET = 'whsec_unit'
const NOW = 1_790_000_000

async function header(payload: string, t = NOW, secret = SECRET): Promise<string> {
  return `t=${t},v1=${await hmacSha256Hex(secret, `${t}.${payload}`)}`
}

describe('formEncode', () => {
  it('encodes nested objects and arrays with bracket keys like stripe-node', () => {
    const body = formEncode({
      mode: 'payment',
      line_items: [{ price_data: { currency: 'cad', unit_amount: 3900 }, quantity: 1 }],
      metadata: { user_id: 'u_1' },
      expand: ['latest_charge', 'customer'],
      skipped: undefined,
      cleared: null,
      flag: true,
    })
    expect(body).toBe(
      'mode=payment&line_items[0][price_data][currency]=cad&line_items[0][price_data][unit_amount]=3900' +
        '&line_items[0][quantity]=1&metadata[user_id]=u_1&expand[0]=latest_charge&expand[1]=customer&cleared=&flag=true',
    )
  })

  it('percent-encodes values, including characters encodeURIComponent leaves alone', () => {
    const body = formEncode({ name: "Maple — 30-day pass (it's)!*", url: 'https://x.test/?a=1&b={ID}' })
    expect(body).toBe('name=Maple%20%E2%80%94%2030-day%20pass%20%28it%27s%29%21%2A&url=https%3A%2F%2Fx.test%2F%3Fa%3D1%26b%3D%7BID%7D')
    const parsed = new URLSearchParams(body)
    expect(parsed.get('name')).toBe("Maple — 30-day pass (it's)!*")
    expect(parsed.get('url')).toBe('https://x.test/?a=1&b={ID}')
  })
})

describe('verifyStripeSignature', () => {
  const payload = '{"id":"evt_1","type":"charge.refunded"}'

  it('accepts a valid signature within the tolerance', async () => {
    expect(await verifyStripeSignature(payload, await header(payload), SECRET, NOW + 300)).toEqual({ ok: true })
  })

  it('accepts any matching v1 among several', async () => {
    const good = (await header(payload)).split(',')[1]
    const h = `t=${NOW},v1=${'ab'.repeat(32)},${good}`
    expect(await verifyStripeSignature(payload, h, SECRET, NOW)).toEqual({ ok: true })
  })

  it('rejects a changed body, a wrong secret and a v0-only header', async () => {
    const h = await header(payload)
    expect(await verifyStripeSignature(`${payload} `, h, SECRET, NOW)).toEqual({ ok: false, reason: 'mismatch' })
    expect(await verifyStripeSignature(payload, h, 'whsec_other', NOW)).toEqual({ ok: false, reason: 'mismatch' })
    const v0 = h.replace('v1=', 'v0=')
    expect(await verifyStripeSignature(payload, v0, SECRET, NOW)).toEqual({ ok: false, reason: 'malformed' })
  })

  it('rejects a stale timestamp, unless the tolerance is 0', async () => {
    const h = await header(payload)
    expect(await verifyStripeSignature(payload, h, SECRET, NOW + 301)).toEqual({ ok: false, reason: 'stale' })
    expect(await verifyStripeSignature(payload, h, SECRET, NOW + 10_000, 0)).toEqual({ ok: true })
  })

  it('rejects missing or malformed headers and a missing secret', async () => {
    expect(await verifyStripeSignature(payload, null, SECRET, NOW)).toEqual({ ok: false, reason: 'missing' })
    expect(await verifyStripeSignature(payload, await header(payload), '', NOW)).toEqual({ ok: false, reason: 'missing' })
    expect(await verifyStripeSignature(payload, 'garbage', SECRET, NOW)).toEqual({ ok: false, reason: 'malformed' })
    expect(await verifyStripeSignature(payload, 't=12x,v1=aa', SECRET, NOW)).toEqual({ ok: false, reason: 'malformed' })
  })
})

describe('stripeFetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function stub(res: Response) {
    const fn = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => res)
    vi.stubGlobal('fetch', fn)
    return fn
  }

  it('sends GET params in the query string with the bearer key', async () => {
    const fn = stub(Response.json({ id: 'pi_1' }))
    const pi = await stripeFetch<{ id: string }>(env, 'GET', '/v1/payment_intents/pi_1', { params: { expand: ['latest_charge'] } })
    expect(pi.id).toBe('pi_1')
    const [url, init] = fn.mock.calls[0]
    expect(url).toBe('https://api.stripe.com/v1/payment_intents/pi_1?expand[0]=latest_charge')
    expect(init?.method).toBe('GET')
    expect(init?.body).toBeUndefined()
    expect((init?.headers as Record<string, string>).Authorization).toBe(`Bearer ${env.STRIPE_SECRET_KEY}`)
    expect((init?.headers as Record<string, string>)['Stripe-Version']).toBe(STRIPE_API_VERSION)
  })

  it('sends POST params as a form body with an Idempotency-Key', async () => {
    const fn = stub(Response.json({ id: 're_1', amount: 3900 }))
    await stripeFetch(env, 'POST', '/v1/refunds', { params: { payment_intent: 'pi_1' }, idempotencyKey: 'self-cs_1' })
    const [url, init] = fn.mock.calls[0]
    expect(url).toBe('https://api.stripe.com/v1/refunds')
    expect(init?.body).toBe('payment_intent=pi_1')
    expect(init?.headers).toMatchObject({
      'Content-Type': 'application/x-www-form-urlencoded',
      'Idempotency-Key': 'self-cs_1',
      'Stripe-Version': STRIPE_API_VERSION,
    })
  })

  it("throws a StripeError with status, type and code but without Stripe's message", async () => {
    stub(Response.json({ error: { type: 'invalid_request_error', code: 'email_invalid', message: 'Invalid email: a@b.test' } }, { status: 400 }))
    const err = await stripeFetch(env, 'POST', '/v1/checkout/sessions').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(StripeError)
    expect(err).toMatchObject({ status: 400, type: 'invalid_request_error', code: 'email_invalid' })
    expect(describeError(err)).toBe('Stripe request failed (400, invalid_request_error, email_invalid)')
    expect(describeError(err)).not.toContain('@')
  })

  it('handles error responses that are not JSON', async () => {
    stub(new Response('bad gateway', { status: 502 }))
    const err = await stripeFetch(env, 'GET', '/v1/refunds').catch((e: unknown) => e)
    expect(err).toMatchObject({ status: 502, type: null, code: null })
  })
})

describe('helpers', () => {
  it('idOf reads expandable references', () => {
    expect(idOf('ch_1')).toBe('ch_1')
    expect(idOf({ id: 'ch_2' })).toBe('ch_2')
    expect(idOf(null)).toBeNull()
    expect(idOf(undefined)).toBeNull()
  })

  it('receiptUrlOf keeps only absolute https links within the spec length', () => {
    const ok = 'https://pay.stripe.com/receipts/payment/CAcaFwoVYWNjdF90ZXN0?s=ap'
    expect(receiptUrlOf({ receipt_url: ok })).toBe(ok)
    const longest = `https://pay.stripe.com/${'x'.repeat(MAX_RECEIPT_URL_LENGTH - 'https://pay.stripe.com/'.length)}`
    expect(receiptUrlOf({ receipt_url: longest })).toBe(longest)
    expect(MAX_RECEIPT_URL_LENGTH).toBe(5000)
    for (const bad of [
      undefined,
      null,
      '',
      `${longest}x`,
      'http://pay.stripe.com/receipts/payment/x',
      'javascript:alert(1)',
      'data:text/html,hi',
      '//pay.stripe.com/receipts',
      '/receipts/payment/x',
      'https://user:pw@pay.stripe.com/receipts',
      'https://',
      42 as unknown as string,
    ]) {
      expect(receiptUrlOf({ receipt_url: bad }), String(bad).slice(0, 40)).toBeNull()
    }
  })

  it('describeError never throws on non-errors', () => {
    expect(describeError('x')).toBe('unknown error')
  })
})
