// Message Batches helper for the eval scripts (claude-api skill: typescript/claude-api/batches.md).
// Batches run at 50% of standard token prices, most finish within an hour (24 h maximum), and
// results stay available for 29 days. The server-side `fallbacks` parameter is rejected on the
// Batches API, so callers strip it (and its beta header) from every request's params.
import Anthropic from '@anthropic-ai/sdk'

export type BatchRequest = Anthropic.Beta.Messages.BatchCreateParams.Request
export type BatchParams = BatchRequest['params']
export type BatchResult = Anthropic.Beta.Messages.BetaMessageBatchResult

/** Remove fields the Batches API rejects or that belong in headers. */
export function batchSafeParams(params: Record<string, unknown>): BatchParams {
  const { betas: _betas, fallbacks: _fallbacks, fallback_credit_token: _credit, stream: _stream, ...rest } = params
  return rest as unknown as BatchParams
}

export interface RunBatchOptions {
  /** resume polling an existing batch instead of creating one */
  batchId?: string
  pollSeconds?: number
  maxWaitMinutes?: number
  log?: (line: string) => void
}

export async function runBatch(client: Anthropic, requests: BatchRequest[], opts: RunBatchOptions = {}): Promise<{ batchId: string; results: Map<string, BatchResult> }> {
  const log = opts.log ?? ((l: string) => console.log(l))
  const pollMs = (opts.pollSeconds ?? 60) * 1000
  const deadline = Date.now() + (opts.maxWaitMinutes ?? 240) * 60_000
  let batchId = opts.batchId
  if (!batchId) {
    const created = await client.beta.messages.batches.create({ requests })
    batchId = created.id
    log(`batch ${batchId}: created with ${requests.length} request(s)`)
  } else {
    log(`batch ${batchId}: resuming`)
  }
  for (;;) {
    const b = await client.beta.messages.batches.retrieve(batchId)
    const c = b.request_counts
    log(`batch ${batchId}: ${b.processing_status} (processing ${c.processing}, succeeded ${c.succeeded}, errored ${c.errored}, expired ${c.expired}, canceled ${c.canceled})`)
    if (b.processing_status === 'ended') break
    if (Date.now() > deadline) throw new Error(`batch ${batchId} still running after the wait limit — rerun with --batch-id ${batchId}`)
    await new Promise((r) => setTimeout(r, pollMs))
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
