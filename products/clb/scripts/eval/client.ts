// Shared set-up for the scripts that call the Claude API (eval, synthetic set, prompt-cache check).
//
// API key: ANTHROPIC_EVAL_API_KEY first — a key from a separate Anthropic workspace with its own
// monthly limit (memo §3.3 "API for dev and eval"), so eval spend can never use up the production
// Console limit the Worker's spend tiers are measured against. When only ANTHROPIC_API_KEY (the
// production key) is set, it is used with a warning.
//
// Grader model and tuning follow the Worker's rules: --model, else GRADER_MODEL (trimmed; an empty
// value counts as unset — Actions exports unset variables as ''), else config.MODELS.defaultGrader;
// GRADER_EFFORT / GRADER_MAX_TOKENS through graderSettings() (invalid → config default).
import Anthropic from '@anthropic-ai/sdk'
import { MODELS } from '../../shared/config'
import { graderSettings, type GraderSettings } from '../../worker/src/grading/claude'

export type Env = Record<string, string | undefined>

export type KeySource = 'ANTHROPIC_EVAL_API_KEY' | 'ANTHROPIC_API_KEY'

/** The key to use and where it came from; null when neither variable is set. */
export function evalApiKey(env: Env): { key: string; source: KeySource } | null {
  const evalKey = env.ANTHROPIC_EVAL_API_KEY?.trim()
  if (evalKey) return { key: evalKey, source: 'ANTHROPIC_EVAL_API_KEY' }
  const prodKey = env.ANTHROPIC_API_KEY?.trim()
  if (prodKey) return { key: prodKey, source: 'ANTHROPIC_API_KEY' }
  return null
}

/** The warning printed when the production key is used (a GitHub annotation inside Actions). */
export function fallbackKeyNotice(env: Env): string {
  const text =
    'ANTHROPIC_EVAL_API_KEY is not set, so this run uses the production ANTHROPIC_API_KEY: its spend counts against the production Console limit, which the Worker cannot see. Add ANTHROPIC_EVAL_API_KEY from a separate Anthropic workspace (business/online/owner-setup.md).'
  return env.GITHUB_ACTIONS === 'true' ? `::warning title=Eval uses the production API key::${text}` : `warning: ${text}`
}

/** Client for the eval scripts, or null (with a message on stderr) when no key is set. */
export function createEvalClient(
  env: Env,
  who: string,
  log: (l: string) => void = (l) => console.error(l),
  options: { timeout?: number; maxRetries?: number } = {},
): Anthropic | null {
  const k = evalApiKey(env)
  if (!k) {
    log(`${who}: set ANTHROPIC_EVAL_API_KEY (or ANTHROPIC_API_KEY)`)
    return null
  }
  if (k.source === 'ANTHROPIC_API_KEY') log(fallbackKeyNotice(env))
  return new Anthropic({ apiKey: k.key, ...options })
}

/** --model, else GRADER_MODEL when non-empty, else the Worker's default grader. */
export function resolveGraderModel(modelArg: string | undefined, env: Env): string {
  return modelArg?.trim() || env.GRADER_MODEL?.trim() || MODELS.defaultGrader
}

/** The same effort / max_tokens the Worker uses for these variables. */
export function resolveGraderSettings(env: Env): Pick<GraderSettings, 'effort' | 'maxTokens'> {
  const { effort, maxTokens } = graderSettings({ GRADER_EFFORT: env.GRADER_EFFORT, GRADER_MAX_TOKENS: env.GRADER_MAX_TOKENS })
  return { effort, maxTokens }
}

/**
 * An AbortSignal that fires on SIGTERM or SIGINT (a cancelled or superseded Actions run, Ctrl-C), so
 * a batch in flight is cancelled instead of running on and being billed. dispose() removes the handlers.
 */
export function abortOnSignals(log: (l: string) => void = (l) => console.error(l)): { signal: AbortSignal; dispose: () => void } {
  const controller = new AbortController()
  const onSignal = (sig: NodeJS.Signals) => {
    log(`received ${sig}: stopping`)
    controller.abort(new Error(sig))
  }
  process.once('SIGTERM', onSignal)
  process.once('SIGINT', onSignal)
  return {
    signal: controller.signal,
    dispose: () => {
      process.off('SIGTERM', onSignal)
      process.off('SIGINT', onSignal)
    },
  }
}

export function argValue(args: string[], name: string): string | undefined {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
