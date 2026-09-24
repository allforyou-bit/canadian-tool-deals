import { env } from 'cloudflare:test'
import type Anthropic from '@anthropic-ai/sdk'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { tokenCostMicroUsd } from '../../src/lib/spend'
import { callCost, callGrader, GraderOutputError, parseGraderMessage, SERVER_FALLBACK_BETA } from '../../src/grading/claude'
import { SAFETY_REFUSAL } from '../../src/grading/copy'
import { SYSTEM_PROMPT } from '../../src/grading/prompt'
import { validateGradeJson } from '../../src/grading/validate'
import { apiMessage, type ApiMessage, jsonResponse, SIMPLE_OUTPUT, stubFetch, stubGrader, USAGE } from './helpers'

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
  it('cuts surplus errors and rewrites, drops empty ones, and trims text', () => {
    const many = Array.from({ length: 7 }, (_, i) => ({ kind: 'grammar', original: ` word${i} `, correction: 'w', why: 'y' }))
    const r = validateGradeJson(
      { ...SIMPLE_OUTPUT, topErrors: [{ kind: 'grammar', original: '', correction: '', why: 'y' }, ...many], rewrites: ['a', ' ', 'b', 'c'] },
      'en',
    )
    expect(r.topErrors).toHaveLength(5)
    expect(r.topErrors[0].original).toBe('word0')
    expect(r.rewrites).toEqual(['a', 'b'])
  })

  it('empties feedback fields on a refused result', () => {
    const r = validateGradeJson({ ...SIMPLE_OUTPUT, refused: true, refusalMessage: 'Please ask a lawyer.' }, 'en')
    expect(r).toMatchObject({ refused: true, refusalMessage: 'Please ask a lawyer.', criteria: [], topErrors: [], rewrites: [], nextStep: '' })
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
    expect(body.stream).toBeUndefined()
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

  it('lets API errors through without retrying a 400', async () => {
    const { calls } = stubFetch(() => jsonResponse({ type: 'error', error: { type: 'invalid_request_error', message: 'bad' } }, 400))
    const e = await callGrader(env, input).catch((x: unknown) => x)
    expect(e).not.toBeInstanceOf(GraderOutputError)
    expect((e as { status?: number }).status).toBe(400)
    expect(calls).toHaveLength(1)
  })
})

describe('callCost', () => {
  const usage = (u: Record<string, unknown>) => u as unknown as Anthropic.Beta.Messages.BetaUsage

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
