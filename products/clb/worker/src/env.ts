// Worker bindings and secrets. Bindings are declared in worker/wrangler.jsonc; secrets are set with
// `wrangler secret put NAME` (or by the deploy workflow from GitHub secrets) — never committed.

export interface Env {
  /** D1 database (schema: worker/migrations) */
  DB: D1Database
  /** KV namespace for kill switches (config.FLAG_DEFAULTS) and short-lived counters */
  FLAGS: KVNamespace
  /** Workers AI (speech-to-text: @cf/openai/whisper-large-v3-turbo) */
  AI: Ai
  /** static assets from ../out (the exported Next.js site) */
  ASSETS: Fetcher

  // ---- plain vars (wrangler.jsonc "vars") ----
  SITE_URL: string
  APP_VERSION: string
  /** optional model override, e.g. "claude-sonnet-5"; default config.MODELS.defaultGrader */
  GRADER_MODEL?: string
  /** optional grader tuning (defaults: config.MODELS.graderEffort / graderMaxTokens) */
  GRADER_EFFORT?: string
  GRADER_MAX_TOKENS?: string
  /** optional: the monthly spend limit actually set in the Anthropic Console (USD); tiers use min(formula, this) */
  ANTHROPIC_MONTHLY_LIMIT_USD?: string
  /**
   * Staging only: comma-separated email addresses. When set, sign-in links are sent only to these
   * addresses and anonymous grading is off, so a public staging host cannot be used to send email or
   * spend model credit. Never set in production.
   */
  STAGING_ALLOWED_EMAILS?: string
  /** Google sign-in (memo §7.2): OAuth client id (plain var) — the secret is GOOGLE_CLIENT_SECRET */
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
  /** 'owner' (default): the email sign-in link only for OWNER_EMAIL; 'all'; 'off' */
  MAGIC_LINK?: string
  /** 'off' (default): no email to learners, only owner alerts; 'on' once a sending domain exists */
  LEARNER_EMAIL?: string
  /** the owner's legal name, shown as the seller (memo §7.2 Z5) */
  LEGAL_NAME?: string
  /** prepaid Anthropic credits in USD and the ISO date they were bought (ops/config/anthropic-limit.json) */
  ANTHROPIC_PREPAID_USD?: string
  ANTHROPIC_PREPAID_SINCE?: string
  FROM_EMAIL: string
  /** CASL: every commercial email must include the sender's mailing address */
  MAILING_ADDRESS: string
  OWNER_EMAIL: string

  // ---- secrets ----
  ANTHROPIC_API_KEY: string
  STRIPE_SECRET_KEY: string
  STRIPE_WEBHOOK_SECRET: string
  RESEND_API_KEY: string
  TURNSTILE_SECRET: string
  /** salt for hashing IPs, device ids and session tokens */
  HASH_SALT: string
}

/** The signed-in user, when a valid session cookie is present. */
export interface User {
  id: string
  email: string
  lang: 'en' | 'ko'
  freeSpeakingUsed: boolean
  selfRefundUsed: boolean
}

export interface Ctx {
  env: Env
  exec: ExecutionContext
  user: User | null
  /** salted hash of the client IP's /24 (IPv4) or /48 (IPv6) */
  ipHash: string
  /** salted hash of the mpc_device cookie (set on first visit to /api) */
  deviceHash: string
  country: string | null
  region: string | null
  now: Date
}
