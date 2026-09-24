// Pro-rated refund of a pass's unused days that also ends the pass (the Terms promise, in some cases, "a pro-rated
// refund of the unused days, and the pass ends"). Run by .github/workflows/refund.yml ("Refund unused days"), which
// the owner starts from the Actions tab (steps: business/online/owner-setup.md section 9-8):
//
//   STRIPE_SECRET_KEY=… PAYMENT_INTENT=pi_… AMOUNT_CAD=15.60 MODE=preview|refund node scripts/run.mjs scripts/refund.ts
//
// Why a script: the Worker ends a pass on a partial refund only when the refund carries metadata end_pass=true
// (worker/src/billing/webhook.ts END_PASS_METADATA_KEY), and whether the Stripe Dashboard's refund dialog takes
// metadata is unverified. A full refund from the Dashboard ends the pass without it.
//
// Both modes first read, and write nothing: GET /v1/payment_intents/{id} with expand[0]=latest_charge, then
// GET /v1/refunds?charge=…&limit=100. They refuse a payment that is not a succeeded CAD payment, a disputed charge,
// an amount above what is left to refund (charge.amount − charge.amount_refunded), and a charge that already has a
// live (not failed or canceled) end_pass refund: that pass has already ended (the same test as the webhook's
// refundEndsPass). `preview` stops there and writes the job summary. `refund` then POSTs /v1/refunds with
// payment_intent, amount (cents), reason=requested_by_customer and metadata[end_pass]=true, with the Idempotency-Key
// mpc-refund-<payment_intent>-<cents>, so a second run with the same values never refunds twice. The Worker's
// charge.refunded webhook then ends the pass.
//
// Replays: Stripe keeps the first answer to an Idempotency-Key for at least 24 hours and sends it again, errors
// included, marked with the response header Idempotent-Replayed: true [unverified: the header is in Stripe's
// idempotency docs, not in the OpenAPI spec]. So a rerun after a refund that later failed would get back the old
// refund with its old status (e.g. pending). A POST answer is treated as a replay when that header is true or when
// the refund's id is already in the list read before the POST; the summary then says nothing new was refunded and
// shows the refund's current status (from that list, or GET /v1/refunds/{id}), exit 1 when it failed or was canceled.
//
// Days left are counted from the pass's end date, not the payment date: a second purchase is queued behind the
// buyer's current pass (worker/src/billing/entitlement.ts grantPass), and a pause of the AI feedback (credits used up,
// worker/src/cron.ts) moves end dates later.
// The script cannot see the passes (no database access), so the preview shows the payment date only as the earliest
// possible start and points the owner to the D1 query in guide section 9-8.
//
// Requests follow worker/src/billing/stripe.ts: same host, same form encoding (formEncode), Stripe-Version pinned to
// STRIPE_API_VERSION. Parameter and field names (payment_intent status/currency/metadata/latest_charge; charge
// amount/amount_refunded/disputed/refunded; refund status/metadata; POST /v1/refunds payment_intent/amount/reason/
// metadata; GET /v1/refunds charge/limit ≤ 100; error.message/type/code) were checked against stripe/openapi
// spec3.json 2026-09-30.endive, the version after the pin [unverified: identical in 2026-08-26.dahlia; they are
// long-standing fields and the Worker reads the same ones].
//
// The pass length comes from the PaymentIntent's metadata.sku, which checkout.ts sets (payment_intent_data.metadata)
// and shared/config.ts SKUS describes; without a known sku the pro-rated table is left out.
//
// Output: ids, amounts, statuses, the sku and the payment date only. Nothing about the buyer (email, name, card,
// address) is kept from Stripe's responses, and the key never appears: every line is passed through redact(), which
// also removes anything shaped like a Stripe key or an email address from Stripe's error messages.
// Exit codes: 0 preview shown or refund created; 1 refused, Stripe error or failed refund; 2 missing key or bad input.
import { SKUS, type Sku } from '../shared/config'
import { formatCad } from '../worker/src/billing/messages'
import { type Charge, type FormParams, type PaymentIntent, type Refund, type StripeList, STRIPE_API, STRIPE_API_VERSION, formEncode } from '../worker/src/billing/stripe'
import { END_PASS_METADATA_KEY } from '../worker/src/billing/webhook'
import { stripeKeyMode, type StripeMode } from './reconcile-core'

/** The workflow's `name:` in .github/workflows/refund.yml (the owner clicks it in the Actions tab). */
export const REFUND_WORKFLOW_NAME = 'Refund unused days'

export const MODES = ['preview', 'refund'] as const
export type Mode = (typeof MODES)[number]

export const PAYMENT_INTENT_RE = /^pi_[A-Za-z0-9]{8,64}$/
export const AMOUNT_CAD_RE = /^\d{1,4}(\.\d{1,2})?$/

/** The line the preview summary ends with: what the owner does next. */
export const NEXT_STEP_KO = '같은 값으로 mode를 refund로 바꿔 다시 실행하세요.'

/** Summary titles (Korean first, for the owner; the guide quotes the Korean words). */
export const TITLES = {
  preview: { ko: '미리보기', en: 'preview' },
  refunded: { ko: '환불했어요', en: 'refund created' },
  stopped: { ko: '멈췄어요', en: 'stopped' },
  failed: { ko: '환불이 실패했어요', en: 'refund failed' },
  stripeError: { ko: 'Stripe 오류', en: 'Stripe error' },
  input: { ko: '입력값을 확인해 주세요', en: 'check the inputs' },
  noKey: { ko: '시작하지 못했어요', en: 'not started' },
} as const
type Title = (typeof TITLES)[keyof typeof TITLES]

/** A reason in both languages (the summary shows both; the log shows the English). */
export interface Message {
  ko: string
  en: string
}

// ---------- inputs ----------

/**
 * "15.6" → 1560, "0.01" → 1, "39" → 3900: digits and at most two decimals, parsed as text so no float error
 * creeps in. null for anything else (C$, commas, signs, exponents, more than 4 digits of dollars) and for zero.
 */
export function cadToCents(text: string): number | null {
  if (!AMOUNT_CAD_RE.test(text)) return null
  const [dollars, fraction = ''] = text.split('.')
  const cents = Number(dollars) * 100 + Number(fraction.padEnd(2, '0'))
  return cents > 0 ? cents : null
}

export interface RefundInputs {
  paymentIntent: string
  cents: number
  mode: Mode
}

/** Validates the workflow inputs (surrounding spaces from a copy-paste are dropped first). */
export function parseInputs(raw: { paymentIntent?: string; amountCad?: string; mode?: string }): { ok: true; inputs: RefundInputs } | { ok: false; errors: Message[] } {
  const paymentIntent = (raw.paymentIntent ?? '').trim()
  const amount = (raw.amountCad ?? '').trim()
  const mode = (raw.mode ?? '').trim()
  const errors: Message[] = []
  if (!PAYMENT_INTENT_RE.test(paymentIntent)) {
    errors.push({
      ko: '`payment_intent`는 Stripe 결제 화면의 `pi_`로 시작하는 결제 ID예요(`ch_`, `py_`로 시작하는 ID나 이메일이 아니에요).',
      en: '`payment_intent` must be the payment id that starts with `pi_` (not a `ch_`/`py_` id or an email).',
    })
  }
  const cents = cadToCents(amount)
  if (cents === null) {
    errors.push({
      ko: '`amount_cad`는 `15.60`처럼 숫자와 점만 써요(`C$`, 쉼표, 빈칸 없이, 0보다 크게, 소수점 아래 두 자리까지).',
      en: '`amount_cad` must be a positive amount in dollars with digits and a dot only, e.g. `15.60` (no `C$`, no commas).',
    })
  }
  if (!(MODES as readonly string[]).includes(mode)) {
    errors.push({ ko: '`mode`는 `preview` 또는 `refund`만 돼요.', en: '`mode` must be `preview` or `refund`.' })
  }
  if (errors.length || cents === null) return { ok: false, errors }
  return { ok: true, inputs: { paymentIntent, cents, mode: mode as Mode } }
}

/**
 * The key's mode, or null when the value is not shaped like a Stripe secret or restricted key
 * (sk_live_/rk_live_/sk_test_/rk_test_ followed by letters and digits; a publishable key pk_… is refused).
 */
export function keyModeOf(key: string): StripeMode | null {
  return /^(?:sk|rk)_(?:live|test)_[A-Za-z0-9]+$/.test(key) ? stripeKeyMode(key) : null
}

// ---------- redaction ----------

/**
 * Removes the given secrets, anything shaped like a Stripe key (including Stripe's own masked form
 * "sk_live_****abcd") and email addresses. Every summary and log line goes through it.
 */
export function redact(text: string, secrets: readonly string[] = []): string {
  let out = text
  for (const s of secrets) if (s) out = out.split(s).join('[redacted]')
  return out.replace(/\b(?:sk|rk|pk)_[A-Za-z0-9_*]+/g, '[redacted key]').replace(/[^\s@<>()"'`,;:]+@[^\s@<>()"'`,;:]+/g, '[redacted email]')
}

// ---------- Stripe ----------

/** A failed Stripe call. The message is Stripe's own error text (redacted before it is shown). */
export class StripeCallError extends Error {
  constructor(
    readonly status: number | null,
    message: string,
  ) {
    super(message)
    this.name = 'StripeCallError'
  }
}

/**
 * Calls the Stripe REST API the way worker/src/billing/stripe.ts stripeFetch does, keeping Stripe's error text.
 * onHeaders sees the response headers of every answer, errors included (for Idempotent-Replayed).
 */
export async function stripeCall<T>(
  key: string,
  method: 'GET' | 'POST',
  path: string,
  opts: { params?: FormParams; idempotencyKey?: string; onHeaders?: (headers: Headers) => void },
  fetchImpl: typeof fetch,
): Promise<T> {
  const encoded = formEncode(opts.params ?? {})
  const headers: Record<string, string> = { Authorization: `Bearer ${key}`, 'Stripe-Version': STRIPE_API_VERSION }
  if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey
  let url = STRIPE_API + path
  const init: RequestInit = { method, headers }
  if (method === 'GET') {
    if (encoded) url += `?${encoded}`
  } else {
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
    init.body = encoded
  }
  let res: Response
  try {
    res = await fetchImpl(url, init)
  } catch (e) {
    throw new StripeCallError(null, `could not reach Stripe (${e instanceof Error ? e.message : 'network error'})`)
  }
  opts.onHeaders?.(res.headers)
  let data: unknown = null
  try {
    data = (await res.json()) as unknown
  } catch {
    data = null
  }
  if (!res.ok) {
    const err = (data as { error?: { message?: unknown; type?: unknown; code?: unknown } } | null)?.error
    const text = typeof err?.message === 'string' ? err.message : 'no error message'
    const kind = [err?.type, err?.code].filter((v): v is string => typeof v === 'string').join(', ')
    throw new StripeCallError(res.status, `HTTP ${res.status}${kind ? ` (${kind})` : ''}: ${text}`)
  }
  return data as T
}

interface StripeCharge extends Charge {
  amount?: number
  currency?: string | null
}

export interface StripePaymentIntent extends PaymentIntent {
  status?: string | null
  currency?: string | null
  metadata?: Record<string, string> | null
  latest_charge?: string | StripeCharge | null
  /** seconds since the Unix epoch */
  created?: number | null
}

/** What the script keeps from the PaymentIntent and its charge: ids, amounts, statuses, the sku and the date. */
export interface PaymentFacts {
  paymentIntent: string
  status: string | null
  currency: string | null
  sku: Sku | null
  /** the PaymentIntent's creation date, YYYY-MM-DD in UTC (Checkout creates it when the buyer pays) */
  paymentDate: string | null
  chargeId: string | null
  /** cents; the charge's amount (the PaymentIntent's when the charge has none) */
  amountPaid: number
  /** cents refunded so far, partial refunds included */
  amountRefunded: number
  disputed: boolean
  fullyRefunded: boolean
}

const isSku = (v: unknown): v is Sku => typeof v === 'string' && Object.hasOwn(SKUS, v)

/** 1756684800 → "2025-09-01" (UTC); null for anything that is not a positive number of seconds. */
export function utcDate(unixSeconds: unknown): string | null {
  // (8.64e12 s is the largest time a Date can hold; NaN fails both comparisons)
  if (typeof unixSeconds !== 'number' || !(unixSeconds > 0 && unixSeconds < 8.64e12)) return null
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10)
}

export function paymentFacts(pi: StripePaymentIntent): PaymentFacts {
  const charge = pi.latest_charge && typeof pi.latest_charge === 'object' ? pi.latest_charge : null
  const sku = pi.metadata?.sku
  return {
    paymentIntent: pi.id,
    status: typeof pi.status === 'string' ? pi.status : null,
    currency: typeof pi.currency === 'string' ? pi.currency.toLowerCase() : null,
    sku: isSku(sku) ? sku : null,
    paymentDate: utcDate(pi.created),
    chargeId: charge?.id ?? null,
    amountPaid: charge?.amount ?? pi.amount ?? 0,
    amountRefunded: charge?.amount_refunded ?? 0,
    disputed: charge?.disputed === true,
    fullyRefunded: charge?.refunded === true,
  }
}

/** The webhook's test (refundEndsPass): a refund that is not failed or canceled and has metadata end_pass=true. */
export function isLiveEndPassRefund(r: Refund): boolean {
  return r.status !== 'failed' && r.status !== 'canceled' && r.metadata?.[END_PASS_METADATA_KEY]?.trim().toLowerCase() === 'true'
}

export interface Assessment {
  facts: PaymentFacts
  /** cents that can still be refunded: amount paid − already refunded */
  refundable: number
  requested: number
  /** live end_pass refunds already on the charge (the pass has ended) */
  endedBy: { id: string; amount: number; status: string | null }[]
  problems: Message[]
}

export function assess(facts: PaymentFacts, refunds: StripeList<Refund> | null, requested: number): Assessment {
  const refundable = Math.max(0, facts.amountPaid - facts.amountRefunded)
  const endedBy = (refunds?.data ?? []).filter(isLiveEndPassRefund).map((r) => ({ id: r.id, amount: r.amount, status: r.status ?? null }))
  const problems: Message[] = []
  if (facts.status !== 'succeeded') {
    problems.push({
      ko: `완료된 결제가 아니에요(상태: \`${facts.status ?? '알 수 없음'}\`). 완료된(\`succeeded\`) 결제만 환불해요.`,
      en: `The payment has not succeeded (status \`${facts.status ?? 'unknown'}\`).`,
    })
  }
  if (facts.currency !== 'cad') {
    problems.push({
      ko: `캐나다 달러(CAD) 결제가 아니에요(통화: \`${facts.currency ?? '알 수 없음'}\`).`,
      en: `Not a CAD payment (currency \`${facts.currency ?? 'unknown'}\`).`,
    })
  }
  if (!facts.chargeId || facts.amountPaid <= 0) {
    problems.push({ ko: '이 결제에는 카드 결제 기록(charge)이 없어요.', en: 'The payment has no charge to refund.' })
  }
  if (facts.disputed) {
    problems.push({
      ko: '이 결제는 분쟁(dispute) 중이에요. 환불하지 말고 Stripe 대시보드의 분쟁 화면에서 답해요.',
      en: 'The charge is disputed: answer the dispute in the Stripe Dashboard instead of refunding.',
    })
  }
  if (refunds?.has_more) {
    problems.push({
      ko: '이 결제의 환불 기록이 100개가 넘어서 이미 끝난 이용권인지 확인할 수 없어요.',
      en: 'The charge has more than 100 refunds, so an earlier end_pass refund cannot be ruled out.',
    })
  }
  if (endedBy.length) {
    const ids = endedBy.map((r) => `\`${r.id}\``).join(', ')
    problems.push({
      ko: `이 결제에는 이미 \`end_pass\` 환불(${ids})이 있어요. **이용권은 이미 끝났어요.** 다시 환불하지 않아요.`,
      en: `A live end_pass refund (${ids}) already exists: the pass has already ended.`,
    })
  } else if (facts.chargeId && facts.amountPaid > 0 && (facts.fullyRefunded || refundable === 0)) {
    problems.push({
      ko: '이미 전액 환불된 결제예요. 이용권도 이미 끝났어요.',
      en: 'The payment is already fully refunded, which already ended the pass.',
    })
  } else if (facts.amountPaid > 0 && requested > refundable) {
    problems.push({
      ko: `요청 금액 ${formatCad(requested)}이 환불할 수 있는 최대 금액 ${formatCad(refundable)}보다 커요.`,
      en: `The requested ${formatCad(requested)} is more than the ${formatCad(refundable)} that can still be refunded.`,
    })
  }
  return { facts, refundable, requested, endedBy, problems }
}

// ---------- pro-rated amounts ----------

/** amount paid × days left ÷ pass days, in cents (rounded to the nearest cent). */
export const proRataCents = (paidCents: number, daysLeft: number, passDays: number): number => Math.round((paidCents * daysLeft) / passDays)

export interface ProRata {
  sku: Sku
  passDays: number
  paid: number
  rows: { daysLeft: number; cents: number }[]
  /** the requested amount expressed as days left, to one decimal */
  requestedDays: number
}

/** The pro-rated table for a known sku (null without one: the pass length is then unknown). */
export function proRata(sku: Sku | null, paidCents: number, requestedCents: number): ProRata | null {
  if (!sku || paidCents <= 0) return null
  const passDays = SKUS[sku].days
  const days = new Set([1, ...[1, 2, 3, 4, 5].map((k) => Math.round((passDays * k) / 6)), passDays - 1])
  const rows = [...days].filter((d) => d >= 1 && d < passDays).sort((a, b) => a - b).map((d) => ({ daysLeft: d, cents: proRataCents(paidCents, d, passDays) }))
  return { sku, passDays, paid: paidCents, rows, requestedDays: Math.round((requestedCents * passDays * 10) / paidCents) / 10 }
}

/** 3900 → "39", 3950 → "39.50" (the guide writes the formula as "39 × 12 ÷ 30"). */
const plainDollars = (cents: number): string => (cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2))

// ---------- summary ----------

export interface Outcome {
  code: 0 | 1 | 2
  /** Markdown for GITHUB_STEP_SUMMARY */
  summary: string
  /** plain lines for the job log */
  log: string[]
}

const title = (t: Title): string => `## ${REFUND_WORKFLOW_NAME}: ${t.ko} (${t.en})`
const bullets = (messages: Message[]): string[] => messages.map((m) => `- ${m.ko}<br>${m.en}`)

function keyModeText(mode: StripeMode): string {
  return mode === 'live' ? '**live (실사용)**: 실제 결제예요 / real payments' : '**test (시험)**: 시험 결제예요, 진짜 돈은 움직이지 않아요 / test payments, no real money'
}

function factsTable(a: Assessment, mode: StripeMode): string[] {
  const f = a.facts
  const pass = f.sku ? `${SKUS[f.sku].ko} (\`${f.sku}\`)` : '알 수 없음 (metadata에 sku 없음) / unknown'
  return [
    '| 항목 / Item | 값 / Value |',
    '|---|---|',
    `| 키 모드 / Key mode | ${keyModeText(mode)} |`,
    `| 결제 ID / Payment | \`${f.paymentIntent}\` |`,
    `| 이용권 / Pass | ${pass} |`,
    `| 결제일 / Payment date | ${f.paymentDate ? `${f.paymentDate} (UTC)` : '알 수 없음 / unknown'} |`,
    `| 결제한 금액 / Amount paid | ${formatCad(f.amountPaid)} |`,
    `| 이미 환불된 금액 / Already refunded | ${formatCad(f.amountRefunded)} |`,
    `| 환불할 수 있는 최대 금액 / Refundable | ${formatCad(a.refundable)} |`,
    `| 요청 금액 / Requested | **${formatCad(a.requested)}** |`,
  ]
}

function proRataSection(a: Assessment): string[] {
  const p = proRata(a.facts.sku, a.facts.amountPaid, a.requested)
  if (!p) return []
  const out = [
    '',
    '### 남은 날짜 계산 / Pro-rated amounts',
    '',
    `결제한 금액 × 남은 일수 ÷ ${p.passDays} (amount paid × days left ÷ pass days). 요청한 ${formatCad(a.requested)}은 남은 약 **${p.requestedDays}일**에 해당해요 (about ${p.requestedDays} days left).`,
  ]
  if (p.paid !== SKUS[p.sku].priceCents) out.push('', `결제한 금액이 지금 가격(${formatCad(SKUS[p.sku].priceCents)})과 달라요. 계산은 결제한 금액으로 해요.`)
  out.push('', '| 남은 일수 / Days left | 계산 / Formula | 금액 / Amount |', '|---|---|---|')
  for (const r of p.rows) {
    const over = r.cents > a.refundable ? ' (최대 금액보다 커요 / above the refundable amount)' : ''
    out.push(`| ${r.daysLeft} | ${plainDollars(p.paid)} × ${r.daysLeft} ÷ ${p.passDays} | ${formatCad(r.cents)}${over} |`)
  }
  out.push('', `환불할 수 있는 최대 금액 / Max refundable: **${formatCad(a.refundable)}**`)
  return out
}

/** The preview's reminder of where days left come from (the pass dates are in D1, which the script cannot read). */
function daysLeftSection(a: Assessment): string[] {
  const f = a.facts
  const days = f.sku ? SKUS[f.sku].days : null
  const date = f.paymentDate ? `(\`${f.paymentDate}\`)` : ''
  return [
    '',
    '### 남은 일수는 끝나는 날로 세요 / Count days left from the end date',
    '',
    `- 결제일${date}은 이용권이 **가장 일찍** 시작할 수 있는 날일 뿐이에요. 구매자가 이용권을 두 번 이상 샀으면 뒤의 이용권은 앞의 것이 끝난 뒤에 시작해요: **아직 시작하지 않은 이용권은 전액** 환불해요. AI 피드백이 멈췄던 적이 있으면 이용권이 멈춘 시간만큼 늘어나서 끝나는 날이 뒤로 밀려 있어요.`,
    `- 금액을 정하기 전에 안내서 9-8의 D1 조회로 이 결제의 이용권 날짜(\`starts_at\`, \`ends_at\`)를 확인해요. 남은 일수 = \`ends_at\` − 오늘${days ? `, 많아야 ${days}일` : ''}.`,
    `- The payment date is only the earliest the pass could start: a later purchase starts when the buyer's earlier pass ends (a pass that has not started is refunded in full), and a pause of the AI feedback moves end dates later. Check the pass dates with the D1 query in guide section 9-8: days left = ends_at − today${days ? `, at most ${days}` : ''}.`,
  ]
}

function logFacts(a: Assessment, mode: StripeMode, runMode: Mode): string {
  const f = a.facts
  return (
    `refund: ${runMode}, key mode ${mode}, payment ${f.paymentIntent}, sku ${f.sku ?? 'unknown'}, status ${f.status ?? 'unknown'}, ` +
    `currency ${f.currency ?? 'unknown'}, paid ${f.amountPaid}, refunded ${f.amountRefunded}, refundable ${a.refundable}, requested ${a.requested} (cents)`
  )
}

function finish(o: Outcome, key: string): Outcome {
  // log lines become Actions annotations, which show Markdown backticks literally
  return { code: o.code, summary: `${redact(o.summary, [key]).trimEnd()}\n`, log: o.log.map((l) => redact(l, [key]).replace(/`/g, '')) }
}

// ---------- run ----------

export interface RunOptions {
  env: Record<string, string | undefined>
  /** defaults to the global fetch */
  fetchImpl?: typeof fetch
}

/** Everything except writing: reads env, calls Stripe, and returns the exit code, the summary and the log lines. */
export async function runRefund({ env, fetchImpl }: RunOptions): Promise<Outcome> {
  const key = (env.STRIPE_SECRET_KEY ?? '').trim()
  const f = fetchImpl ?? ((input: string | URL | Request, init?: RequestInit) => fetch(input, init))
  if (!key) {
    return finish(
      {
        code: 2,
        summary: [
          title(TITLES.noKey),
          '',
          'GitHub 저장소의 비밀(Settings → Secrets and variables → Actions)에 **STRIPE_SECRET_KEY** 가 없어서 아무것도 환불하지 않았어요.',
          '',
          'Nothing was refunded: the STRIPE_SECRET_KEY secret is missing.',
        ].join('\n'),
        log: ['::error::refund: STRIPE_SECRET_KEY is not set; nothing was refunded.'],
      },
      key,
    )
  }

  const parsed = parseInputs({ paymentIntent: env.PAYMENT_INTENT, amountCad: env.AMOUNT_CAD, mode: env.MODE })
  if (!parsed.ok) {
    return finish(
      {
        code: 2,
        summary: [title(TITLES.input), '', '**아무것도 환불하지 않았어요.** Nothing was refunded.', '', ...bullets(parsed.errors)].join('\n'),
        log: parsed.errors.map((e) => `::error::refund: ${e.en}`),
      },
      key,
    )
  }
  const { paymentIntent, cents, mode: runMode } = parsed.inputs

  const keyMode = keyModeOf(key)
  if (!keyMode) {
    const msg: Message = {
      // (the prefixes are written without what follows them, so redact() leaves this text alone)
      ko: '**STRIPE_SECRET_KEY** 가 Stripe 비밀 키 모양(`sk_` 또는 `rk_` 다음에 live나 test)이 아니에요. 8-4의 실사용 제한 키(restricted key)를 다시 넣어요.',
      en: 'STRIPE_SECRET_KEY is not a Stripe secret or restricted key (sk_ or rk_, then live or test).',
    }
    return finish(
      { code: 2, summary: [title(TITLES.input), '', '**아무것도 환불하지 않았어요.** Nothing was refunded.', '', ...bullets([msg])].join('\n'), log: [`::error::refund: ${msg.en}`] },
      key,
    )
  }

  // ---- read (both modes) ----
  let a: Assessment
  // the charge's refunds as read before any POST (a POST answer whose id is here is a replay of an earlier run's)
  let earlierRefunds: Refund[] = []
  try {
    const pi = await stripeCall<StripePaymentIntent>(key, 'GET', `/v1/payment_intents/${encodeURIComponent(paymentIntent)}`, { params: { expand: ['latest_charge'] } }, f)
    const facts = paymentFacts(pi)
    // One page of up to 100 refunds, as the webhook reads it (has_more is refused in assess)
    const refunds = facts.chargeId ? await stripeCall<StripeList<Refund>>(key, 'GET', '/v1/refunds', { params: { charge: facts.chargeId, limit: 100 } }, f) : null
    earlierRefunds = refunds?.data ?? []
    a = assess(facts, refunds, cents)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error'
    return finish(
      {
        code: 1,
        summary: [
          title(TITLES.stripeError),
          '',
          '**아무것도 환불하지 않았어요.** 결제 정보를 읽지 못했어요. Nothing was refunded: the payment could not be read.',
          '',
          `| 키 모드 / Key mode | ${keyModeText(keyMode)} |`,
          '|---|---|',
          `| 결제 ID / Payment | \`${paymentIntent}\` |`,
          '',
          `Stripe: ${message}`,
          '',
          '결제 ID가 맞는지, 키 모드(live/test)가 그 결제와 같은지 확인해요. 시험 결제는 test 키로만, 실제 결제는 live 키로만 보여요.',
          'Check the payment id, and that the key mode matches the payment (test payments are visible only to test keys).',
        ].join('\n'),
        log: [`::error::refund: reading ${paymentIntent} from Stripe failed: ${message}`],
      },
      key,
    )
  }

  const table = factsTable(a, keyMode)
  const prorata = proRataSection(a)
  if (a.problems.length) {
    return finish(
      {
        code: 1,
        summary: [
          title(TITLES.stopped),
          '',
          '**아무것도 환불하지 않았어요.** 아래 이유를 확인해요. Nothing was refunded, for the reasons below.',
          '',
          ...bullets(a.problems),
          '',
          ...table,
          ...prorata,
        ].join('\n'),
        log: [logFacts(a, keyMode, runMode), ...a.problems.map((p) => `::error::refund: ${p.en}`)],
      },
      key,
    )
  }

  if (runMode === 'preview') {
    return finish(
      {
        code: 0,
        summary: [
          title(TITLES.preview),
          '',
          '**아직 아무것도 환불하지 않았어요.** Preview only: nothing was refunded.',
          '',
          ...table,
          '',
          '### 무엇이 일어나나요 / What will happen',
          '',
          `- ${formatCad(a.requested)}을 구매자의 카드로 돌려주고, **이용권이 끝나요**(환불에 \`${END_PASS_METADATA_KEY}\` = \`true\`를 붙여요).`,
          `- Refunds ${formatCad(a.requested)} to the buyer's card and ends the pass (the refund gets metadata ${END_PASS_METADATA_KEY}=true).`,
          ...prorata,
          ...daysLeftSection(a),
          '',
          '### 다음 단계 / Next step',
          '',
          `**${NEXT_STEP_KO}**`,
          '',
          'Run the workflow again with the same values and mode = refund.',
        ].join('\n'),
        log: [logFacts(a, keyMode, runMode), `::notice::Preview only: nothing was refunded. Run again with mode refund to refund ${formatCad(a.requested)} and end the pass.`],
      },
      key,
    )
  }

  // ---- refund ----
  const idempotencyKey = `mpc-refund-${paymentIntent}-${cents}`
  const answer = { replayed: false }
  let refund: Refund
  try {
    refund = await stripeCall<Refund>(
      key,
      'POST',
      '/v1/refunds',
      {
        params: { payment_intent: paymentIntent, amount: cents, reason: 'requested_by_customer', metadata: { [END_PASS_METADATA_KEY]: 'true' } },
        idempotencyKey,
        onHeaders: (h) => {
          answer.replayed = h.get('Idempotent-Replayed')?.trim().toLowerCase() === 'true'
        },
      },
      f,
    )
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error'
    return finish(
      {
        code: 1,
        summary: [
          title(TITLES.stripeError),
          '',
          `Stripe가 환불을 받지 않았어요. Stripe did not accept the refund: ${message}`,
          '',
          // a replayed error comes back the same on a rerun, so the rerun advice is only for a first answer
          ...(answer.replayed
            ? [
                '이 답은 Stripe가 **전에 같은 값의 요청에 준 답을 다시 보여 준 것**이에요(`Idempotent-Replayed`). 이번 실행은 새로 환불을 시도하지 않았어요.',
                'Stripe replayed its earlier answer to the same values (Idempotent-Replayed): this run did not try a new refund.',
                '',
              ]
            : [
                '환불이 됐는지 확실하지 않으면 **같은 값으로 다시 실행**해요. 같은 값이면 두 번 환불되지 않아요: 이미 됐으면 "이용권은 이미 끝났어요"라고 나와요.',
                'If unsure whether it went through, run again with the same values: it never refunds twice.',
                '',
              ]),
          '**같은 오류가 또 나오면 계속 다시 실행하지 않아요.** Stripe는 같은 값의 요청에 적어도 24시간 동안 처음 준 답(오류도)을 그대로 다시 보여 줘요. 24시간 뒤에 하거나 Claude에게 물어요.',
          'If the same error comes back, stop rerunning: Stripe replays its first answer to the same values (errors included) for at least 24 hours. Try again after 24 hours or ask Claude.',
          '',
          ...table,
        ].join('\n'),
        log: [logFacts(a, keyMode, runMode), `::error::refund: Stripe refused the refund${answer.replayed ? ' (a replayed earlier answer)' : ''}: ${message}`],
      },
      key,
    )
  }

  // A replay: Stripe sent back the refund an earlier run made with this key. Its status in the replayed body is the
  // status it had then, so the current one is taken from the list read before the POST, or read again.
  const listed = earlierRefunds.find((r) => r.id === refund.id)
  if (answer.replayed || listed) {
    let current: Refund | null = listed ?? null
    let readError = ''
    if (!current) {
      try {
        current = await stripeCall<Refund>(key, 'GET', `/v1/refunds/${encodeURIComponent(refund.id)}`, {}, f)
      } catch (e) {
        readError = e instanceof Error ? e.message : 'unknown error'
      }
    }
    const replayKo = `Stripe가 **전에 만든 환불**(\`${refund.id}\`)을 다시 보여 줬어요(같은 값의 요청에는 적어도 24시간 동안 같은 답을 줘요). **새로 환불하지 않았어요.**`
    const replayEn = `Stripe replayed the refund ${refund.id} that an earlier run made with the same values: nothing new was refunded.`
    const now = current?.status ?? null
    const rows = [`| 환불 ID / Refund | \`${refund.id}\` |`, `| 환불 금액 / Refunded | ${formatCad(refund.amount)} |`, `| 지금 상태 / Status now | \`${now ?? 'unknown'}\` |`]
    const logFirst = logFacts(a, keyMode, runMode)
    if (!current) {
      return finish(
        {
          code: 1,
          summary: [
            title(TITLES.stripeError),
            '',
            replayKo,
            `그 환불의 지금 상태를 읽지 못했어요: ${readError}. Stripe 대시보드의 그 결제 화면에서 환불 상태를 보거나 Claude에게 물어요.`,
            `${replayEn} Its current status could not be read: ${readError}.`,
            '',
            ...table,
            ...rows,
          ].join('\n'),
          log: [logFirst, `::error::refund: Stripe replayed refund ${refund.id}; nothing new was refunded, and its current status could not be read: ${readError}`],
        },
        key,
      )
    }
    if (now === 'succeeded' || now === 'pending') {
      return finish(
        {
          code: 0,
          summary: [
            title(TITLES.refunded),
            '',
            replayKo,
            `그 환불(${formatCad(refund.amount)})은 지금 \`${now}\` 상태예요: 돈은 한 번만 돌아가고, 사이트가 Stripe의 알림을 받으면 **이용권이 끝나요**(자동이에요).`,
            `${replayEn} That refund is ${now}: the buyer is refunded once, and the site ends the pass when Stripe tells it.`,
            '',
            ...table,
            ...rows,
            '',
            '### 다음 단계 / Next step',
            '',
            '이 워크플로를 다시 실행하지 않아요. 구매자에게 아직 알리지 않았으면 환불했다고 알려요.',
            'Do not run this workflow again for this payment; tell the buyer if you have not yet.',
          ].join('\n'),
          log: [logFirst, `::notice::Stripe replayed refund ${refund.id} from an earlier run (now ${now}); nothing new was refunded.`],
        },
        key,
      )
    }
    return finish(
      {
        code: 1,
        summary: [
          title(TITLES.failed),
          '',
          replayKo,
          `그 환불의 지금 상태는 \`${now ?? 'unknown'}\`예요: 돈이 돌아가지 않았어요. 구매자와 다른 환불 방법을 정하거나, 24시간 뒤에 Claude에게 물어요.`,
          `${replayEn} That refund is ${now ?? 'unknown'}: the buyer has not received the money. Arrange another way to refund with the buyer, or ask Claude after 24 hours.`,
          '',
          ...table,
          ...rows,
        ].join('\n'),
        log: [logFirst, `::error::refund: Stripe replayed refund ${refund.id} from an earlier run, now ${now ?? 'unknown'}; nothing new was refunded.`],
      },
      key,
    )
  }

  const ok = refund.status === 'succeeded' || refund.status === 'pending'
  const status = refund.status ?? 'unknown'
  const refundRows = [`| 환불 ID / Refund | \`${refund.id}\` |`, `| 환불 금액 / Refunded | ${formatCad(refund.amount)} |`, `| 상태 / Status | \`${status}\` |`]
  if (!ok) {
    return finish(
      {
        code: 1,
        summary: [
          title(TITLES.failed),
          '',
          `환불 \`${refund.id}\`의 상태가 \`${status}\`예요. 돈이 돌아가지 않았어요. 구매자와 다른 환불 방법을 정해요.`,
          `Refund ${refund.id} is ${status}: the buyer has not received the money.`,
          '',
          ...table,
          ...refundRows,
        ].join('\n'),
        log: [logFacts(a, keyMode, runMode), `::error::refund: refund ${refund.id} is ${status}.`],
      },
      key,
    )
  }
  return finish(
    {
      code: 0,
      summary: [
        title(TITLES.refunded),
        '',
        `**${formatCad(refund.amount)}을 환불했어요.** 사이트가 Stripe의 알림을 받으면 **이용권이 끝나요**(자동이에요). \`pending\`도 정상이에요.`,
        `Refunded ${formatCad(refund.amount)} with metadata ${END_PASS_METADATA_KEY}=true; the site ends the pass when Stripe tells it (pending is normal).`,
        '',
        ...table,
        ...refundRows,
        '',
        '### 다음 단계 / Next step',
        '',
        '구매자에게 환불했다고 알려요. 카드에 보이기까지 며칠 걸릴 수 있어요. 이 워크플로를 다시 실행하지 않아요.',
        'Tell the buyer; do not run this workflow again for this payment.',
      ].join('\n'),
      log: [logFacts(a, keyMode, runMode), `::notice::Refund ${refund.id} (${formatCad(refund.amount)}): ${status}; the pass ends when the webhook arrives.`],
    },
    key,
  )
}

export async function main(_args: string[]): Promise<number> {
  const outcome = await runRefund({ env: process.env })
  for (const line of outcome.log) console.log(line)
  const summaryFile = process.env.GITHUB_STEP_SUMMARY
  if (summaryFile) {
    const { appendFile } = await import('node:fs/promises')
    await appendFile(summaryFile, outcome.summary)
  } else {
    console.log(outcome.summary)
  }
  return outcome.code
}
