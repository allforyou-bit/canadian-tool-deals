// Generates the synthetic eval set (memo B12) with claude-opus-5 through the Message Batches API:
// 60 writing answers, 60 speaking transcripts, 10 immigration-advice probes and 20 benign
// immigration-themed answers (plan: scripts/eval/synthetic-plan.ts). Synthetic only — never user
// data. Output goes to .eval/ (gitignored) and, in CI, to an Actions artifact/cache; never to git.
//
//   ANTHROPIC_API_KEY=… node scripts/run.mjs scripts/eval/gen-synthetic.ts [--out .eval/synthetic]
//       [--model claude-opus-5] [--limit N] [--batch-id ID] [--dry-run]
//
// --dry-run writes the plan (plan.json) without calling the API. Exit 1 when too few items came back.
import Anthropic from '@anthropic-ai/sdk'
import { batchSafeParams, messageText, runBatch, type BatchRequest } from './batch'
import type { EvalSample } from './harness'
import { buildPlan, GENERATOR_SYSTEM, selectSubset } from './synthetic-plan'

export const GENERATOR_MODEL = 'claude-opus-5'
const MAX_TOKENS = 4000

function argValue(args: string[], name: string): string | undefined {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}

export async function main(args: string[]): Promise<number> {
  const { mkdir, writeFile } = await import('node:fs/promises')
  const { join } = await import('node:path')
  const outDir = argValue(args, '--out') ?? '.eval/synthetic'
  const model = argValue(args, '--model') ?? GENERATOR_MODEL
  const limit = Number(argValue(args, '--limit') ?? 0)
  const plan = selectSubset(buildPlan(), limit)
  await mkdir(outDir, { recursive: true })
  await writeFile(join(outDir, 'plan.json'), `${JSON.stringify(plan, null, 2)}\n`)

  if (args.includes('--dry-run')) {
    console.log(`gen-synthetic: dry run — wrote ${plan.length} plan item(s) to ${join(outDir, 'plan.json')}`)
    return 0
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('gen-synthetic: ANTHROPIC_API_KEY is not set')
    return 2
  }

  const requests: BatchRequest[] = plan.map((p) => ({
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

  const client = new Anthropic()
  const { batchId, results } = await runBatch(client, requests, {
    batchId: argValue(args, '--batch-id'),
    maxWaitMinutes: Number(argValue(args, '--max-wait-minutes') ?? 240),
  })

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
  const report = { batchId, model, planned: plan.length, generated: samples.length, problems, sample: byCategory('sample'), probe: byCategory('probe'), benign: byCategory('benign') }
  await writeFile(join(outDir, 'gen-report.json'), `${JSON.stringify(report, null, 2)}\n`)
  console.log(`gen-synthetic: ${JSON.stringify(report)}`)

  // every probe and benign item is needed for the refusal checks; allow a 5% shortfall elsewhere
  const plannedOf = (c: string) => plan.filter((p) => p.category === c).length
  const ok = byCategory('probe') === plannedOf('probe') && byCategory('benign') === plannedOf('benign') && byCategory('sample') >= Math.ceil(plannedOf('sample') * 0.95)
  return ok ? 0 : 1
}
