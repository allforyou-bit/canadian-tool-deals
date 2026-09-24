// Lighthouse assertion for level-b.yml (memo §7 B1, level B: "Lighthouse mobile performance ≥ 85 on /").
//
//   node scripts/run.mjs scripts/lighthouse-check.ts --min 85 run-1.report.json [run-2.report.json …]
//
// Reads Lighthouse JSON reports (lighthouse <url> --output=json; fields per the Lighthouse repo's
// docs/understanding-results.md: runtimeError, configSettings.formFactor, categories.performance.score
// on a 0–1 scale). A report counts only when it ran without a runtimeError, with the mobile form factor,
// and has a performance score. The check passes when the MEDIAN score of the counted runs is at least
// --min (0–100), which evens out run-to-run noise the way Lighthouse CI does. A missing or unreadable
// report is reported, not thrown; with no counted run the check fails.
// Prints scores and the URL only; appends a table to GITHUB_STEP_SUMMARY when set. Exit 0 / 1.

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

export interface RunScore {
  /** 0–100, or null when the run does not count */
  score: number | null
  problem?: string
  url?: string
}

/** The mobile performance score of one Lighthouse JSON report (0–100), or why it does not count. */
export function scoreFromReport(report: unknown): RunScore {
  if (!isObj(report)) return { score: null, problem: 'not a Lighthouse JSON report' }
  const url = typeof report.finalDisplayedUrl === 'string' ? report.finalDisplayedUrl : undefined
  if (isObj(report.runtimeError)) {
    const code = typeof report.runtimeError.code === 'string' ? report.runtimeError.code : 'unknown'
    return { score: null, problem: `Lighthouse runtime error ${code}`, url }
  }
  const settings = isObj(report.configSettings) ? report.configSettings : {}
  if (settings.formFactor !== 'mobile') return { score: null, problem: `form factor is ${String(settings.formFactor)}, want mobile`, url }
  const perf = isObj(report.categories) && isObj(report.categories.performance) ? report.categories.performance : null
  if (!perf) return { score: null, problem: 'no performance category (run with --only-categories=performance)', url }
  if (typeof perf.score !== 'number' || !Number.isFinite(perf.score)) return { score: null, problem: 'performance score is missing (the page may not have loaded)', url }
  return { score: Math.round(perf.score * 100), url }
}

export function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

export interface LighthouseVerdict {
  ok: boolean
  median: number | null
  lines: string[]
}

/** One entry per expected run: the parsed report, or null when the file was missing or not JSON. */
export function evaluateLighthouse(runs: { name: string; report: unknown | null }[], min: number): LighthouseVerdict {
  const lines: string[] = []
  const scores: number[] = []
  for (const r of runs) {
    const s = r.report === null ? { score: null, problem: 'report missing or not JSON (the run failed)' } : scoreFromReport(r.report)
    if (s.score === null) lines.push(`${r.name}: does not count — ${s.problem}`)
    else {
      scores.push(s.score)
      lines.push(`${r.name}: performance ${s.score}${s.url ? ` (${s.url})` : ''}`)
    }
  }
  if (!scores.length) {
    lines.push(`No Lighthouse run produced a mobile performance score; B1 needs a median of at least ${min}.`)
    return { ok: false, median: null, lines }
  }
  const m = median(scores)
  const ok = m >= min
  lines.push(`Median mobile performance ${m} over ${scores.length} run(s) — ${ok ? 'pass' : 'FAIL'} (B1 needs at least ${min}).`)
  return { ok, median: m, lines }
}

export async function main(args: string[]): Promise<number> {
  const i = args.indexOf('--min')
  const min = i >= 0 ? Number(args[i + 1]) : 85
  const files = args.filter((a, j) => a !== '--min' && (i < 0 || j !== i + 1))
  if (!Number.isFinite(min) || min <= 0 || min > 100 || !files.length) {
    console.error('usage: lighthouse-check.ts [--min 85] report.json [report.json …]')
    return 2
  }
  const { readFile, appendFile } = await import('node:fs/promises')
  const { basename } = await import('node:path')
  const runs: { name: string; report: unknown | null }[] = []
  for (const f of files) {
    let report: unknown | null = null
    try {
      report = JSON.parse(await readFile(f, 'utf8'))
    } catch {
      report = null
    }
    runs.push({ name: basename(f), report })
  }
  const v = evaluateLighthouse(runs, min)
  for (const l of v.lines) console.log(l)
  if (!v.ok) console.log(`::error::Lighthouse (memo B1): ${v.lines[v.lines.length - 1]}`)
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, ['### Lighthouse, mobile performance on / (memo B1)', '', ...v.lines.map((l) => `- ${l}`), ''].join('\n') + '\n')
  }
  return v.ok ? 0 : 1
}
