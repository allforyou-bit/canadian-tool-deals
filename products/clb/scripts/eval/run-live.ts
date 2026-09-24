// Live grading eval (memo B12): grades every synthetic sample 3 times with the production grader
// request (worker/src/grading/claude.ts buildGraderParams, batch variant) through the Message
// Batches API, parses and filters each output exactly as the Worker does (parseGraderMessage,
// filterResult), then applies the harness thresholds and the >5-point regression rule.
//
//   ANTHROPIC_API_KEY=… node scripts/run.mjs scripts/eval/run-live.ts [--in .eval/synthetic/samples.json]
//       [--out .eval/results] [--baseline .eval/baseline/metrics.json] [--runs 3] [--model ID]
//       [--limit N] [--batch-id ID] [--max-wait-minutes 240]
//
// --limit N grades at most N practice samples (half writing, half speaking) plus every probe and
// benign item, to keep a run cheap; 0 or absent grades the whole set.
//
// Model: --model, else GRADER_MODEL, else config.MODELS.defaultGrader (the Worker's rule).
// Writes metrics.json (aggregate only), summary.md and outputs.jsonl (synthetic outputs, for the
// Actions artifact — never committed). Exit 0 pass, 1 thresholds failed, 2 usage/API error.
import Anthropic from '@anthropic-ai/sdk'
import { MODELS } from '../../shared/config'
import { buildGraderParams, parseGraderMessage } from '../../worker/src/grading/claude'
import { filterResult } from '../../worker/src/grading/filter'
import { tokenCostMicroUsd } from '../../worker/src/lib/spend'
import { batchSafeParams, runBatch, type BatchRequest } from './batch'
import { checkThresholds, computeMetrics, renderSummary, validateGradeResult, type EvalMetrics, type EvalSample, type RunOutcome, type SampleRuns } from './harness'
import { selectSubset } from './synthetic-plan'

function argValue(args: string[], name: string): string | undefined {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}

export const customId = (sampleId: string, run: number) => `${sampleId}__r${run}`

/** One grader request per sample and run, with batch-safe params (no fallbacks, no beta header). */
export function buildRequests(samples: EvalSample[], runs: number, model: string): BatchRequest[] {
  return samples.flatMap((s) =>
    Array.from({ length: runs }, (_, k) => ({
      custom_id: customId(s.id, k + 1),
      params: batchSafeParams(
        buildGraderParams({ taskId: s.taskId, promptIndex: s.promptIndex, text: s.text, explanationLang: s.explanationLang, model }, { batch: true }) as unknown as Record<string, unknown>,
      ),
    })),
  )
}

export async function main(args: string[]): Promise<number> {
  const { existsSync } = await import('node:fs')
  const { appendFile, mkdir, readFile, writeFile } = await import('node:fs/promises')
  const { join } = await import('node:path')
  const inFile = argValue(args, '--in') ?? '.eval/synthetic/samples.json'
  const outDir = argValue(args, '--out') ?? '.eval/results'
  const baselineFile = argValue(args, '--baseline')
  const runs = Math.max(1, Number(argValue(args, '--runs') ?? 3))
  const model = argValue(args, '--model') ?? process.env.GRADER_MODEL ?? MODELS.defaultGrader
  const limit = Number(argValue(args, '--limit') ?? 0)

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('run-live: ANTHROPIC_API_KEY is not set')
    return 2
  }
  if (!existsSync(inFile)) {
    console.error(`run-live: ${inFile} not found — run scripts/eval/gen-synthetic.ts first`)
    return 2
  }
  let samples = JSON.parse(await readFile(inFile, 'utf8')) as EvalSample[]
  samples = selectSubset(samples, limit)
  const baseline = baselineFile && existsSync(baselineFile) ? (JSON.parse(await readFile(baselineFile, 'utf8')) as { metrics: EvalMetrics }).metrics : null

  const client = new Anthropic()
  let batch
  try {
    batch = await runBatch(client, buildRequests(samples, runs, model), {
      batchId: argValue(args, '--batch-id'),
      maxWaitMinutes: Number(argValue(args, '--max-wait-minutes') ?? 240),
    })
  } catch (e) {
    console.error(`run-live: ${e instanceof Error ? e.message : 'batch failed'}`)
    return 2
  }

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
  const estimatedCostUsd = Math.round((costMicroUsd / 1e6) * 0.5 * 100) / 100
  const summary = `${renderSummary(metrics, check, baseline)}\n\nModel: \`${model}\` · batch \`${batch.batchId}\` · estimated cost US$${estimatedCostUsd} (ESTIMATE: token counts × config.MODELS prices × 0.5)\n`

  await mkdir(outDir, { recursive: true })
  await writeFile(join(outDir, 'metrics.json'), `${JSON.stringify({ model, batchId: batch.batchId, runs, pass: check.pass, failures: check.failures, estimatedCostUsd, metrics }, null, 2)}\n`)
  await writeFile(join(outDir, 'summary.md'), summary)
  await writeFile(join(outDir, 'outputs.jsonl'), `${lines.join('\n')}\n`)
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, summary)
  console.log(summary)
  return check.pass ? 0 : 1
}
