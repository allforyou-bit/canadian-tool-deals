// Tests for the deploy-time scripts: configuration check (deploy-config.ts), smoke checks (smoke.ts)
// and IndexNow (indexnow.ts). No network: fetch is always a stub.
import { describe, expect, it, vi } from 'vitest'
import anthropicLimitText from '../../../ops/config/anthropic-limit.json?raw'
import wranglerText from '../worker/wrangler.jsonc?raw'
import {
  checkDeployConfig,
  checkWranglerIds,
  customDomainFor,
  liveVersionFrom,
  parseAnthropicLimit,
  parseEmailList,
  parseJsonc,
  stagingFromEmail,
  wranglerSection,
} from './deploy-config'
import { buildIndexNowBodies, INDEXNOW_ENDPOINT, pingIndexNow, sitemapUrls, validIndexNowKey } from './indexnow'
import { checkHealth, checkMeShape, KEY_FILES, KEY_PAGES, runSmoke } from './smoke'

const ADDRESS = '1 Test St, Toronto ON M5V 0A1'
// wrangler.jsonc with ids pasted in, as the owner does after creating the resources
const filled = wranglerText
  .replace('// "database_id": "<paste from `npx wrangler d1 create mpc`>",', '"database_id": "0f2c8e0a-1111-4222-8333-944455556666",')
  .replace('"binding": "FLAGS"\n      // "id": "<paste from `npx wrangler kv namespace create FLAGS`>"', '"binding": "FLAGS", "id": "0123456789abcdef0123456789abcdef"')
  .replace('// "database_id": "<paste from `npx wrangler d1 create mpc-staging`>",', '"database_id": "1f2c8e0a-1111-4222-8333-944455556666",')
  .replace('"binding": "FLAGS"\n          // "id": "<paste from `npx wrangler kv namespace create FLAGS --env staging`>"', '"binding": "FLAGS", "id": "fedcba9876543210fedcba9876543210"')

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

  it('reports ids that are still commented out, per target', () => {
    expect(checkWranglerIds(parseJsonc(wranglerText), 'production')).toHaveLength(2)
    expect(checkWranglerIds(parseJsonc(wranglerText), 'staging').join(' ')).toMatch(/env\.staging has no D1 database_id/)
    expect(checkWranglerIds(parseJsonc(filled), 'production')).toEqual([])
    expect(checkWranglerIds(parseJsonc(filled), 'staging')).toEqual([])
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
    MAILING_ADDRESS: ADDRESS,
    TURNSTILE_SITE_KEY: '0x4AAAAAAAB1234567890abc',
    TURNSTILE_SECRET_MODE: 'set',
    FROM_EMAIL: 'Maple Practice Coach <coach@maplepractice.ca>',
    OWNER_EMAIL: 'owner@maplepractice.ca',
  }
  const run = (over: Record<string, string | undefined>, target: 'production' | 'staging' = 'production', limit: string | null = anthropicLimitText) =>
    checkDeployConfig({ target, env: { ...env, ...over }, wranglerText: filled, anthropicLimitText: limit })

  it('passes a complete production configuration and hands the workflow its values', () => {
    const r = run({})
    expect(r.errors).toEqual([])
    expect(r.outputs).toEqual({
      site_url: 'https://maplepractice.ca',
      domain: 'maplepractice.ca',
      anthropic_limit_usd: String(parseAnthropicLimit(anthropicLimitText).usd),
      // staging-only outputs stay empty: production is never locked and keeps its sender as is
      staging_allowed_emails: '',
      from_email: '',
    })
    expect(run({ MPC_STAGING_ALLOWED_EMAILS: 'a@b.ca' }).outputs.staging_allowed_emails).toBe('')
  })

  it('refuses production without the mailing address or with the placeholder (decision 16)', () => {
    expect(run({ MAILING_ADDRESS: '' }).errors.join(' ')).toMatch(/MPC_MAILING_ADDRESS is not set.*CASL/)
    expect(run({ MAILING_ADDRESS: 'SET-BEFORE-LAUNCH (CASL: owner mailing address)' }).errors.join(' ')).toMatch(/placeholder/)
    // the address itself is never echoed
    expect(JSON.stringify(run({ MAILING_ADDRESS: 'SET-BEFORE-LAUNCH 12 Secret Rd' }))).not.toContain('Secret Rd')
    // staging only warns
    const staging = run({ MAILING_ADDRESS: '', STRIPE_KEY_MODE: 'test' }, 'staging')
    expect(staging.errors).toEqual([])
    expect(staging.warnings.join(' ')).toMatch(/MPC_MAILING_ADDRESS is not set/)
  })

  it('passes the Anthropic Console limit from ops/config/anthropic-limit.json (R29)', () => {
    expect(run({}).outputs.anthropic_limit_usd).toBe('150')
    expect(run({}, 'production', null).errors.join(' ')).toMatch(/anthropic-limit\.json is missing/)
    expect(run({}, 'production', '{"monthlyLimitUsd": 0}').errors.join(' ')).toMatch(/positive number/)
    expect(run({}, 'production', '{"monthlyLimitUsd": 300, "confirmedByOwner": true}').warnings.join(' ')).not.toMatch(/confirmedByOwner/)
    expect(run({}, 'production', '{"monthlyLimitUsd": 300}').warnings.join(' ')).toMatch(/not confirmedByOwner/)
  })

  it('caps staging at the eval workspace limit, never the production one (round 2)', () => {
    const { usd, evalUsd } = parseAnthropicLimit(anthropicLimitText)
    expect(evalUsd).not.toBeNull()
    expect(evalUsd).not.toBe(usd)
    expect(run({ STRIPE_KEY_MODE: 'test' }, 'staging').outputs.anthropic_limit_usd).toBe(String(evalUsd))
    expect(run({ STRIPE_KEY_MODE: 'test' }, 'staging', '{"monthlyLimitUsd": 150}').errors.join(' ')).toMatch(/evalMonthlyLimitUsd must be a positive number/)
    expect(run({ STRIPE_KEY_MODE: 'test' }, 'staging', '{"monthlyLimitUsd": 150, "evalMonthlyLimitUsd": -1}').errors.join(' ')).toMatch(/evalMonthlyLimitUsd/)
    expect(run({ STRIPE_KEY_MODE: 'test' }, 'staging', null).errors.join(' ')).toMatch(/anthropic-limit\.json is missing/)
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
    expect(run({ SITE_URL: 'https://mpc.owner.workers.dev' }).outputs.domain).toBe('')
  })

  it('refuses production without a real Turnstile site key and secret; staging only warns (round 2)', () => {
    expect(run({ TURNSTILE_SITE_KEY: '' }).errors.join(' ')).toMatch(/MPC_TURNSTILE_SITE_KEY is not set.*sign-in/)
    for (const key of ['1x00000000000000000000AA', '2x00000000000000000000AB', '1x00000000000000000000BB', '3x00000000000000000000FF']) {
      expect(run({ TURNSTILE_SITE_KEY: key }).errors.join(' ')).toMatch(/test site keys/)
    }
    expect(run({ TURNSTILE_SECRET_MODE: '' }).errors.join(' ')).toMatch(/TURNSTILE_SECRET secret is not set/)
    expect(run({ TURNSTILE_SECRET_MODE: 'test' }).errors.join(' ')).toMatch(/test secret keys/)
    const staging = run({ TURNSTILE_SITE_KEY: '', TURNSTILE_SECRET_MODE: '', STRIPE_KEY_MODE: 'test' }, 'staging')
    expect(staging.errors).toEqual([])
    expect(staging.warnings.join(' ')).toMatch(/MPC_TURNSTILE_SITE_KEY is not set\. Staging does not need it/)
  })

  it('locks staging to MPC_STAGING_ALLOWED_EMAILS, else MPC_OWNER_EMAIL, and refuses it without either (round 2)', () => {
    const stg = (over: Record<string, string | undefined>) => run({ STRIPE_KEY_MODE: 'test', ...over }, 'staging')
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

  it('marks the staging sender visibly and refuses a sender it cannot mark (round 2)', () => {
    expect(run({ STRIPE_KEY_MODE: 'test' }, 'staging').outputs.from_email).toBe('STAGING - Maple Practice Coach <coach@maplepractice.ca>')
    expect(run({ STRIPE_KEY_MODE: 'test', FROM_EMAIL: 'Coach <c@x' }, 'staging').errors.join(' ')).toMatch(/MPC_FROM_EMAIL must be/)
    const unset = run({ STRIPE_KEY_MODE: 'test', FROM_EMAIL: '' }, 'staging')
    expect(unset.errors).toEqual([])
    expect(unset.warnings.join(' ')).toMatch(/MPC_FROM_EMAIL is not set/)
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
    expect(run({ STRIPE_KEY_MODE: 'test' }, 'staging').errors).toEqual([])
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

const me = { signedIn: false, free: { writing: true, speaking: false }, usage: { writingToday: 0, speakingToday: 0, graded30d: 0 }, flags: { checkoutEnabled: false, gradingEnabled: true, banner: '' } }

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

  it('passes a healthy site and requests every key page', async () => {
    const f = site()
    expect(await runSmoke({ base: 'https://coach.test/', version: '0.1.0+abc1234', fetchImpl: f, log: () => {} })).toEqual([])
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
