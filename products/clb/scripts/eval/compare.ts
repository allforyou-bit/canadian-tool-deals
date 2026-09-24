// Side-by-side report of eval runs on different grader models (eval.yml "compare", memo §7.2 Z6): the same
// synthetic samples graded by run-live.ts once per model (claude-opus-5 and claude-sonnet-5), read back
// from each run's metrics.json and shown in one Markdown table for the job summary and the artifact.
// Aggregate numbers only. The thresholds are the harness's pass/fail gates (harness.ts THRESHOLDS); the
// choice of model stays the owner's (MPC_GRADER_MODEL).
//
//   node scripts/run.mjs scripts/eval/compare.ts <metrics.json>... [--out FILE]
//
// Exit 0 when every file was read; 1 when one is missing or invalid (that model's run did not finish:
// see its step log), after reporting the others.
import { THRESHOLDS, type EvalMetrics, type Rate } from './harness'

export interface RunMetricsFile {
  model: string
  effort: string
  maxTokens: number
  limit: number
  runs: number
  /** requests in the batch (absent in files written before the compare mode existed) */
  requests?: number
  pass: boolean
  failures: string[]
  estimatedCostUsd: number
  metrics: EvalMetrics
}

export type CompareColumn = { file: string; run: RunMetricsFile } | { file: string; error: string }

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const isRate = (v: unknown): v is Rate => isObj(v) && typeof v.count === 'number' && typeof v.total === 'number' && (v.rate === null || typeof v.rate === 'number')

const RATE_KEYS = ['schemaValidity', 'forbiddenBeforeFilter', 'forbiddenAfterFilter', 'top3Consistency', 'probeRefusal', 'benignRefusal', 'sampleRefusal'] as const

/** A run-live.ts metrics.json; throws with a short reason (never the file's text) when it is not one. */
export function parseRunMetrics(text: string): RunMetricsFile {
  let o: unknown
  try {
    o = JSON.parse(text)
  } catch {
    throw new Error('not valid JSON')
  }
  if (!isObj(o) || typeof o.model !== 'string' || typeof o.pass !== 'boolean' || !Array.isArray(o.failures) || typeof o.estimatedCostUsd !== 'number') {
    throw new Error('not a run-live metrics.json (model, pass, failures, estimatedCostUsd)')
  }
  const m = o.metrics
  if (!isObj(m) || !isObj(m.samples) || !RATE_KEYS.every((k) => isRate(m[k]))) throw new Error('metrics are missing or incomplete')
  return o as unknown as RunMetricsFile
}

const pct = (r: number | null) => (r === null ? 'n/a' : `${(r * 100).toFixed(1)}%`)
const rateCell = (r: Rate) => `${pct(r.rate)} (${r.count}/${r.total})`
const usd = (v: number) => `US$${v < 0.1 ? v.toFixed(3) : v.toFixed(2)}`

/** Graded requests of a run (every run of every sample), for the cost per grade. */
export function gradedRequests(run: RunMetricsFile): number {
  return run.requests ?? run.metrics.schemaValidity.total
}

/** The Markdown comparison: one column per model, the harness targets in the first column. */
export function renderComparison(columns: CompareColumn[]): string {
  const ok = columns.filter((c): c is Extract<CompareColumn, { run: RunMetricsFile }> => 'run' in c)
  const head = `| | ${columns.map((c) => ('run' in c ? `\`${c.run.model}\`` : `\`${c.file}\``)).join(' | ')} |`
  const sep = `|---|${columns.map(() => '---|').join('')}`
  const row = (label: string, cell: (r: RunMetricsFile) => string) => `| ${label} | ${columns.map((c) => ('run' in c ? cell(c.run) : '—')).join(' | ')} |`
  const perGrade = (r: RunMetricsFile) => (gradedRequests(r) > 0 ? r.estimatedCostUsd / gradedRequests(r) : null)
  const lines = [
    '## Grading eval: model comparison',
    '',
    ok.length
      ? `Same synthetic samples for every model: ${ok[0].run.metrics.samples.sample} practice, ${ok[0].run.metrics.samples.benign} benign immigration-themed, ${ok[0].run.metrics.samples.probe} probes · ${ok[0].run.runs} runs each · effort ${ok[0].run.effort}, max_tokens ${ok[0].run.maxTokens}.`
      : 'No model run finished.',
    '',
    head,
    sep,
    row('Result (all thresholds)', (r) => (r.pass ? 'PASS' : `FAIL (${r.failures.length})`)),
    row(`Schema validity (≥ ${pct(THRESHOLDS.schemaValidity)})`, (r) => rateCell(r.metrics.schemaValidity)),
    row(`Outputs with forbidden claims after the filter (${THRESHOLDS.forbiddenAfterFilter})`, (r) => rateCell(r.metrics.forbiddenAfterFilter)),
    row('Outputs with forbidden claims before the filter (informational)', (r) => rateCell(r.metrics.forbiddenBeforeFilter)),
    row(`Top-3 error-kind consistency (≥ ${pct(THRESHOLDS.top3Consistency)}, ESTIMATE)`, (r) => rateCell(r.metrics.top3Consistency)),
    row('Probes refused in every run (100%)', (r) => rateCell(r.metrics.probeRefusal)),
    row(`Benign themed answers refused (≤ ${pct(THRESHOLDS.benignRefusalMax)})`, (r) => rateCell(r.metrics.benignRefusal)),
    row('Practice samples refused (informational)', (r) => rateCell(r.metrics.sampleRefusal)),
    row('API refusals (stop_reason "refusal")', (r) => String(r.metrics.apiRefusals)),
    row('Estimated cost of this run (batch prices)', (r) => usd(r.estimatedCostUsd)),
    row('Estimated cost per grade (batch prices)', (r) => {
      const v = perGrade(r)
      return v === null ? 'n/a' : usd(v)
    }),
    row('≈ per grade on the live site (standard prices = 2 × batch)', (r) => {
      const v = perGrade(r)
      return v === null ? 'n/a' : `≈ ${usd(v * 2)}`
    }),
    '',
    'Costs are ESTIMATEs from the token counts of this run × the prices in shared/config.ts (MODELS.prices); live grades also use the prompt cache, so the live figure is a rough guide only.',
  ]
  for (const c of ok) {
    if (c.run.failures.length) lines.push('', `**\`${c.run.model}\` failed:**`, '', ...c.run.failures.map((f) => `- ${f}`))
  }
  const missing = columns.filter((c): c is Extract<CompareColumn, { error: string }> => 'error' in c)
  if (missing.length) {
    lines.push('', '**Runs that did not finish** (see the step log for the reason, e.g. the budget or an API error):', '', ...missing.map((c) => `- \`${c.file}\`: ${c.error}`))
  }
  return `${lines.join('\n')}\n`
}

export async function main(args: string[]): Promise<number> {
  const { appendFile, mkdir, readFile, writeFile } = await import('node:fs/promises')
  const { dirname } = await import('node:path')
  const outIdx = args.indexOf('--out')
  const out = outIdx >= 0 ? args[outIdx + 1] : undefined
  const files = args.filter((a, i) => a !== '--out' && (outIdx < 0 || i !== outIdx + 1))
  if (!files.length) {
    console.error('usage: compare.ts <metrics.json>... [--out FILE]')
    return 2
  }
  const columns: CompareColumn[] = []
  for (const file of files) {
    try {
      columns.push({ file, run: parseRunMetrics(await readFile(file, 'utf8')) })
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code
      columns.push({ file, error: code === 'ENOENT' ? 'no metrics.json (the run did not finish)' : e instanceof Error ? e.message : 'unreadable' })
    }
  }
  const md = renderComparison(columns)
  if (out) {
    await mkdir(dirname(out), { recursive: true })
    await writeFile(out, md)
  }
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, md)
  console.log(md)
  return columns.every((c) => 'run' in c) ? 0 : 1
}
