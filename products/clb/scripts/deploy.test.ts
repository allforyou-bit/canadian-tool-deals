// Tests for the deploy-time scripts: configuration check (deploy-config.ts), smoke checks (smoke.ts)
// and IndexNow (indexnow.ts). No network: fetch is always a stub.
import { describe, expect, it, vi } from 'vitest'
import anthropicLimitText from '../../../ops/config/anthropic-limit.json?raw'
import wranglerText from '../worker/wrangler.jsonc?raw'
import {
  checkDeployConfig,
  checkWranglerIds,
  customDomainFor,
  DEFAULT_FROM_EMAIL,
  isSandboxSender,
  liveVersionFrom,
  parseAnthropicLimit,
  parseEmailList,
  parseJsonc,
  senderAddress,
  SETUP_WORKFLOW_NAME,
  setupHint,
  setupNeededSummary,
  stagingFromEmail,
  validDay,
  wranglerSection,
} from './deploy-config'
import { buildIndexNowBodies, derivedIndexNowKey, INDEXNOW_ENDPOINT, pingIndexNow, resolveIndexNowKey, sitemapUrls, validIndexNowKey } from './indexnow'
import { checkHealth, checkMeShape, KEY_FILES, KEY_PAGES, runSmoke } from './smoke'

const ADDRESS = '1 Test St, Toronto ON M5V 0A1'
type Entry = Record<string, unknown>
type Section = { d1_databases: Entry[]; kv_namespaces: Entry[] }
/**
 * The committed wrangler.jsonc with each target's D1 database_id and FLAGS id set, or removed when a target is
 * not given. Built from the parsed config, so it does not depend on the file's comments or on whether the ids
 * are already filled in.
 */
function withIds(ids: Partial<Record<'production' | 'staging', [d1: string, kv: string]>>): Section & { env: { staging: Section } } {
  const c = parseJsonc(wranglerText) as Section & { env: { staging: Section } }
  for (const [section, v] of [
    [c, ids.production],
    [c.env.staging, ids.staging],
  ] as const) {
    const d1 = section.d1_databases.find((d) => d.binding === 'DB')!
    const kv = section.kv_namespaces.find((k) => k.binding === 'FLAGS')!
    if (v) [d1.database_id, kv.id] = v
    else {
      delete d1.database_id
      delete kv.id
    }
  }
  return c
}
// wrangler.jsonc with the ids that the setup workflow (setup-cloudflare.yml) reports, as Claude adds them
const filled = JSON.stringify(
  withIds({
    production: ['0f2c8e0a-1111-4222-8333-944455556666', '0123456789abcdef0123456789abcdef'],
    staging: ['1f2c8e0a-1111-4222-8333-944455556666', 'fedcba9876543210fedcba9876543210'],
  }),
)

describe('parseJsonc and the committed wrangler.jsonc', () => {
  it('keeps // inside strings and drops comments and trailing commas', () => {
    expect(parseJsonc('{ "url": "https://a.b/c", // note\n /* block */ "x": [1, 2,], }')).toEqual({ url: 'https://a.b/c', x: [1, 2] })
    expect(parseJsonc('{"s": "a \\" // b"}')).toEqual({ s: 'a " // b' })
  })

  it('has a staging environment with its own name and every non-inherited binding (R55)', () => {
    const config = parseJsonc(wranglerText) as Record<string, unknown>
    const staging = wranglerSection(config, 'staging')!
    expect(staging.name).toBe('maple-practice-coach-staging')
    expect(staging.name).not.toBe(config.name)
    // config-schema.json: vars, d1_databases, kv_namespaces and ai are not inherited
    for (const key of ['vars', 'd1_databases', 'kv_namespaces', 'ai']) expect(staging).toHaveProperty(key)
    // staging has every production var plus the allowlist that locks it; production never has the allowlist
    expect(Object.keys(staging.vars as object).sort()).toEqual([...Object.keys(config.vars as object), 'STAGING_ALLOWED_EMAILS'].sort())
    expect(config.vars).not.toHaveProperty('STAGING_ALLOWED_EMAILS')
    expect((staging.vars as Record<string, string>).FROM_EMAIL).toMatch(/^STAGING - /)
    expect((staging.d1_databases as { database_name: string }[])[0].database_name).not.toBe((config.d1_databases as { database_name: string }[])[0].database_name)
  })

  it('reports missing ids per target, pointing to the one-time setup workflow (never wrangler auto-provisioning)', () => {
    const unfilled = withIds({})
    const prod = checkWranglerIds(unfilled, 'production')
    expect(prod).toHaveLength(1)
    expect(prod[0]).toMatch(/^worker\/wrangler\.jsonc has no D1 database_id for DB \("mpc"\) and no KV namespace id for FLAGS yet\./)
    expect(prod[0]).toContain(`run the Actions workflow "${SETUP_WORKFLOW_NAME}" (target production or both)`)
    expect(prod[0]).toContain('Claude')
    expect(prod[0]).not.toMatch(/npx wrangler|d1 create|namespace create/)
    const staging = checkWranglerIds(unfilled, 'staging').join(' ')
    expect(staging).toMatch(/env\.staging has no D1 database_id for DB \("mpc-staging"\)/)
    expect(staging).toContain('(target staging or both)')
    // only one of the two missing
    const kvOnly = withIds({ production: ['0f2c8e0a-1111-4222-8333-944455556666', 'x'] })
    expect(checkWranglerIds(kvOnly, 'production')).toEqual([expect.stringMatching(/has no KV namespace id for FLAGS yet\. Cloudflare is not set up for production yet/)])
    expect(checkWranglerIds(parseJsonc(filled), 'production')).toEqual([])
    expect(checkWranglerIds(parseJsonc(filled), 'staging')).toEqual([])
  })

  it('the deploy summary for missing ids names the setup workflow, in Korean and English', () => {
    const text = setupNeededSummary('staging')
    expect(text).toContain(`**Actions** → **${SETUP_WORKFLOW_NAME}** → **Run workflow**`)
    expect(text).toContain('Claude')
    expect(text).toContain(setupHint('staging'))
  })

  it('keeps the staging allowlist out of production and in staging (round 2)', () => {
    const config = parseJsonc(filled) as { vars: Record<string, string>; env: { staging: { vars: Record<string, string> } } }
    const prodLocked = structuredClone(config)
    prodLocked.vars.STAGING_ALLOWED_EMAILS = 'owner@example.com'
    expect(checkWranglerIds(prodLocked, 'production').join(' ')).toMatch(/must not define STAGING_ALLOWED_EMAILS/)
    const stagingOpen = structuredClone(config)
    delete stagingOpen.env.staging.vars.STAGING_ALLOWED_EMAILS
    expect(checkWranglerIds(stagingOpen, 'staging').join(' ')).toMatch(/must define STAGING_ALLOWED_EMAILS/)
    stagingOpen.env.staging.vars.STAGING_ALLOWED_EMAILS = '  '
    expect(checkWranglerIds(stagingOpen, 'staging').join(' ')).toMatch(/must define STAGING_ALLOWED_EMAILS/)
  })
})

describe('customDomainFor (R56)', () => {
  it('returns the host for a custom domain and null for workers.dev', () => {
    expect(customDomainFor('https://maplepractice.ca')).toBe('maplepractice.ca')
    expect(customDomainFor('https://www.maplepractice.ca/')).toBe('www.maplepractice.ca')
    expect(customDomainFor('https://maple-practice-coach.owner.workers.dev')).toBeNull()
  })

  it('rejects anything but a bare https origin', () => {
    expect(() => customDomainFor('http://maplepractice.ca')).toThrow(/https/)
    expect(() => customDomainFor('https://maplepractice.ca/app')).toThrow(/no path/)
    expect(() => customDomainFor('https://maplepractice.ca:8443')).toThrow(/port/)
    expect(() => customDomainFor('maplepractice.ca')).toThrow()
  })
})

describe('checkDeployConfig', () => {
  const env = {
    SITE_URL: 'https://maplepractice.ca/',
    LEGAL_NAME: 'Jiwoo Kim',
    MAILING_ADDRESS: ADDRESS,
    GOOGLE_CLIENT_ID: '123456789012-abcdefghijklmnopqrstuvwxyz012345.apps.googleusercontent.com',
    GOOGLE_SECRET_MODE: 'set',
    TURNSTILE_SITE_KEY: '0x4AAAAAAAB1234567890abc',
    TURNSTILE_SECRET_MODE: 'set',
    FROM_EMAIL: 'Maple Practice Coach <coach@maplepractice.ca>',
    OWNER_EMAIL: 'owner@maplepractice.ca',
  }
  const today = '2026-10-01'
  const bought = JSON.stringify({ monthlyLimitUsd: 10, evalMonthlyLimitUsd: 5, prepaidUsd: 10, prepaidSince: '2026-09-30', confirmedByOwner: true })
  const run = (over: Record<string, string | undefined>, target: 'production' | 'staging' = 'production', limit: string | null = bought) =>
    checkDeployConfig({ target, env: { ...env, ...over }, wranglerText: filled, anthropicLimitText: limit, today })
  const stg = (over: Record<string, string | undefined> = {}, limit: string | null = bought) => run({ STRIPE_KEY_MODE: 'test', ...over }, 'staging', limit)

  it('passes a complete production configuration and hands the workflow its values', () => {
    const r = run({})
    expect(r.errors).toEqual([])
    expect(r.warnings).toEqual([])
    expect(r.outputs).toEqual({
      site_url: 'https://maplepractice.ca',
      domain: 'maplepractice.ca',
      anthropic_limit_usd: '10',
      prepaid_usd: '10',
      prepaid_since: '2026-09-30',
      // production is never locked and keeps its sender as is
      staging_allowed_emails: '',
      from_email: 'Maple Practice Coach <coach@maplepractice.ca>',
      legal_name: 'Jiwoo Kim',
      require_address: 'true',
      google_client_id: env.GOOGLE_CLIENT_ID,
      // passed explicitly on every deploy (memo §7.2 Z3, Z4)
      magic_link: 'owner',
      learner_email: 'off',
    })
    expect(r.notices.join(' ')).toContain('https://maplepractice.ca/api/auth/google/callback')
    expect(run({ MPC_STAGING_ALLOWED_EMAILS: 'a@b.ca' }).outputs.staging_allowed_emails).toBe('')
  })

  it('refuses production without the seller\'s legal name; staging only warns (Z5)', () => {
    expect(run({ LEGAL_NAME: '' }).errors.join(' ')).toMatch(/MPC_LEGAL_NAME is not set\..*sold by <legal name>.*Production is not deployed without it/)
    expect(run({ LEGAL_NAME: 'SET-BEFORE-LAUNCH owner name' }).errors.join(' ')).toMatch(/placeholder/)
    expect(run({ LEGAL_NAME: 'J' }).errors.join(' ')).toMatch(/2–100 characters/)
    expect(run({ LEGAL_NAME: 'Jiwoo <b>Kim</b>' }).errors.join(' ')).toMatch(/plain name/)
    expect(run({ LEGAL_NAME: 'owner@maplepractice.ca' }).errors.join(' ')).toMatch(/plain name/)
    expect(run({ LEGAL_NAME: '  Jiwoo Kim  ' }).outputs.legal_name).toBe('Jiwoo Kim')
    expect(run({ LEGAL_NAME: 'Jiwoo O’Brien-Kim' }).errors).toEqual([])
    // the name itself is never echoed in a message
    expect(JSON.stringify(run({ LEGAL_NAME: 'Secretname <x>' }).errors)).not.toContain('Secretname')
    const staging = stg({ LEGAL_NAME: '' })
    expect(staging.errors).toEqual([])
    expect(staging.warnings.join(' ')).toMatch(/MPC_LEGAL_NAME is not set/)
    expect(stg({ LEGAL_NAME: 'x\ny' }).errors.join(' ')).toMatch(/plain name/)
  })

  it('makes the mailing address optional, checking it only when set (Z5)', () => {
    const none = run({ MAILING_ADDRESS: '' })
    expect(none.errors).toEqual([])
    expect(none.outputs.require_address).toBe('false')
    expect(none.warnings.join(' ')).toMatch(/MPC_MAILING_ADDRESS is not set: the privacy page offers the support form/)
    expect(run({}).outputs.require_address).toBe('true')
    // a leftover placeholder is refused in production and only warned about on staging
    expect(run({ MAILING_ADDRESS: 'SET-BEFORE-LAUNCH (CASL: owner mailing address)' }).errors.join(' ')).toMatch(/placeholder: set the real address or delete the variable/)
    expect(JSON.stringify(run({ MAILING_ADDRESS: 'SET-BEFORE-LAUNCH 12 Secret Rd' }))).not.toContain('Secret Rd')
    expect(stg({ MAILING_ADDRESS: 'SET-BEFORE-LAUNCH x' }).warnings.join(' ')).toMatch(/placeholder/)
    expect(stg({ MAILING_ADDRESS: '' }).warnings.join(' ')).not.toMatch(/MAILING_ADDRESS/)
    // emails to learners bring the CASL address duty back
    const learnerMail = run({ MAILING_ADDRESS: '', LEARNER_EMAIL: 'on', FROM_EMAIL: 'Coach <coach@maplepractice.ca>' })
    expect(learnerMail.errors.join(' ')).toMatch(/MPC_LEARNER_EMAIL=on: emails to learners must carry the sender's mailing address/)
    expect(run({ LEARNER_EMAIL: 'on' }).errors).toEqual([])
  })

  it('refuses production without Google sign-in; staging warns and never gets half of it (Z3)', () => {
    expect(run({ GOOGLE_CLIENT_ID: '' }).errors.join(' ')).toMatch(/needs the MPC_GOOGLE_CLIENT_ID variable\. Production is not deployed/)
    expect(run({ GOOGLE_SECRET_MODE: '' }).errors.join(' ')).toMatch(/needs the GOOGLE_CLIENT_SECRET secret\./)
    expect(run({ GOOGLE_CLIENT_ID: '', GOOGLE_SECRET_MODE: '' }).errors.join(' ')).toMatch(/the MPC_GOOGLE_CLIENT_ID variable and the GOOGLE_CLIENT_SECRET secret/)
    expect(run({ GOOGLE_CLIENT_ID: 'my-client-id' }).errors.join(' ')).toMatch(/does not look like a Google OAuth Client ID/)
    const secretInVar = run({ GOOGLE_CLIENT_ID: 'GOCSPX-abcdefghijklmnop' })
    expect(secretInVar.errors.join(' ')).toMatch(/holds a Google client SECRET/)
    expect(JSON.stringify(secretInVar)).not.toContain('abcdefghijklmnop')
    expect(secretInVar.outputs.google_client_id).toBe('')
    const staging = stg({ GOOGLE_SECRET_MODE: '' })
    expect(staging.errors).toEqual([])
    expect(staging.warnings.join(' ')).toMatch(/Google sign-in is off on staging \(missing the GOOGLE_CLIENT_SECRET secret\)/)
    expect(staging.outputs.google_client_id).toBe('')
    expect(stg().outputs.google_client_id).toBe(env.GOOGLE_CLIENT_ID)
    expect(stg({ GOOGLE_CLIENT_ID: '', MAGIC_LINK: 'off' }).warnings.join(' ')).toMatch(/nobody can sign in on staging/)
  })

  it('passes MAGIC_LINK and LEARNER_EMAIL explicitly and validates overrides (Z3, Z4)', () => {
    expect(run({ MAGIC_LINK: 'off', LEARNER_EMAIL: 'off' }).outputs).toMatchObject({ magic_link: 'off', learner_email: 'off' })
    expect(run({ MAGIC_LINK: 'everyone' }).errors.join(' ')).toMatch(/MPC_MAGIC_LINK must be owner, all, off/)
    expect(run({ LEARNER_EMAIL: 'yes' }).errors.join(' ')).toMatch(/MPC_LEARNER_EMAIL must be off or on/)
    expect(stg().outputs).toMatchObject({ magic_link: 'owner', learner_email: 'off' })
  })

  it("defaults the sender to Resend's sandbox and refuses it for learner email (Z4)", () => {
    const r = run({ FROM_EMAIL: '' })
    expect(r.errors).toEqual([])
    expect(r.outputs.from_email).toBe('Maple Practice Coach <onboarding@resend.dev>')
    expect(DEFAULT_FROM_EMAIL).toBe('Maple Practice Coach <onboarding@resend.dev>')
    expect(r.notices.join(' ')).toMatch(/sandbox sender \(resend\.dev, the default\).*MPC_OWNER_EMAIL must be that address/)
    expect(run({ FROM_EMAIL: '', LEARNER_EMAIL: 'on' }).errors.join(' ')).toMatch(/MPC_LEARNER_EMAIL=on needs a sender on your own verified domain/)
    expect(run({ FROM_EMAIL: 'Coach <onboarding@resend.dev>', MAGIC_LINK: 'all' }).errors.join(' ')).toMatch(/MPC_MAGIC_LINK=all needs a sender/)
    expect(run({ MAGIC_LINK: 'all' }).errors).toEqual([])
    expect(run({ FROM_EMAIL: 'Coach <c@x' }).errors.join(' ')).toMatch(/MPC_FROM_EMAIL must be/)
    expect(senderAddress('Coach <c@x.ca>')).toBe('c@x.ca')
    expect(senderAddress('c@x.ca')).toBe('c@x.ca')
    expect(senderAddress('nope')).toBeNull()
    expect(isSandboxSender('A <onboarding@RESEND.dev>')).toBe(true)
    expect(isSandboxSender('A <x@resend.dev.example.com>')).toBe(false)
  })

  it('needs MPC_OWNER_EMAIL in production: alerts and the owner sign-in link go there', () => {
    expect(run({ OWNER_EMAIL: '' }).errors.join(' ')).toMatch(/Set the repository variable MPC_OWNER_EMAIL/)
    expect(run({ OWNER_EMAIL: 'a@b.ca, c@d.ca' }).errors.join(' ')).toMatch(/must be one email address/)
  })

  it('passes the Anthropic Console limit and the prepaid ledger from ops/config/anthropic-limit.json (R29, Z6)', () => {
    // the committed file: US$10 production, US$5 eval, US$10 of credits not bought yet
    const committed = parseAnthropicLimit(anthropicLimitText, today)
    expect(committed).toMatchObject({ usd: 10, evalUsd: 5, confirmed: false, prepaid: null })
    expect(committed.prepaidProblem).toMatch(/prepaidSince is not set yet/)
    const r = run({}, 'production', anthropicLimitText)
    expect(r.errors).toEqual([])
    expect(r.outputs).toMatchObject({ anthropic_limit_usd: '10', prepaid_usd: '', prepaid_since: '' })
    expect(r.warnings.join(' ')).toMatch(/prepaidSince is not set yet.*prepaid-credit ledger is off/)
    expect(r.warnings.join(' ')).toMatch(/not confirmedByOwner/)
    expect(run({}, 'production', null).errors.join(' ')).toMatch(/anthropic-limit\.json is missing/)
    expect(run({}, 'production', '{"monthlyLimitUsd": 0}').errors.join(' ')).toMatch(/positive number/)
    expect(run({}, 'production', '{"monthlyLimitUsd": 300, "confirmedByOwner": true}').warnings.join(' ')).not.toMatch(/confirmedByOwner/)
  })

  it('passes the prepaid pair only when both parts are valid (Z6)', () => {
    const lim = (o: Record<string, unknown>) => JSON.stringify({ monthlyLimitUsd: 10, evalMonthlyLimitUsd: 5, confirmedByOwner: true, ...o })
    const prepaid = (o: Record<string, unknown>) => {
      const r = run({}, 'production', lim(o))
      return { usd: r.outputs.prepaid_usd, since: r.outputs.prepaid_since, warn: r.warnings.join(' ') }
    }
    expect(prepaid({ prepaidUsd: 25.5, prepaidSince: '2026-10-01' })).toEqual({ usd: '25.5', since: '2026-10-01', warn: '' })
    expect(prepaid({ prepaidUsd: 10, prepaidSince: '2026-10-02' })).toMatchObject({ usd: '', warn: expect.stringMatching(/is in the future/) })
    expect(prepaid({ prepaidUsd: 10, prepaidSince: '2026-02-30' })).toMatchObject({ usd: '', warn: expect.stringMatching(/real day written YYYY-MM-DD/) })
    expect(prepaid({ prepaidUsd: 10, prepaidSince: '2026-09-30T12:00:00Z' })).toMatchObject({ since: '', warn: expect.stringMatching(/YYYY-MM-DD/) })
    expect(prepaid({ prepaidUsd: 0, prepaidSince: '2026-09-30' })).toMatchObject({ usd: '', warn: expect.stringMatching(/prepaidUsd must be a positive number/) })
    expect(prepaid({ prepaidUsd: '10', prepaidSince: '2026-09-30' })).toMatchObject({ usd: '', warn: expect.stringMatching(/prepaidUsd must be/) })
    expect(prepaid({})).toMatchObject({ usd: '', warn: expect.stringMatching(/prepaidUsd and prepaidSince are not set/) })
    // never an error: a deploy without the ledger still has the monthly limit
    expect(run({}, 'production', lim({ prepaidUsd: -1 })).errors).toEqual([])
    // staging never gets the ledger (the credits are the organization's; staging sees only its own spend)
    expect(stg({}, lim({ prepaidUsd: 10, prepaidSince: '2026-09-30' })).outputs).toMatchObject({ prepaid_usd: '', prepaid_since: '', anthropic_limit_usd: '5' })
    expect(validDay('2026-09-30')).toBe(true)
    expect(validDay('2026-13-01')).toBe(false)
  })

  it('caps staging at the eval workspace limit, never the production one (round 2)', () => {
    const { usd, evalUsd } = parseAnthropicLimit(anthropicLimitText)
    expect(evalUsd).not.toBeNull()
    expect(evalUsd).not.toBe(usd)
    expect(stg({}, anthropicLimitText).outputs.anthropic_limit_usd).toBe(String(evalUsd))
    expect(stg({}, '{"monthlyLimitUsd": 150}').errors.join(' ')).toMatch(/evalMonthlyLimitUsd must be a positive number/)
    expect(stg({}, '{"monthlyLimitUsd": 150, "evalMonthlyLimitUsd": -1}').errors.join(' ')).toMatch(/evalMonthlyLimitUsd/)
    expect(stg({}, null).errors.join(' ')).toMatch(/anthropic-limit\.json is missing/)
    // production does not need the eval limit
    expect(run({}, 'production', '{"monthlyLimitUsd": 150, "confirmedByOwner": true}').errors).toEqual([])
  })

  it('validates the grader variables the Worker would otherwise ignore silently', () => {
    expect(run({ GRADER_MODEL: 'claude-sonnet-5', GRADER_EFFORT: 'medium', GRADER_MAX_TOKENS: '6000' }).errors).toEqual([])
    expect(run({ GRADER_MODEL: 'gpt-5' }).errors.join(' ')).toMatch(/MPC_GRADER_MODEL/)
    expect(run({ GRADER_EFFORT: 'extreme' }).errors.join(' ')).toMatch(/MPC_GRADER_EFFORT/)
    expect(run({ GRADER_MAX_TOKENS: '100' }).errors.join(' ')).toMatch(/MPC_GRADER_MAX_TOKENS/)
    expect(run({ GRADER_MAX_TOKENS: '8k' }).errors.join(' ')).toMatch(/MPC_GRADER_MAX_TOKENS/)
  })

  it('needs an https site URL and derives no custom domain for workers.dev', () => {
    expect(run({ SITE_URL: '' }).errors.join(' ')).toMatch(/MPC_SITE_URL/)
    expect(run({ SITE_URL: '' }, 'staging').errors.join(' ')).toMatch(/MPC_STAGING_SITE_URL/)
    expect(run({ SITE_URL: 'http://x.ca' }).errors.join(' ')).toMatch(/https/)
    const workersDev = run({ SITE_URL: 'https://mpc.owner.workers.dev' })
    expect(workersDev.outputs.domain).toBe('')
    expect(workersDev.notices.join(' ')).toContain('https://mpc.owner.workers.dev/api/auth/google/callback')
  })

  it('refuses production without a real Turnstile site key and secret; staging only warns (round 2)', () => {
    expect(run({ TURNSTILE_SITE_KEY: '' }).errors.join(' ')).toMatch(/MPC_TURNSTILE_SITE_KEY is not set.*sign-in/)
    for (const key of ['1x00000000000000000000AA', '2x00000000000000000000AB', '1x00000000000000000000BB', '3x00000000000000000000FF']) {
      expect(run({ TURNSTILE_SITE_KEY: key }).errors.join(' ')).toMatch(/test site keys/)
    }
    expect(run({ TURNSTILE_SECRET_MODE: '' }).errors.join(' ')).toMatch(/TURNSTILE_SECRET secret is not set/)
    expect(run({ TURNSTILE_SECRET_MODE: 'test' }).errors.join(' ')).toMatch(/test secret keys/)
    const staging = stg({ TURNSTILE_SITE_KEY: '', TURNSTILE_SECRET_MODE: '' })
    expect(staging.errors).toEqual([])
    expect(staging.warnings.join(' ')).toMatch(/MPC_TURNSTILE_SITE_KEY is not set\. Staging does not need it/)
  })

  it('locks staging to MPC_STAGING_ALLOWED_EMAILS, else MPC_OWNER_EMAIL, and refuses it without either (round 2)', () => {
    expect(stg({}).outputs.staging_allowed_emails).toBe('owner@maplepractice.ca')
    expect(stg({ MPC_STAGING_ALLOWED_EMAILS: ' me@x.ca , , Second@Y.ca ' }).outputs.staging_allowed_emails).toBe('me@x.ca,Second@Y.ca')
    const none = stg({ MPC_STAGING_ALLOWED_EMAILS: '', OWNER_EMAIL: '' })
    expect(none.errors.join(' ')).toMatch(/not deployed without an email allowlist/)
    expect(none.outputs.staging_allowed_emails).toBe('')
    const bad = stg({ MPC_STAGING_ALLOWED_EMAILS: 'me@x.ca, not an email; secret-value' })
    expect(bad.errors.join(' ')).toMatch(/MPC_STAGING_ALLOWED_EMAILS: 1 of 2 entries/)
    expect(JSON.stringify(bad)).not.toContain('secret-value')
    expect(bad.outputs.staging_allowed_emails).toBe('')
    expect(parseEmailList(' a@b.c,,  d@e.f ')).toEqual(['a@b.c', 'd@e.f'])
  })

  it('marks the staging sender visibly, the sandbox default included, and refuses a sender it cannot mark (round 2)', () => {
    expect(stg().outputs.from_email).toBe('STAGING - Maple Practice Coach <coach@maplepractice.ca>')
    expect(stg({ FROM_EMAIL: 'Coach <c@x' }).errors.join(' ')).toMatch(/MPC_FROM_EMAIL must be/)
    const unset = stg({ FROM_EMAIL: '' })
    expect(unset.errors).toEqual([])
    expect(unset.outputs.from_email).toBe('STAGING - Maple Practice Coach <onboarding@resend.dev>')
    expect(stagingFromEmail('coach@maplepractice.ca')).toBe('STAGING - Maple Practice Coach <coach@maplepractice.ca>')
    expect(stagingFromEmail('<coach@maplepractice.ca>')).toBe('STAGING - Maple Practice Coach <coach@maplepractice.ca>')
    expect(stagingFromEmail('"Maple, Coach" <c@x.ca>')).toBe('"STAGING - Maple, Coach" <c@x.ca>')
    expect(stagingFromEmail('STAGING - Coach <c@x.ca>')).toBe('STAGING - Coach <c@x.ca>')
    expect(stagingFromEmail(undefined)).toBe('')
    expect(stagingFromEmail('not an address')).toBeNull()
  })

  it('never lets staging use a live Stripe key', () => {
    expect(run({ STRIPE_KEY_MODE: 'live' }, 'staging').errors.join(' ')).toMatch(/live key/)
    expect(run({ STRIPE_KEY_MODE: '' }, 'staging').warnings.join(' ')).toMatch(/checkout on staging will not work/)
    expect(stg().errors).toEqual([])
  })
})

describe('liveVersionFrom (deploy.yml before the deploy and before a rollback)', () => {
  const status = { id: 'd1', versions: [{ version_id: 'v-new', percentage: 100 }] }

  it('returns the version at 100% and ignores text before the JSON', () => {
    expect(liveVersionFrom(JSON.stringify(status, null, 2))).toBe('v-new')
    expect(liveVersionFrom(`▲ [WARNING] Proxy environment variables detected.\n${JSON.stringify(status)}`)).toBe('v-new')
  })

  it('returns an empty string for a gradual deployment or anything else', () => {
    expect(liveVersionFrom(JSON.stringify({ versions: [{ version_id: 'a', percentage: 50 }, { version_id: 'b', percentage: 50 }] }))).toBe('')
    expect(liveVersionFrom('')).toBe('')
    expect(liveVersionFrom('✘ [ERROR] The Worker has no deployments.')).toBe('')
    expect(liveVersionFrom('{ not json')).toBe('')
    expect(liveVersionFrom(JSON.stringify({ versions: [{ version_id: 7, percentage: 100 }] }))).toBe('')
  })
})

// ---------- smoke ----------

const me = {
  signedIn: false,
  free: { writing: true, speaking: false },
  usage: { writingToday: 0, speakingToday: 0, graded30d: 0 },
  flags: { checkoutEnabled: false, gradingEnabled: true, freeEnabled: true, banner: '', speakingAvailable: true },
  auth: { google: true, magicLink: 'owner' },
}

function site(over: Record<string, { status?: number; body?: unknown; type?: string }> = {}) {
  return vi.fn(async (url: string) => {
    const path = new URL(url).pathname
    const o = over[path] ?? {}
    const status = o.status ?? 200
    if (path === '/api/health') return Response.json(o.body ?? { ok: true, version: '0.1.0+abc1234' }, { status })
    if (path === '/api/me') return new Response(JSON.stringify(o.body ?? me), { status, headers: { 'content-type': o.type ?? 'application/json' } })
    return new Response('<!doctype html><p>ok</p>', { status, headers: { 'content-type': o.type ?? (path.endsWith('/') ? 'text/html; charset=utf-8' : 'text/plain') } })
  })
}

describe('smoke checks', () => {
  it('checks the health body and the version', () => {
    expect(checkHealth({ ok: true, version: 'v1' }, 'v1')).toEqual([])
    expect(checkHealth({ ok: true, version: 'v0' }, 'v1')).toEqual(['/api/health: version is v0, want v1'])
    expect(checkHealth({ ok: false })).toHaveLength(2)
  })

  it('checks the signed-out /api/me shape', () => {
    expect(checkMeShape(me)).toEqual([])
    expect(checkMeShape({ ...me, email: 'a@b.c' })).toContain('/api/me: a signed-out response must not carry an email field')
    expect(checkMeShape({ ...me, flags: { checkoutEnabled: 'no' } }).join(' ')).toMatch(/flags must be/)
    expect(checkMeShape({ ...me, usage: {} }).join(' ')).toMatch(/usage must be/)
    expect(checkMeShape({ ...me, signedIn: true }).join(' ')).toMatch(/signedIn should be false/)
    expect(checkMeShape('nope')).toEqual(['/api/me: body is not a JSON object'])
  })

  it('checks the zero-capital fields and what the deploy configured (Z2, Z3)', () => {
    expect(checkMeShape({ ...me, flags: { ...me.flags, speakingAvailable: undefined } }).join(' ')).toMatch(/speakingAvailable/)
    expect(checkMeShape({ ...me, auth: undefined }).join(' ')).toMatch(/auth must be/)
    expect(checkMeShape({ ...me, auth: { google: true, magicLink: 'everyone' } }).join(' ')).toMatch(/auth must be/)
    expect(checkMeShape(me, { google: true, magicLink: 'owner' })).toEqual([])
    expect(checkMeShape(me, { google: false })).toEqual(['/api/me: auth.google is true, but this deploy did not configure Google sign-in'])
    expect(checkMeShape({ ...me, auth: { google: false, magicLink: 'owner' } }, { google: true })).toEqual(['/api/me: auth.google is false, but this deploy configured Google sign-in'])
    expect(checkMeShape(me, { magicLink: 'off' })).toEqual(['/api/me: auth.magicLink is owner, want off'])
  })

  it('passes a healthy site and requests every key page', async () => {
    const f = site()
    expect(await runSmoke({ base: 'https://coach.test/', version: '0.1.0+abc1234', expect: { google: true, magicLink: 'owner' }, fetchImpl: f, log: () => {} })).toEqual([])
    const paths = f.mock.calls.map(([u]) => new URL(u).pathname)
    for (const p of [...KEY_PAGES, ...KEY_FILES, '/api/health', '/api/me']) expect(paths).toContain(p)
  })

  it('waits for the new version, then reports what is still wrong', async () => {
    let n = 0
    const healthy = site()
    const f = vi.fn(async (url: string) => {
      if (new URL(url).pathname === '/api/health') return Response.json({ ok: true, version: ++n < 3 ? 'old' : 'new' })
      return healthy(url)
    })
    const sleep = vi.fn(async () => {})
    expect(await runSmoke({ base: 'https://coach.test', version: 'new', waitSeconds: 60, pollSeconds: 10, fetchImpl: f, sleep, log: () => {} })).toEqual([])
    expect(sleep).toHaveBeenCalledTimes(2)
    const bad = site({ '/pricing/': { status: 404 }, '/api/me': { type: 'text/html' } })
    const problems = await runSmoke({ base: 'https://coach.test', version: 'x', fetchImpl: bad, log: () => {} })
    expect(problems).toEqual(['/api/health: version is 0.1.0+abc1234, want x', '/pricing/: HTTP 404', '/api/me: content-type text/html, want application/json'])
  })

  it('reports a network failure as HTTP 0 instead of throwing', async () => {
    const f = vi.fn(async () => {
      throw new Error('ECONNREFUSED')
    })
    const problems = await runSmoke({ base: 'https://coach.test', fetchImpl: f, log: () => {} })
    expect(problems[0]).toBe('/api/health: HTTP 0')
    expect(problems).toContain('/api/me: HTTP 0')
  })
})

// ---------- IndexNow ----------

describe('IndexNow (R70)', () => {
  const xml = `<?xml version="1.0"?><urlset>
    <url><loc>https://maplepractice.ca/</loc></url>
    <url><loc> https://maplepractice.ca/ko/ </loc></url>
    <url><loc>https://maplepractice.ca/pricing/?a=1&amp;b=2</loc></url>
    <url><loc>https://other.example/</loc></url>
    <url><loc>https://maplepractice.ca/</loc></url>
  </urlset>`

  it('accepts keys of 8–128 letters, digits and dashes', () => {
    expect(validIndexNowKey('a1b2c3d4')).toBe(true)
    expect(validIndexNowKey('0f'.repeat(16))).toBe(true)
    expect(validIndexNowKey('short')).toBe(false)
    expect(validIndexNowKey('has space here')).toBe(false)
    expect(validIndexNowKey('x'.repeat(129))).toBe(false)
  })

  it('derives a stable key from the site origin when MPC_INDEXNOW_KEY is unset (Z10)', async () => {
    // first 32 hex characters of SHA-256("https://maplepractice.ca")
    expect(await derivedIndexNowKey('https://maplepractice.ca')).toBe('8c0b1ee1822610e550cf6ad9e08fd3c0')
    // the origin, not the exact spelling, decides the key
    expect(await derivedIndexNowKey('https://MaplePractice.ca/')).toBe('8c0b1ee1822610e550cf6ad9e08fd3c0')
    expect(await derivedIndexNowKey('https://maple-practice-coach.owner.workers.dev')).toBe('90700404bf7db812f22552a8184af319')
    expect(validIndexNowKey(await derivedIndexNowKey('https://maplepractice.ca'))).toBe(true)
  })

  it('prefers a valid MPC_INDEXNOW_KEY and falls back to the derived key with a warning', async () => {
    expect(await resolveIndexNowKey('a1b2c3d4e5', 'https://maplepractice.ca')).toEqual({ key: 'a1b2c3d4e5', source: 'variable' })
    expect(await resolveIndexNowKey('  ', 'https://maplepractice.ca')).toEqual({ key: '8c0b1ee1822610e550cf6ad9e08fd3c0', source: 'derived' })
    expect(await resolveIndexNowKey(undefined, 'https://maplepractice.ca')).toMatchObject({ source: 'derived' })
    const bad = await resolveIndexNowKey('not valid!', 'https://maplepractice.ca')
    expect(bad).toMatchObject({ key: '8c0b1ee1822610e550cf6ad9e08fd3c0', source: 'derived', warning: expect.stringMatching(/MPC_INDEXNOW_KEY must be/) })
    // no key and no usable site: skipped, never a failure
    expect(await resolveIndexNowKey('', '')).toMatchObject({ key: null, reason: expect.stringMatching(/no https:\/\/ site URL/) })
    expect(await resolveIndexNowKey('', 'http://maplepractice.ca')).toMatchObject({ key: null })
  })

  it('takes the sitemap URLs on the site host only, once each', () => {
    expect(sitemapUrls(xml, 'https://maplepractice.ca')).toEqual(['https://maplepractice.ca/', 'https://maplepractice.ca/ko/', 'https://maplepractice.ca/pricing/?a=1&b=2'])
    expect(sitemapUrls(xml, 'https://elsewhere.ca')).toEqual([])
  })

  it('builds the request body with the key file location at the site root', () => {
    const [body] = buildIndexNowBodies('https://maplepractice.ca', 'a1b2c3d4e5', ['https://maplepractice.ca/'])
    expect(body).toEqual({ host: 'maplepractice.ca', key: 'a1b2c3d4e5', keyLocation: 'https://maplepractice.ca/a1b2c3d4e5.txt', urlList: ['https://maplepractice.ca/'] })
    const many = Array.from({ length: 10_001 }, (_, i) => `https://maplepractice.ca/p${i}/`)
    expect(buildIndexNowBodies('https://maplepractice.ca', 'a1b2c3d4e5', many).map((b) => b.urlList.length)).toEqual([10_000, 1])
  })

  it('posts JSON and never throws on errors (the deploy is not affected)', async () => {
    const bodies = buildIndexNowBodies('https://maplepractice.ca', 'a1b2c3d4e5', ['https://maplepractice.ca/'])
    const ok = vi.fn(async () => new Response(null, { status: 202 }))
    expect(await pingIndexNow(bodies, ok)).toEqual({ ok: true, lines: ['IndexNow: 1 URL(s) → HTTP 202'] })
    const [url, init] = ok.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(INDEXNOW_ENDPOINT)
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual(bodies[0])
    expect((await pingIndexNow(bodies, async () => new Response(null, { status: 422 }))).ok).toBe(false)
    const down = await pingIndexNow(bodies, async () => {
      throw new Error('ENOTFOUND')
    })
    expect(down.ok).toBe(false)
    expect(down.lines[0]).toMatch(/request failed/)
  })
})
