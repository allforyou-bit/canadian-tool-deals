// Stripe ↔ D1 reconciliation logic (memo §5.2: "0 unmatched, otherwise an issue is opened").
// Pure functions only; the CLI that fetches both sides is scripts/reconcile.ts.
//
// Every paid Stripe Checkout Session in the window must have a D1 `purchases` row (id = session id)
// that the webhook moved past 'pending', with the same amount and currency; and every D1 purchase
// that took money must have a paid session. Sessions paid in the last `graceMinutes` are skipped:
// their webhook may still be in flight (the next daily run covers them, the window is 3 days).

/** The Checkout Session fields we read (Stripe API: checkout.session object). */
export interface StripeSession {
  id: string
  /** Unix seconds */
  created: number
  mode: string
  status: string | null
  payment_status: string
  amount_total: number | null
  currency: string | null
  livemode: boolean
}

/** The D1 `purchases` columns we read (worker/migrations/0001_init.sql). */
export interface D1Purchase {
  id: string
  status: string
  amount_cents: number
  currency: string
  created_at: string
}

export type MismatchKind = 'missing_in_d1' | 'not_marked_paid' | 'amount_mismatch' | 'missing_in_stripe'

export interface Mismatch {
  kind: MismatchKind
  /** Checkout Session id (the purchases.id) — an identifier, never customer data */
  id: string
  detail: string
}

export interface ReconcileReport {
  windowStart: string
  checkedAt: string
  stripePaid: number
  d1Paid: number
  skippedRecent: number
  mismatches: Mismatch[]
}

/** D1 statuses that mean the customer's money was taken at some point. */
export const MONEY_TAKEN = ['paid', 'refunded', 'disputed', 'rejected_region'] as const

export function isPaidSession(s: StripeSession): boolean {
  return s.mode === 'payment' && s.status === 'complete' && s.payment_status === 'paid'
}

export interface ReconcileInput {
  /** sessions listed from a little before windowStart (lookup margin) */
  sessions: StripeSession[]
  /** purchases selected from a little before windowStart (lookup margin) */
  purchases: D1Purchase[]
  windowStart: Date
  now: Date
  graceMinutes?: number
}

export function reconcile({ sessions, purchases, windowStart, now, graceMinutes = 60 }: ReconcileInput): ReconcileReport {
  const startSec = windowStart.getTime() / 1000
  const graceSec = now.getTime() / 1000 - graceMinutes * 60
  const startIso = windowStart.toISOString()
  const paidSessions = sessions.filter(isPaidSession)
  const sessionById = new Map(paidSessions.map((s) => [s.id, s]))
  const purchaseById = new Map(purchases.map((p) => [p.id, p]))
  const mismatches: Mismatch[] = []
  let skippedRecent = 0
  let stripePaid = 0

  for (const s of paidSessions) {
    if (s.created < startSec) continue
    if (s.created > graceSec) {
      skippedRecent++
      continue
    }
    stripePaid++
    const p = purchaseById.get(s.id)
    if (!p) {
      mismatches.push({ kind: 'missing_in_d1', id: s.id, detail: 'paid in Stripe, no purchases row (webhook not received or failed)' })
    } else if (p.status === 'pending') {
      mismatches.push({ kind: 'not_marked_paid', id: s.id, detail: 'paid in Stripe, purchases row still pending (no pass granted)' })
    } else if (p.amount_cents !== s.amount_total || p.currency.toLowerCase() !== (s.currency ?? '').toLowerCase()) {
      mismatches.push({
        kind: 'amount_mismatch',
        id: s.id,
        detail: `Stripe ${s.amount_total ?? 'null'} ${s.currency ?? ''} vs D1 ${p.amount_cents} ${p.currency}`,
      })
    }
  }

  let d1Paid = 0
  for (const p of purchases) {
    if (p.created_at < startIso || !(MONEY_TAKEN as readonly string[]).includes(p.status)) continue
    d1Paid++
    if (!sessionById.has(p.id)) {
      mismatches.push({ kind: 'missing_in_stripe', id: p.id, detail: `D1 status '${p.status}' but no paid Checkout Session found` })
    }
  }

  return { windowStart: startIso, checkedAt: now.toISOString(), stripePaid, d1Paid, skippedRecent, mismatches }
}

/** Markdown body for the GitHub issue: counts and session ids only, never customer details. */
export function renderIssue(r: ReconcileReport, livemode: boolean | null): string {
  const lines = [
    `Daily Stripe ↔ D1 reconciliation found **${r.mismatches.length}** mismatch(es).`,
    '',
    `- Window: ${r.windowStart} → ${r.checkedAt} (UTC)`,
    `- Stripe mode: ${livemode === null ? 'unknown (no sessions)' : livemode ? 'live' : 'test'}`,
    `- Paid Checkout Sessions checked: ${r.stripePaid} (skipped, paid in the last hour: ${r.skippedRecent})`,
    `- D1 purchases that took money: ${r.d1Paid}`,
    '',
    '| Kind | Checkout Session | Detail |',
    '|---|---|---|',
    ...r.mismatches.map((m) => `| ${m.kind} | \`${m.id}\` | ${m.detail} |`),
    '',
    'What to do: open each session in the Stripe Dashboard. `missing_in_d1` / `not_marked_paid` mean a buyer paid but may not have a pass:',
    "check the webhook endpoint's delivery log in the Stripe Dashboard and resend the event. `missing_in_stripe` means D1 recorded money that Stripe does not show: check for a test/live key mix-up.",
    '',
    '_Opened by `.github/workflows/reconcile.yml`. This issue contains ids only; never paste customer emails or card details here._',
  ]
  return lines.join('\n')
}
