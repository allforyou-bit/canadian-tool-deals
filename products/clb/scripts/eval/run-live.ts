// Live grading eval (memo B12): grades every synthetic sample 3 times with the production grader
// request (worker/src/grading/claude.ts buildGraderParams, batch variant) through the Message
// Batches API, parses and filters each output exactly as the Worker does (parseGraderMessage,
// filterResult), then applies the harness thresholds and the >5-point regression rule.
//
//   ANTHROPIC_EVAL_API_KEY=… node scripts/run.mjs scripts/eval/run-live.ts [--in .eval/synthetic/samples.json]
//       [--out .eval/results] [--baseline .eval/baseline/metrics.json] [--runs 3] [--model ID]
//       [--limit N] [--subset-metrics M] [--batch-id ID] [--max-wait-minutes 240] [--budget-usd N]
//
// --limit N grades at most N practice samples (half writing, half speaking) plus every probe and
// benign item, to keep a run cheap; 0 or absent grades the whole set. The baseline is compared only
// when it was measured with the same --limit (metrics.json records it).
// --subset-metrics M also writes metrics-limit-M.json: the metrics of the --limit M subset, taken from
// this run's results (the subset is a prefix of every larger one). The scheduled full run uses it to
// keep a baseline for the smaller limit that pull requests run with.
//
// Key: ANTHROPIC_EVAL_API_KEY, else ANTHROPIC_API_KEY with a warning (scripts/eval/client.ts).
// Model: --model, else GRADER_MODEL (empty = unset), else config.MODELS.defaultGrader (the Worker's
// rule); effort / max_tokens from GRADER_EFFORT / GRADER_MAX_TOKENS like the Worker (graderSettings).
// Budget: before creating the batch, the worst case (every request using all of max_tokens, batch
// prices) must be at most --budget-usd / EVAL_BUDGET_USD (US$), else nothing is sent (exit 2).
// Stopping: the batch id is written to <out>/batch-id.txt while it runs; on SIGTERM/SIGINT or after
// --max-wait-minutes the batch is cancelled (the workflow's cancel step also reads that file).
// Writes metrics.json (aggregate only), summary.md and outputs.jsonl (synthetic outputs, for the
// Actions artifact — never committed). Exit 0 pass, 1 thresholds failed, 2 usage/API/budget error.
import { buildGraderParams, parseGraderMessage, type GraderSettings } from '../../worker/src/grading/claude'
import { filterResult } from '../../worker/src/grading/filter'
import { tokenCostMicroUsd } from '../../worker/src/lib/spend'
import { BATCH_PRICE_FACTOR, batchSafeParams, checkBudget, maxBatchCostUsd, runBatch, type BatchRequest } from './batch'
import { abortOnSignals, argValue, createEvalClient, resolveGraderModel, resolveGraderSettings } from './client'
import { checkThresholds, computeMetrics, renderSummary, validateGradeResult, type EvalMetrics, type EvalSample, type RunOutcome, type SampleRuns } from './harness'
import { selectSubset } from './synthetic-plan'

export const customId = (sampleId: string, run: number) => `${sampleId}__r${run}`

/** One grader request per sample and run, with batch-safe params (no fallbacks, no beta header). */
export function buildRequests(samples: EvalSample[], runs: number, model: string, settings: Partial<Pick<GraderSettings, 'effort' | 'maxTokens'>> = {}): BatchRequest[] {
  return samples.flatMap((s) =>
    Array.from({ length: runs }, (_, k) => ({
      custom_id: customId(s.id, k + 1),
      params: batchSafeParams(
        buildGraderParams(
          { taskId: s.taskId, promptIndex: s.promptIndex, text: s.text, explanationLang: s.explanationLang, model },
          { batch: true, effort: settings.effort, maxTokens: settings.maxTokens },
        ) as unknown as Record<string, unknown>,
      ),
    })),
  )
}

/** The runs of the samples a `--limit n` run would grade (selectSubset keeps a prefix, so it is a subset of any larger run). */
export function subsetRuns(all: SampleRuns[], n: number): SampleRuns[] {
  const keep = new Set(selectSubset(all.map((r) => r.sample), n).map((s) => s.id))
  return all.filter((r) => keep.has(r.sample.id))
}

export interface BaselineFile {
  metrics: EvalMetrics
  /** --limit of the run that produced it; absent in files written before 2026-09-24 */
  limit?: number
}

/** The baseline metrics to compare against, or null with the reason when it does not apply. */
export function usableBaseline(baseline: BaselineFile | null, limit: number): { metrics: EvalMetrics | null; note: string | null } {
  if (!baseline) return { metrics: null, note: 'no baseline yet: the regression rule is skipped' }
  const baseLimit = baseline.limit ?? 0
  if (baseLimit !== limit) return { metrics: null, note: `the baseline was measured with limit ${baseLimit}, this run uses ${limit}: the regression rule is skipped` }
  return { metrics: baseline.metrics, note: null }
}

export async function main(args: string[]): Promise<number> {
  const { existsSync } = await import('node:fs')
  const { appendFile, mkdir, readFile, rm, writeFile } = await import('node:fs/promises')
  const { join } = await import('node:path')
  const inFile = argValue(args, '--in') ?? '.eval/synthetic/samples.json'
  const outDir = argValue(args, '--out') ?? '.eval/results'
  const baselineFile = argValue(args, '--baseline')
  const runs = Math.max(1, Number(argValue(args, '--runs') ?? 3))
  const model = resolveGraderModel(argValue(args, '--model'), process.env)
  const settings = resolveGraderSettings(process.env)
  const limit = Number(argValue(args, '--limit') ?? 0)
  const subsetLimit = Number(argValue(args, '--subset-metrics') ?? 0)
  if (!Number.isInteger(limit) || limit < 0 || !Number.isInteger(subsetLimit) || subsetLimit < 0) {
    console.error('run-live: --limit and --subset-metrics must be whole numbers ≥ 0')
    return 2
  }

  if (!existsSync(inFile)) {
    console.error(`run-live: ${inFile} not found — run scripts/eval/gen-synthetic.ts first`)
    return 2
  }
  let samples = JSON.parse(await readFile(inFile, 'utf8')) as EvalSample[]
  samples = selectSubset(samples, limit)
  const baselineRaw = baselineFile && existsSync(baselineFile) ? (JSON.parse(await readFile(baselineFile, 'utf8')) as BaselineFile) : null
  const { metrics: baseline, note: baselineNote } = usableBaseline(baselineRaw, limit)
  if (baselineNote) console.log(`run-live: ${baselineNote}`)

  const requests = buildRequests(samples, runs, model, settings)
  const bound = maxBatchCostUsd(requests)
  console.log(
    `run-live: ${requests.length} request(s) on ${model} (effort ${settings.effort}, max_tokens ${settings.maxTokens}); worst case US$${bound.usd} (ESTIMATE: every request at max_tokens, batch prices)`,
  )
  if (bound.unpricedModels.length) console.log(`run-live: no price in config for ${bound.unpricedModels.join(', ')}; priced at the most expensive known model`)
  const overBudget = checkBudget(bound, argValue(args, '--budget-usd') ?? process.env.EVAL_BUDGET_USD)
  if (overBudget) {
    console.error(`run-live: not started — ${overBudget}`)
    return 2
  }

  const client = createEvalClient(process.env, 'run-live')
  if (!client) return 2
  await mkdir(outDir, { recursive: true })
  const idFile = join(outDir, 'batch-id.txt')
  const stop = abortOnSignals()
  let batch
  try {
    batch = await runBatch(client, requests, {
      batchId: argValue(args, '--batch-id'),
      maxWaitMinutes: Number(argValue(args, '--max-wait-minutes') ?? 240),
      onBatchId: (id) => writeFile(idFile, `${id}\n`),
      signal: stop.signal,
    })
  } catch (e) {
    console.error(`run-live: ${e instanceof Error ? e.message : 'batch failed'}`)
    return 2
  } finally {
    stop.dispose()
  }
  await rm(idFile, { force: true })

  let costMicroUsd = 0
  const lines: string[] = []
  const all: SampleRuns[] = samples.map((sample) => {
    const outcomes: RunOutcome[] = []
    for (let k = 1; k <= runs; k++) {
      const r = batch.results.get(customId(sample.id, k))
      let outcome: RunOutcome
      if (!r) outcome = { ok: false, error: 'missing result' }
      else if (r.type !== 'succeeded') outcome = { ok: false, error: `batch result ${r.type}` }
      else {
        costMicroUsd += tokenCostMicroUsd(r.message.model, r.message.usage)
        try {
          const result = parseGraderMessage(r.message, sample.explanationLang)
          const problems = validateGradeResult(result, sample.explanationLang)
          outcome = problems.length
            ? { ok: false, error: problems.join('; ') }
            : { ok: true, result, filtered: filterResult(result).result, apiRefusal: r.message.stop_reason === 'refusal' }
        } catch (e) {
          outcome = { ok: false, error: e instanceof Error ? e.message : 'parse failed' }
        }
      }
      outcomes.push(outcome)
      lines.push(JSON.stringify({ id: sample.id, category: sample.category, run: k, ...outcome }))
    }
    return { sample, runs: outcomes }
  })

  const metrics = computeMetrics(all)
  const check = checkThresholds(metrics, baseline)
  // Batches bill at 50% of standard prices (claude-api skill, batches.md)
  const estimatedCostUsd = Math.round((costMicroUsd / 1e6) * BATCH_PRICE_FACTOR * 100) / 100
  const summary = `${renderSummary(metrics, check, baseline)}\n\nModel: \`${model}\` (effort ${settings.effort}, max_tokens ${settings.maxTokens}) · limit ${limit || 'all'} · batch \`${batch.batchId}\` · estimated cost US$${estimatedCostUsd} (ESTIMATE: token counts × config.MODELS prices × ${BATCH_PRICE_FACTOR})${baselineNote ? ` · ${baselineNote}` : ''}\n`

  await writeFile(
    join(outDir, 'metrics.json'),
    `${JSON.stringify({ model, effort: settings.effort, maxTokens: settings.maxTokens, limit, batchId: batch.batchId, runs, pass: check.pass, failures: check.failures, estimatedCostUsd, metrics }, null, 2)}\n`,
  )
  if (subsetLimit > 0 && (limit === 0 || subsetLimit < limit)) {
    const sm = computeMetrics(subsetRuns(all, subsetLimit))
    const sc = checkThresholds(sm, null)
    await writeFile(
      join(outDir, `metrics-limit-${subsetLimit}.json`),
      `${JSON.stringify({ model, effort: settings.effort, maxTokens: settings.maxTokens, limit: subsetLimit, subsetOf: limit, batchId: batch.batchId, runs, pass: sc.pass, failures: sc.failures, metrics: sm }, null, 2)}\n`,
    )
    console.log(`run-live: wrote metrics-limit-${subsetLimit}.json (the limit-${subsetLimit} subset of this run)`)
  }
  await writeFile(join(outDir, 'summary.md'), summary)
  await writeFile(join(outDir, 'outputs.jsonl'), `${lines.join('\n')}\n`)
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, summary)
  console.log(summary)
  return check.pass ? 0 : 1
}
