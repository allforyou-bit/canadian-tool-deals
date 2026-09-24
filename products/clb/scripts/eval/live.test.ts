// Offline tests for the live-eval plumbing: model/key resolution, the pre-flight cost bound, batch
// cancelling, baseline matching and the prompt-cache check. Every API call goes to a stub.
import type Anthropic from '@anthropic-ai/sdk'
import { describe, expect, it, vi } from 'vitest'
import { MODELS } from '../../shared/config'
import { checkBudget, maxBatchCostUsd, runBatch, type BatchRequest } from './batch'
import { CACHE_CHECK_INPUT, checkPromptCache } from './cache-check'
import { readBatchId } from './cancel-batch'
import { evalApiKey, fallbackKeyNotice, resolveGraderModel, resolveGraderSettings } from './client'
import { buildGeneratorRequests } from './gen-synthetic'
import type { EvalMetrics, EvalSample } from './harness'
import { buildRequests, subsetRuns, usableBaseline } from './run-live'
import { buildPlan, selectSubset } from './synthetic-plan'

describe('grader model and settings (R52)', () => {
  it('treats an empty GRADER_MODEL as unset, as the Worker does', () => {
    // Actions exports an unset repository variable as ''
    expect(resolveGraderModel(undefined, { GRADER_MODEL: '' })).toBe(MODELS.defaultGrader)
    expect(resolveGraderModel(undefined, { GRADER_MODEL: '  ' })).toBe(MODELS.defaultGrader)
    expect(resolveGraderModel(undefined, {})).toBe(MODELS.defaultGrader)
    expect(resolveGraderModel(undefined, { GRADER_MODEL: ' claude-sonnet-5 ' })).toBe('claude-sonnet-5')
    expect(resolveGraderModel('claude-opus-5', { GRADER_MODEL: 'claude-sonnet-5' })).toBe('claude-opus-5')
    expect(resolveGraderModel('', { GRADER_MODEL: 'claude-sonnet-5' })).toBe('claude-sonnet-5')
  })

  it('applies GRADER_EFFORT / GRADER_MAX_TOKENS like the Worker, invalid values falling back to config', () => {
    expect(resolveGraderSettings({})).toEqual({ effort: MODELS.graderEffort, maxTokens: MODELS.graderMaxTokens })
    expect(resolveGraderSettings({ GRADER_EFFORT: 'medium', GRADER_MAX_TOKENS: '6000' })).toEqual({ effort: 'medium', maxTokens: 6000 })
    expect(resolveGraderSettings({ GRADER_EFFORT: 'extreme', GRADER_MAX_TOKENS: 'lots' })).toEqual({ effort: MODELS.graderEffort, maxTokens: MODELS.graderMaxTokens })
  })

  it('puts the model and settings into every batch request', () => {
    const samples = buildPlan()
      .slice(0, 1)
      .map((p) => ({ ...p, text: 'Synthetic practice answer.' }))
    const [r] = buildRequests(samples, 1, resolveGraderModel(undefined, { GRADER_MODEL: '' }), { effort: 'medium', maxTokens: 6000 })
    expect(r.params.model).toBe(MODELS.defaultGrader)
    expect(r.params.max_tokens).toBe(6000)
    expect((r.params as unknown as { output_config: { effort: string } }).output_config.effort).toBe('medium')
  })
})

describe('eval API key (R53)', () => {
  it('prefers ANTHROPIC_EVAL_API_KEY and falls back to the production key', () => {
    expect(evalApiKey({ ANTHROPIC_EVAL_API_KEY: 'k-eval', ANTHROPIC_API_KEY: 'k-prod' })).toEqual({ key: 'k-eval', source: 'ANTHROPIC_EVAL_API_KEY' })
    expect(evalApiKey({ ANTHROPIC_EVAL_API_KEY: '', ANTHROPIC_API_KEY: 'k-prod' })).toEqual({ key: 'k-prod', source: 'ANTHROPIC_API_KEY' })
    expect(evalApiKey({ ANTHROPIC_EVAL_API_KEY: '', ANTHROPIC_API_KEY: '' })).toBeNull()
  })

  it('warns as a GitHub annotation inside Actions, never printing the key', () => {
    expect(fallbackKeyNotice({ GITHUB_ACTIONS: 'true', ANTHROPIC_API_KEY: 'k-prod' })).toMatch(/^::warning title=/)
    expect(fallbackKeyNotice({ ANTHROPIC_API_KEY: 'k-prod' })).toMatch(/^warning: /)
    expect(fallbackKeyNotice({ GITHUB_ACTIONS: 'true', ANTHROPIC_API_KEY: 'k-prod' })).not.toContain('k-prod')
  })
})

describe('pre-flight cost bound (R53)', () => {
  const samples: EvalSample[] = buildPlan().map((p) => ({ ...p, text: 'Synthetic practice answer. '.repeat(40) }))

  it('bounds a batch at every request using all of max_tokens, at batch prices', () => {
    const one = buildRequests(samples.slice(0, 1), 1, 'claude-opus-5', { maxTokens: 8000 })
    const b = maxBatchCostUsd(one)
    expect(b.requests).toBe(1)
    expect(b.outputTokens).toBe(8000)
    expect(b.inputTokens).toBeGreaterThan(1000)
    // output alone: 8000 × US$25 / 1M × 0.5 = US$0.10
    expect(b.usd).toBeGreaterThanOrEqual(0.1)
    expect(b.usd).toBeLessThan(0.2)
    expect(maxBatchCostUsd(buildRequests(samples.slice(0, 1), 1, 'claude-sonnet-5', { maxTokens: 8000 })).usd).toBeLessThan(b.usd)
  })

  it('prices an unknown model at the most expensive known one', () => {
    const b = maxBatchCostUsd(buildRequests(samples.slice(0, 1), 1, 'claude-future-9', { maxTokens: 8000 }))
    expect(b.unpricedModels).toEqual(['claude-future-9'])
    expect(b.usd).toBeGreaterThanOrEqual(0.1)
  })

  it('refuses a run whose worst case is above EVAL_BUDGET_USD, and scales with --limit', () => {
    const full = maxBatchCostUsd(buildRequests(samples, 3, 'claude-opus-5', { maxTokens: 8000 }))
    const small = maxBatchCostUsd(buildRequests(selectSubset(samples, 10), 3, 'claude-opus-5', { maxTokens: 8000 }))
    expect(full.requests).toBe(450)
    expect(small.requests).toBe(120)
    expect(checkBudget(full, '20')).toMatch(/worst case for this run is US\$\d+(\.\d+)? \(450 requests/)
    expect(checkBudget(small, '20')).toBeNull()
    expect(checkBudget(full, undefined)).toBeNull()
    expect(checkBudget(full, '')).toBeNull()
    expect(checkBudget(full, 'lots')).toMatch(/positive number/)
    expect(checkBudget(full, '0')).toMatch(/positive number/)
  })

  it('bounds the synthetic-set generation too', () => {
    const b = maxBatchCostUsd(buildGeneratorRequests(buildPlan(), 'claude-opus-5'))
    expect(b.requests).toBe(150)
    // 150 × 4000 output tokens × US$25 / 1M × 0.5 = US$7.50 before input
    expect(b.usd).toBeGreaterThan(7.5)
  })
})

// A stand-in for client.beta.messages.batches.
function fakeClient(statuses: string[]) {
  let i = 0
  const batches = {
    create: vi.fn(async () => ({ id: 'msgbatch_test1' })),
    retrieve: vi.fn(async () => ({
      processing_status: statuses[Math.min(i++, statuses.length - 1)],
      request_counts: { processing: 1, succeeded: 0, errored: 0, expired: 0, canceled: 0 },
    })),
    cancel: vi.fn(async () => ({ processing_status: 'canceling' })),
    results: vi.fn(async () =>
      (async function* () {
        yield { custom_id: 'a', result: { type: 'succeeded' } }
      })(),
    ),
  }
  return { client: { beta: { messages: { batches } } } as unknown as Anthropic, batches }
}

describe('runBatch cancelling (R53)', () => {
  const requests = [{ custom_id: 'a', params: { model: 'm', max_tokens: 1, messages: [] } }] as unknown as BatchRequest[]

  it('returns results and reports the batch id as soon as it exists', async () => {
    const { client, batches } = fakeClient(['in_progress', 'ended'])
    const ids: string[] = []
    const r = await runBatch(client, requests, { log: () => {}, sleep: async () => {}, onBatchId: (id) => void ids.push(id) })
    expect(ids).toEqual(['msgbatch_test1'])
    expect([...r.results.keys()]).toEqual(['a'])
    expect(batches.cancel).not.toHaveBeenCalled()
  })

  it('cancels the batch when the wait limit passes', async () => {
    const { client, batches } = fakeClient(['in_progress'])
    let t = 0
    const run = runBatch(client, requests, { log: () => {}, maxWaitMinutes: 1, now: () => t, sleep: async () => void (t += 30_000) })
    await expect(run).rejects.toThrow(/cancelled so it stops billing/)
    await expect(run).rejects.toMatchObject({ name: 'BatchStoppedError', reason: 'deadline' })
    expect(batches.cancel).toHaveBeenCalledWith('msgbatch_test1')
    expect(batches.results).not.toHaveBeenCalled()
  })

  it('cancels the batch when the run is stopped (SIGTERM from a cancelled or superseded Actions run)', async () => {
    const { client, batches } = fakeClient(['in_progress'])
    const controller = new AbortController()
    const run = runBatch(client, requests, {
      log: () => {},
      signal: controller.signal,
      sleep: async () => controller.abort(new Error('SIGTERM')),
    })
    await expect(run).rejects.toMatchObject({ name: 'BatchStoppedError', reason: 'aborted', batchId: 'msgbatch_test1' })
    expect(batches.cancel).toHaveBeenCalledTimes(1)
  })

  it('keeps the old resume behaviour when cancelOnDeadline is false', async () => {
    const { client, batches } = fakeClient(['in_progress'])
    await expect(runBatch(client, requests, { log: () => {}, maxWaitMinutes: 0, now: (() => { let t = 0; return () => (t += 1) })(), sleep: async () => {}, cancelOnDeadline: false })).rejects.toThrow(/rerun with --batch-id msgbatch_test1/)
    expect(batches.cancel).not.toHaveBeenCalled()
  })

  it('reads batch ids left behind for the cancel step', () => {
    expect(readBatchId('msgbatch_01ABCdef\n')).toBe('msgbatch_01ABCdef')
    expect(readBatchId('')).toBeNull()
    expect(readBatchId('not an id; rm -rf /')).toBeNull()
  })
})

describe('baseline keyed by limit (R64)', () => {
  it('takes the runs of a smaller limit from a larger run (prefix subsets)', () => {
    const all = buildPlan().map((p) => ({ sample: { ...p, text: 't' }, runs: [] }))
    const ids = (xs: { sample: { id: string } }[]) => xs.map((x) => x.sample.id)
    expect(ids(subsetRuns(all, 20))).toEqual(selectSubset(all.map((r) => r.sample), 20).map((s) => s.id))
    expect(subsetRuns(all, 20)).toHaveLength(50)
    // the limit-20 subset of a limit-40 run is the limit-20 subset of the full set
    const forty = subsetRuns(all, 40)
    expect(ids(subsetRuns(forty, 20))).toEqual(ids(subsetRuns(all, 20)))
  })

  const metrics = { runsPerSample: 3 } as unknown as EvalMetrics

  it('compares only against a baseline measured with the same limit', () => {
    expect(usableBaseline({ metrics, limit: 20 }, 20)).toEqual({ metrics, note: null })
    expect(usableBaseline({ metrics, limit: 0 }, 20).metrics).toBeNull()
    expect(usableBaseline({ metrics, limit: 0 }, 20).note).toMatch(/limit 0, this run uses 20/)
    // files written before limits were recorded came from full runs
    expect(usableBaseline({ metrics }, 0)).toEqual({ metrics, note: null })
    expect(usableBaseline(null, 0).note).toMatch(/no baseline yet/)
  })
})

describe('prompt-cache check (memo B3 level B)', () => {
  const usage = (over: Record<string, number>) => ({ input_tokens: 400, output_tokens: 900, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, ...over })
  const message = (u: Record<string, number>) => ({ model: 'claude-opus-5', usage: usage(u), content: [], stop_reason: 'end_turn' }) as unknown as Anthropic.Beta.Messages.BetaMessage

  it('sends the identical production grader request twice and passes when the second reads the cache', async () => {
    const create = vi.fn().mockResolvedValueOnce(message({ cache_creation_input_tokens: 3200 })).mockResolvedValueOnce(message({ cache_read_input_tokens: 3200 }))
    const r = await checkPromptCache(create, 'claude-opus-5', { effort: 'high', maxTokens: 8000 })
    expect(r.ok).toBe(true)
    expect(r.second.cacheReadTokens).toBe(3200)
    expect(create).toHaveBeenCalledTimes(2)
    const [[p1], [p2]] = create.mock.calls
    expect(p2).toEqual(p1)
    // non-batch production params: cache marker on the system prompt, server-side fallbacks on Opus 5
    expect(p1.system[0].cache_control).toEqual({ type: 'ephemeral' })
    expect(p1.fallbacks).toBe('default')
    expect(p1.max_tokens).toBe(8000)
    expect(JSON.stringify(p1.messages)).toContain(CACHE_CHECK_INPUT.text.split('\n')[0])
  })

  it('fails when the second identical request reads nothing from the cache', async () => {
    const create = vi.fn().mockResolvedValue(message({ cache_creation_input_tokens: 3200 }))
    const r = await checkPromptCache(create, 'claude-opus-5', { effort: 'high', maxTokens: 8000 })
    expect(r.ok).toBe(false)
    expect(r.message).toMatch(/MISS/)
  })
})
