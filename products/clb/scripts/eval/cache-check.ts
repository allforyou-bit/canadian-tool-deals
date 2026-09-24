// Level-B check for memo B3: the grader's frozen system prompt is served from the prompt cache.
// Sends the production grader request (buildGraderParams, non-batch: the same params the Worker's
// callGrader sends, with GRADER_MODEL / GRADER_EFFORT / GRADER_MAX_TOKENS applied the same way) twice,
// one after the other, for a hand-written synthetic fixture, and requires the second response to report
// cache_read_input_tokens > 0 (claude-api skill, shared/prompt-caching.md: "an integration-test
// assertion that a second identical request shows cache_read_input_tokens > 0").
//
//   ANTHROPIC_EVAL_API_KEY=… node scripts/run.mjs scripts/eval/cache-check.ts [--model ID]
//
// No key → skipped with a notice (exit 0). Exit 1 when the second call read nothing from the cache,
// 2 on an API error. Prints token counts only (the fixture is synthetic; no output text is printed).
// Cost: two grader calls, about US$0.05–0.15 on claude-opus-5 (ESTIMATE).
import type Anthropic from '@anthropic-ai/sdk'
import { buildGraderParams, callCost, graderTimeoutMs, type CallCost, type GraderInput, type GraderSettings } from '../../worker/src/grading/claude'
import { argValue, createEvalClient, evalApiKey, resolveGraderModel, resolveGraderSettings } from './client'
import fixture from './fixtures/writing-email-neighbour.json'

type CreateParams = Anthropic.Beta.Messages.MessageCreateParamsNonStreaming
type Message = Anthropic.Beta.Messages.BetaMessage

export const CACHE_CHECK_INPUT: Omit<GraderInput, 'model'> = {
  taskId: fixture.taskId,
  promptIndex: fixture.promptIndex,
  text: fixture.text,
  explanationLang: fixture.explanationLang as GraderInput['explanationLang'],
}

export interface CacheCheckResult {
  ok: boolean
  first: CallCost
  second: CallCost
  message: string
}

/** Two identical grader requests; ok when the second read from the cache. `create` is the SDK call (stubbed in tests). */
export async function checkPromptCache(
  create: (params: CreateParams) => Promise<Message>,
  model: string,
  settings: Pick<GraderSettings, 'effort' | 'maxTokens'>,
): Promise<CacheCheckResult> {
  const params = () => buildGraderParams({ ...CACHE_CHECK_INPUT, model }, { effort: settings.effort, maxTokens: settings.maxTokens })
  const m1 = await create(params())
  const first = callCost({ model: m1.model, usage: m1.usage })
  const m2 = await create(params())
  const second = callCost({ model: m2.model, usage: m2.usage })
  const ok = second.cacheReadTokens > 0
  const counts = (c: CallCost) => `input ${c.inputTokens}, cache write ${c.cacheWriteTokens}, cache read ${c.cacheReadTokens}, output ${c.outputTokens}`
  const message = ok
    ? `prompt cache OK on ${model}: second call read ${second.cacheReadTokens} token(s) from the cache (first: ${counts(first)}; second: ${counts(second)})`
    : `prompt cache MISS on ${model}: the second identical request read 0 tokens from the cache (first: ${counts(first)}; second: ${counts(second)}). Something in the rendered prefix changes between requests, or the system prompt is below the model's minimum cacheable length (shared/prompt-caching.md).`
  return { ok, first, second, message }
}

export async function main(args: string[]): Promise<number> {
  const { appendFile } = await import('node:fs/promises')
  if (!evalApiKey(process.env)) {
    console.log('cache-check: skipped — neither ANTHROPIC_EVAL_API_KEY nor ANTHROPIC_API_KEY is set')
    return 0
  }
  const model = resolveGraderModel(argValue(args, '--model'), process.env)
  const settings = resolveGraderSettings(process.env)
  const client = createEvalClient(process.env, 'cache-check', (l) => console.log(l), { timeout: graderTimeoutMs(settings.maxTokens), maxRetries: 0 })
  if (!client) return 2
  let result: CacheCheckResult
  try {
    result = await checkPromptCache((p) => client.beta.messages.create(p), model, settings)
  } catch (e) {
    console.error(`cache-check: API error — ${e instanceof Error ? e.message.slice(0, 300) : 'unknown'}`)
    return 2
  }
  console.log(`cache-check: ${result.message}`)
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `- ${result.ok ? '✅' : '❌'} ${result.message}\n`)
  return result.ok ? 0 : 1
}
