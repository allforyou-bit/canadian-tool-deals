// Daily metrics export (memo §5.2, B8): copies the Worker's aggregate `metrics_daily` rows from D1
// into ops/metrics/<day>.json and guards every committed metrics file against personal data.
//
//   node scripts/run.mjs scripts/metrics.ts export [--dir ../../ops/metrics] [--days 3] [--rows rows.json] [--now ISO]
//   node scripts/run.mjs scripts/metrics.ts guard <file-or-dir>...
//
// export exit codes: 0 ok · 1 invalid row or personal-data hit (nothing written for that row)
//                    3 files written but the newest row is older than yesterday (UTC): the Worker's
//                      daily cron did not run — the workflow opens an issue.
// File format: ops/metrics/README.md. The row's JSON is written by worker/src/cron.ts (core).
import type { DailyMetrics } from '../worker/src/cron'
import { parseD1Json, queryRemoteD1, type Row } from './lib/d1'
import { describeFinding, findPersonalData } from './lib/pii-guard'

export const METRICS_FILE_SCHEMA = 1

export interface MetricsFile {
  schema: typeof METRICS_FILE_SCHEMA
  day: string
  source: 'd1.metrics_daily'
  /** when the Worker wrote the row (metrics_daily.created_at) */
  computedAt: string
  metrics: DailyMetrics
}

const DAY = /^\d{4}-\d{2}-\d{2}$/

function isCount(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0
}

/** Validate the Worker's DailyMetrics JSON (aggregate numbers only). Returns problems, empty when valid. */
export function validateDailyMetrics(value: unknown): string[] {
  const problems: string[] = []
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ['metrics must be an object']
  const m = value as Record<string, unknown>
  if (typeof m.day !== 'string' || !DAY.test(m.day)) problems.push('day must be YYYY-MM-DD')
  const events = m.events as Record<string, unknown> | undefined
  if (!events || typeof events !== 'object' || Array.isArray(events)) problems.push('events must be an object')
  else for (const [k, v] of Object.entries(events)) if (!isCount(v)) problems.push(`events.${k} must be a count`)
  const groups: Record<string, string[]> = {
    grades: ['writing', 'speaking', 'free', 'refused'],
    purchases: ['paid', 'grossCents'],
    refunds: ['count', 'cents'],
  }
  for (const [g, keys] of Object.entries(groups)) {
    const o = m[g] as Record<string, unknown> | undefined
    if (!o || typeof o !== 'object') problems.push(`${g} must be an object`)
    else for (const k of keys) if (!isCount(o[k])) problems.push(`${g}.${k} must be a count`)
  }
  if (!isCount(m.costUsd)) problems.push('costUsd must be a non-negative number')
  if (!isCount(m.disputes)) problems.push('disputes must be a count')
  return problems
}

/** Build the committed file for one metrics_daily row ({ day, json, created_at }). Throws on bad data. */
export function toMetricsFile(row: Row): MetricsFile {
  const day = String(row.day ?? '')
  if (!DAY.test(day)) throw new Error('metrics_daily row has no valid day')
  let metrics: unknown
  try {
    metrics = JSON.parse(String(row.json ?? ''))
  } catch {
    throw new Error(`metrics_daily ${day}: json column is not valid JSON`)
  }
  const problems = validateDailyMetrics(metrics)
  if (problems.length) throw new Error(`metrics_daily ${day}: ${problems.join('; ')}`)
  if ((metrics as DailyMetrics).day !== day) throw new Error(`metrics_daily ${day}: day column and JSON day differ`)
  return { schema: METRICS_FILE_SCHEMA, day, source: 'd1.metrics_daily', computedAt: String(row.created_at ?? ''), metrics: metrics as DailyMetrics }
}

export function serializeMetricsFile(file: MetricsFile): string {
  return `${JSON.stringify(file, null, 2)}\n`
}

/** The newest row must cover yesterday (UTC) or later; the Worker writes yesterday's row at 05:00 UTC. */
export function isFresh(latestDay: string | null, now: Date): boolean {
  if (!latestDay) return false
  const yesterday = new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10)
  return latestDay >= yesterday
}

function argValue(args: string[], name: string): string | undefined {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}

async function setOutput(name: string, value: string): Promise<void> {
  const file = process.env.GITHUB_OUTPUT
  if (!file) return
  const { appendFile } = await import('node:fs/promises')
  await appendFile(file, `${name}=${value}\n`)
}

async function exportCommand(args: string[]): Promise<number> {
  const { mkdir, readFile, writeFile } = await import('node:fs/promises')
  const { join } = await import('node:path')
  const dir = argValue(args, '--dir') ?? '../../ops/metrics'
  const days = Math.max(1, Math.min(31, Number(argValue(args, '--days') ?? 3)))
  const now = new Date(argValue(args, '--now') ?? Date.now())
  const rowsFile = argValue(args, '--rows')
  const rows = rowsFile
    ? parseD1Json(await readFile(rowsFile, 'utf8'))
    : await queryRemoteD1(`SELECT day, json, created_at FROM metrics_daily ORDER BY day DESC LIMIT ${days}`)

  await mkdir(dir, { recursive: true })
  let written = 0
  let failed = 0
  let latest: string | null = null
  for (const row of rows) {
    try {
      const file = toMetricsFile(row)
      const text = serializeMetricsFile(file)
      const hits = findPersonalData(text)
      if (hits.length) {
        failed++
        console.error(`metrics: ${file.day} NOT written — personal-data guard: ${hits.map(describeFinding).join('; ')}`)
        continue
      }
      await writeFile(join(dir, `${file.day}.json`), text)
      written++
      if (!latest || file.day > latest) latest = file.day
    } catch (e) {
      failed++
      console.error(`metrics: ${e instanceof Error ? e.message : 'invalid row'}`)
    }
  }
  const fresh = isFresh(latest, now)
  console.log(`metrics: ${rows.length} row(s) read, ${written} file(s) written, newest day ${latest ?? 'none'}${fresh ? '' : ' (STALE)'}`)
  await setOutput('latest_day', latest ?? '')
  await setOutput('fresh', String(fresh))
  if (failed) return 1
  return fresh ? 0 : 3
}

async function guardCommand(paths: string[]): Promise<number> {
  const { readdir, readFile, stat } = await import('node:fs/promises')
  const { join } = await import('node:path')
  const files: string[] = []
  for (const p of paths) {
    const s = await stat(p).catch(() => null)
    if (!s) continue
    if (s.isDirectory()) for (const f of (await readdir(p)).sort()) if (f.endsWith('.json')) files.push(join(p, f))
    if (s.isFile()) files.push(p)
  }
  let bad = 0
  for (const f of files) {
    const hits = findPersonalData(await readFile(f, 'utf8'))
    if (hits.length) {
      bad++
      console.error(`pii-guard: ${f}: ${hits.map(describeFinding).join('; ')}`)
    }
  }
  console.log(`pii-guard: ${files.length} file(s) checked, ${bad} with findings`)
  return bad ? 1 : 0
}

export async function main(args: string[]): Promise<number> {
  const [command, ...rest] = args
  if (command === 'export') return exportCommand(rest)
  if (command === 'guard') return guardCommand(rest.length ? rest : ['../../ops/metrics'])
  console.error('usage: metrics.ts export [--dir D] [--days N] [--rows FILE] [--now ISO] | guard <paths...>')
  return 2
}
