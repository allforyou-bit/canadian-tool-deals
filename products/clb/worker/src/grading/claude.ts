// Grader call to the Claude Messages API (CONTRACT §6: also consumed by the eval harness).
// Request shape per the claude-api skill: adaptive thinking + output_config.effort
// (typescript/claude-api/README.md), structured JSON via output_config.format
// (shared/tool-use-concepts.md), an explicit cache breakpoint on the frozen system prompt
// (shared/prompt-caching.md), and server-side refusal fallbacks for Claude Opus 5
// (shared/model-migration.md → Migrating to Claude Opus 5 → New API features). All fields
// below are typed by @anthropic-ai/sdk 0.128.0 (resources/beta/messages/messages.d.ts).
import Anthropic, { APIConnectionTimeoutError, APIError } from '@anthropic-ai/sdk'
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

/** Effort levels accepted by output_config.effort (SDK 0.128.0 BetaOutputConfig.effort). */
export const EFFORT_LEVELS = ['low', 'medium', 'high', 'xhigh', 'max'] as const
export type GraderEffort = (typeof EFFORT_LEVELS)[number]

/**
 * The skill's starting point for Claude Opus 5 and Claude Sonnet 5 is the API default, `high`;
 * `low`/`medium` are the cost lever once the eval harness shows no quality loss (GRADER_EFFORT).
 * Pinning the default explicitly does not change caching (shared/prompt-caching.md § Invalidation hierarchy).
 */
export const GRADER_EFFORT: GraderEffort = MODELS.graderEffort

/**
 * Bounds for GRADER_MAX_TOKENS. Below ~1,000 adaptive thinking plus the JSON answer truncates; above
 * 21,333 the SDK refuses a non-streaming request (client.js calculateNonstreamingTimeout: 60 min per
 * 128,000 tokens must stay under 10 min).
 */
export const MAX_TOKENS_MIN = 1024
export const MAX_TOKENS_MAX = 20_000

export interface GraderSettings {
  effort: GraderEffort
  maxTokens: number
  /** per-attempt request timeout, long enough for maxTokens of output */
  timeoutMs: number
}

/**
 * Time allowed for one attempt: the SDK's own expected time for a non-streaming request of this
 * max_tokens (60 minutes per 128,000 tokens, client.js) plus 30 s for input processing. 8,000
 * tokens → 255 s.
 */
export function graderTimeoutMs(maxTokens: number): number {
  return 30_000 + Math.ceil((60 * 60 * 1000 * maxTokens) / 128_000)
}

/** GRADER_EFFORT / GRADER_MAX_TOKENS overrides (decision 1); a missing or invalid value falls back to config. */
export function graderSettings(env: Pick<Env, 'GRADER_EFFORT' | 'GRADER_MAX_TOKENS'>): GraderSettings {
  const e = env.GRADER_EFFORT?.trim().toLowerCase()
  const effort = EFFORT_LEVELS.find((l) => l === e) ?? MODELS.graderEffort
  const raw = env.GRADER_MAX_TOKENS?.trim() ?? ''
  const n = /^\d+$/.test(raw) ? Number(raw) : NaN
  const maxTokens = n >= MAX_TOKENS_MIN && n <= MAX_TOKENS_MAX ? n : MODELS.graderMaxTokens
  return { effort, maxTokens, timeoutMs: graderTimeoutMs(maxTokens) }
}

/** Beta header for the scalar `fallbacks: "default"` form (not the array form's -06-01 header). */
export const SERVER_FALLBACK_BETA = 'server-side-fallback-2026-07-01' as const

/** Server-side fallbacks are opted into only for the Claude Opus 5 line. */
export function usesServerFallback(model: string): boolean {
  return model.startsWith('claude-opus-5')
}

/**
 * Request params for client.beta.messages.create. `batch: true` drops `fallbacks` and its beta
 * header, which the Message Batches API rejects (typescript/claude-api/README.md § Refusal Fallbacks).
 * `effort` and `maxTokens` default to config (the Worker passes graderSettings(env)).
 */
export function buildGraderParams(
  input: GraderInput,
  opts: { batch?: boolean; effort?: GraderEffort; maxTokens?: number } = {},
): CreateParams {
  const params: CreateParams = {
    model: input.model,
    max_tokens: opts.maxTokens ?? MODELS.graderMaxTokens,
    thinking: { type: 'adaptive' },
    output_config: {
      effort: opts.effort ?? GRADER_EFFORT,
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

/**
 * Per-request client; fetch is resolved at call time so a stubbed global fetch is honoured. SDK
 * retries are off: callGrader retries once itself, but never a timed-out attempt (that one may
 * still be generating, and billed, on the server).
 */
export function createClient(env: Env, timeoutMs = graderTimeoutMs(MODELS.graderMaxTokens)): Anthropic {
  return new Anthropic({
    apiKey: env.ANTHROPIC_API_KEY,
    fetch: (input, init) => fetch(input, init),
    maxRetries: 0,
    timeout: timeoutMs,
  })
}

/** The model produced a response, but not a usable grade. Carries usage so the cost is recorded. */
export class GraderOutputError extends Error {
  constructor(
    message: string,
    readonly call: { model: string; usage: Usage; stopReason: StopReason | null; lostAttemptsMicroUsd?: number },
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
  /** worst-case cost of an earlier attempt that failed without usage but may have run (see GraderApiError) */
  lostAttemptsMicroUsd?: number
}

/**
 * The API call failed without a usable response, so its usage is unknown. `billableAttempts` counts
 * the attempts that may still have run on the server (timeouts, lost connections, 5xx other than
 * 529); `costMicroUsd` prices each of them at the worst case (worstCaseCallCostMicroUsd), so the
 * cost log never under-counts. The original error is `cause` (its HTTP status, if any, is `status`).
 */
export class GraderApiError extends Error {
  constructor(
    cause: unknown,
    readonly status: number | null,
    readonly billableAttempts: number,
    readonly costMicroUsd: number,
  ) {
    super(cause instanceof Error ? cause.message : 'grader call failed', { cause })
    this.name = 'GraderApiError'
  }
}

/**
 * Anthropic's message when a 400 means "cannot pay for this call" (see isCreditExhausted). [unverified: these
 * wordings are prior knowledge of what the Messages API has returned — "Your credit balance is too low to access
 * the Anthropic API…" and "You have reached your specified API usage limits…" — not documented anywhere read.]
 */
const CREDIT_MESSAGE = /credit balance|purchase credits|usage limit|spend(ing)? limit/i

/** The API's own `error.message` (not the SDK's "<status> <json>" wrapper), or ''. */
function apiErrorMessage(e: APIError): string {
  const body = e.error as { error?: { message?: unknown }; message?: unknown } | undefined
  const m = body?.error?.message ?? body?.message
  return typeof m === 'string' ? m : ''
}

/**
 * Anthropic refused the call because the organisation cannot pay for it: the prepaid credit balance is used up,
 * or a usage (spend) limit set in the Console is reached. Retrying does not help until the owner tops up or
 * raises the limit, so the grade handlers pause grading instead of failing each request (memo §7.2 Z6).
 * - Documented: HTTP 402 `billing_error`, "Billing or payment problem" (claude-api skill, shared/error-codes.md);
 *   the SDK's ErrorType lists 'billing_error', and its BetaManagedAgentsBillingError says "out of credits or spend
 *   limit reached. Retrying with the same credentials will not succeed" (@anthropic-ai/sdk 0.128.0).
 * - [unverified] A 400 `invalid_request_error` whose message names the credit balance or a usage limit
 *   (CREDIT_MESSAGE): the docs read do not say which status these carry, so both are accepted.
 * Accepts a GraderApiError (checks its cause) or an SDK error; never matches a timeout or a lost connection.
 */
export function isCreditExhausted(e: unknown): boolean {
  const inner = e instanceof GraderApiError ? e.cause : e
  if (!(inner instanceof APIError) || typeof inner.status !== 'number') return false
  if (inner.status === 402 || inner.type === 'billing_error') return true
  return inner.status === 400 && CREDIT_MESSAGE.test(apiErrorMessage(inner))
}

/** 529 overloaded and 429 rate limit are rejected before any work; other 5xx may have run. */
function mayHaveRun(e: unknown): boolean {
  if (!(e instanceof APIError)) return true
  if (e.status === undefined) return true // connection error or timeout: the request may have arrived
  return e.status >= 500 && e.status !== 529
}

/** Worth one more attempt: rate limits, overload, server errors and failed connections, but not a timeout. */
function retryable(e: unknown): boolean {
  if (!(e instanceof APIError) || e instanceof APIConnectionTimeoutError) return false
  if (isCreditExhausted(e)) return false
  if (e.status === undefined) return true
  return e.status === 408 || e.status === 409 || e.status === 429 || e.status >= 500
}

const MAX_ATTEMPTS = 2
export const RETRY_DELAY_MS = 1000

/**
 * Chars per token assumed for the worst case. English runs at about 4 characters per token; 2 also
 * covers the Korean criteria in the user block.
 */
const WORST_CASE_CHARS_PER_TOKEN = 2

/**
 * Upper bound for one attempt whose usage is unknown (a timeout, a lost connection, a 5xx, or a call
 * still in flight): all input priced as a cache write (1.25×) at the conservative token rate, plus the
 * full max_tokens of output. For a typical grade this is several times the measured cost, which also
 * covers a server-side fallback re-run inside the same call.
 */
export function worstCaseCallCostMicroUsd(input: GraderInput, maxTokens: number): number {
  const chars = SYSTEM_PROMPT.length + buildUserBlock(input).length
  const inputTokens = Math.ceil(chars / WORST_CASE_CHARS_PER_TOKEN)
  return tokenCostMicroUsd(input.model, { input_tokens: 0, output_tokens: maxTokens, cache_creation_input_tokens: inputTokens })
}

/**
 * Call the grader: at most two attempts, the second only after a retryable error. Throws
 * GraderOutputError (with usage) for unusable output and GraderApiError (with a worst-case cost) when
 * no response arrived.
 */
export async function callGrader(env: Env, input: GraderInput): Promise<GraderCall> {
  const settings = graderSettings(env)
  const client = createClient(env, settings.timeoutMs)
  const params = buildGraderParams(input, { effort: settings.effort, maxTokens: settings.maxTokens })
  let billable = 0
  const attempt = async (n: number): Promise<Message> => {
    try {
      return await client.beta.messages.create(params)
    } catch (e) {
      if (mayHaveRun(e)) billable++
      if (n < MAX_ATTEMPTS && retryable(e)) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
        return attempt(n + 1)
      }
      const status = e instanceof APIError && typeof e.status === 'number' ? e.status : null
      throw new GraderApiError(e, status, billable, billable * worstCaseCallCostMicroUsd(input, settings.maxTokens))
    }
  }
  const message = await attempt(1)
  const lostAttemptsMicroUsd = billable * worstCaseCallCostMicroUsd(input, settings.maxTokens)
  const call = { model: message.model, usage: message.usage, stopReason: message.stop_reason, lostAttemptsMicroUsd }
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
 * which is the safe direction for the spend caps. An earlier HTTP attempt that failed without usage
 * adds its worst-case estimate (`lostAttemptsMicroUsd`) to the cost, not to the token counts.
 */
export function callCost(call: { model: string; usage: Usage; lostAttemptsMicroUsd?: number }): CallCost {
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
  total.costMicroUsd += call.lostAttemptsMicroUsd ?? 0
  return total
}
