// Configuration check for deploy.yml (production and staging). Everything the workflow needs to decide
// before it touches Cloudflare, in one tested place:
//
//   node scripts/run.mjs scripts/deploy-config.ts check --target production|staging
//   … | node scripts/run.mjs scripts/deploy-config.ts live-version   (stdin: `wrangler deployments status --json`)
//
// Reads (environment): SITE_URL, LEGAL_NAME, MAILING_ADDRESS, FROM_EMAIL, OWNER_EMAIL,
// MPC_STAGING_ALLOWED_EMAILS, GOOGLE_CLIENT_ID, MAGIC_LINK, LEARNER_EMAIL, GRADER_MODEL, GRADER_EFFORT,
// GRADER_MAX_TOKENS, TURNSTILE_SITE_KEY, and TURNSTILE_SECRET_MODE, GOOGLE_SECRET_MODE and STRIPE_KEY_MODE
// (computed by the workflow from the secrets' values without printing them), plus worker/wrangler.jsonc and
// ../../ops/config/anthropic-limit.json.
// Prints ::error:: / ::warning:: / ::notice:: annotations; exit 1 on any error. GITHUB_OUTPUT gets:
//   site_url                SITE_URL without a trailing slash
//   domain                  the custom-domain host for `wrangler deploy --domain` ('' for *.workers.dev)
//   anthropic_limit_usd     ops/config/anthropic-limit.json: monthlyLimitUsd (production) or
//                           evalMonthlyLimitUsd (staging, which grades with the eval workspace key)
//   prepaid_usd, prepaid_since  production only, and only when both prepaidUsd and prepaidSince are valid:
//                           the Worker's prepaid-credit ledger (ANTHROPIC_PREPAID_USD / _SINCE, memo §7.2 Z6)
//   staging_allowed_emails  staging only: MPC_STAGING_ALLOWED_EMAILS, else OWNER_EMAIL ('' on production)
//   from_email              the sender: MPC_FROM_EMAIL, else Resend's sandbox sender DEFAULT_FROM_EMAIL; on
//                           staging with a visible "STAGING - " prefix
//   legal_name              MPC_LEGAL_NAME, trimmed ('' when unset; production refuses to deploy without it)
//   require_address         'true' when MPC_MAILING_ADDRESS holds a real address (the content lint then
//                           checks that it reached the site)
//   google_client_id        MPC_GOOGLE_CLIENT_ID when it and the GOOGLE_CLIENT_SECRET secret are both set
//                           (a half-configured Google sign-in is never deployed)
//   magic_link, learner_email  MPC_MAGIC_LINK / MPC_LEARNER_EMAIL, else 'owner' / 'off' (AUTH_DEFAULTS);
//                           always passed explicitly
//
// Rules (integrator decisions 1, 16; review R29, R39, R55, R56; round 2; zero-capital launch memo §7.2 Z3–Z6):
//   - production refuses to deploy without MPC_LEGAL_NAME: the seller's legal name on the terms, privacy page
//     and footer (Z5); staging only warns
//   - MPC_MAILING_ADDRESS is optional (a warning): no email goes to learners and no marketing consent is asked
//     for, so the CASL address duties do not arise [미확인: legal reading, memo §7.2 Z5]. With
//     MPC_LEARNER_EMAIL=on it is required again in production. A value still holding the SET-BEFORE-LAUNCH
//     placeholder is refused in production.
//   - production refuses to deploy without Google sign-in (MPC_GOOGLE_CLIENT_ID and the GOOGLE_CLIENT_SECRET
//     secret, Z3): learners have no other way to sign in; staging only warns
//   - production needs MPC_OWNER_EMAIL: owner alerts and the owner-only email sign-in link go there
//   - Resend's sandbox sender (…@resend.dev, the default) only delivers to the Resend account's own address,
//     so it is refused together with MAGIC_LINK=all or LEARNER_EMAIL=on
//   - production refuses to deploy without a real Turnstile site key and secret: Cloudflare's test site
//     key only yields a dummy token that a real secret rejects, so sign-in and the free sample would fail
//   - the target's D1 database_id and KV namespace id must be filled in worker/wrangler.jsonc; when they are not,
//     the error (and the job summary) points to the one-time workflow "Set up Cloudflare (one time)"
//     (setup-cloudflare.yml, scripts/cloudflare-setup.ts), and nothing reaches Cloudflare
//   - GRADER_EFFORT / GRADER_MAX_TOKENS must be valid when set (the Worker would silently use the defaults)
//   - staging must never get a live Stripe key
//   - staging is locked to an email allowlist (STAGING_ALLOWED_EMAILS: sign-in links only to those
//     addresses, no anonymous grading); a staging deploy without one is refused, and production must
//     never define it
import { AUTH_DEFAULTS, BRAND } from '../shared/config'
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
export const looksLikeId = (v: unknown): boolean => typeof v === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(v)

/** The Worker var that locks staging to the owner's addresses (worker/src/auth.ts stagingAllows). */
export const STAGING_ALLOWLIST_VAR = 'STAGING_ALLOWED_EMAILS'

/**
 * The `name:` of .github/workflows/setup-cloudflare.yml, the one-time workflow that finds or creates each target's
 * D1 database and FLAGS KV namespace (scripts/cloudflare-setup.ts). Messages name it so the owner can find it in
 * the Actions tab; cloudflare-setup.test.ts checks it against the workflow file.
 */
export const SETUP_WORKFLOW_NAME = 'Set up Cloudflare (one time)'

/** What a deploy with missing Cloudflare ids tells the owner to do instead (never wrangler's auto-provisioning). */
export function setupHint(target: Target): string {
  return `Cloudflare is not set up for ${target} yet: run the Actions workflow "${SETUP_WORKFLOW_NAME}" (target ${target} or both), send the block from its summary to Claude in the chat so the ids are added to worker/wrangler.jsonc, then deploy again`
}

/** Problems with the target's D1 and KV ids (added after the setup workflow created the resources) and vars. */
export function checkWranglerIds(config: unknown, target: Target): string[] {
  const s = wranglerSection(config, target)
  const where = target === 'production' ? 'worker/wrangler.jsonc' : 'worker/wrangler.jsonc env.staging'
  if (!s) return [`${where} is missing`]
  const p: string[] = []
  const d1 = Array.isArray(s.d1_databases) ? s.d1_databases.find((d) => isObj(d) && d.binding === 'DB') : undefined
  const kv = Array.isArray(s.kv_namespaces) ? s.kv_namespaces.find((k) => isObj(k) && k.binding === 'FLAGS') : undefined
  const missing = [
    !isObj(d1) || !looksLikeId(d1.database_id) ? `no D1 database_id for DB ("${isObj(d1) && typeof d1.database_name === 'string' ? d1.database_name : '?'}")` : '',
    !isObj(kv) || !looksLikeId(kv.id) ? 'no KV namespace id for FLAGS' : '',
  ].filter(Boolean)
  // One message per target: the deploy stops here, before `wrangler d1 migrations apply` and `wrangler deploy`,
  // whose hidden auto-provisioning (wrangler 4.137 --x-provision, on by default) would otherwise create resources.
  if (missing.length) p.push(`${where} has ${missing.join(' and ')} yet. ${setupHint(target)}.`)
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

/** A real YYYY-MM-DD calendar day. */
export function validDay(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const d = new Date(`${v}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(v)
}

export interface AnthropicLimit {
  /** monthlyLimitUsd: the production workspace's monthly limit set in the Anthropic Console */
  usd: number
  /** evalMonthlyLimitUsd: the eval workspace's limit (staging grades with that key); null when not positive */
  evalUsd: number | null
  confirmed: boolean
  /** prepaidUsd + prepaidSince (memo §7.2 Z6) when both are valid, else null and the reason */
  prepaid: { usd: number; since: string } | null
  prepaidProblem: string | null
}

/**
 * ops/config/anthropic-limit.json. monthlyLimitUsd must be positive (throws otherwise). The prepaid pair is
 * passed to the Worker only when both parts are valid: prepaidUsd a positive number of US dollars and
 * prepaidSince the UTC day the credits were bought (YYYY-MM-DD, not after `today`).
 */
export function parseAnthropicLimit(text: string, today: string = new Date().toISOString().slice(0, 10)): AnthropicLimit {
  const o = JSON.parse(text) as Obj
  const usd = o.monthlyLimitUsd
  if (!positive(usd)) throw new Error('monthlyLimitUsd must be a positive number')
  let prepaid: AnthropicLimit['prepaid'] = null
  let prepaidProblem: string | null = null
  const pUsd = o.prepaidUsd ?? null
  const since = o.prepaidSince ?? null
  if (pUsd === null && since === null) prepaidProblem = 'prepaidUsd and prepaidSince are not set'
  else if (!positive(pUsd)) prepaidProblem = 'prepaidUsd must be a positive number of US dollars'
  else if (since === null) prepaidProblem = 'prepaidSince is not set yet (the UTC day the credits were bought, YYYY-MM-DD)'
  else if (!validDay(since)) prepaidProblem = 'prepaidSince must be a real day written YYYY-MM-DD'
  else if (since > today) prepaidProblem = `prepaidSince ${since} is in the future`
  else prepaid = { usd: pUsd, since }
  return { usd, evalUsd: positive(o.evalMonthlyLimitUsd) ? o.evalMonthlyLimitUsd : null, confirmed: o.confirmedByOwner === true, prepaid, prepaidProblem }
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
 * Resend's shared sandbox sender (memo §7.2 Z4): free and needs no domain, but "it can only deliver to your
 * Resend account email" (resend-skills, read 2026-09-24), so MPC_OWNER_EMAIL must be that account's address.
 */
export const RESEND_SANDBOX_DOMAIN = 'resend.dev'
export const DEFAULT_FROM_EMAIL = `${BRAND.en} <onboarding@${RESEND_SANDBOX_DOMAIN}>`

/** The address in `Name <address>` or a bare address; null when the value is neither. */
export function senderAddress(from: string): string | null {
  const v = from.trim()
  if (looksLikeEmail(v)) return v
  const m = /^(.*?)\s*<([^<>\s]+)>$/.exec(v)
  return m && looksLikeEmail(m[2]) ? m[2] : null
}

export const isSandboxSender = (from: string): boolean => (senderAddress(from) ?? '').toLowerCase().endsWith(`@${RESEND_SANDBOX_DOMAIN}`)

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

export const MAGIC_LINK_MODES = ['owner', 'all', 'off'] as const
export const LEARNER_EMAIL_MODES = ['off', 'on'] as const

/**
 * A Google OAuth web client ID ends in .apps.googleusercontent.com (Google Cloud console, "Client ID";
 * research 2026-09-24, SECONDARY). Client secrets start with GOCSPX- [unverified: prior knowledge]; one pasted
 * into the public variable is refused, because the Worker would put it into every sign-in URL.
 */
export const GOOGLE_CLIENT_ID_PATTERN = /^[A-Za-z0-9-]+\.apps\.googleusercontent\.com$/

/** The seller's legal name (memo §7.2 Z5): a plain name. Returns the problem, or null when it is usable. */
export function legalNameProblem(name: string): string | null {
  if (!name) return 'is not set'
  if (name.startsWith(PLACEHOLDER_PREFIX)) return `still starts with the ${PLACEHOLDER_PREFIX} placeholder`
  const n = [...name].length
  if (n < 2 || n > 100) return `must be 2–100 characters (got ${n})`
  if (/[\u0000-\u001f\u007f<>@]|:\/\//.test(name)) return 'must be a plain name (no line breaks, <, >, @ or web address)'
  return null
}

/** The path the Worker's Google sign-in returns to (worker/src/index.ts route, CONTRACT §2). */
export const GOOGLE_CALLBACK_PATH = '/api/auth/google/callback'

export interface CheckInput {
  target: Target
  env: Record<string, string | undefined>
  wranglerText: string
  anthropicLimitText: string | null
  /** YYYY-MM-DD (UTC) for the prepaidSince check; defaults to today */
  today?: string
}

export interface CheckOutputs {
  site_url: string
  domain: string
  anthropic_limit_usd: string
  prepaid_usd: string
  prepaid_since: string
  staging_allowed_emails: string
  from_email: string
  legal_name: string
  require_address: string
  google_client_id: string
  magic_link: string
  learner_email: string
}

export interface CheckResult {
  errors: string[]
  warnings: string[]
  notices: string[]
  outputs: CheckOutputs
}

export function checkDeployConfig({ target, env, wranglerText, anthropicLimitText, today }: CheckInput): CheckResult {
  const errors: string[] = []
  const warnings: string[] = []
  const notices: string[] = []
  const outputs: CheckOutputs = {
    site_url: '',
    domain: '',
    anthropic_limit_usd: '',
    prepaid_usd: '',
    prepaid_since: '',
    staging_allowed_emails: '',
    from_email: '',
    legal_name: '',
    require_address: 'false',
    google_client_id: '',
    magic_link: '',
    learner_email: '',
  }
  const production = target === 'production'
  const siteVar = production ? 'MPC_SITE_URL' : 'MPC_STAGING_SITE_URL'
  const v = (name: string) => (env[name] ?? '').trim()

  const site = v('SITE_URL').replace(/\/+$/, '')
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

  // ---- sign-in and email (memo §7.2 Z3, Z4) ----
  const magicLink = v('MAGIC_LINK') || AUTH_DEFAULTS.magicLink
  const learnerEmail = v('LEARNER_EMAIL') || AUTH_DEFAULTS.learnerEmail
  if (!(MAGIC_LINK_MODES as readonly string[]).includes(magicLink)) errors.push(`MPC_MAGIC_LINK must be ${MAGIC_LINK_MODES.join(', ')} (or unset for '${AUTH_DEFAULTS.magicLink}').`)
  else outputs.magic_link = magicLink
  if (!(LEARNER_EMAIL_MODES as readonly string[]).includes(learnerEmail)) errors.push(`MPC_LEARNER_EMAIL must be ${LEARNER_EMAIL_MODES.join(' or ')} (or unset for '${AUTH_DEFAULTS.learnerEmail}').`)
  else outputs.learner_email = learnerEmail

  const googleId = v('GOOGLE_CLIENT_ID')
  const googleSecret = v('GOOGLE_SECRET_MODE') === 'set'
  let googleIdOk = false
  if (googleId.startsWith('GOCSPX-')) {
    errors.push('MPC_GOOGLE_CLIENT_ID holds a Google client SECRET, which must never be in a repository variable: delete that variable, reset the secret in the Google Cloud console, store the new one as the GOOGLE_CLIENT_SECRET repository secret, and put the Client ID (…apps.googleusercontent.com) in MPC_GOOGLE_CLIENT_ID.')
  } else if (googleId && !GOOGLE_CLIENT_ID_PATTERN.test(googleId)) {
    errors.push(`MPC_GOOGLE_CLIENT_ID does not look like a Google OAuth Client ID (letters, digits and dashes ending in .apps.googleusercontent.com; got ${googleId.length} characters).`)
  } else googleIdOk = !!googleId
  const googleMissing = [googleId ? '' : 'the MPC_GOOGLE_CLIENT_ID variable', googleSecret ? '' : 'the GOOGLE_CLIENT_SECRET secret'].filter(Boolean)
  if (googleIdOk && googleSecret) {
    outputs.google_client_id = googleId
    if (outputs.site_url) notices.push(`Google sign-in is on: the Google OAuth client must list ${outputs.site_url}${GOOGLE_CALLBACK_PATH} as an authorized redirect URI (owner-setup).`)
  } else if (googleMissing.length) {
    if (production) errors.push(`Google sign-in needs ${googleMissing.join(' and ')}. Production is not deployed without it: learners sign in only with Google (memo §7.2 Z3; owner-setup).`)
    else warnings.push(`Google sign-in is off on staging (missing ${googleMissing.join(' and ')}); only the owner's email sign-in link works there.`)
  }
  if (!production && magicLink === 'off' && !outputs.google_client_id) warnings.push('MPC_MAGIC_LINK is off and Google sign-in is not configured: nobody can sign in on staging.')

  const owner = v('OWNER_EMAIL')
  if (owner && !looksLikeEmail(owner)) errors.push('MPC_OWNER_EMAIL must be one email address.')
  else if (!owner && production) errors.push("Set the repository variable MPC_OWNER_EMAIL: owner alerts (spend, prepaid credits, support) and the owner's email sign-in link go there. With Resend's sandbox sender it must be the address the Resend account was opened with.")

  const fromRaw = v('FROM_EMAIL')
  const from = fromRaw || DEFAULT_FROM_EMAIL
  if (!senderAddress(from)) errors.push("MPC_FROM_EMAIL must be 'Name <address>' or a bare address (or unset for Resend's sandbox sender).")
  else {
    outputs.from_email = production ? from : (stagingFromEmail(from) ?? '')
    if (isSandboxSender(from)) {
      notices.push(`Email goes out from Resend's sandbox sender (${RESEND_SANDBOX_DOMAIN}${fromRaw ? '' : ', the default'}), which delivers only to the Resend account's own address: MPC_OWNER_EMAIL must be that address.`)
      if (outputs.learner_email === 'on') errors.push(`MPC_LEARNER_EMAIL=on needs a sender on your own verified domain in MPC_FROM_EMAIL: Resend's sandbox sender cannot deliver to learners.`)
      if (outputs.magic_link === 'all') errors.push(`MPC_MAGIC_LINK=all needs a sender on your own verified domain in MPC_FROM_EMAIL: Resend's sandbox sender cannot deliver sign-in links to learners.`)
    }
  }

  // ---- seller and contact details (memo §7.2 Z5) ----
  const legalName = v('LEGAL_NAME')
  const nameProblem = legalNameProblem(legalName)
  if (!nameProblem) outputs.legal_name = legalName
  else if (production || legalName) {
    const msg = `MPC_LEGAL_NAME ${nameProblem}. The terms, privacy page, footer and owner emails name the seller ("${BRAND.en} is sold by <legal name>, a sole proprietor in Ontario").`
    if (production) errors.push(`${msg} Production is not deployed without it.`)
    else errors.push(msg)
  } else warnings.push('MPC_LEGAL_NAME is not set: the staging site shows no seller name. Production deploys refuse to run without it.')

  const address = v('MAILING_ADDRESS')
  if (address.startsWith(PLACEHOLDER_PREFIX)) {
    const msg = `MPC_MAILING_ADDRESS still starts with the ${PLACEHOLDER_PREFIX} placeholder: set the real address or delete the variable.`
    if (production) errors.push(msg)
    else warnings.push(msg)
  } else if (address) {
    outputs.require_address = 'true'
  } else if (production && outputs.learner_email === 'on') {
    errors.push("MPC_MAILING_ADDRESS is not set, but MPC_LEARNER_EMAIL=on: emails to learners must carry the sender's mailing address (CASL), so production is not deployed without it.")
  } else if (production) {
    warnings.push('MPC_MAILING_ADDRESS is not set: the privacy page offers the support form instead of a postal address. That is the plan while no email goes to learners and no marketing consent is asked for (memo §7.2 Z5; legal point unverified).')
  }

  // ---- grader ----
  const model = v('GRADER_MODEL')
  if (model && !(GRADER_MODELS as readonly string[]).includes(model)) errors.push(`MPC_GRADER_MODEL must be ${GRADER_MODELS.join(' or ')} (or unset for the default).`)
  const effort = v('GRADER_EFFORT')
  if (effort && !(EFFORT_LEVELS as readonly string[]).includes(effort)) errors.push(`MPC_GRADER_EFFORT must be one of ${EFFORT_LEVELS.join(', ')} (or unset for the default).`)
  const maxTokens = v('GRADER_MAX_TOKENS')
  if (maxTokens && (!/^\d+$/.test(maxTokens) || Number(maxTokens) < MAX_TOKENS_MIN || Number(maxTokens) > MAX_TOKENS_MAX)) {
    errors.push(`MPC_GRADER_MAX_TOKENS must be a whole number from ${MAX_TOKENS_MIN} to ${MAX_TOKENS_MAX} (or unset for the default).`)
  }

  // The Worker's spend tiers use min(memo formula L, ANTHROPIC_MONTHLY_LIMIT_USD). Production gets the
  // production workspace limit and the prepaid-credit ledger; staging grades with the eval workspace key, so it
  // gets that limit (and no ledger: the credits are the organization's, staging sees only its own spend).
  if (!anthropicLimitText) {
    errors.push('ops/config/anthropic-limit.json is missing; the Worker needs the Console limit (ANTHROPIC_MONTHLY_LIMIT_USD) for its spend tiers.')
  } else {
    try {
      const limit = parseAnthropicLimit(anthropicLimitText, today)
      if (production) {
        outputs.anthropic_limit_usd = String(limit.usd)
        if (!limit.confirmed) warnings.push(`ops/config/anthropic-limit.json is not confirmedByOwner yet: the Worker assumes the Anthropic Console limit is US$${limit.usd}. Set that limit in the Console and confirm it in the file.`)
        if (limit.prepaid) {
          outputs.prepaid_usd = String(limit.prepaid.usd)
          outputs.prepaid_since = limit.prepaid.since
        } else {
          warnings.push(`ops/config/anthropic-limit.json: ${limit.prepaidProblem}, so the Worker's prepaid-credit ledger is off (with it, free samples stop at 70% of the credits and grading pauses at 97%; without it only the monthly limit applies). After buying credits, record the amount and the day there (memo §7.2 Z6).`)
        }
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
  const siteKey = v('TURNSTILE_SITE_KEY')
  const secretMode = v('TURNSTILE_SECRET_MODE')
  if (production) {
    if (!siteKey) errors.push("MPC_TURNSTILE_SITE_KEY is not set. Production is not deployed without it: the site would be built with Cloudflare's test site key, whose dummy token the real TURNSTILE_SECRET rejects, so every sign-in and free sample would fail (owner-setup 4-1).")
    else if (TURNSTILE_TEST_SITE_KEY.test(siteKey)) errors.push("MPC_TURNSTILE_SITE_KEY is one of Cloudflare's test site keys; production needs the site key of your own Turnstile widget (owner-setup 4-1).")
    if (secretMode === 'test') errors.push("The TURNSTILE_SECRET secret is one of Cloudflare's test secret keys; production needs the secret key of your own Turnstile widget (owner-setup 4-1).")
    else if (secretMode !== 'set') errors.push('The TURNSTILE_SECRET secret is not set. Production is not deployed without it: the Worker could not verify Turnstile, so sign-in and the free sample would fail (owner-setup 4-1).')
  } else if (!siteKey) {
    warnings.push("MPC_TURNSTILE_SITE_KEY is not set. Staging does not need it (it always uses Cloudflare's test keys behind its email allowlist), but production deploys refuse to run without it and the TURNSTILE_SECRET secret.")
  }

  if (!production) {
    const stripeMode = v('STRIPE_KEY_MODE')
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
  }
  return { errors, warnings, notices, outputs }
}

/** Job-summary text (Korean for the owner, then English) for a deploy stopped by missing Cloudflare ids. */
export function setupNeededSummary(target: Target): string {
  return [
    `## Cloudflare 설정이 아직 안 됐어요 (${target})`,
    '',
    `배포를 멈췄어요. Cloudflare에 데이터베이스(D1)와 스위치 저장소(KV)가 아직 연결되지 않았어요. **Actions** → **${SETUP_WORKFLOW_NAME}** → **Run workflow**를 한 번 실행하고, 그 실행 결과 요약에 나오는 상자를 복사해 Claude에게 채팅으로 보내요. Claude가 ID를 넣은 뒤 이 배포를 다시 실행해요.`,
    '',
    `The deploy stopped before touching Cloudflare: ${setupHint(target)}.`,
    '',
  ].join('\n')
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
  for (const n of r.notices) console.log(`::notice::${n}`)
  for (const w of r.warnings) console.log(`::warning::${w}`)
  for (const e of r.errors) console.log(`::error::${e}`)
  if (process.env.GITHUB_STEP_SUMMARY && r.errors.some((e) => e.includes(SETUP_WORKFLOW_NAME))) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, setupNeededSummary(target))
  }
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, Object.entries(r.outputs).map(([k, v]) => `${k}=${v.replace(/[\r\n]+/g, ' ')}\n`).join(''))
  }
  console.log(
    `deploy-config (${target}): ${r.errors.length} error(s), ${r.warnings.length} warning(s)` +
      (r.outputs.domain ? `; custom domain ${r.outputs.domain}` : r.outputs.site_url ? '; workers.dev address' : '') +
      (r.outputs.anthropic_limit_usd ? `; Anthropic limit US$${r.outputs.anthropic_limit_usd}` : '') +
      (r.outputs.prepaid_usd ? `; prepaid credits US$${r.outputs.prepaid_usd} since ${r.outputs.prepaid_since}` : '') +
      `; Google sign-in ${r.outputs.google_client_id ? 'on' : 'off'}; email link ${r.outputs.magic_link || '?'}; learner email ${r.outputs.learner_email || '?'}` +
      (r.outputs.staging_allowed_emails ? `; staging allowlist of ${r.outputs.staging_allowed_emails.split(',').length} address(es)` : ''),
  )
  return r.errors.length ? 1 : 0
}
