import { env } from 'cloudflare:test'
import type Anthropic from '@anthropic-ai/sdk'
import { APIConnectionTimeoutError } from '@anthropic-ai/sdk'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MODELS } from '../../../shared/config'
import type { Env } from '../../src/env'
import { tokenCostMicroUsd } from '../../src/lib/spend'
import {
  callCost,
  callGrader,
  GraderApiError,
  GraderOutputError,
  graderSettings,
  graderTimeoutMs,
  MAX_TOKENS_MAX,
  MAX_TOKENS_MIN,
  parseGraderMessage,
  SERVER_FALLBACK_BETA,
  worstCaseCallCostMicroUsd,
} from '../../src/grading/claude'
import { SAFETY_REFUSAL, SCOPE_REFUSAL } from '../../src/grading/copy'
import { SYSTEM_PROMPT } from '../../src/grading/prompt'
import { MAX_TOP_ERRORS, validateGradeJson } from '../../src/grading/validate'
import { abortError, apiError, apiMessage, type ApiMessage, jsonResponse, SIMPLE_OUTPUT, stubFetch, stubGrader, USAGE } from './helpers'

type Message = Anthropic.Beta.Messages.BetaMessage
const asMessage = (m: ApiMessage) => m as unknown as Message

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('parseGraderMessage', () => {
  it('returns a GradeResult with server-set fields', () => {
    const r = parseGraderMessage(asMessage(apiMessage(SIMPLE_OUTPUT)), 'ko')
    expect(r).toMatchObject({ refused: false, explanationLang: 'ko', bandShown: false })
    expect(r.criteria).toHaveLength(4)
    expect(r.topErrors).toHaveLength(2)
    expect(r).not.toHaveProperty('refusalMessage')
  })

  it('turns stop_reason "refusal" into a refused result, even with empty content', () => {
    const r = parseGraderMessage(asMessage(apiMessage('', { content: [], stop_reason: 'refusal' })), 'en')
    expect(r).toMatchObject({ refused: true, refusalMessage: SAFETY_REFUSAL.en, criteria: [], topErrors: [], rewrites: [] })
  })

  it('gives a scope refusal the fixed SCOPE_REFUSAL, never model text', () => {
    const out = { ...SIMPLE_OUTPUT, refused: true, criteria: [], topErrors: [], rewrites: [], nextStep: '', refusalMessage: 'Your CRS score is too low.' }
    expect(parseGraderMessage(asMessage(apiMessage(out)), 'ko')).toMatchObject({ refused: true, refusalMessage: SCOPE_REFUSAL.ko })
  })

  it('throws on max_tokens and on a context-window stop', () => {
    expect(() => parseGraderMessage(asMessage(apiMessage('{"refused":', { stop_reason: 'max_tokens' })))).toThrow(/max_tokens/)
    expect(() => parseGraderMessage(asMessage(apiMessage(SIMPLE_OUTPUT, { stop_reason: 'model_context_window_exceeded' })))).toThrow()
  })

  it('throws on invalid JSON, empty text and schema violations', () => {
    expect(() => parseGraderMessage(asMessage(apiMessage('not json')))).toThrow(/invalid JSON/)
    expect(() => parseGraderMessage(asMessage(apiMessage('', { content: [] })))).toThrow(/no text/)
    const bad = [
      { ...SIMPLE_OUTPUT, refused: 'no' },
      { ...SIMPLE_OUTPUT, criteria: [] },
      { ...SIMPLE_OUTPUT, criteria: [{ name: 'x', strengths: 1, improve: 'y' }] },
      { ...SIMPLE_OUTPUT, topErrors: [{ kind: 'pronunciation', original: 'a', correction: 'b', why: 'c' }] },
      { ...SIMPLE_OUTPUT, rewrites: 'one' },
      { ...SIMPLE_OUTPUT, nextStep: null },
      [SIMPLE_OUTPUT],
    ]
    for (const b of bad) expect(() => parseGraderMessage(asMessage(apiMessage(b)))).toThrow()
  })

  it('reads the text after the last fallback switch point and ignores thinking blocks', () => {
    const m = apiMessage(SIMPLE_OUTPUT)
    m.content = [
      { type: 'fallback', from: { model: 'claude-opus-5' }, to: { model: 'claude-opus-4-8' } },
      { type: 'thinking', thinking: '', signature: 'sig' },
      ...m.content,
    ]
    expect(parseGraderMessage(asMessage(m)).criteria).toHaveLength(4)
  })
})

describe('validateGradeJson', () => {
  it('cuts surplus errors (the pages promise up to three) and rewrites, drops empty ones, and trims text', () => {
    expect(MAX_TOP_ERRORS).toBe(3)
    const many = Array.from({ length: 7 }, (_, i) => ({ kind: 'grammar', original: ` word${i} `, correction: 'w', why: 'y' }))
    const r = validateGradeJson(
      { ...SIMPLE_OUTPUT, topErrors: [{ kind: 'grammar', original: '', correction: '', why: 'y' }, ...many], rewrites: ['a', ' ', 'b', 'c'] },
      'en',
    )
    expect(r.topErrors).toHaveLength(3)
    expect(r.topErrors.map((e) => e.original)).toEqual(['word0', 'word1', 'word2'])
    expect(r.rewrites).toEqual(['a', 'b'])
  })

  it('empties feedback fields on a refused result and uses the fixed refusal copy', () => {
    const r = validateGradeJson({ ...SIMPLE_OUTPUT, refused: true, refusalMessage: 'Please ask a lawyer.' }, 'en')
    expect(r).toMatchObject({ refused: true, refusalMessage: SCOPE_REFUSAL.en, criteria: [], topErrors: [], rewrites: [], nextStep: '' })
  })
})

describe('graderSettings (GRADER_EFFORT, GRADER_MAX_TOKENS)', () => {
  const settings = (e?: string, t?: string) => graderSettings({ GRADER_EFFORT: e, GRADER_MAX_TOKENS: t })

  it('defaults to config', () => {
    expect(settings()).toEqual({ effort: MODELS.graderEffort, maxTokens: MODELS.graderMaxTokens, timeoutMs: graderTimeoutMs(MODELS.graderMaxTokens) })
  })

  it('accepts every documented effort level, trimmed and in any case', () => {
    for (const e of ['low', 'medium', 'high', 'xhigh', 'max']) expect(settings(` ${e.toUpperCase()} `).effort).toBe(e)
  })

  it('accepts integer max_tokens within bounds', () => {
    expect(settings(undefined, '3500')).toMatchObject({ maxTokens: 3500, timeoutMs: graderTimeoutMs(3500) })
    expect(settings(undefined, String(MAX_TOKENS_MIN)).maxTokens).toBe(MAX_TOKENS_MIN)
    expect(settings(undefined, String(MAX_TOKENS_MAX)).maxTokens).toBe(MAX_TOKENS_MAX)
  })

  it('falls back to config for invalid values', () => {
    for (const e of ['', 'extreme', 'hi gh', 'none']) expect(settings(e).effort).toBe(MODELS.graderEffort)
    for (const t of ['', 'abc', '-5', '3000.5', '1e4', '0', String(MAX_TOKENS_MIN - 1), String(MAX_TOKENS_MAX + 1)]) {
      expect(settings(undefined, t).maxTokens, t).toBe(MODELS.graderMaxTokens)
    }
  })

  it('allows time for max_tokens of output (8,000 tokens: 255 s) within the SDK non-streaming limit', () => {
    expect(graderTimeoutMs(8000)).toBe(255_000)
    expect(graderTimeoutMs(MAX_TOKENS_MAX)).toBeLessThanOrEqual(30_000 + 10 * 60 * 1000)
  })
})

describe('callGrader (stubbed fetch)', () => {
  const input = { taskId: 'survey', promptIndex: 1, text: 'I prefer option B.', explanationLang: 'en' as const, model: 'claude-opus-5' }

  it('sends the documented request shape to the Messages API', async () => {
    const { calls } = stubGrader(apiMessage(SIMPLE_OUTPUT))
    const out = await callGrader(env, input)
    expect(out.result.criteria).toHaveLength(4)
    expect(out.model).toBe('claude-opus-5')
    expect(out.stopReason).toBe('end_turn')
    expect(out.usage).toMatchObject(USAGE)

    expect(calls).toHaveLength(1)
    const { body, headers, url } = calls[0]
    expect(new URL(url).pathname).toBe('/v1/messages')
    expect(headers.get('x-api-key')).toBe('sk-ant-test')
    expect(headers.get('anthropic-beta')).toBe(SERVER_FALLBACK_BETA)
    expect(body.fallbacks).toBe('default')
    expect(body.betas).toBeUndefined()
    expect(body.system).toEqual([{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }])
    expect(body.thinking).toEqual({ type: 'adaptive' })
    expect(body.output_config).toMatchObject({ effort: 'high', format: { type: 'json_schema' } })
    expect(body.max_tokens).toBe(MODELS.graderMaxTokens)
    expect(body.stream).toBeUndefined()
    expect(headers.get('x-stainless-timeout')).toBe(String(graderTimeoutMs(MODELS.graderMaxTokens) / 1000))
    expect(out.lostAttemptsMicroUsd).toBe(0)
  })

  it('uses GRADER_EFFORT and GRADER_MAX_TOKENS from the environment', async () => {
    const { calls } = stubGrader(apiMessage(SIMPLE_OUTPUT))
    await callGrader({ ...(env as Env), GRADER_EFFORT: 'low', GRADER_MAX_TOKENS: '3000' }, input)
    expect(calls[0].body).toMatchObject({ max_tokens: 3000, output_config: { effort: 'low' } })
    expect(calls[0].headers.get('x-stainless-timeout')).toBe(String(Math.trunc(graderTimeoutMs(3000) / 1000)))
  })

  it('sends no fallbacks or beta header for other models', async () => {
    const { calls } = stubGrader(apiMessage(SIMPLE_OUTPUT, { model: 'claude-sonnet-5' }))
    await callGrader(env, { ...input, model: 'claude-sonnet-5' })
    expect(calls[0].body.model).toBe('claude-sonnet-5')
    expect(calls[0].body.fallbacks).toBeUndefined()
    expect(calls[0].headers.get('anthropic-beta')).toBeNull()
  })

  it('throws GraderOutputError carrying usage for unusable output', async () => {
    stubGrader(apiMessage('{"refused": false, "crit', { stop_reason: 'max_tokens' }))
    const e = await callGrader(env, input).catch((x: unknown) => x)
    expect(e).toBeInstanceOf(GraderOutputError)
    expect((e as GraderOutputError).call.usage).toMatchObject(USAGE)
    expect((e as GraderOutputError).call.stopReason).toBe('max_tokens')
  })

  it('does not retry a 400, and bills nothing for it', async () => {
    const { calls } = stubFetch(() => jsonResponse({ type: 'error', error: { type: 'invalid_request_error', message: 'bad' } }, 400))
    const e = await callGrader(env, input).catch((x: unknown) => x)
    expect(e).toBeInstanceOf(GraderApiError)
    expect(e).toMatchObject({ status: 400, billableAttempts: 0, costMicroUsd: 0 })
    expect((e as GraderApiError).cause).toMatchObject({ status: 400 })
    expect(calls).toHaveLength(1)
  })

  const worst = worstCaseCallCostMicroUsd(input, MODELS.graderMaxTokens)

  it('does not retry a timeout, and bills it at the worst case', async () => {
    const { calls } = stubFetch(() => {
      throw abortError()
    })
    const e = await callGrader(env, input).catch((x: unknown) => x)
    expect(e).toMatchObject({ status: null, billableAttempts: 1, costMicroUsd: worst })
    expect((e as GraderApiError).cause).toBeInstanceOf(APIConnectionTimeoutError)
    expect(calls).toHaveLength(1)
  })

  it('retries a failed connection once; both attempts may have run', async () => {
    const { calls } = stubFetch(() => {
      throw new TypeError('network connection lost')
    })
    const e = await callGrader(env, input).catch((x: unknown) => x)
    expect(e).toMatchObject({ billableAttempts: 2, costMicroUsd: 2 * worst })
    expect(calls).toHaveLength(2)
  })

  it('retries 429 and 529 once without billing them', async () => {
    for (const [status, type] of [
      [429, 'rate_limit_error'],
      [529, 'overloaded_error'],
    ] as const) {
      const { calls } = stubFetch(() => apiError(status, type))
      const e = await callGrader(env, input).catch((x: unknown) => x)
      expect(e).toMatchObject({ status, billableAttempts: 0, costMicroUsd: 0 })
      expect(calls).toHaveLength(2)
    }
  })

  it('succeeds on the retry after a 529, with nothing extra billed', async () => {
    let n = 0
    const { calls } = stubFetch(() => (++n === 1 ? apiError(529, 'overloaded_error') : jsonResponse(apiMessage(SIMPLE_OUTPUT))))
    const out = await callGrader(env, input)
    expect(calls).toHaveLength(2)
    expect(out.lostAttemptsMicroUsd).toBe(0)
    expect(callCost(out).costMicroUsd).toBe(tokenCostMicroUsd('claude-opus-5', USAGE))
  })

  it('adds the worst case of a lost 5xx attempt to a later response and to unusable output', async () => {
    let n = 0
    stubFetch(() => (++n === 1 ? apiError(500) : jsonResponse(apiMessage(SIMPLE_OUTPUT))))
    const out = await callGrader(env, input)
    expect(callCost(out).costMicroUsd).toBe(tokenCostMicroUsd('claude-opus-5', USAGE) + worst)

    n = 0
    stubFetch(() => (++n === 1 ? apiError(502) : jsonResponse(apiMessage('not json'))))
    const e = (await callGrader(env, input).catch((x: unknown) => x)) as GraderOutputError
    expect(e).toBeInstanceOf(GraderOutputError)
    expect(callCost(e.call).costMicroUsd).toBe(tokenCostMicroUsd('claude-opus-5', USAGE) + worst)
  })
})

describe('worstCaseCallCostMicroUsd', () => {
  const input = { taskId: 'email', promptIndex: 0, text: 'Hello neighbour.', explanationLang: 'en' as const, model: 'claude-opus-5' }

  it('prices the full max_tokens of output plus all input as a cache write', () => {
    const w = worstCaseCallCostMicroUsd(input, 8000)
    expect(w).toBeGreaterThan(8000 * 25 + (SYSTEM_PROMPT.length / 4) * 5)
    expect(worstCaseCallCostMicroUsd(input, 4000)).toBe(w - 4000 * 25)
  })

  it('is several times the measured cost of a typical grade', () => {
    expect(worstCaseCallCostMicroUsd(input, 8000)).toBeGreaterThan(4 * tokenCostMicroUsd('claude-opus-5', USAGE))
  })

  it('grows with the learner text and prices unknown models at the highest rate', () => {
    expect(worstCaseCallCostMicroUsd({ ...input, text: 'x'.repeat(6000) }, 8000)).toBeGreaterThan(worstCaseCallCostMicroUsd(input, 8000))
    expect(worstCaseCallCostMicroUsd({ ...input, model: 'claude-future-9' }, 8000)).toBe(worstCaseCallCostMicroUsd(input, 8000))
  })
})

describe('callCost', () => {
  const usage = (u: Record<string, unknown>) => u as unknown as Anthropic.Beta.Messages.BetaUsage

  it('adds the worst-case cost of lost attempts to the cost, not to the token counts', () => {
    const c = callCost({ model: 'claude-opus-5', usage: usage({ ...USAGE }), lostAttemptsMicroUsd: 1234 })
    expect(c).toMatchObject({ inputTokens: 500, outputTokens: 1200, costMicroUsd: tokenCostMicroUsd('claude-opus-5', USAGE) + 1234 })
  })

  it('prices the top-level usage when there are no iterations', () => {
    const c = callCost({ model: 'claude-opus-5', usage: usage({ ...USAGE, iterations: null }) })
    expect(c).toEqual({
      inputTokens: 500,
      outputTokens: 1200,
      cacheReadTokens: 1950,
      cacheWriteTokens: 0,
      costMicroUsd: tokenCostMicroUsd('claude-opus-5', USAGE),
    })
    // 500×5 + 1200×25 + 1950×5×0.1 = 33,475 micro-USD
    expect(c.costMicroUsd).toBe(33_475)
  })

  it('sums every attempt of a server-side fallback at each model’s own price', () => {
    const declined = { type: 'message', model: 'claude-opus-5', input_tokens: 400, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }
    const served = { type: 'fallback_message', model: 'claude-opus-4-8', input_tokens: 2400, output_tokens: 1000, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }
    const c = callCost({ model: 'claude-opus-4-8', usage: usage({ ...served, iterations: [declined, served] }) })
    expect(c.inputTokens).toBe(2800)
    expect(c.outputTokens).toBe(1000)
    expect(c.costMicroUsd).toBe(tokenCostMicroUsd('claude-opus-5', declined) + tokenCostMicroUsd('claude-opus-4-8', served))
  })
})
