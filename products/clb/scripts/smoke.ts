// Smoke checks against a deployed Worker (deploy.yml after every deploy; level-b.yml on demand):
//   1. GET /api/health → 200 {ok:true, version}; with --version, polls until that version is live
//   2. key pages → 200 HTML (and robots.txt / sitemap.xml)
//   3. GET /api/me (signed out) → 200 JSON in the MeResponse shape (shared/api.ts), no email; with
//      --expect-google / --expect-magic-link (deploy.yml), the sign-in methods the deploy configured
//      (memo §7.2 Z3: auth.google, auth.magicLink)
//
//   node scripts/run.mjs scripts/smoke.ts --base https://… [--version 0.1.0+abc1234] [--wait-seconds 120]
//       [--expect-google true|false] [--expect-magic-link owner|all|off]
//
// Exit 0 when every check passed, 1 otherwise. Prints status codes and field names only.
import type { HealthResponse, MeResponse } from '../shared/api'

/** Pages every deploy must serve (all are in the static export). */
export const KEY_PAGES = [
  '/',
  '/ko/',
  '/pricing/',
  '/ko/pricing/',
  '/practice/',
  '/practice/writing/email/',
  '/practice/speaking/advice/',
  '/login/',
  '/account/',
  '/help/',
  '/formats/',
  '/legal/privacy/',
  '/legal/terms/',
  '/legal/refunds/',
  '/legal/ai-disclosure/',
] as const
export const KEY_FILES = ['/robots.txt', '/sitemap.xml'] as const

type Fetch = (url: string, init?: RequestInit) => Promise<Response>

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

/** Problems with a GET /api/health body; `version` is required to match when given. */
export function checkHealth(body: unknown, version?: string): string[] {
  if (!isObj(body)) return ['/api/health: body is not a JSON object']
  const h = body as Partial<HealthResponse> & Record<string, unknown>
  const p: string[] = []
  if (h.ok !== true) p.push('/api/health: ok is not true')
  if (typeof h.version !== 'string' || h.version === '') p.push('/api/health: version is missing')
  else if (version && h.version !== version) p.push(`/api/health: version is ${h.version}, want ${version}`)
  return p
}

/** What the deploy configured, checked against /api/me's `auth` (fields left out are not checked). */
export interface MeExpectations {
  google?: boolean
  magicLink?: string
}

/** Problems with a signed-out GET /api/me body (MeResponse, shared/api.ts). */
export function checkMeShape(body: unknown, expect: MeExpectations = {}): string[] {
  if (!isObj(body)) return ['/api/me: body is not a JSON object']
  const me = body as Partial<MeResponse> & Record<string, unknown>
  const p: string[] = []
  const bool = (v: unknown) => typeof v === 'boolean'
  const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0
  if (me.signedIn !== false) p.push('/api/me: signedIn should be false for a request without a session')
  if ('email' in me) p.push('/api/me: a signed-out response must not carry an email field')
  if (!isObj(me.free) || !bool(me.free.writing) || !bool(me.free.speaking)) p.push('/api/me: free must be {writing: boolean, speaking: boolean}')
  if (!isObj(me.usage) || !num(me.usage.writingToday) || !num(me.usage.speakingToday) || !num(me.usage.graded30d)) {
    p.push('/api/me: usage must be {writingToday, speakingToday, graded30d} numbers')
  }
  if (
    !isObj(me.flags) ||
    !bool(me.flags.checkoutEnabled) ||
    !bool(me.flags.gradingEnabled) ||
    !bool(me.flags.freeEnabled) ||
    !bool(me.flags.speakingAvailable) ||
    typeof me.flags.banner !== 'string'
  ) {
    p.push('/api/me: flags must be {checkoutEnabled, gradingEnabled, freeEnabled, speakingAvailable: boolean, banner: string}')
  }
  if (!isObj(me.auth) || !bool(me.auth.google) || !['owner', 'all', 'off'].includes(String(me.auth.magicLink))) {
    p.push("/api/me: auth must be {google: boolean, magicLink: 'owner' | 'all' | 'off'}")
  } else {
    if (expect.google !== undefined && me.auth.google !== expect.google) p.push(`/api/me: auth.google is ${me.auth.google}, but this deploy ${expect.google ? 'configured' : 'did not configure'} Google sign-in`)
    if (expect.magicLink !== undefined && me.auth.magicLink !== expect.magicLink) p.push(`/api/me: auth.magicLink is ${me.auth.magicLink}, want ${expect.magicLink}`)
  }
  if (me.pass !== undefined && me.pass !== null) p.push('/api/me: pass must be null or absent when signed out')
  return p
}

async function getJson(fetchImpl: Fetch, url: string): Promise<{ status: number; body: unknown; type: string }> {
  try {
    const res = await fetchImpl(url, { headers: { accept: 'application/json' }, redirect: 'manual' })
    const type = res.headers.get('content-type') ?? ''
    let body: unknown = null
    try {
      body = await res.json()
    } catch {
      body = null
    }
    return { status: res.status, body, type }
  } catch {
    return { status: 0, body: null, type: '' }
  }
}

export interface SmokeOptions {
  base: string
  version?: string
  expect?: MeExpectations
  waitSeconds?: number
  pollSeconds?: number
  fetchImpl?: Fetch
  sleep?: (ms: number) => Promise<void>
  log?: (line: string) => void
}

/** Runs every check; returns the problems (empty = passed). */
export async function runSmoke(opts: SmokeOptions): Promise<string[]> {
  const base = opts.base.replace(/\/+$/, '')
  const fetchImpl = opts.fetchImpl ?? ((u, i) => fetch(u, i))
  const sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)))
  const log = opts.log ?? ((l) => console.log(l))
  const problems: string[] = []

  // 1. health, polling while a new version reaches every location
  const attempts = Math.max(1, Math.floor((opts.waitSeconds ?? 0) / (opts.pollSeconds ?? 10)) + 1)
  let health: string[] = []
  for (let i = 1; i <= attempts; i++) {
    const r = await getJson(fetchImpl, `${base}/api/health`)
    health = r.status === 200 ? checkHealth(r.body, opts.version) : [`/api/health: HTTP ${r.status}`]
    if (!health.length) break
    if (i < attempts) {
      log(`smoke: attempt ${i}/${attempts}: ${health.join('; ')}`)
      await sleep((opts.pollSeconds ?? 10) * 1000)
    }
  }
  problems.push(...health)
  if (!health.length) log(`smoke: /api/health 200${opts.version ? ` (${opts.version})` : ''}`)

  // 2. pages and files
  for (const path of [...KEY_PAGES, ...KEY_FILES]) {
    let status = 0
    let type = ''
    try {
      const res = await fetchImpl(`${base}${path}`, { redirect: 'manual' })
      status = res.status
      type = res.headers.get('content-type') ?? ''
      await res.arrayBuffer().catch(() => undefined)
    } catch {
      status = 0
    }
    if (status !== 200) problems.push(`${path}: HTTP ${status}`)
    else if (path.endsWith('/') && !type.includes('text/html')) problems.push(`${path}: content-type ${type || 'missing'}, want text/html`)
  }
  log(`smoke: ${KEY_PAGES.length} page(s) and ${KEY_FILES.length} file(s) requested`)

  // 3. /api/me shape (signed out)
  const me = await getJson(fetchImpl, `${base}/api/me`)
  if (me.status !== 200) problems.push(`/api/me: HTTP ${me.status}`)
  else if (!me.type.includes('application/json')) problems.push(`/api/me: content-type ${me.type || 'missing'}, want application/json`)
  else problems.push(...checkMeShape(me.body, opts.expect))
  return problems
}

function argValue(args: string[], name: string): string | undefined {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}

export async function main(args: string[]): Promise<number> {
  const base = argValue(args, '--base') ?? ''
  if (!/^https?:\/\/[^/\s]+\/?$/.test(base)) {
    console.error('smoke: --base must be the site origin, e.g. https://example.com')
    return 2
  }
  const google = argValue(args, '--expect-google')
  if (google !== undefined && google !== 'true' && google !== 'false') {
    console.error('smoke: --expect-google takes true or false')
    return 2
  }
  const magicLink = argValue(args, '--expect-magic-link') || undefined
  const problems = await runSmoke({
    base,
    version: argValue(args, '--version') || undefined,
    waitSeconds: Number(argValue(args, '--wait-seconds') ?? 0),
    expect: { google: google === undefined ? undefined : google === 'true', magicLink },
  })
  const { appendFile } = await import('node:fs/promises')
  const summary = problems.length ? `Smoke checks FAILED on ${base}:\n${problems.map((p) => `- ${p}`).join('\n')}\n` : `Smoke checks passed on ${base}: /api/health, ${KEY_PAGES.length} pages, robots.txt, sitemap.xml, /api/me shape.\n`
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, summary)
  if (problems.length) {
    for (const p of problems) console.error(`smoke: ${p}`)
    return 1
  }
  console.log(`smoke: all checks passed on ${base}`)
  return 0
}
