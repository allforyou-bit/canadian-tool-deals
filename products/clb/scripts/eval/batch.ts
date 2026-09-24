// Message Batches helper for the eval scripts (claude-api skill: typescript/claude-api/batches.md).
// Batches run at 50% of standard token prices, most finish within an hour (24 h maximum), and
// results stay available for 29 days. The server-side `fallbacks` parameter is rejected on the
// Batches API, so callers strip it (and its beta header) from every request's params.
//
// Cost control: maxBatchCostUsd() bounds what a batch can cost before it is created (every request
// using all of its max_tokens), and runBatch() cancels the batch (batches.cancel) when the wait limit
// passes or when the caller aborts (SIGTERM/SIGINT from a cancelled or superseded Actions run), so a
// batch nobody will read is not left running and billed.
import Anthropic from '@anthropic-ai/sdk'
import { MODELS } from '../../shared/config'

export type BatchRequest = Anthropic.Beta.Messages.BatchCreateParams.Request
export type BatchParams = BatchRequest['params']
export type BatchResult = Anthropic.Beta.Messages.BetaMessageBatchResult

/** Batches bill every token at 50% of the standard price (claude-api skill, batches.md). */
export const BATCH_PRICE_FACTOR = 0.5

/** Remove fields the Batches API rejects or that belong in headers. */
export function batchSafeParams(params: Record<string, unknown>): BatchParams {
  const { betas: _betas, fallbacks: _fallbacks, fallback_credit_token: _credit, stream: _stream, ...rest } = params
  return rest as unknown as BatchParams
}

export interface CostBound {
  requests: number
  /** ESTIMATE upper bound: UTF-8 bytes of everything rendered into the prompt ÷ 2 */
  inputTokens: number
  /** the sum of every request's max_tokens (thinking is billed as output and counts against it) */
  outputTokens: number
  usd: number
  /** models without a price in config.MODELS.prices; priced at the most expensive known model */
  unpricedModels: string[]
}

/**
 * The most a batch can cost: every request's prompt (bounded at 2 UTF-8 bytes per token, which is
 * above real tokenizer ratios for English and Korean [ESTIMATE]) plus its full max_tokens of output,
 * at config.MODELS prices × BATCH_PRICE_FACTOR, with no cache discount.
 */
export function maxBatchCostUsd(requests: BatchRequest[], prices: Record<string, { inUsd: number; outUsd: number }> = MODELS.prices): CostBound {
  const all = Object.values(prices)
  const worst = { inUsd: Math.max(...all.map((p) => p.inUsd)), outUsd: Math.max(...all.map((p) => p.outUsd)) }
  const unpriced = new Set<string>()
  let inputTokens = 0
  let outputTokens = 0
  let usd = 0
  const encoder = new TextEncoder()
  for (const r of requests) {
    const p = r.params as unknown as Record<string, unknown>
    const price = prices[String(p.model)] ?? (unpriced.add(String(p.model)), worst)
    const rendered = JSON.stringify({ system: p.system, messages: p.messages, output_config: p.output_config, tools: p.tools })
    const inTok = Math.ceil(encoder.encode(rendered).length / 2)
    const outTok = Number(p.max_tokens) || 0
    inputTokens += inTok
    outputTokens += outTok
    usd += ((inTok * price.inUsd + outTok * price.outUsd) / 1e6) * BATCH_PRICE_FACTOR
  }
  return { requests: requests.length, inputTokens, outputTokens, usd: Math.round(usd * 100) / 100, unpricedModels: [...unpriced] }
}

/**
 * Pre-flight check against the budget (US$ per script run, from --budget-usd or EVAL_BUDGET_USD).
 * Returns an error message when the bound is above the budget or the budget is not a positive number.
 */
export function checkBudget(bound: CostBound, budgetRaw: string | undefined): string | null {
  if (budgetRaw === undefined || budgetRaw.trim() === '') return null
  const budget = Number(budgetRaw)
  if (!Number.isFinite(budget) || budget <= 0) return `EVAL_BUDGET_USD must be a positive number of US dollars (got "${budgetRaw}")`
  if (bound.usd > budget) {
    return `the worst case for this run is US$${bound.usd} (${bound.requests} requests, up to ${bound.outputTokens} output tokens), above the budget US$${budget}. Grade fewer samples (--limit / MPC_EVAL_LIMIT), lower GRADER_MAX_TOKENS, or raise MPC_EVAL_BUDGET_USD.`
  }
  return null
}

export class BatchStoppedError extends Error {
  constructor(
    message: string,
    readonly batchId: string,
    readonly reason: 'deadline' | 'aborted',
  ) {
    super(message)
    this.name = 'BatchStoppedError'
  }
}

export interface RunBatchOptions {
  /** resume polling an existing batch instead of creating one */
  batchId?: string
  pollSeconds?: number
  maxWaitMinutes?: number
  log?: (line: string) => void
  /** called as soon as the batch id is known, e.g. to write it where a cancel step can find it */
  onBatchId?: (batchId: string) => void | Promise<void>
  /** aborting cancels the batch (the CLIs abort on SIGTERM / SIGINT) */
  signal?: AbortSignal
  /** cancel the batch when the wait limit passes (default true; a batch nobody reads is not left billing) */
  cancelOnDeadline?: boolean
  /** for tests */
  now?: () => number
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>
}

function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve()
    const t = setTimeout(done, ms)
    function done() {
      clearTimeout(t)
      signal?.removeEventListener('abort', done)
      resolve()
    }
    signal?.addEventListener('abort', done, { once: true })
  })
}

/** Cancel a batch; never throws (an ended batch cannot be cancelled, which is fine). */
export async function cancelBatch(client: Anthropic, batchId: string, log: (l: string) => void = (l) => console.log(l)): Promise<boolean> {
  try {
    const b = await client.beta.messages.batches.cancel(batchId)
    log(`batch ${batchId}: cancel requested (${b.processing_status})`)
    return true
  } catch (e) {
    log(`batch ${batchId}: cancel failed (${e instanceof Error ? e.message.slice(0, 200) : 'error'})`)
    return false
  }
}

export async function runBatch(client: Anthropic, requests: BatchRequest[], opts: RunBatchOptions = {}): Promise<{ batchId: string; results: Map<string, BatchResult> }> {
  const log = opts.log ?? ((l: string) => console.log(l))
  const now = opts.now ?? Date.now
  const sleep = opts.sleep ?? abortableSleep
  const pollMs = (opts.pollSeconds ?? 60) * 1000
  const deadline = now() + (opts.maxWaitMinutes ?? 240) * 60_000
  if (opts.signal?.aborted) throw new Error('aborted before the batch was created')
  let batchId = opts.batchId
  if (!batchId) {
    const created = await client.beta.messages.batches.create({ requests })
    batchId = created.id
    log(`batch ${batchId}: created with ${requests.length} request(s)`)
  } else {
    log(`batch ${batchId}: resuming`)
  }
  await opts.onBatchId?.(batchId)
  for (;;) {
    if (opts.signal?.aborted) {
      await cancelBatch(client, batchId, log)
      throw new BatchStoppedError(`batch ${batchId} cancelled: the run was stopped`, batchId, 'aborted')
    }
    const b = await client.beta.messages.batches.retrieve(batchId)
    const c = b.request_counts
    log(`batch ${batchId}: ${b.processing_status} (processing ${c.processing}, succeeded ${c.succeeded}, errored ${c.errored}, expired ${c.expired}, canceled ${c.canceled})`)
    if (b.processing_status === 'ended') break
    if (now() > deadline) {
      if (opts.cancelOnDeadline === false) throw new BatchStoppedError(`batch ${batchId} still running after the wait limit — rerun with --batch-id ${batchId}`, batchId, 'deadline')
      await cancelBatch(client, batchId, log)
      throw new BatchStoppedError(`batch ${batchId} still running after the wait limit; cancelled so it stops billing`, batchId, 'deadline')
    }
    await sleep(pollMs, opts.signal)
  }
  const results = new Map<string, BatchResult>()
  for await (const item of await client.beta.messages.batches.results(batchId)) results.set(item.custom_id, item.result)
  return { batchId, results }
}

/** Text of a message's text blocks (after the last fallback switch point, if any). */
export function messageText(message: Anthropic.Beta.Messages.BetaMessage): string {
  let start = 0
  message.content.forEach((b, i) => {
    if (b.type === 'fallback') start = i + 1
  })
  return message.content
    .slice(start)
    .map((b) => (b.type === 'text' ? b.text : ''))
    .join('')
    .trim()
}
