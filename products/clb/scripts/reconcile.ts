// Daily Stripe ↔ D1 reconciliation (memo §5.2). Run by .github/workflows/reconcile.yml:
//
//   STRIPE_SECRET_KEY=… node scripts/run.mjs scripts/reconcile.ts [--days 3] [--out .cache/reconcile]
//                       [--sessions sessions.json] [--purchases wrangler-output.json] [--now ISO]
//
// Stripe: GET /v1/checkout/sessions with created[gte], status=complete, limit=100 and starting_after
// pagination (parameters checked against stripe/openapi spec3.json, API version 2026-09-30).
// payment_status is not a list filter, so paid sessions are selected here. D1: read-only SELECT
// through wrangler (scripts/lib/d1.ts). Only ids, amounts, statuses and timestamps are kept; nothing
// about the customer is read into memory beyond what the list endpoint returns, and nothing is logged.
//
// Mode: the key's prefix (sk_live_/rk_live_ vs sk_test_/rk_test_) decides which D1 purchases are
// compared: after the switch from test to live keys, test purchases (cs_test_…) are left out instead of
// being reported as missing_in_stripe (and vice versa). --mode live|test overrides it (for --sessions files).
//
// Writes <out>/report.json and <out>/issue.md; exit 1 when there is any mismatch (the workflow
// then opens an issue), 2 on a usage or fetch error.
import { parseD1Json, queryRemoteD1 } from './lib/d1'
import { modeSqlCondition, reconcile, renderIssue, stripeKeyMode, type D1Purchase, type StripeMode, type StripeSession } from './reconcile-core'

const STRIPE_API = 'https://api.stripe.com/v1/checkout/sessions'
const LOOKUP_MARGIN_MS = 86_400_000

function pickSession(o: Record<string, unknown>): StripeSession {
  return {
    id: String(o.id),
    created: Number(o.created),
    mode: String(o.mode),
    status: (o.status as string | null) ?? null,
    payment_status: String(o.payment_status),
    amount_total: (o.amount_total as number | null) ?? null,
    currency: (o.currency as string | null) ?? null,
    livemode: Boolean(o.livemode),
  }
}

export async function listPaidWindowSessions(key: string, createdGte: number, fetchImpl: typeof fetch = fetch): Promise<StripeSession[]> {
  const out: StripeSession[] = []
  let startingAfter: string | undefined
  for (let page = 0; page < 50; page++) {
    const q = new URLSearchParams({ limit: '100', status: 'complete', 'created[gte]': String(createdGte) })
    if (startingAfter) q.set('starting_after', startingAfter)
    const res = await fetchImpl(`${STRIPE_API}?${q}`, { headers: { authorization: `Bearer ${key}` } })
    if (!res.ok) throw new Error(`Stripe list failed with HTTP ${res.status}`)
    const body = (await res.json()) as { data?: Record<string, unknown>[]; has_more?: boolean }
    const data = body.data ?? []
    out.push(...data.map(pickSession))
    if (!body.has_more || data.length === 0) return out
    startingAfter = String(data[data.length - 1].id)
  }
  throw new Error('Stripe list: more than 50 pages — narrow the window')
}

function argValue(args: string[], name: string): string | undefined {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}

export async function main(args: string[]): Promise<number> {
  const { mkdir, readFile, writeFile, appendFile } = await import('node:fs/promises')
  const { join } = await import('node:path')
  const days = Math.max(1, Math.min(14, Number(argValue(args, '--days') ?? 3)))
  const outDir = argValue(args, '--out') ?? '.cache/reconcile'
  const now = new Date(argValue(args, '--now') ?? Date.now())
  const windowStart = new Date(now.getTime() - days * 86_400_000)
  const lookupStart = new Date(windowStart.getTime() - LOOKUP_MARGIN_MS)

  const modeArg = argValue(args, '--mode')
  if (modeArg !== undefined && modeArg !== 'live' && modeArg !== 'test') {
    console.error('reconcile: --mode must be live or test')
    return 2
  }
  let mode: StripeMode | null = (modeArg as StripeMode | undefined) ?? null
  let sessions: StripeSession[]
  let purchases: D1Purchase[]
  try {
    const sessionsFile = argValue(args, '--sessions')
    if (sessionsFile) {
      sessions = (JSON.parse(await readFile(sessionsFile, 'utf8')) as Record<string, unknown>[]).map(pickSession)
    } else {
      const key = process.env.STRIPE_SECRET_KEY
      if (!key) {
        console.error('reconcile: STRIPE_SECRET_KEY is not set')
        return 2
      }
      mode ??= stripeKeyMode(key)
      if (!mode) console.log('reconcile: the key prefix shows neither live nor test mode; comparing every D1 purchase')
      sessions = await listPaidWindowSessions(key, Math.floor(lookupStart.getTime() / 1000))
    }
    const purchasesFile = argValue(args, '--purchases')
    const sql = `SELECT id, status, amount_cents, currency, created_at FROM purchases WHERE created_at >= '${lookupStart.toISOString()}'${modeSqlCondition(mode)}`
    const rows = purchasesFile ? parseD1Json(await readFile(purchasesFile, 'utf8')) : await queryRemoteD1(sql)
    purchases = rows.map((r) => ({
      id: String(r.id),
      status: String(r.status),
      amount_cents: Number(r.amount_cents),
      currency: String(r.currency),
      created_at: String(r.created_at),
    }))
  } catch (e) {
    console.error(`reconcile: ${e instanceof Error ? e.message : 'fetch failed'}`)
    return 2
  }

  const report = reconcile({ sessions, purchases, windowStart, now, mode })
  const livemode = mode ? mode === 'live' : sessions.length ? sessions[0].livemode : null
  await mkdir(outDir, { recursive: true })
  await writeFile(join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`)
  await writeFile(join(outDir, 'issue.md'), `${renderIssue(report, livemode)}\n`)
  console.log(
    `reconcile: window ${report.windowStart} → ${report.checkedAt}; Stripe paid ${report.stripePaid}, D1 paid ${report.d1Paid}, ` +
      `skipped recent ${report.skippedRecent}, other mode ${report.skippedOtherMode} (key mode ${mode ?? 'unknown'}), mismatches ${report.mismatches.length}`,
  )
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `mismatches=${report.mismatches.length}\n`)
  return report.mismatches.length ? 1 : 0
}
