// Daily metrics export (memo §5.2, B8): copies the Worker's aggregate `metrics_daily` rows from D1
// into ops/metrics/<day>.json and guards every committed metrics file against personal data.
//
//   node scripts/run.mjs scripts/metrics.ts export [--dir ../../ops/metrics] [--days 3] [--rows rows.json] [--now ISO]
//   node scripts/run.mjs scripts/metrics.ts guard <file-or-dir>...
//
// export exit codes: 0 ok · 1 invalid row or personal-data hit (nothing written for that row)
//                    3 files written but the newest row is older than yesterday (UTC): the Worker's
//                      daily cron did not run — the workflow opens an issue.
// guard: walks directories recursively and checks EVERY file (any name, extension or case). Only
//   README.md, ads.json and <YYYY-MM-DD>.json may live in ops/metrics; anything else fails. Daily files
//   and ads.json must also match their allowlisted shapes, so no free-text field can slip through.
// File format: ops/metrics/README.md. The row's JSON is written by worker/src/cron.ts (core).
import type { EventName } from '../shared/api'
import type { DailyMetrics } from '../worker/src/cron'
import type { GradeOutcome } from '../worker/src/grading/store'
import { parseAdsJson } from './ads'
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
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/

// ---- allowlists (every key at every level; values must be numbers) ----

export const EVENT_NAMES = ['landing', 'sample_start', 'sample_done', 'signup', 'checkout_start', 'purchase', 'refund'] as const
/** grades.outcome values, plus what the cron reports for rows still pending or without an outcome */
export const OUTCOME_KEYS = ['graded', 'scope_refused', 'safety_refused', 'failed', 'no_speech', 'too_long', 'pending', 'unknown'] as const
const TOP_KEYS = ['day', 'events', 'paidEvents', 'grades', 'outcomes', 'costUsd', 'purchases', 'refunds', 'disputes'] as const
const GROUP_KEYS = {
  grades: ['writing', 'speaking', 'free', 'refused'],
  purchases: ['paid', 'grossCents'],
  refunds: ['count', 'cents'],
} as const
const FILE_KEYS = ['schema', 'day', 'source', 'computedAt', 'metrics'] as const

/** true when the list names exactly the keys of T */
type Covers<T, L extends readonly PropertyKey[]> = [Exclude<keyof T, L[number]>] extends [never] ? ([Exclude<L[number], keyof T>] extends [never] ? true : false) : false
type Assert<T extends true> = T
/**
 * Compile-time guard: `npx tsc -p scripts/tsconfig.json` fails here when worker/src/cron.ts
 * DailyMetrics or shared/api.ts EventName gains, loses or renames a field. Update the allowlists
 * above and ops/metrics/README.md together.
 */
export type AllowlistsMatchDailyMetrics = [
  Assert<Covers<DailyMetrics, typeof TOP_KEYS>>,
  Assert<Covers<DailyMetrics['grades'], (typeof GROUP_KEYS)['grades']>>,
  Assert<Covers<DailyMetrics['purchases'], (typeof GROUP_KEYS)['purchases']>>,
  Assert<Covers<DailyMetrics['refunds'], (typeof GROUP_KEYS)['refunds']>>,
  Assert<Covers<Record<EventName, number>, typeof EVENT_NAMES>>,
  Assert<Covers<Record<GradeOutcome | 'pending' | 'unknown', number>, typeof OUTCOME_KEYS>>,
  Assert<Covers<MetricsFile, typeof FILE_KEYS>>,
]

function isCount(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0
}

function isAmount(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

function unknownKeys(o: Record<string, unknown>, allowed: readonly string[], at: string): string[] {
  return Object.keys(o)
    .filter((k) => !allowed.includes(k))
    .map((k) => `${at}${at ? '.' : ''}${safeKey(k)} is not an allowed field`)
}

/** Key names are printed in problems; long or odd ones are shortened so a log never carries free text. */
function safeKey(k: string): string {
  return /^[A-Za-z0-9_]{1,32}$/.test(k) ? k : `<key of ${[...k].length} chars>`
}

function countMap(v: unknown, allowed: readonly string[], at: string, problems: string[]): void {
  if (!isPlainObject(v)) return void problems.push(`${at} must be an object`)
  problems.push(...unknownKeys(v, allowed, at))
  for (const k of allowed) if (k in v && !isCount(v[k])) problems.push(`${at}.${k} must be a whole number ≥ 0`)
}

/**
 * Validate the Worker's DailyMetrics JSON (aggregate numbers only) against an allowlist: unknown keys
 * at any level are rejected and every leaf must be a number. Returns problems, empty when valid.
 */
export function validateDailyMetrics(value: unknown): string[] {
  const problems: string[] = []
  if (!isPlainObject(value)) return ['metrics must be an object']
  const m = value
  problems.push(...unknownKeys(m, TOP_KEYS, ''))
  if (typeof m.day !== 'string' || !DAY.test(m.day)) problems.push('day must be YYYY-MM-DD')
  countMap(m.events, EVENT_NAMES, 'events', problems)
  // optional: files written before 2026-09-24 lack these (K3 counts paid sample starts from paidEvents)
  if (m.paidEvents !== undefined) countMap(m.paidEvents, EVENT_NAMES, 'paidEvents', problems)
  if (m.outcomes !== undefined) countMap(m.outcomes, OUTCOME_KEYS, 'outcomes', problems)
  for (const [g, keys] of Object.entries(GROUP_KEYS)) {
    const o = m[g]
    if (!isPlainObject(o)) {
      problems.push(`${g} must be an object`)
      continue
    }
    problems.push(...unknownKeys(o, keys, g))
    for (const k of keys) if (!isCount(o[k])) problems.push(`${g}.${k} must be a whole number ≥ 0`)
  }
  if (!isAmount(m.costUsd)) problems.push('costUsd must be a non-negative number')
  if (!isCount(m.disputes)) problems.push('disputes must be a whole number ≥ 0')
  return problems
}

/** Validate a committed ops/metrics/<day>.json file (the whole file, not only `metrics`). */
export function validateMetricsFile(value: unknown, expectedDay?: string): string[] {
  if (!isPlainObject(value)) return ['file must be a JSON object']
  const problems = unknownKeys(value, FILE_KEYS, '')
  if (value.schema !== METRICS_FILE_SCHEMA) problems.push(`schema must be ${METRICS_FILE_SCHEMA}`)
  if (value.source !== 'd1.metrics_daily') problems.push('source must be "d1.metrics_daily"')
  if (typeof value.day !== 'string' || !DAY.test(value.day)) problems.push('day must be YYYY-MM-DD')
  else if (expectedDay && value.day !== expectedDay) problems.push('day differs from the file name')
  if (typeof value.computedAt !== 'string' || !ISO_TIME.test(value.computedAt)) problems.push('computedAt must be an ISO-8601 UTC time')
  problems.push(...validateDailyMetrics(value.metrics).map((p) => `metrics: ${p}`))
  if (isPlainObject(value.metrics) && value.metrics.day !== value.day) problems.push('metrics.day differs from day')
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
  const computedAt = String(row.created_at ?? '')
  if (!ISO_TIME.test(computedAt)) throw new Error(`metrics_daily ${day}: created_at is not an ISO-8601 UTC time`)
  return { schema: METRICS_FILE_SCHEMA, day, source: 'd1.metrics_daily', computedAt, metrics: metrics as DailyMetrics }
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

// ---------- personal-data guard for committed files ----------

export type GuardKind = 'readme' | 'daily' | 'ads' | 'unexpected'

/** What a path (relative to ops/metrics, "/"-separated) may be. Only three kinds of file belong there. */
export function classifyMetricsPath(relPath: string): GuardKind {
  if (relPath === 'README.md') return 'readme'
  if (relPath === 'ads.json') return 'ads'
  if (/^\d{4}-\d{2}-\d{2}\.json$/.test(relPath)) return 'daily'
  return 'unexpected'
}

/**
 * Problems for one file: unexpected files fail; every file except README.md is scanned for personal
 * data whatever its name; daily files and ads.json must also parse into their allowlisted shapes.
 * Messages name rules and positions only, never the matched text.
 */
export function guardFile(relPath: string, text: string): string[] {
  const kind = classifyMetricsPath(relPath)
  if (kind === 'readme') return []
  const problems: string[] = []
  if (kind === 'unexpected') problems.push('unexpected file: only README.md, ads.json and <YYYY-MM-DD>.json belong in ops/metrics (no subfolders)')
  problems.push(...findPersonalData(text).map(describeFinding))
  if (kind === 'daily') {
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      return [...problems, 'not valid JSON']
    }
    problems.push(...validateMetricsFile(parsed, relPath.slice(0, 10)))
  }
  if (kind === 'ads') {
    try {
      parseAdsJson(text)
    } catch (e) {
      // parseAdsJson names rows and fields only
      problems.push(e instanceof Error ? e.message : 'ads.json invalid')
    }
  }
  return problems
}

/** The subset of node:fs/promises the guard walks with (injected in tests). */
export interface GuardFs {
  stat(path: string): Promise<{ isDirectory(): boolean; isFile(): boolean }>
  readdir(path: string, opts: { withFileTypes: true }): Promise<{ name: string; isDirectory(): boolean; isFile(): boolean }[]>
  readFile(path: string, encoding: 'utf8'): Promise<string>
}

/**
 * Every file under each path, recursively, as { path, rel } where rel is relative to the directory
 * given (a file given directly is classified by its base name). Symlinks and other special entries
 * are returned too, so the guard reports them as unexpected instead of skipping them.
 */
export async function collectGuardFiles(paths: string[], fs: GuardFs): Promise<{ path: string; rel: string; readable: boolean }[]> {
  const out: { path: string; rel: string; readable: boolean }[] = []
  const walk = async (dir: string, rel: string): Promise<void> => {
    const entries = (await fs.readdir(dir, { withFileTypes: true })).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    for (const e of entries) {
      const path = `${dir}/${e.name}`
      const r = rel ? `${rel}/${e.name}` : e.name
      if (e.isDirectory()) await walk(path, r)
      else out.push({ path, rel: r, readable: e.isFile() })
    }
  }
  for (const given of paths) {
    const p = given.length > 1 ? given.replace(/\/+$/, '') : given
    const s = await fs.stat(p).catch(() => null)
    if (!s) continue
    if (s.isDirectory()) await walk(p, '')
    else out.push({ path: p, rel: p.split('/').pop() ?? p, readable: s.isFile() })
  }
  return out
}

export async function guardPaths(paths: string[], fs: GuardFs, log: { out: (l: string) => void; err: (l: string) => void } = { out: console.log, err: console.error }): Promise<number> {
  const files = await collectGuardFiles(paths, fs)
  let bad = 0
  for (const f of files) {
    const problems = f.readable ? guardFile(f.rel, await fs.readFile(f.path, 'utf8')) : ['unexpected entry: not a regular file']
    if (problems.length) {
      bad++
      log.err(`pii-guard: ${f.path}: ${problems.join('; ')}`)
    }
  }
  log.out(`pii-guard: ${files.length} file(s) checked, ${bad} with findings`)
  return bad ? 1 : 0
}

async function guardCommand(paths: string[]): Promise<number> {
  const fs = await import('node:fs/promises')
  return guardPaths(paths, fs as unknown as GuardFs)
}

export async function main(args: string[]): Promise<number> {
  const [command, ...rest] = args
  if (command === 'export') return exportCommand(rest)
  if (command === 'guard') return guardCommand(rest.length ? rest : ['../../ops/metrics'])
  console.error('usage: metrics.ts export [--dir D] [--days N] [--rows FILE] [--now ISO] | guard <paths...>')
  return 2
}
