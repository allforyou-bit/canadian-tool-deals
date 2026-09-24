// Ads spend ingestion and CAC (memo B8, §6 K3/K4, scale rules). Pure functions + a small CLI.
//
// ops/metrics/ads.json  — written by the daily Routine from the scheduled Google Ads email:
//   [{ "date": "2026-10-26", "spendCad": 19.84, "clicks": 12, "impressions": 410, "conversions": 0 }, ...]
//   one row per day, ascending, a re-imported day replaces its row (format: ops/metrics/README.md).
// ops/config/ad-cap.json — the owner-approved cap (memo scale rules; changed only by an owner-merged PR).
//
//   node scripts/run.mjs scripts/ads.ts check [--ads F] [--cap F] [--today YYYY-MM-DD]
//   node scripts/run.mjs scripts/ads.ts cac --from YYYY-MM-DD --to YYYY-MM-DD [--ads F] [--metrics DIR]
import type { MetricsFile } from './metrics'

export interface AdsDay {
  date: string
  spendCad: number
  clicks: number
  impressions: number
  conversions: number
}

export interface AdCap {
  capCad: number
  dailyCad: number
  startDate: string
  endDate: string
  confirmedByOwner: boolean
  notes: string
}

const DAY = /^\d{4}-\d{2}-\d{2}$/

function validDay(s: unknown): s is string {
  return typeof s === 'string' && DAY.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s)
}

function nonNegative(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0
}

/** Parse and validate ads.json. Throws with every problem found; returns rows sorted by date. */
export function parseAdsJson(text: string): AdsDay[] {
  const data: unknown = JSON.parse(text)
  if (!Array.isArray(data)) throw new Error('ads.json must be a JSON array of day rows')
  const problems: string[] = []
  const seen = new Set<string>()
  const rows: AdsDay[] = []
  data.forEach((r: unknown, i) => {
    const at = `row ${i + 1}`
    if (!r || typeof r !== 'object' || Array.isArray(r)) return problems.push(`${at}: must be an object`)
    const o = r as Record<string, unknown>
    const extra = Object.keys(o).filter((k) => !['date', 'spendCad', 'clicks', 'impressions', 'conversions'].includes(k))
    if (extra.length) problems.push(`${at}: unknown field(s) ${extra.join(', ')}`)
    if (!validDay(o.date)) problems.push(`${at}: date must be a real YYYY-MM-DD day`)
    else if (seen.has(o.date)) problems.push(`${at}: duplicate date ${o.date}`)
    else seen.add(o.date)
    if (!nonNegative(o.spendCad)) problems.push(`${at}: spendCad must be a number ≥ 0`)
    for (const k of ['clicks', 'impressions'] as const) if (!nonNegative(o[k]) || !Number.isInteger(o[k])) problems.push(`${at}: ${k} must be a whole number ≥ 0`)
    // Google Ads can report fractional conversions under some attribution models [unverified]
    if (!nonNegative(o.conversions)) problems.push(`${at}: conversions must be a number ≥ 0`)
    rows.push(o as unknown as AdsDay)
  })
  if (problems.length) throw new Error(`ads.json invalid: ${problems.join('; ')}`)
  return rows.sort((a, b) => a.date.localeCompare(b.date))
}

export function parseAdCap(text: string): AdCap {
  const o = JSON.parse(text) as Record<string, unknown>
  const problems: string[] = []
  if (!nonNegative(o.capCad)) problems.push('capCad')
  if (!nonNegative(o.dailyCad)) problems.push('dailyCad')
  if (!validDay(o.startDate)) problems.push('startDate')
  if (!validDay(o.endDate)) problems.push('endDate')
  if (typeof o.confirmedByOwner !== 'boolean') problems.push('confirmedByOwner')
  if (problems.length) throw new Error(`ad-cap.json invalid field(s): ${problems.join(', ')}`)
  return { capCad: o.capCad as number, dailyCad: o.dailyCad as number, startDate: o.startDate as string, endDate: o.endDate as string, confirmedByOwner: o.confirmedByOwner as boolean, notes: String(o.notes ?? '') }
}

/** Ads count as running when the owner confirmed the cap (Gate C) and today is inside the campaign dates. */
export function adsActive(cap: AdCap, today: string): boolean {
  return cap.confirmedByOwner && today >= cap.startDate && today <= cap.endDate
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
}

/**
 * ads.json is stale when its newest day is more than two days before today (UTC): yesterday's
 * report normally arrives today, so a missing row for two days means over 48 h without data.
 */
export function adsFreshness(rows: AdsDay[], today: string): { latest: string | null; ageDays: number | null; stale: boolean } {
  const latest = rows.length ? rows[rows.length - 1].date : null
  const ageDays = latest ? daysBetween(latest, today) : null
  return { latest, ageDays, stale: ageDays === null || ageDays > 2 }
}

export interface Window {
  from: string
  to: string
}

const inWindow = (day: string, w: Window) => day >= w.from && day <= w.to

export function adsTotals(rows: AdsDay[], w: Window): Omit<AdsDay, 'date'> & { days: number } {
  const t = { spendCad: 0, clicks: 0, impressions: 0, conversions: 0, days: 0 }
  for (const r of rows) {
    if (!inWindow(r.date, w)) continue
    t.spendCad += r.spendCad
    t.clicks += r.clicks
    t.impressions += r.impressions
    t.conversions += r.conversions
    t.days++
  }
  t.spendCad = Math.round(t.spendCad * 100) / 100
  return t
}

/** Total ad spend so far against the owner-approved cap (memo: C$1,200 to Jan 31 unless re-confirmed). */
export function capStatus(rows: AdsDay[], cap: AdCap): { spentCad: number; capCad: number; remainingCad: number; overCap: boolean } {
  const spentCad = Math.round(rows.reduce((s, r) => s + r.spendCad, 0) * 100) / 100
  return { spentCad, capCad: cap.capCad, remainingCad: Math.round((cap.capCad - spentCad) * 100) / 100, overCap: spentCad > cap.capCad }
}

export interface Funnel {
  days: number
  landing: number
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

/** Sum the daily metrics files over a window. */
export function funnel(files: MetricsFile[], w: Window): Funnel {
  const f: Funnel = { days: 0, landing: 0, sample_start: 0, sample_done: 0, signup: 0, checkout_start: 0, purchaseEvents: 0, purchasesPaid: 0, grossCents: 0, refunds: 0 }
  for (const file of files) {
    if (!inWindow(file.day, w)) continue
    const m = file.metrics
    f.days++
    f.landing += m.events.landing ?? 0
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
 * Memo B8 acceptance: the daily JSON funnel must reconcile to the purchases ±0. `purchases` is the
 * list of paid purchases (e.g. a fixture or a D1 export of paid_at days); both funnel counts must match it.
 */
export function reconcileFunnel(files: MetricsFile[], paidDays: string[], w: Window): { expected: number; purchasesPaid: number; purchaseEvents: number; ok: boolean } {
  const f = funnel(files, w)
  const expected = paidDays.filter((d) => inWindow(d.slice(0, 10), w)).length
  return { expected, purchasesPaid: f.purchasesPaid, purchaseEvents: f.purchaseEvents, ok: f.purchasesPaid === expected && f.purchaseEvents === expected }
}

/** Blended CAC = ad spend ÷ all purchases in the window (organic included). null when there are no purchases. */
export function blendedCac(spendCad: number, purchases: number): number | null {
  return purchases > 0 ? Math.round((spendCad / purchases) * 100) / 100 : null
}

/**
 * K4 test: is CAC above the threshold (the measured blended first-sale net)? With zero buyers the
 * CAC is unbounded, so it exceeds the threshold as soon as spend does.
 */
export function cacExceeds(spendCad: number, buyers: number, thresholdCad: number): boolean {
  return buyers > 0 ? spendCad / buyers > thresholdCad : spendCad > thresholdCad
}

export interface CacReport extends Window {
  spendCad: number
  clicks: number
  purchases: number
  adsConversions: number
  blendedCac: number | null
  /** spend ÷ the smaller of purchases and Google-reported conversions: the conservative figure for K4 */
  conservativeCac: number | null
}

export function cacReport(rows: AdsDay[], files: MetricsFile[], w: Window): CacReport {
  const ads = adsTotals(rows, w)
  const f = funnel(files, w)
  const buyers = Math.min(f.purchasesPaid, ads.conversions)
  return {
    ...w,
    spendCad: ads.spendCad,
    clicks: ads.clicks,
    purchases: f.purchasesPaid,
    adsConversions: ads.conversions,
    blendedCac: blendedCac(ads.spendCad, f.purchasesPaid),
    conservativeCac: blendedCac(ads.spendCad, buyers),
  }
}

// ---------- CLI ----------

function argValue(args: string[], name: string, fallback?: string): string | undefined {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}

async function setOutputs(values: Record<string, string>): Promise<void> {
  const file = process.env.GITHUB_OUTPUT
  if (!file) return
  const { appendFile } = await import('node:fs/promises')
  await appendFile(file, Object.entries(values).map(([k, v]) => `${k}=${v.replace(/\n/g, ' ')}\n`).join(''))
}

export async function main(args: string[]): Promise<number> {
  const { existsSync } = await import('node:fs')
  const { readFile, readdir } = await import('node:fs/promises')
  const { join } = await import('node:path')
  const [command, ...rest] = args
  const adsPath = argValue(rest, '--ads', '../../ops/metrics/ads.json')!
  const rows = existsSync(adsPath) ? parseAdsJson(await readFile(adsPath, 'utf8')) : []

  if (command === 'check') {
    const cap = parseAdCap(await readFile(argValue(rest, '--cap', '../../ops/config/ad-cap.json')!, 'utf8'))
    const today = argValue(rest, '--today', new Date().toISOString().slice(0, 10))!
    const active = adsActive(cap, today)
    const fresh = adsFreshness(rows, today)
    const spend = capStatus(rows, cap)
    const alert = active && fresh.stale
    const message = alert
      ? `ads.json is stale (newest day: ${fresh.latest ?? 'none'}) while ads should be running (${cap.startDate} to ${cap.endDate}). Pause the campaign in the Google Ads app until the daily report is flowing again.`
      : spend.overCap
        ? `Ad spend C$${spend.spentCad} is above the approved cap C$${cap.capCad}. Pause the campaign in the Google Ads app.`
        : 'ok'
    console.log(JSON.stringify({ today, active, ...fresh, ...spend, alert, message }))
    await setOutputs({ active: String(active), stale: String(fresh.stale), alert: String(alert), over_cap: String(spend.overCap), message })
    return 0
  }

  if (command === 'cac') {
    const from = argValue(rest, '--from')
    const to = argValue(rest, '--to')
    if (!validDay(from) || !validDay(to)) {
      console.error('ads.ts cac: --from and --to must be YYYY-MM-DD')
      return 2
    }
    const dir = argValue(rest, '--metrics', '../../ops/metrics')!
    const files: MetricsFile[] = []
    for (const name of existsSync(dir) ? (await readdir(dir)).sort() : []) {
      if (/^\d{4}-\d{2}-\d{2}\.json$/.test(name)) files.push(JSON.parse(await readFile(join(dir, name), 'utf8')) as MetricsFile)
    }
    console.log(JSON.stringify(cacReport(rows, files, { from, to }), null, 2))
    return 0
  }

  console.error('usage: ads.ts check [--ads F] [--cap F] [--today D] | cac --from D --to D [--ads F] [--metrics DIR]')
  return 2
}
