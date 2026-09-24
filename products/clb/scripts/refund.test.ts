// Tests for scripts/refund.ts ("Refund unused days", .github/workflows/refund.yml). Stripe is a mocked fetch:
// nothing reaches the network. Also checks the workflow file and the owner guide's section 9-8 against the script.
import { describe, expect, it, vi } from 'vitest'
import refundYml from '../../../.github/workflows/refund.yml?raw'
import guide from '../../../business/online/owner-setup.md?raw'
import { SKUS } from '../shared/config'
import { STRIPE_API_VERSION, type Refund } from '../worker/src/billing/stripe'
import { END_PASS_METADATA_KEY } from '../worker/src/billing/webhook'
import {
  NEXT_STEP_KO,
  REFUND_WORKFLOW_NAME,
  TITLES,
  assess,
  cadToCents,
  isLiveEndPassRefund,
  keyModeOf,
  parseInputs,
  paymentFacts,
  proRata,
  proRataCents,
  redact,
  runRefund,
  type Outcome,
  type StripePaymentIntent,
} from './refund'

// Fake keys, assembled at run time so the literal never looks like a real key to secret scanners (GitHub push protection).
const KEY = ['rk', 'live', 'FAKE0000000000000000000000'].join('_')
const TEST_KEY = ['sk', 'test', 'FAKE0000000000000000000000'].join('_')
const PI = 'pi_3PqRsTuVwXyZ0123'
const CHARGE = 'ch_3PqRsTuVwXyZ0123'

// What Stripe sends back includes the buyer's details; none of it may reach the output.
const BUYER = { email: 'jane.buyer@example.com', name: 'Jane Q Buyer', line1: '77 Hidden Lane', postal: 'M5V 3L9', last4: '4242', fingerprint: 'fpAbC123xYz789' }

function charge(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: CHARGE,
    object: 'charge',
    amount: 3900,
    amount_refunded: 0,
    currency: 'cad',
    disputed: false,
    refunded: false,
    receipt_email: BUYER.email,
    billing_details: { email: BUYER.email, name: BUYER.name, address: { line1: BUYER.line1, postal_code: BUYER.postal, city: 'Toronto', state: 'ON', country: 'CA' } },
    payment_method_details: { type: 'card', card: { last4: BUYER.last4, brand: 'visa', country: 'CA', fingerprint: BUYER.fingerprint } },
    ...over,
  }
}

function paymentIntent(over: Record<string, unknown> = {}, chargeOver: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: PI,
    object: 'payment_intent',
    amount: 3900,
    currency: 'cad',
    status: 'succeeded',
    receipt_email: BUYER.email,
    metadata: { user_id: 'usr_internal_1', sku: 'pass30', terms_version: '2026-09-24' },
    latest_charge: charge(chargeOver),
    ...over,
  }
}

const refundObj = (over: Partial<Refund> & Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 're_1AAA',
  object: 'refund',
  amount: 1560,
  currency: 'cad',
  status: 'succeeded',
  charge: CHARGE,
  payment_intent: PI,
  metadata: {},
  ...over,
})

interface Call {
  method: string
  url: string
  headers: Record<string, string>
  body: string | null
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

/** A fake Stripe: the PaymentIntent, one page of refunds and the POST /v1/refunds answer. */
function fakeStripe(
  opts: {
    pi?: Record<string, unknown>
    piError?: { status: number; body: unknown }
    refunds?: Record<string, unknown>[]
    hasMore?: boolean
    post?: { status: number; body: unknown }
    postThrows?: boolean
  } = {},
) {
  const calls: Call[] = []
  const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? 'GET'
    calls.push({ method, url, headers: { ...((init?.headers ?? {}) as Record<string, string>) }, body: typeof init?.body === 'string' ? init.body : null })
    if (method === 'GET' && url.startsWith('https://api.stripe.com/v1/payment_intents/')) {
      return opts.piError ? json(opts.piError.body, opts.piError.status) : json(opts.pi ?? paymentIntent())
    }
    if (method === 'GET' && url.startsWith('https://api.stripe.com/v1/refunds?')) {
      return json({ object: 'list', data: opts.refunds ?? [], has_more: opts.hasMore ?? false })
    }
    if (method === 'POST' && url === 'https://api.stripe.com/v1/refunds') {
      if (opts.postThrows) throw new TypeError('fetch failed')
      const p = opts.post ?? { status: 200, body: refundObj({ metadata: { end_pass: 'true' } }) }
      return json(p.body, p.status)
    }
    return json({ error: { message: 'unexpected request', type: 'invalid_request_error' } }, 404)
  })
  return { fetchImpl: fetchImpl as unknown as typeof fetch, calls }
}

const env = (over: Record<string, string | undefined> = {}) => ({ STRIPE_SECRET_KEY: KEY, PAYMENT_INTENT: PI, AMOUNT_CAD: '15.60', MODE: 'preview', ...over })

/** Everything the run shows: summary and log lines. */
const shown = (o: Outcome) => `${o.summary}\n${o.log.join('\n')}`

describe('cadToCents', () => {
  it('converts dollars to integer cents without float error', () => {
    expect(cadToCents('15.6')).toBe(1560)
    expect(cadToCents('15.60')).toBe(1560)
    expect(cadToCents('0.01')).toBe(1)
    expect(cadToCents('39')).toBe(3900)
    expect(cadToCents('0.29')).toBe(29) // 0.29 * 100 is 28.999999999999996 in floating point
    expect(cadToCents('9999.99')).toBe(999999)
  })

  it('refuses zero, signs, symbols, commas, exponents, spaces and more than two decimals', () => {
    for (const bad of ['0', '0.0', '0.00', '-1', '+1', 'C$15.60', '$15.60', '15,60', '1,560', '1e3', '15.605', '.5', '5.', '10000', '', ' 15.60', '15.60 ', 'NaN', 'Infinity']) {
      expect(cadToCents(bad), bad).toBeNull()
    }
  })
})

describe('parseInputs', () => {
  it('accepts a pi_ id, an amount and a mode (surrounding spaces from a copy-paste are dropped)', () => {
    expect(parseInputs({ paymentIntent: ` ${PI}\n`, amountCad: ' 15.6 ', mode: 'refund' })).toEqual({ ok: true, inputs: { paymentIntent: PI, cents: 1560, mode: 'refund' } })
  })

  it('refuses other ids, bad amounts and unknown modes, naming each input', () => {
    for (const id of [CHARGE, 'py_3PqRsTuVwXyZ0123', 'pi_short', 'pi_3PqRsTu VwXyZ', 'pi_3PqRsTuVwXyZ0123_secret_abc', BUYER.email, '', `pi_${'a'.repeat(65)}`]) {
      const r = parseInputs({ paymentIntent: id, amountCad: '15.60', mode: 'preview' })
      expect(r.ok, id).toBe(false)
      if (!r.ok) expect(r.errors.map((e) => e.en).join(' ')).toContain('payment_intent')
    }
    const r = parseInputs({ paymentIntent: PI, amountCad: 'C$15.60', mode: 'Refund' })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errors).toHaveLength(2)
      expect(r.errors[0].en).toContain('amount_cad')
      expect(r.errors[1].en).toContain('mode')
    }
  })
})

describe('keyModeOf and redact', () => {
  it('accepts sk_/rk_ live and test keys and reports their mode; refuses anything else', () => {
    expect(keyModeOf(KEY)).toBe('live')
    expect(keyModeOf('sk_live_abc123')).toBe('live')
    expect(keyModeOf(TEST_KEY)).toBe('test')
    expect(keyModeOf('rk_test_abc123')).toBe('test')
    for (const bad of ['pk_live_abc123', 'whsec_abc123', 'sk_abc123', 'sk_live_', 'sk_live_abc 123', 'sk-ant-abc123', 'rk_prod_abc123']) expect(keyModeOf(bad), bad).toBeNull()
  })

  it('removes the key, key-shaped text (Stripe also masks keys as sk_live_****abcd) and email addresses', () => {
    const text = `Invalid API Key provided: sk_live_********************WXyz; key ${KEY}; ${TEST_KEY}; contact ${BUYER.email}; task_id stays`
    const out = redact(text, [KEY])
    expect(out).not.toMatch(/\b(?:sk|rk)_(?:live|test)_/)
    expect(out).not.toContain(KEY)
    expect(out).not.toContain('WXyz')
    expect(out).not.toContain(BUYER.email)
    expect(out).toContain('task_id stays')
  })
})

describe('assess', () => {
  const facts = (pi: Record<string, unknown>) => paymentFacts(pi as unknown as StripePaymentIntent)
  const list = (data: Record<string, unknown>[], has_more = false) => ({ data: data as unknown as Refund[], has_more })

  it('keeps only ids, amounts, statuses and the sku', () => {
    const f = facts(paymentIntent({}, { amount_refunded: 500 }))
    expect(f).toEqual({
      paymentIntent: PI,
      status: 'succeeded',
      currency: 'cad',
      sku: 'pass30',
      chargeId: CHARGE,
      amountPaid: 3900,
      amountRefunded: 500,
      disputed: false,
      fullyRefunded: false,
    })
    expect(facts(paymentIntent({ metadata: { sku: 'pass999' } })).sku).toBeNull()
    expect(facts(paymentIntent({ metadata: null })).sku).toBeNull()
  })

  it('refundable = charge amount − amount already refunded; the requested amount may equal it', () => {
    const a = assess(facts(paymentIntent({}, { amount_refunded: 1000 })), list([]), 2900)
    expect(a.refundable).toBe(2900)
    expect(a.problems).toEqual([])
  })

  it('refuses more than what is left to refund', () => {
    const a = assess(facts(paymentIntent({}, { amount_refunded: 3000 })), list([]), 1560)
    expect(a.refundable).toBe(900)
    expect(a.problems.map((p) => p.en)).toEqual(['The requested C$15.60 is more than the C$9.00 that can still be refunded.'])
  })

  it('refuses a payment that is not CAD, not succeeded, has no charge, or is disputed', () => {
    expect(assess(facts(paymentIntent({ currency: 'usd' })), list([]), 1560).problems.map((p) => p.en)).toEqual(['Not a CAD payment (currency `usd`).'])
    expect(assess(facts(paymentIntent({ status: 'processing' })), list([]), 1560).problems[0].en).toContain('has not succeeded')
    expect(assess(facts(paymentIntent({ latest_charge: null })), null, 1560).problems[0].en).toContain('no charge')
    expect(assess(facts(paymentIntent({ latest_charge: CHARGE })), null, 1560).problems[0].en).toContain('no charge')
    expect(assess(facts(paymentIntent({}, { disputed: true })), list([]), 1560).problems.map((p) => p.en).join(' ')).toContain('disputed')
  })

  it('refuses when a live end_pass refund exists (the pass has already ended), with the webhook’s test', () => {
    for (const r of [refundObj({ metadata: { end_pass: 'true' } }), refundObj({ status: 'pending', metadata: { end_pass: ' TRUE ' } })]) {
      const a = assess(facts(paymentIntent({}, { amount_refunded: 1560 })), list([r]), 1000)
      expect(a.endedBy.map((x) => x.id)).toEqual(['re_1AAA'])
      expect(a.problems.map((p) => p.en)).toEqual(['A live end_pass refund (`re_1AAA`) already exists: the pass has already ended.'])
      expect(a.problems[0].ko).toContain('이용권은 이미 끝났어요')
    }
    // failed or canceled end_pass refunds, and refunds without it, do not end the pass
    const other = [refundObj({ status: 'failed', metadata: { end_pass: 'true' } }), refundObj({ id: 're_2', status: 'canceled', metadata: { end_pass: 'true' } }), refundObj({ id: 're_3', metadata: { end_pass: 'false' } }), refundObj({ id: 're_4', metadata: null })]
    expect(other.map((r) => isLiveEndPassRefund(r as unknown as Refund))).toEqual([false, false, false, false])
    expect(assess(facts(paymentIntent({}, { amount_refunded: 500 })), list(other), 1000).problems).toEqual([])
  })

  it('refuses a fully refunded payment, and a refund list it cannot read to the end', () => {
    expect(assess(facts(paymentIntent({}, { amount_refunded: 3900, refunded: true })), list([]), 100).problems[0].en).toContain('already fully refunded')
    expect(assess(facts(paymentIntent()), list([], true), 100).problems[0].en).toContain('more than 100 refunds')
  })
})

describe('proRata', () => {
  it('computes amount paid × days left ÷ pass days (the guide’s example: 39 × 12 ÷ 30 = C$15.60)', () => {
    expect(proRataCents(SKUS.pass30.priceCents, 12, SKUS.pass30.days)).toBe(1560)
    expect(proRataCents(SKUS.pass90.priceCents, 45, SKUS.pass90.days)).toBe(3950)
    expect(proRataCents(SKUS.pass90.priceCents, 1, SKUS.pass90.days)).toBe(88)
    const p = proRata('pass30', 3900, 1560)
    expect(p?.passDays).toBe(30)
    expect(p?.requestedDays).toBe(12)
    expect(p?.rows.map((r) => r.daysLeft)).toEqual([1, 5, 10, 15, 20, 25, 29])
    expect(proRata('pass90', 7900, 3950)?.rows.map((r) => r.daysLeft)).toEqual([1, 15, 30, 45, 60, 75, 89])
  })

  it('is skipped when the sku (so the pass length) is unknown', () => {
    expect(proRata(null, 3900, 1560)).toBeNull()
  })
})

describe('runRefund: preview', () => {
  it('reads the PaymentIntent and its refunds with the pinned Stripe-Version and makes no POST', async () => {
    const s = fakeStripe()
    const o = await runRefund({ env: env(), fetchImpl: s.fetchImpl })
    expect(o.code).toBe(0)
    expect(s.calls.map((c) => c.method)).toEqual(['GET', 'GET'])
    expect(s.calls.some((c) => c.method === 'POST')).toBe(false)
    const [piCall, refundsCall] = s.calls
    expect(piCall.url).toBe(`https://api.stripe.com/v1/payment_intents/${PI}?expand[0]=latest_charge`)
    expect(refundsCall.url).toBe(`https://api.stripe.com/v1/refunds?charge=${CHARGE}&limit=100`)
    for (const c of s.calls) {
      expect(c.headers['Stripe-Version']).toBe(STRIPE_API_VERSION)
      expect(c.headers.Authorization).toBe(`Bearer ${KEY}`)
      expect(c.headers['Idempotency-Key']).toBeUndefined()
    }
  })

  it('writes the bilingual summary: key mode, ids, amounts, what will happen and the exact next step', async () => {
    const o = await runRefund({ env: env(), fetchImpl: fakeStripe({ pi: paymentIntent({}, { amount_refunded: 500 }) }).fetchImpl })
    const s = o.summary
    expect(s).toContain(`## ${REFUND_WORKFLOW_NAME}: ${TITLES.preview.ko} (${TITLES.preview.en})`)
    expect(s).toContain('아직 아무것도 환불하지 않았어요')
    expect(s).toContain('| 키 모드 / Key mode | **live (실사용)**')
    expect(s).toContain(`| 결제 ID / Payment | \`${PI}\` |`)
    expect(s).toContain('| 이용권 / Pass | 30일 이용권 (`pass30`) |')
    expect(s).toContain('| 결제한 금액 / Amount paid | C$39.00 |')
    expect(s).toContain('| 이미 환불된 금액 / Already refunded | C$5.00 |')
    expect(s).toContain('| 환불할 수 있는 최대 금액 / Refundable | C$34.00 |')
    expect(s).toContain('| 요청 금액 / Requested | **C$15.60** |')
    expect(s).toContain('이용권이 끝나요')
    expect(s).toContain(NEXT_STEP_KO)
    expect(NEXT_STEP_KO).toBe('같은 값으로 mode를 refund로 바꿔 다시 실행하세요.')
    // the pro-rated table, with the rows above the refundable amount marked
    expect(s).toContain('남은 약 **12일**')
    expect(s).toContain('| 10 | 39 × 10 ÷ 30 | C$13.00 |')
    expect(s).toContain('| 29 | 39 × 29 ÷ 30 | C$37.70 (최대 금액보다 커요 / above the refundable amount) |')
    expect(s).toContain('Max refundable: **C$34.00**')
  })

  it('reports a test key as test mode, and leaves the pro-rated table out without a sku', async () => {
    const o = await runRefund({ env: env({ STRIPE_SECRET_KEY: TEST_KEY }), fetchImpl: fakeStripe({ pi: paymentIntent({ metadata: {} }) }).fetchImpl })
    expect(o.code).toBe(0)
    expect(o.summary).toContain('**test (시험)**')
    expect(o.summary).toContain('알 수 없음')
    expect(o.summary).not.toContain('남은 날짜 계산')
  })
})

describe('runRefund: refund', () => {
  it('POSTs /v1/refunds with the amount in cents, end_pass metadata, the reason and a stable idempotency key', async () => {
    const s = fakeStripe()
    const o = await runRefund({ env: env({ MODE: 'refund', AMOUNT_CAD: '15.6' }), fetchImpl: s.fetchImpl })
    expect(o.code).toBe(0)
    expect(s.calls.map((c) => c.method)).toEqual(['GET', 'GET', 'POST'])
    const post = s.calls[2]
    expect(post.url).toBe('https://api.stripe.com/v1/refunds')
    expect(post.headers['Stripe-Version']).toBe(STRIPE_API_VERSION)
    expect(post.headers['Idempotency-Key']).toBe(`mpc-refund-${PI}-1560`)
    expect(post.headers['Content-Type']).toBe('application/x-www-form-urlencoded')
    expect(post.headers.Authorization).toBe(`Bearer ${KEY}`)
    const body = new URLSearchParams(post.body ?? '')
    expect(Object.fromEntries(body)).toEqual({
      payment_intent: PI,
      amount: '1560',
      reason: 'requested_by_customer',
      [`metadata[${END_PASS_METADATA_KEY}]`]: 'true',
    })
    expect(END_PASS_METADATA_KEY).toBe('end_pass')
    expect(o.summary).toContain(`## ${REFUND_WORKFLOW_NAME}: ${TITLES.refunded.ko}`)
    expect(o.summary).toContain('| 환불 ID / Refund | `re_1AAA` |')
    expect(o.summary).toContain('| 상태 / Status | `succeeded` |')
    expect(o.summary).toContain('이용권이 끝나요')
  })

  it('the same inputs always give the same idempotency key (a double click never refunds twice)', async () => {
    const a = fakeStripe()
    const b = fakeStripe()
    await runRefund({ env: env({ MODE: 'refund', AMOUNT_CAD: '15.60' }), fetchImpl: a.fetchImpl })
    await runRefund({ env: env({ MODE: 'refund', AMOUNT_CAD: '15.6', PAYMENT_INTENT: ` ${PI} ` }), fetchImpl: b.fetchImpl })
    expect(a.calls[2].headers['Idempotency-Key']).toBe(b.calls[2].headers['Idempotency-Key'])
  })

  it('treats a pending refund as done and a failed one as an error', async () => {
    const pending = await runRefund({ env: env({ MODE: 'refund' }), fetchImpl: fakeStripe({ post: { status: 200, body: refundObj({ status: 'pending' }) } }).fetchImpl })
    expect(pending.code).toBe(0)
    expect(pending.summary).toContain('`pending`')
    const failed = await runRefund({ env: env({ MODE: 'refund' }), fetchImpl: fakeStripe({ post: { status: 200, body: refundObj({ status: 'failed' }) } }).fetchImpl })
    expect(failed.code).toBe(1)
    expect(failed.summary).toContain(TITLES.failed.ko)
  })

  it('exits non-zero with Stripe’s error message, with the key and any email removed', async () => {
    const message = `Refund amount (C$15.60) is greater than unrefunded amount on charge. Key ${KEY} used by ${BUYER.email}.`
    const s = fakeStripe({ post: { status: 400, body: { error: { type: 'invalid_request_error', code: 'amount_too_large', message } } } })
    const o = await runRefund({ env: env({ MODE: 'refund' }), fetchImpl: s.fetchImpl })
    expect(o.code).toBe(1)
    expect(o.summary).toContain(TITLES.stripeError.ko)
    expect(o.summary).toContain('HTTP 400 (invalid_request_error, amount_too_large): Refund amount (C$15.60) is greater than unrefunded amount on charge.')
    expect(o.summary).toContain('같은 값으로 다시 실행')
    expect(shown(o)).not.toContain(KEY)
    expect(shown(o)).not.toContain(BUYER.email)
  })

  it('a network failure on the POST is an error that tells the owner a rerun is safe', async () => {
    const o = await runRefund({ env: env({ MODE: 'refund' }), fetchImpl: fakeStripe({ postThrows: true }).fetchImpl })
    expect(o.code).toBe(1)
    expect(o.summary).toContain('could not reach Stripe')
    expect(o.summary).toContain('두 번 환불되지 않아요')
  })
})

describe('runRefund: refusals make no POST', () => {
  const refused = async (fake: ReturnType<typeof fakeStripe>, over: Record<string, string> = {}) => {
    const o = await runRefund({ env: env({ MODE: 'refund', ...over }), fetchImpl: fake.fetchImpl })
    expect(o.code).toBe(1)
    expect(fake.calls.some((c) => c.method === 'POST')).toBe(false)
    expect(o.summary).toContain(`## ${REFUND_WORKFLOW_NAME}: ${TITLES.stopped.ko}`)
    expect(o.summary).toContain('아무것도 환불하지 않았어요')
    return o
  }

  it('over-refund', async () => {
    const o = await refused(fakeStripe(), { AMOUNT_CAD: '39.01' })
    expect(o.log.join('\n')).toContain('::error::refund: The requested C$39.01 is more than the C$39.00')
  })

  it('non-CAD payment', async () => {
    await refused(fakeStripe({ pi: paymentIntent({ currency: 'usd' }) }))
  })

  it('pass already ended by an end_pass refund', async () => {
    const o = await refused(fakeStripe({ pi: paymentIntent({}, { amount_refunded: 1560 }), refunds: [refundObj({ metadata: { end_pass: 'true' } })] }))
    expect(o.summary).toContain('이용권은 이미 끝났어요')
    // preview says the same
    const p = await runRefund({ env: env(), fetchImpl: fakeStripe({ pi: paymentIntent({}, { amount_refunded: 1560 }), refunds: [refundObj({ metadata: { end_pass: 'true' } })] }).fetchImpl })
    expect(p.code).toBe(1)
    expect(p.summary).toContain('이용권은 이미 끝났어요')
  })

  it('a payment Stripe cannot find (e.g. a test payment with a live key)', async () => {
    const s = fakeStripe({
      piError: { status: 404, body: { error: { type: 'invalid_request_error', code: 'resource_missing', message: `No such payment_intent: '${PI}'` } } },
    })
    const o = await runRefund({ env: env({ MODE: 'refund' }), fetchImpl: s.fetchImpl })
    expect(o.code).toBe(1)
    expect(s.calls.map((c) => c.method)).toEqual(['GET'])
    expect(o.summary).toContain(`No such payment_intent: '${PI}'`)
  })
})

describe('runRefund: missing secret, bad key, bad inputs', () => {
  it('without STRIPE_SECRET_KEY it calls nothing and says what is missing', async () => {
    const s = fakeStripe()
    for (const key of [undefined, '', '  ']) {
      const o = await runRefund({ env: env({ STRIPE_SECRET_KEY: key }), fetchImpl: s.fetchImpl })
      expect(o.code).toBe(2)
      expect(o.summary).toContain(TITLES.noKey.ko)
      expect(o.summary).toContain('STRIPE_SECRET_KEY')
    }
    expect(s.calls).toEqual([])
  })

  it('a key that is not a Stripe secret or restricted key is refused without printing it', async () => {
    const s = fakeStripe()
    for (const key of ['pk_live_51AbCdEfGh', 'whsec_51AbCdEfGh', 'not a key']) {
      const o = await runRefund({ env: env({ STRIPE_SECRET_KEY: key }), fetchImpl: s.fetchImpl })
      expect(o.code).toBe(2)
      expect(shown(o)).not.toContain(key)
      expect(o.summary).toContain('`sk_` 또는 `rk_`')
    }
    expect(s.calls).toEqual([])
  })

  it('bad inputs call nothing', async () => {
    const s = fakeStripe()
    const o = await runRefund({ env: env({ AMOUNT_CAD: '15,60', PAYMENT_INTENT: CHARGE, MODE: 'go' }), fetchImpl: s.fetchImpl })
    expect(o.code).toBe(2)
    expect(o.summary).toContain(TITLES.input.ko)
    expect(o.log).toHaveLength(3)
    expect(s.calls).toEqual([])
  })
})

describe('runRefund: output never carries the key or the buyer’s details', () => {
  it('in every outcome', async () => {
    const leaky = { error: { type: 'api_error', message: `Invalid API Key provided: ${KEY.slice(0, 8)}****${KEY.slice(-4)} (${BUYER.email})` } }
    const runs: Outcome[] = [
      await runRefund({ env: env(), fetchImpl: fakeStripe().fetchImpl }),
      await runRefund({ env: env({ MODE: 'refund' }), fetchImpl: fakeStripe().fetchImpl }),
      await runRefund({ env: env({ MODE: 'refund' }), fetchImpl: fakeStripe({ post: { status: 401, body: leaky } }).fetchImpl }),
      await runRefund({ env: env(), fetchImpl: fakeStripe({ piError: { status: 401, body: leaky } }).fetchImpl }),
      await runRefund({ env: env({ AMOUNT_CAD: '99' }), fetchImpl: fakeStripe().fetchImpl }),
      await runRefund({ env: env({ STRIPE_SECRET_KEY: TEST_KEY, MODE: 'refund' }), fetchImpl: fakeStripe().fetchImpl }),
    ]
    expect(runs.map((o) => o.code)).toEqual([0, 0, 1, 1, 1, 0])
    for (const o of runs) {
      const text = shown(o)
      expect(text).not.toContain(KEY)
      expect(text).not.toContain(TEST_KEY)
      expect(text).not.toMatch(/\b(?:sk|rk)_(?:live|test)_/)
      expect(text).not.toContain(KEY.slice(-4))
      for (const v of Object.values(BUYER)) expect(text, v).not.toContain(v)
      expect(text).not.toContain('usr_internal_1')
      expect(text).not.toContain('@')
    }
  })
})

describe('refund.yml and the owner guide (section 9-8) follow the script', () => {
  const lines = refundYml.split('\n')

  it('is the manual workflow "Refund unused days" with the three inputs, preview by default', () => {
    expect(/^name: (.+)$/m.exec(refundYml)?.[1]).toBe(REFUND_WORKFLOW_NAME)
    const on = refundYml.slice(refundYml.indexOf('\non:'), refundYml.indexOf('\npermissions:'))
    expect(on).toContain('workflow_dispatch:')
    expect(on).not.toMatch(/\n {2}(push|pull_request|schedule|workflow_run|repository_dispatch):/)
    const inputs = [...on.matchAll(/^ {6}([a-z_]+):\s*$/gm)].map((m) => m[1])
    expect(inputs).toEqual(['payment_intent', 'amount_cad', 'mode'])
    expect(on).toMatch(/mode:[\s\S]*type: choice[\s\S]*default: preview[\s\S]*- preview\n\s+- refund/)
    expect(refundYml).toMatch(/permissions:\n {2}contents: read\n\n/)
    expect(refundYml).toMatch(/concurrency:\n {2}group: refund\n {2}cancel-in-progress: false/)
    expect(refundYml).toContain('run: node scripts/run.mjs scripts/refund.ts')
  })

  it('passes inputs through env only, and gives the Stripe key only to the steps that need it (not npm ci)', () => {
    for (const l of lines.filter((x) => x.includes('inputs.'))) expect(l, l).toMatch(/^\s*(?:[A-Z_]+|run-name): .*\$\{\{ inputs\.[a-z_]+ \}\}/)
    const keyLines = lines.map((l, i) => [l, i] as const).filter(([l]) => l.includes('secrets.STRIPE_SECRET_KEY'))
    expect(keyLines).toHaveLength(2)
    for (const [, i] of keyLines) expect(lines[i - 1].trim()).toBe('env:')
    expect(refundYml).toMatch(/- name: Install\n\s+if: [^\n]+\n\s+run: npm ci\n/)
    expect(refundYml).toContain('persist-credentials: false')
  })

  it('the guide tells the owner to run it with these inputs, preview first', () => {
    // bold markers dropped: the guide writes quoted labels as "**Label**" (see owner-setup.test.ts)
    const start = guide.indexOf('### 9-8.')
    const section = guide.slice(start, guide.indexOf('\n### ', start + 1)).replace(/\*\*/g, '')
    expect(section).toContain(`"${REFUND_WORKFLOW_NAME}"`)
    for (const name of ['payment_intent', 'amount_cad', 'mode', 'preview', 'refund', 'master', 'STRIPE_SECRET_KEY']) expect(section, name).toContain(`\`${name}\``)
    expect(section).toContain('`mode`: `preview`')
    expect(section.indexOf('`mode`: `preview`')).toBeLessThan(section.indexOf('`mode`만 `refund`'))
    // the summary titles it tells the owner to look for are the script's
    expect(section).toContain(`"${REFUND_WORKFLOW_NAME}: ${TITLES.preview.ko} (${TITLES.preview.en})"`)
    for (const t of [TITLES.refunded, TITLES.stopped]) expect(section, t.ko).toContain(`"${t.ko}"`)
    expect(section).toContain('"이용권이 끝나요"')
  })
})
