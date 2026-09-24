// Grader call to the Claude Messages API (CONTRACT §6: also consumed by the eval harness).
// Request shape per the claude-api skill: adaptive thinking + output_config.effort
// (typescript/claude-api/README.md), structured JSON via output_config.format
// (shared/tool-use-concepts.md), an explicit cache breakpoint on the frozen system prompt
// (shared/prompt-caching.md), and server-side refusal fallbacks for Claude Opus 5
// (shared/model-migration.md → Migrating to Claude Opus 5 → New API features). All fields
// below are typed by @anthropic-ai/sdk 0.128.0 (resources/beta/messages/messages.d.ts).
import Anthropic from '@anthropic-ai/sdk'
import type { GradeResult, Lang } from '../../../shared/api'
import { MODELS } from '../../../shared/config'
import type { Env } from '../env'
import { tokenCostMicroUsd } from '../lib/spend'
import { SAFETY_REFUSAL } from './copy'
import { buildUserBlock, GRADE_JSON_SCHEMA, SYSTEM_PROMPT } from './prompt'
import { validateGradeJson } from './validate'

type CreateParams = Anthropic.Beta.Messages.MessageCreateParamsNonStreaming
type Message = Anthropic.Beta.Messages.BetaMessage
type Usage = Anthropic.Beta.Messages.BetaUsage
type StopReason = Anthropic.Beta.Messages.BetaStopReason

export interface GraderInput {
  taskId: string
  promptIndex: number
  text: string
  explanationLang: Lang
  model: string
}

/**
 * The skill's starting point for Claude Opus 5 and Claude Sonnet 5 is the API default, `high`;
 * `low`/`medium` are the cost lever once the eval harness shows no quality loss. Pinning the
 * default explicitly does not change caching (shared/prompt-caching.md § Invalidation hierarchy).
 */
export const GRADER_EFFORT = 'high' as const

/** Beta header for the scalar `fallbacks: "default"` form (not the array form's -06-01 header). */
export const SERVER_FALLBACK_BETA = 'server-side-fallback-2026-07-01' as const

/** Server-side fallbacks are opted into only for the Claude Opus 5 line. */
export function usesServerFallback(model: string): boolean {
  return model.startsWith('claude-opus-5')
}

/**
 * Request params for client.beta.messages.create. `batch: true` drops `fallbacks` and its beta
 * header, which the Message Batches API rejects (typescript/claude-api/README.md § Refusal Fallbacks).
 */
export function buildGraderParams(input: GraderInput, opts: { batch?: boolean } = {}): CreateParams {
  const params: CreateParams = {
    model: input.model,
    max_tokens: MODELS.graderMaxTokens,
    thinking: { type: 'adaptive' },
    output_config: {
      effort: GRADER_EFFORT,
      format: { type: 'json_schema', schema: GRADE_JSON_SCHEMA },
    },
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: buildUserBlock(input) }],
  }
  if (usesServerFallback(input.model) && !opts.batch) {
    params.betas = [SERVER_FALLBACK_BETA]
    params.fallbacks = 'default'
  }
  return params
}

/** Per-request client; fetch is resolved at call time so a stubbed global fetch is honoured. */
export function createClient(env: Env): Anthropic {
  return new Anthropic({
    apiKey: env.ANTHROPIC_API_KEY,
    fetch: (input, init) => fetch(input, init),
    maxRetries: 1,
    timeout: 90_000,
  })
}

/** The model produced a response, but not a usable grade. Carries usage so the cost is recorded. */
export class GraderOutputError extends Error {
  constructor(
    message: string,
    readonly call: { model: string; usage: Usage; stopReason: StopReason | null },
  ) {
    super(message)
    this.name = 'GraderOutputError'
  }
}

/** Text of the serving attempt: text blocks after the last fallback switch point, if any. */
function finalText(message: Message): string {
  const blocks = message.content
  let start = 0
  blocks.forEach((b, i) => {
    if (b.type === 'fallback') start = i + 1
  })
  return blocks
    .slice(start)
    .map((b) => (b.type === 'text' ? b.text : ''))
    .join('')
}

/**
 * Turn a Messages API response into a GradeResult. Checks stop_reason before reading content
 * (a refusal can arrive with empty or partial content). Throws on max_tokens and invalid output.
 */
export function parseGraderMessage(message: Message, explanationLang: Lang = 'en'): GradeResult {
  switch (message.stop_reason) {
    case 'refusal':
      return {
        refused: true,
        refusalMessage: SAFETY_REFUSAL[explanationLang],
        criteria: [],
        topErrors: [],
        rewrites: [],
        nextStep: '',
        explanationLang,
        bandShown: false,
      }
    case 'max_tokens':
    case 'model_context_window_exceeded':
      throw new Error(`grader output truncated (${message.stop_reason})`)
  }
  const text = finalText(message)
  if (text.trim() === '') throw new Error('grader returned no text')
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error('grader returned invalid JSON')
  }
  return validateGradeJson(json, explanationLang)
}

export interface GraderCall {
  result: GradeResult
  model: string
  usage: Usage
  stopReason: StopReason | null
}

/** Call the grader. Throws GraderOutputError (with usage) for unusable output; API errors pass through. */
export async function callGrader(env: Env, input: GraderInput): Promise<GraderCall> {
  const message = await createClient(env).beta.messages.create(buildGraderParams(input))
  const call = { model: message.model, usage: message.usage, stopReason: message.stop_reason }
  try {
    return { ...call, result: parseGraderMessage(message, input.explanationLang) }
  } catch (e) {
    throw new GraderOutputError(e instanceof Error ? e.message : 'invalid grader output', call)
  }
}

export interface CallCost {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  costMicroUsd: number
}

/**
 * Tokens and cost of one call. With server-side fallbacks the top-level usage covers only the
 * serving attempt; `usage.iterations` lists every attempt with its own model (skill:
 * model-migration.md → `refusal` stop reason → Billing), so those are summed when present.
 * Attempts declined before output are reported but not billed; counting them over-states cost,
 * which is the safe direction for the spend caps.
 */
export function callCost(call: { model: string; usage: Usage }): CallCost {
  const attempts = (call.usage.iterations ?? []).flatMap((it) =>
    it.type === 'message' || it.type === 'fallback_message' ? [{ ...it, model: it.model ?? call.model }] : [],
  )
  const parts = attempts.length > 0 ? attempts : [{ ...call.usage, model: call.model }]
  const total: CallCost = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, costMicroUsd: 0 }
  for (const p of parts) {
    total.inputTokens += p.input_tokens
    total.outputTokens += p.output_tokens
    total.cacheReadTokens += p.cache_read_input_tokens ?? 0
    total.cacheWriteTokens += p.cache_creation_input_tokens ?? 0
    total.costMicroUsd += tokenCostMicroUsd(p.model, p)
  }
  return total
}
