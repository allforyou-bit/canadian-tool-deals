// Funnel totals over the committed daily metrics files (memo B8; KPI Routine). Pure functions + a small CLI.
// No ads data exists any more (memo §7.2 Z1: no ad budget), so there is no CAC: the funnel counts the
// organic path, including the free practice mode (practice_start / practice_done, no AI, Z9).
//
//   node scripts/run.mjs scripts/funnel.ts --from YYYY-MM-DD --to YYYY-MM-DD [--metrics ../../ops/metrics] [--purchases FILE]
//
// Prints the totals as JSON. With --purchases (a JSON list of { paidAt } from a D1 or Stripe export) it
// also checks the memo B8 acceptance rule — the funnel reconciles to the purchases ±0 — and exits 1 when
// it does not.
import type { MetricsFile } from './metrics'

export interface Window {
  from: string
  to: string
}

export interface Funnel {
  days: number
  landing: number
  practice_start: number
  practice_done: number
  sample_start: number
  sample_done: number
  signup: number
  checkout_start: number
  /** purchase events (billing inserts one per granted pass) */
  purchaseEvents: number
  /** purchases that granted a pass, from the purchases table */
  purchasesPaid: number
  grossCents: number
  refunds: number
}

const DAY = /^\d{4}-\d{2}-\d{2}$/

export function validDay(s: unknown): s is string {
  if (typeof s !== 'string' || !DAY.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s)
}

const inWindow = (day: string, w: Window) => day >= w.from && day <= w.to

/** Sum the daily metrics files over a window (inclusive). */
export function funnel(files: MetricsFile[], w: Window): Funnel {
  const f: Funnel = {
    days: 0,
    landing: 0,
    practice_start: 0,
    practice_done: 0,
    sample_start: 0,
    sample_done: 0,
    signup: 0,
    checkout_start: 0,
    purchaseEvents: 0,
    purchasesPaid: 0,
    grossCents: 0,
    refunds: 0,
  }
  for (const file of files) {
    if (!inWindow(file.day, w)) continue
    const m = file.metrics
    f.days++
    f.landing += m.events.landing ?? 0
    f.practice_start += m.events.practice_start ?? 0
    f.practice_done += m.events.practice_done ?? 0
    f.sample_start += m.events.sample_start ?? 0
    f.sample_done += m.events.sample_done ?? 0
    f.signup += m.events.signup ?? 0
    f.checkout_start += m.events.checkout_start ?? 0
    f.purchaseEvents += m.events.purchase ?? 0
    f.purchasesPaid += m.purchases.paid
    f.grossCents += m.purchases.grossCents
    f.refunds += m.refunds.count
  }
  return f
}

/**
 * Memo B8 acceptance: the daily JSON funnel must reconcile to the purchases ±0. `paidDays` lists the paid
 * purchases' paid_at times (e.g. a fixture or a D1 export); both funnel counts must match their number.
 */
export function reconcileFunnel(files: MetricsFile[], paidDays: string[], w: Window): { expected: number; purchasesPaid: number; purchaseEvents: number; ok: boolean } {
  const f = funnel(files, w)
  const expected = paidDays.filter((d) => inWindow(d.slice(0, 10), w)).length
  return { expected, purchasesPaid: f.purchasesPaid, purchaseEvents: f.purchaseEvents, ok: f.purchasesPaid === expected && f.purchaseEvents === expected }
}

function argValue(args: string[], name: string, fallback?: string): string | undefined {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}

export async function main(args: string[]): Promise<number> {
  const { existsSync } = await import('node:fs')
  const { readFile, readdir } = await import('node:fs/promises')
  const { join } = await import('node:path')
  const from = argValue(args, '--from')
  const to = argValue(args, '--to')
  if (!validDay(from) || !validDay(to)) {
    console.error('usage: funnel.ts --from YYYY-MM-DD --to YYYY-MM-DD [--metrics DIR] [--purchases FILE]')
    return 2
  }
  const dir = argValue(args, '--metrics', '../../ops/metrics')!
  const files: MetricsFile[] = []
  for (const name of existsSync(dir) ? (await readdir(dir)).sort() : []) {
    if (/^\d{4}-\d{2}-\d{2}\.json$/.test(name)) files.push(JSON.parse(await readFile(join(dir, name), 'utf8')) as MetricsFile)
  }
  const w = { from, to }
  console.log(JSON.stringify({ from, to, ...funnel(files, w) }, null, 2))
  const purchasesFile = argValue(args, '--purchases')
  if (!purchasesFile) return 0
  const paid = (JSON.parse(await readFile(purchasesFile, 'utf8')) as { paidAt?: unknown }[]).map((p) => String(p.paidAt ?? ''))
  const r = reconcileFunnel(files, paid, w)
  console.log(`funnel: ${r.ok ? 'reconciles' : 'DOES NOT reconcile'} with the purchases (expected ${r.expected}, purchasesPaid ${r.purchasesPaid}, purchase events ${r.purchaseEvents})`)
  return r.ok ? 0 : 1
}
