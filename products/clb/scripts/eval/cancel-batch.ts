// Cancels Message Batches whose ids were left behind by a stopped eval run (eval.yml runs this in an
// `if: cancelled()` step, so a superseded or cancelled run's batch stops billing). run-live.ts and
// gen-synthetic.ts write the id when the batch is created and delete the file when it has ended, so
// a file that is still there means the batch may still be running.
//
//   ANTHROPIC_EVAL_API_KEY=… node scripts/run.mjs scripts/eval/cancel-batch.ts <id-file>...
//
// Always exits 0: a batch that already ended cannot be cancelled, and that is fine.
import { cancelBatch } from './batch'
import { createEvalClient } from './client'

/** The batch id in a file written by run-live / gen-synthetic, or null when it does not look like one. */
export function readBatchId(text: string): string | null {
  const id = text.trim()
  return /^[A-Za-z0-9_-]{6,128}$/.test(id) ? id : null
}

export async function main(args: string[]): Promise<number> {
  const { existsSync } = await import('node:fs')
  const { readFile, rm } = await import('node:fs/promises')
  const ids: { file: string; id: string }[] = []
  for (const file of args) {
    if (!existsSync(file)) continue
    const id = readBatchId(await readFile(file, 'utf8'))
    if (id) ids.push({ file, id })
    else console.log(`cancel-batch: ${file} holds no batch id`)
  }
  if (!ids.length) {
    console.log('cancel-batch: no batch left running')
    return 0
  }
  const client = createEvalClient(process.env, 'cancel-batch', (l) => console.log(l))
  if (!client) return 0
  for (const { file, id } of ids) {
    await cancelBatch(client, id)
    await rm(file, { force: true })
  }
  return 0
}
