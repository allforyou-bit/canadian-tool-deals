// Configuration check for deploy.yml (production and staging). Everything the workflow needs to decide
// before it touches Cloudflare, in one tested place:
//
//   node scripts/run.mjs scripts/deploy-config.ts check --target production|staging
//   … | node scripts/run.mjs scripts/deploy-config.ts live-version   (stdin: `wrangler deployments status --json`)
//
// Reads (environment): SITE_URL, MAILING_ADDRESS, FROM_EMAIL, OWNER_EMAIL, MPC_STAGING_ALLOWED_EMAILS,
// GRADER_MODEL, GRADER_EFFORT, GRADER_MAX_TOKENS, TURNSTILE_SITE_KEY, TURNSTILE_SECRET_MODE and
// STRIPE_KEY_MODE (both computed by the workflow from the secret's value without printing it), plus
// worker/wrangler.jsonc and ../../ops/config/anthropic-limit.json.
// Prints ::error:: / ::warning:: annotations; exit 1 on any error. GITHUB_OUTPUT gets:
//   site_url                SITE_URL without a trailing slash
//   domain                  the custom-domain host for `wrangler deploy --domain` ('' for *.workers.dev)
//   anthropic_limit_usd     ops/config/anthropic-limit.json: monthlyLimitUsd (production) or
//                           evalMonthlyLimitUsd (staging, which grades with the eval workspace key)
//   staging_allowed_emails  staging only: MPC_STAGING_ALLOWED_EMAILS, else OWNER_EMAIL ('' on production)
//   from_email              staging only: FROM_EMAIL with a visible "STAGING - " prefix ('' on production)
//
// Rules (integrator decisions 1, 16; review R29, R39, R55, R56; round 2):
//   - production refuses to deploy without MAILING_ADDRESS (or with the SET-BEFORE-LAUNCH placeholder);
//     staging only warns (it is a test site; the Worker ignores marketing opt-in while the placeholder is set)
//   - production refuses to deploy without a real Turnstile site key and secret: Cloudflare's test site
//     key only yields a dummy token that a real secret rejects, so sign-in and the free sample would fail
//   - the target's D1 database_id and KV namespace id must be filled in worker/wrangler.jsonc
//   - GRADER_EFFORT / GRADER_MAX_TOKENS must be valid when set (the Worker would silently use the defaults)
//   - staging must never get a live Stripe key
//   - staging is locked to an email allowlist (STAGING_ALLOWED_EMAILS: sign-in links only to those
//     addresses, no anonymous grading); a staging deploy without one is refused, and production must
//     never define it
import { BRAND } from '../shared/config'
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

/** The Worker var that locks staging to the owner's addresses (worker/src/auth.ts stagingAllows). */
export const STAGING_ALLOWLIST_VAR = 'STAGING_ALLOWED_EMAILS'

/** Problems with the target's D1 and KV ids (the owner pastes them after creating the resources) and vars. */
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
  const vars = isObj(s.vars) ? s.vars : {}
  // production must never be locked to an allowlist (nobody else could sign in); staging keeps a placeholder
  // in the file so a deploy that bypasses the workflow is locked too
  if (target === 'production' && STAGING_ALLOWLIST_VAR in vars) p.push(`${where}: vars must not define ${STAGING_ALLOWLIST_VAR} (staging only)`)
  if (target === 'staging' && !(typeof vars[STAGING_ALLOWLIST_VAR] === 'string' && vars[STAGING_ALLOWLIST_VAR].trim())) {
    p.push(`${where}: vars must define ${STAGING_ALLOWLIST_VAR} (a placeholder address is fine; deploy.yml overrides it)`)
  }
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

const positive = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0

/**
 * ops/config/anthropic-limit.json: monthlyLimitUsd (the production workspace limit set in the Anthropic
 * Console) and evalMonthlyLimitUsd (the eval workspace limit; null when missing or not a positive number).
 */
export function parseAnthropicLimit(text: string): { usd: number; evalUsd: number | null; confirmed: boolean } {
  const o = JSON.parse(text) as Obj
  const usd = o.monthlyLimitUsd
  if (!positive(usd)) throw new Error('monthlyLimitUsd must be a positive number')
  return { usd, evalUsd: positive(o.evalMonthlyLimitUsd) ? o.evalMonthlyLimitUsd : null, confirmed: o.confirmedByOwner === true }
}

/** A plausible single email address (no spaces, one @, a dot in the domain). Values are never printed. */
const looksLikeEmail = (v: string): boolean => /^[^\s@,<>]+@[^\s@,<>]+\.[^\s@,<>]+$/.test(v)

/** Comma-separated addresses, trimmed, empty entries dropped. */
export function parseEmailList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean)
}

/**
 * The sender for staging emails: FROM_EMAIL with "STAGING - " in front of the display name, so a staging
 * email can never be mistaken for a production one. Only atom characters are added, so the result stays a
 * valid RFC 5322 display name without new quoting. A bare address gets the brand as its name. Returns ''
 * for an empty input and null when the value is neither `Name <address>` nor `address`.
 */
export function stagingFromEmail(from: string | undefined): string | null {
  const v = (from ?? '').trim()
  if (!v) return ''
  const prefix = 'STAGING - '
  if (looksLikeEmail(v)) return `${prefix}${BRAND.en} <${v}>`
  const m = /^(.*?)\s*<([^<>\s]+)>$/.exec(v)
  if (!m || !looksLikeEmail(m[2])) return null
  let name = m[1].trim()
  if (name.startsWith(prefix)) name = name.slice(prefix.length)
  if (name.length >= 2 && name.startsWith('"') && name.endsWith('"')) return `"${prefix}${name.slice(1, -1)}" <${m[2]}>`
  return `${prefix}${name || BRAND.en} <${m[2]}>`
}

/** Cloudflare's documented Turnstile test site keys (turnstile/troubleshooting/testing.mdx). */
export const TURNSTILE_TEST_SITE_KEY = /^[123]x0{20}[A-F]{2}$/

export const PLACEHOLDER_PREFIX = 'SET-BEFORE-LAUNCH'

export const GRADER_MODELS = ['claude-opus-5', 'claude-sonnet-5'] as const

export interface CheckInput {
  target: Target
  env: Record<string, string | undefined>
  wranglerText: string
  anthropicLimitText: string | null
}

export interface CheckOutputs {
  site_url: string
  domain: string
  anthropic_limit_usd: string
  staging_allowed_emails: string
  from_email: string
}

export interface CheckResult {
  errors: string[]
  warnings: string[]
  outputs: CheckOutputs
}

export function checkDeployConfig({ target, env, wranglerText, anthropicLimitText }: CheckInput): CheckResult {
  const errors: string[] = []
  const warnings: string[] = []
  const outputs: CheckOutputs = { site_url: '', domain: '', anthropic_limit_usd: '', staging_allowed_emails: '', from_email: '' }
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

  // The Worker's spend tiers use min(memo formula L, ANTHROPIC_MONTHLY_LIMIT_USD). Production gets the
  // production workspace limit; staging grades with the eval workspace key, so it gets that limit.
  if (!anthropicLimitText) {
    errors.push('ops/config/anthropic-limit.json is missing; the Worker needs the Console limit (ANTHROPIC_MONTHLY_LIMIT_USD) for its spend tiers.')
  } else {
    try {
      const limit = parseAnthropicLimit(anthropicLimitText)
      if (target === 'production') {
        outputs.anthropic_limit_usd = String(limit.usd)
        if (!limit.confirmed) warnings.push(`ops/config/anthropic-limit.json is not confirmedByOwner yet: the Worker assumes the Anthropic Console limit is US$${limit.usd}. Set that limit in the Console and confirm it in the file.`)
      } else if (limit.evalUsd === null) {
        errors.push('ops/config/anthropic-limit.json: evalMonthlyLimitUsd must be a positive number; staging grades with the eval workspace key and is capped at that limit.')
      } else {
        outputs.anthropic_limit_usd = String(limit.evalUsd)
      }
    } catch (e) {
      errors.push(`ops/config/anthropic-limit.json: ${e instanceof Error ? e.message : 'invalid'}.`)
    }
  }

  // Turnstile. Cloudflare's test site key yields only the dummy token XXXX.DUMMY.TOKEN.XXXX, which a real
  // secret rejects, and the test secret accepts only that dummy token (turnstile/troubleshooting/testing.mdx).
  // So production needs a real pair; staging always uses the test pair (deploy.yml) behind its email allowlist.
  const siteKey = (env.TURNSTILE_SITE_KEY ?? '').trim()
  const secretMode = (env.TURNSTILE_SECRET_MODE ?? '').trim()
  if (target === 'production') {
    if (!siteKey) errors.push("MPC_TURNSTILE_SITE_KEY is not set. Production is not deployed without it: the site would be built with Cloudflare's test site key, whose dummy token the real TURNSTILE_SECRET rejects, so every sign-in and free sample would fail (owner-setup 2-2).")
    else if (TURNSTILE_TEST_SITE_KEY.test(siteKey)) errors.push("MPC_TURNSTILE_SITE_KEY is one of Cloudflare's test site keys; production needs the site key of your own Turnstile widget (owner-setup 2-2).")
    if (secretMode === 'test') errors.push("The TURNSTILE_SECRET secret is one of Cloudflare's test secret keys; production needs the secret key of your own Turnstile widget (owner-setup 2-2).")
    else if (secretMode !== 'set') errors.push('The TURNSTILE_SECRET secret is not set. Production is not deployed without it: the Worker could not verify Turnstile, so sign-in and the free sample would fail (owner-setup 2-2).')
  } else if (!siteKey) {
    warnings.push("MPC_TURNSTILE_SITE_KEY is not set. Staging does not need it (it always uses Cloudflare's test keys behind its email allowlist), but production deploys refuse to run without it and the TURNSTILE_SECRET secret.")
  }

  if (target === 'staging') {
    const stripeMode = (env.STRIPE_KEY_MODE ?? '').trim()
    if (stripeMode === 'live') errors.push('STRIPE_TEST_SECRET_KEY is a live key; staging only takes Stripe test keys (sk_test_… / rk_test_…).')
    else if (stripeMode !== 'test') warnings.push('No Stripe test key (STRIPE_TEST_SECRET_KEY and STRIPE_TEST_WEBHOOK_SECRET secrets): checkout on staging will not work.')

    // Staging is a public workers.dev host with the Turnstile test secret: the allowlist is what keeps
    // strangers from sending sign-in emails through it or spending model credit (anonymous grading is off).
    const fromVar = parseEmailList(env.MPC_STAGING_ALLOWED_EMAILS)
    const list = fromVar.length ? fromVar : parseEmailList(env.OWNER_EMAIL)
    const source = fromVar.length ? 'MPC_STAGING_ALLOWED_EMAILS' : 'MPC_OWNER_EMAIL'
    if (!list.length) {
      errors.push(`Staging is not deployed without an email allowlist: set the repository variable MPC_STAGING_ALLOWED_EMAILS (comma-separated) or MPC_OWNER_EMAIL. Only those addresses can sign in on staging (${STAGING_ALLOWLIST_VAR}).`)
    } else {
      const bad = list.filter((e) => !looksLikeEmail(e)).length
      if (bad) errors.push(`${source}: ${bad} of ${list.length} entries do not look like an email address (comma-separated addresses only).`)
      else outputs.staging_allowed_emails = list.join(',')
    }

    const from = stagingFromEmail(env.FROM_EMAIL)
    if (from === null) errors.push("MPC_FROM_EMAIL must be 'Name <address>' or a bare address; staging marks it with a STAGING prefix.")
    else if (!from) warnings.push('MPC_FROM_EMAIL is not set: staging sends from the placeholder address in worker/wrangler.jsonc, so its sign-in emails will not arrive.')
    else outputs.from_email = from
  }
  return { errors, warnings, outputs }
}

/**
 * The version serving 100% of traffic in `wrangler deployments status --json` output ('' when there is
 * none, e.g. a gradual deployment, or the text is not that JSON). Text before the JSON is ignored.
 */
export function liveVersionFrom(text: string): string {
  // the JSON starts on a line of its own; a warning line such as "▲ [WARNING] …" may come first
  for (const m of text.matchAll(/^\s*[{[]/gm)) {
    let j: unknown
    try {
      j = JSON.parse(text.slice(m.index))
    } catch {
      continue
    }
    const versions = isObj(j) && Array.isArray(j.versions) ? j.versions : []
    const v = versions.find((x) => isObj(x) && x.percentage === 100)
    return isObj(v) && typeof v.version_id === 'string' ? v.version_id : ''
  }
  return ''
}

function argValue(args: string[], name: string): string | undefined {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}

async function readStdin(): Promise<string> {
  let s = ''
  for await (const chunk of process.stdin) s += String(chunk)
  return s
}

export async function main(args: string[]): Promise<number> {
  const [command, ...rest] = args
  if (command === 'live-version') {
    console.log(liveVersionFrom(await readStdin()))
    return 0
  }
  const target = argValue(rest, '--target')
  if (command !== 'check' || (target !== 'production' && target !== 'staging')) {
    console.error('usage: deploy-config.ts check --target production|staging  |  deploy-config.ts live-version < status.json')
    return 2
  }
  const { readFile, appendFile } = await import('node:fs/promises')
  const wranglerText = await readFile('worker/wrangler.jsonc', 'utf8')
  const anthropicLimitText = await readFile('../../ops/config/anthropic-limit.json', 'utf8').catch(() => null)
  const r = checkDeployConfig({ target, env: process.env, wranglerText, anthropicLimitText })
  for (const w of r.warnings) console.log(`::warning::${w}`)
  for (const e of r.errors) console.log(`::error::${e}`)
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, Object.entries(r.outputs).map(([k, v]) => `${k}=${v.replace(/[\r\n]+/g, ' ')}\n`).join(''))
  }
  console.log(
    `deploy-config (${target}): ${r.errors.length} error(s), ${r.warnings.length} warning(s)` +
      (r.outputs.domain ? `; custom domain ${r.outputs.domain}` : r.outputs.site_url ? '; workers.dev address' : '') +
      (r.outputs.anthropic_limit_usd ? `; Anthropic limit US$${r.outputs.anthropic_limit_usd}` : '') +
      (r.outputs.staging_allowed_emails ? `; staging allowlist of ${r.outputs.staging_allowed_emails.split(',').length} address(es)` : ''),
  )
  return r.errors.length ? 1 : 0
}
