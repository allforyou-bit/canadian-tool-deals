// Spend ledger for one eval workflow run (memo §7.2 Z6: a manual eval run has one budget, default US$5).
// eval.yml points every script that creates a Message Batch at the same file (EVAL_LEDGER or --ledger,
// .eval/ledger.json): the synthetic set, the grading run, and in "compare" mode one grading run per model.
// Before a script creates its batch, the batch's worst case must fit in the budget minus what the run's
// earlier batches cost (batch.ts checkBudget); afterwards the script records its own cost:
//   'results'     the ESTIMATE from the token counts of the results that were read (failed and cancelled
//                 requests are not billed), at config.MODELS prices × the batch discount
//   'worst_case'  the pre-flight bound, when a batch was created but its results were never read (stopped,
//                 timed out or failed), because part of it may have been processed and billed
// The file holds amounts and script names only, never prompts or outputs. No file, or no path → nothing
// spent yet. A ledger that cannot be read is an error, so a broken file can never reset the budget.

export interface LedgerEntry {
  /** the script and model that created the batch, e.g. "run-live claude-opus-5" */
  what: string
  usd: number
  basis: 'results' | 'worst_case'
}

const isEntry = (v: unknown): v is LedgerEntry => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false
  const e = v as Record<string, unknown>
  return typeof e.what === 'string' && typeof e.usd === 'number' && Number.isFinite(e.usd) && e.usd >= 0 && (e.basis === 'results' || e.basis === 'worst_case')
}

/** Entries of a ledger file's text; '' or null → none. Throws on anything that is not a list of entries. */
export function parseLedger(text: string | null): LedgerEntry[] {
  if (text === null || text.trim() === '') return []
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('the eval spend ledger is not valid JSON')
  }
  if (!Array.isArray(data) || !data.every(isEntry)) throw new Error('the eval spend ledger must be a list of {what, usd, basis} entries')
  return data
}

/** What the run has spent so far (US$, rounded up to the cent). */
export function ledgerSpentUsd(entries: LedgerEntry[]): number {
  return Math.ceil(Math.round(entries.reduce((s, e) => s + e.usd, 0) * 1e6) / 1e4) / 100
}

/** The ledger's entries; a missing file (or no path) means nothing was spent yet. */
export async function readLedger(file: string | undefined): Promise<LedgerEntry[]> {
  if (!file) return []
  const { readFile } = await import('node:fs/promises')
  const text = await readFile(file, 'utf8').catch((e: NodeJS.ErrnoException) => {
    if (e.code === 'ENOENT') return null
    throw e
  })
  return parseLedger(text)
}

/** Appends one entry (no-op without a path). */
export async function recordSpend(file: string | undefined, entry: LedgerEntry): Promise<void> {
  if (!file) return
  const { mkdir, writeFile } = await import('node:fs/promises')
  const { dirname } = await import('node:path')
  const entries = await readLedger(file)
  entries.push({ what: entry.what, usd: Math.ceil(entry.usd * 100) / 100, basis: entry.basis })
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, `${JSON.stringify(entries, null, 2)}\n`)
}
