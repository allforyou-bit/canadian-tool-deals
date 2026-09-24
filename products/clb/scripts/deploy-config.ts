// Configuration check for deploy.yml (production and staging). Everything the workflow needs to decide
// before it touches Cloudflare, in one tested place:
//
//   node scripts/run.mjs scripts/deploy-config.ts check --target production|staging
//
// Reads (environment): SITE_URL, MAILING_ADDRESS, GRADER_MODEL, GRADER_EFFORT, GRADER_MAX_TOKENS,
// TURNSTILE_SITE_KEY, STRIPE_KEY_MODE (live|test|'' — from the key prefix, computed by the workflow
// without printing the key), plus worker/wrangler.jsonc and ../../ops/config/anthropic-limit.json.
// Prints ::error:: / ::warning:: annotations; exit 1 on any error. GITHUB_OUTPUT gets:
//   site_url             SITE_URL without a trailing slash
//   domain               the custom-domain host for `wrangler deploy --domain` ('' for *.workers.dev)
//   anthropic_limit_usd  ops/config/anthropic-limit.json monthlyLimitUsd (production only; '' on staging)
//
// Rules (integrator decisions 1, 16; review R29, R39, R55, R56):
//   - production refuses to deploy without MAILING_ADDRESS (or with the SET-BEFORE-LAUNCH placeholder);
//     staging only warns (it is a test site; the Worker ignores marketing opt-in while the placeholder is set)
//   - the target's D1 database_id and KV namespace id must be filled in worker/wrangler.jsonc
//   - GRADER_EFFORT / GRADER_MAX_TOKENS must be valid when set (the Worker would silently use the defaults)
//   - staging must never get a live Stripe key
import { EFFORT_LEVELS, MAX_TOKENS_MAX, MAX_TOKENS_MIN } from '../worker/src/grading/claude'

export type Target = 'production' | 'staging'

/** Parse JSON with // and /* comments and trailing commas (wrangler.jsonc), leaving strings intact. */
export function parseJsonc(text: string): unknown {
  let out = ''
  let i = 0
  while (i < text.length) {
    const c = text[i]
    if (c === '"') {
      let j = i + 1
      while (j < text.length && text[j] !== '"') j += text[j] === '\\' ? 2 : 1
      out += text.slice(i, j + 1)
      i = j + 1
    } else if (c === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++
    } else if (c === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2)
      i = end < 0 ? text.length : end + 2
    } else {
      out += c
      i++
    }
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'))
}

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v)

/** The wrangler section a target deploys with: the top level, or env.staging. */
export function wranglerSection(config: unknown, target: Target): Obj | null {
  if (!isObj(config)) return null
  if (target === 'production') return config
  const env = config.env
  return isObj(env) && isObj(env.staging) ? env.staging : null
}

/** A pasted resource id: not empty, no spaces, not a `<paste …>` placeholder. */
const looksLikeId = (v: unknown): boolean => typeof v === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(v)

/** Problems with the target's D1 and KV ids (the owner pastes them after creating the resources). */
export function checkWranglerIds(config: unknown, target: Target): string[] {
  const s = wranglerSection(config, target)
  const where = target === 'production' ? 'worker/wrangler.jsonc' : 'worker/wrangler.jsonc env.staging'
  if (!s) return [`${where} is missing`]
  const p: string[] = []
  const d1 = Array.isArray(s.d1_databases) ? s.d1_databases.find((d) => isObj(d) && d.binding === 'DB') : undefined
  if (!isObj(d1) || !looksLikeId(d1.database_id)) {
    p.push(`${where} has no D1 database_id for DB yet (owner-setup: \`npx wrangler d1 create ${isObj(d1) && typeof d1.database_name === 'string' ? d1.database_name : 'mpc'}\`, paste the id)`)
  }
  const kv = Array.isArray(s.kv_namespaces) ? s.kv_namespaces.find((k) => isObj(k) && k.binding === 'FLAGS') : undefined
  if (!isObj(kv) || !looksLikeId(kv.id)) {
    p.push(`${where} has no KV namespace id for FLAGS yet (owner-setup: \`npx wrangler kv namespace create FLAGS${target === 'staging' ? ' --env staging' : ''}\`, paste the id)`)
  }
  if (target === 'staging' && s.name === (config as Obj).name) p.push(`${where}: name must differ from the production Worker's name`)
  return p
}

/**
 * The custom domain to attach with `wrangler deploy --domain`, or null for a *.workers.dev address.
 * Throws when the URL is not a bare https origin.
 */
export function customDomainFor(siteUrl: string): string | null {
  const u = new URL(siteUrl)
  if (u.protocol !== 'https:') throw new Error('must start with https://')
  if (u.port) throw new Error('must not have a port')
  if ((u.pathname !== '/' && u.pathname !== '') || u.search || u.hash) throw new Error('must be the bare origin, with no path')
  return u.hostname === 'workers.dev' || u.hostname.endsWith('.workers.dev') ? null : u.hostname
}

/** monthlyLimitUsd from ops/config/anthropic-limit.json (the limit set in the Anthropic Console). */
export function parseAnthropicLimit(text: string): { usd: number; confirmed: boolean } {
  const o = JSON.parse(text) as Obj
  const usd = o.monthlyLimitUsd
  if (typeof usd !== 'number' || !Number.isFinite(usd) || usd <= 0) throw new Error('monthlyLimitUsd must be a positive number')
  return { usd, confirmed: o.confirmedByOwner === true }
}

export const PLACEHOLDER_PREFIX = 'SET-BEFORE-LAUNCH'

export const GRADER_MODELS = ['claude-opus-5', 'claude-sonnet-5'] as const

export interface CheckInput {
  target: Target
  env: Record<string, string | undefined>
  wranglerText: string
  anthropicLimitText: string | null
}

export interface CheckResult {
  errors: string[]
  warnings: string[]
  outputs: { site_url: string; domain: string; anthropic_limit_usd: string }
}

export function checkDeployConfig({ target, env, wranglerText, anthropicLimitText }: CheckInput): CheckResult {
  const errors: string[] = []
  const warnings: string[] = []
  const outputs = { site_url: '', domain: '', anthropic_limit_usd: '' }
  const siteVar = target === 'production' ? 'MPC_SITE_URL' : 'MPC_STAGING_SITE_URL'

  const site = (env.SITE_URL ?? '').trim().replace(/\/+$/, '')
  if (!site) errors.push(`Set the repository variable ${siteVar} to the site's https:// address; the smoke test and SITE_URL need it.`)
  else {
    try {
      const domain = customDomainFor(site)
      outputs.site_url = site
      outputs.domain = domain ?? ''
    } catch (e) {
      errors.push(`${siteVar} ${e instanceof Error ? e.message : 'is not a URL'} (got a value of ${site.length} characters).`)
    }
  }

  let config: unknown = null
  try {
    config = parseJsonc(wranglerText)
  } catch {
    errors.push('worker/wrangler.jsonc is not valid JSONC.')
  }
  if (config !== null) errors.push(...checkWranglerIds(config, target))

  const address = (env.MAILING_ADDRESS ?? '').trim()
  const addressProblem = !address
    ? 'MPC_MAILING_ADDRESS is not set'
    : address.startsWith(PLACEHOLDER_PREFIX)
      ? `MPC_MAILING_ADDRESS still starts with the ${PLACEHOLDER_PREFIX} placeholder`
      : null
  if (addressProblem) {
    if (target === 'production') {
      errors.push(`${addressProblem}. CASL requires the owner's mailing address in the consent request and in every email, so production is not deployed without it (integrator decision 16; business/online/owner-setup.md).`)
    } else {
      warnings.push(`${addressProblem}: the staging site and its emails show the placeholder, and the Worker ignores marketing opt-in.`)
    }
  }

  const model = (env.GRADER_MODEL ?? '').trim()
  if (model && !(GRADER_MODELS as readonly string[]).includes(model)) errors.push(`MPC_GRADER_MODEL must be ${GRADER_MODELS.join(' or ')} (or unset for the default).`)
  const effort = (env.GRADER_EFFORT ?? '').trim()
  if (effort && !(EFFORT_LEVELS as readonly string[]).includes(effort)) errors.push(`MPC_GRADER_EFFORT must be one of ${EFFORT_LEVELS.join(', ')} (or unset for the default).`)
  const maxTokens = (env.GRADER_MAX_TOKENS ?? '').trim()
  if (maxTokens && (!/^\d+$/.test(maxTokens) || Number(maxTokens) < MAX_TOKENS_MIN || Number(maxTokens) > MAX_TOKENS_MAX)) {
    errors.push(`MPC_GRADER_MAX_TOKENS must be a whole number from ${MAX_TOKENS_MIN} to ${MAX_TOKENS_MAX} (or unset for the default).`)
  }

  if (target === 'production') {
    if (!anthropicLimitText) errors.push('ops/config/anthropic-limit.json is missing; the Worker needs the Console limit (ANTHROPIC_MONTHLY_LIMIT_USD) for its spend tiers.')
    else {
      try {
        const limit = parseAnthropicLimit(anthropicLimitText)
        outputs.anthropic_limit_usd = String(limit.usd)
        if (!limit.confirmed) warnings.push(`ops/config/anthropic-limit.json is not confirmedByOwner yet: the Worker assumes the Anthropic Console limit is US$${limit.usd}. Set that limit in the Console and confirm it in the file.`)
      } catch (e) {
        errors.push(`ops/config/anthropic-limit.json: ${e instanceof Error ? e.message : 'invalid'}.`)
      }
    }
    if (!(env.TURNSTILE_SITE_KEY ?? '').trim()) warnings.push("MPC_TURNSTILE_SITE_KEY is not set: the site is built with Cloudflare's always-pass test key.")
  }

  const stripeMode = (env.STRIPE_KEY_MODE ?? '').trim()
  if (target === 'staging') {
    if (stripeMode === 'live') errors.push('STRIPE_TEST_SECRET_KEY is a live key; staging only takes Stripe test keys (sk_test_… / rk_test_…).')
    else if (stripeMode !== 'test') warnings.push('No Stripe test key (STRIPE_TEST_SECRET_KEY and STRIPE_TEST_WEBHOOK_SECRET secrets): checkout on staging will not work.')
  }
  return { errors, warnings, outputs }
}

function argValue(args: string[], name: string): string | undefined {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}

export async function main(args: string[]): Promise<number> {
  const [command, ...rest] = args
  const target = argValue(rest, '--target')
  if (command !== 'check' || (target !== 'production' && target !== 'staging')) {
    console.error('usage: deploy-config.ts check --target production|staging')
    return 2
  }
  const { readFile, appendFile } = await import('node:fs/promises')
  const wranglerText = await readFile('worker/wrangler.jsonc', 'utf8')
  const anthropicLimitText = await readFile('../../ops/config/anthropic-limit.json', 'utf8').catch(() => null)
  const r = checkDeployConfig({ target, env: process.env, wranglerText, anthropicLimitText })
  for (const w of r.warnings) console.log(`::warning::${w}`)
  for (const e of r.errors) console.log(`::error::${e}`)
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, Object.entries(r.outputs).map(([k, v]) => `${k}=${v}\n`).join(''))
  console.log(
    `deploy-config (${target}): ${r.errors.length} error(s), ${r.warnings.length} warning(s)` +
      (r.outputs.domain ? `; custom domain ${r.outputs.domain}` : r.outputs.site_url ? '; workers.dev address' : '') +
      (r.outputs.anthropic_limit_usd ? `; Anthropic limit US$${r.outputs.anthropic_limit_usd}` : ''),
  )
  return r.errors.length ? 1 : 0
}
