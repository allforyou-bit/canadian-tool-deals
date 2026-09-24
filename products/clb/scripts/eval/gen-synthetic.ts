// Generates the synthetic eval set (memo B12) with claude-opus-5 through the Message Batches API:
// up to 60 writing answers, 60 speaking transcripts, 10 immigration-advice probes and 20 benign
// immigration-themed answers (plan: scripts/eval/synthetic-plan.ts). Synthetic only — never user
// data. Output goes to .eval/ (gitignored) and, in CI, to an Actions artifact/cache; never to git.
//
//   ANTHROPIC_EVAL_API_KEY=… node scripts/run.mjs scripts/eval/gen-synthetic.ts [--out .eval/synthetic]
//       [--model claude-opus-5] [--limit N] [--batch-id ID] [--max-wait-minutes 240] [--budget-usd N] [--ledger FILE] [--dry-run]
//
// --limit N generates only the items a `run-live.ts --limit N` run grades (synthetic-plan.ts selectSubset),
// so a small eval run pays only for its own samples. --dry-run writes the plan (plan.json) without calling
// the API. Exit 1 when too few items came back, 2 on a usage/API error or when the worst-case cost is above
// what is left of --budget-usd / EVAL_BUDGET_USD (the whole workflow run's budget, ledger.ts).
// Key, budget, ledger and cancelling work as in run-live.ts (scripts/eval/client.ts, batch.ts); the batch
// id is kept in <out>/gen-batch-id.txt while the batch runs.
import { batchSafeParams, checkBudget, maxBatchCostUsd, messageText, resultsCostUsd, runBatch, type BatchRequest } from './batch'
import { abortOnSignals, argValue, createEvalClient } from './client'
import type { EvalSample } from './harness'
import { ledgerSpentUsd, readLedger, recordSpend } from './ledger'
import { buildPlan, GENERATOR_SYSTEM, selectSubset, type PlanItem } from './synthetic-plan'

export const GENERATOR_MODEL = 'claude-opus-5'
const MAX_TOKENS = 4000

export function buildGeneratorRequests(plan: PlanItem[], model: string): BatchRequest[] {
  return plan.map((p) => ({
    custom_id: `gen-${p.id}`,
    params: batchSafeParams({
      model,
      max_tokens: MAX_TOKENS,
      // generation is simple; medium effort keeps thinking (billed as output) modest
      output_config: { effort: 'medium' },
      system: GENERATOR_SYSTEM,
      messages: [{ role: 'user', content: p.brief }],
    }),
  }))
}

export async function main(args: string[]): Promise<number> {
  const { mkdir, rm, writeFile } = await import('node:fs/promises')
  const { join } = await import('node:path')
  const outDir = argValue(args, '--out') ?? '.eval/synthetic'
  const model = argValue(args, '--model')?.trim() || GENERATOR_MODEL
  const limit = Number(argValue(args, '--limit') ?? 0)
  const plan = selectSubset(buildPlan(), limit)
  await mkdir(outDir, { recursive: true })
  await writeFile(join(outDir, 'plan.json'), `${JSON.stringify(plan, null, 2)}\n`)

  if (args.includes('--dry-run')) {
    console.log(`gen-synthetic: dry run — wrote ${plan.length} plan item(s) to ${join(outDir, 'plan.json')}`)
    return 0
  }
  const requests = buildGeneratorRequests(plan, model)
  const bound = maxBatchCostUsd(requests)
  console.log(`gen-synthetic: ${requests.length} request(s) on ${model}; worst case US$${bound.usd} (ESTIMATE: every request at max_tokens, batch prices)`)
  const ledgerFile = argValue(args, '--ledger') ?? (process.env.EVAL_LEDGER || undefined)
  let spentUsd: number
  try {
    spentUsd = ledgerSpentUsd(await readLedger(ledgerFile))
  } catch (e) {
    console.error(`gen-synthetic: not started — ${e instanceof Error ? e.message : 'the spend ledger could not be read'}`)
    return 2
  }
  const overBudget = checkBudget(bound, argValue(args, '--budget-usd') ?? process.env.EVAL_BUDGET_USD, spentUsd)
  if (overBudget) {
    console.error(`gen-synthetic: not started — ${overBudget}`)
    return 2
  }
  const client = createEvalClient(process.env, 'gen-synthetic')
  if (!client) return 2

  const idFile = join(outDir, 'gen-batch-id.txt')
  const what = `gen-synthetic ${model}`
  const stop = abortOnSignals()
  let created = false
  let batch
  try {
    batch = await runBatch(client, requests, {
      batchId: argValue(args, '--batch-id'),
      maxWaitMinutes: Number(argValue(args, '--max-wait-minutes') ?? 240),
      onBatchId: (id) => {
        created = true
        return writeFile(idFile, `${id}\n`)
      },
      signal: stop.signal,
    })
  } catch (e) {
    console.error(`gen-synthetic: ${e instanceof Error ? e.message : 'batch failed'}`)
    // part of a created batch may have been processed and billed: count its worst case against the budget
    if (created) await recordSpend(ledgerFile, { what, usd: bound.usd, basis: 'worst_case' }).catch(() => undefined)
    return 2
  } finally {
    stop.dispose()
  }
  await rm(idFile, { force: true })
  const { batchId, results } = batch
  const estimatedCostUsd = resultsCostUsd(results.values())
  try {
    await recordSpend(ledgerFile, { what, usd: estimatedCostUsd, basis: 'results' })
  } catch (e) {
    console.error(`gen-synthetic: could not record the cost in the spend ledger (${e instanceof Error ? e.message : 'error'})`)
    return 2
  }

  const samples: EvalSample[] = []
  const problems: Record<string, number> = {}
  const note = (k: string) => (problems[k] = (problems[k] ?? 0) + 1)
  for (const p of plan) {
    const r = results.get(`gen-${p.id}`)
    if (!r) note('missing')
    else if (r.type !== 'succeeded') note(r.type)
    else if (r.message.stop_reason === 'refusal') note('refusal')
    else if (r.message.stop_reason === 'max_tokens') note('max_tokens')
    else {
      const text = messageText(r.message)
      if (text.length < 20) note('empty')
      else samples.push({ id: p.id, kind: p.kind, category: p.category, taskId: p.taskId, promptIndex: p.promptIndex, explanationLang: p.explanationLang, text })
    }
  }

  await writeFile(join(outDir, 'samples.json'), `${JSON.stringify(samples, null, 2)}\n`)
  const byCategory = (c: string) => samples.filter((s) => s.category === c).length
  const report = { batchId, model, limit, planned: plan.length, generated: samples.length, problems, sample: byCategory('sample'), probe: byCategory('probe'), benign: byCategory('benign'), estimatedCostUsd }
  await writeFile(join(outDir, 'gen-report.json'), `${JSON.stringify(report, null, 2)}\n`)
  console.log(`gen-synthetic: ${JSON.stringify(report)}`)

  // every probe and benign item is needed for the refusal checks; allow a 5% shortfall elsewhere
  const plannedOf = (c: string) => plan.filter((p) => p.category === c).length
  const ok = byCategory('probe') === plannedOf('probe') && byCategory('benign') === plannedOf('benign') && byCategory('sample') >= Math.ceil(plannedOf('sample') * 0.95)
  return ok ? 0 : 1
}
