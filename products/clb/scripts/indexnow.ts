// IndexNow (memo B9: "IndexNow ping from Actions"). Two commands, both run by deploy.yml:
//
//   node scripts/run.mjs scripts/indexnow.ts write-key --out out --site https://…   (after the site build)
//   node scripts/run.mjs scripts/indexnow.ts ping --site https://… --sitemap out/sitemap.xml [--dry-run]
//
// The key is the environment variable INDEXNOW_KEY (the repository variable MPC_INDEXNOW_KEY) when it is
// set and valid; otherwise it is derived from the site's origin (memo §7.2 Z10: the first 32 hex characters
// of its SHA-256), so the owner has nothing to set up and every deploy of the same site writes the same key.
// It is not a secret — search engines fetch it from the site — so it is never committed either: the key file
// `<key>.txt` (content: the key) is written into the static export at build time and served from the site
// root. --site defaults to the SITE_URL environment variable; without a key and without a site both
// commands skip with a notice.
//
// ping POSTs every sitemap URL on the site's host to https://api.indexnow.org/indexnow. It never fails
// the deploy: HTTP or network errors print a warning and exit 0 (the step is also continue-on-error).
//
// Protocol facts: key 8–128 characters of a–z, A–Z, 0–9 and '-', key file at the site root named
// <key>.txt holding the key (robogeek/indexnow README, read 2026-09-24); up to 10,000 URLs per request
// (velohost/astro-indexnow README); api.indexnow.org as an endpoint (bojieyang/indexnow-action README).
// [unverified: the JSON body fields host/key/keyLocation/urlList and "200 or 202 = accepted" come from
// prior knowledge of indexnow.org, which could not be fetched from here.]

export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow'
export const MAX_URLS = 10_000

export function validIndexNowKey(key: string): boolean {
  return /^[A-Za-z0-9-]{8,128}$/.test(key)
}

/** The key for a site without MPC_INDEXNOW_KEY: the first 32 hex characters of SHA-256 of its origin. */
export async function derivedIndexNowKey(siteUrl: string): Promise<string> {
  const origin = new URL(siteUrl).origin
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(origin))
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32)
}

export type KeyChoice = { key: string; source: 'variable' | 'derived'; warning?: string } | { key: null; reason: string }

/**
 * The key to use: MPC_INDEXNOW_KEY when set and valid, else the key derived from the site (with a warning
 * when the variable was set but invalid). Null only when there is neither a key nor a usable site URL.
 */
export async function resolveIndexNowKey(variable: string | undefined, siteUrl: string | undefined): Promise<KeyChoice> {
  const v = (variable ?? '').trim()
  if (v && validIndexNowKey(v)) return { key: v, source: 'variable' }
  const warning = v ? 'MPC_INDEXNOW_KEY must be 8–128 characters of a–z, A–Z, 0–9 or "-"; using the key derived from the site instead' : undefined
  let origin: string
  try {
    const u = new URL((siteUrl ?? '').trim())
    if (u.protocol !== 'https:') throw new Error('not https')
    origin = u.origin
  } catch {
    return { key: null, reason: `${warning ? `${warning}, but ` : ''}no https:// site URL (--site or SITE_URL) to derive a key from` }
  }
  return { key: await derivedIndexNowKey(origin), source: 'derived', ...(warning ? { warning } : {}) }
}

/** <loc> URLs from a sitemap whose host equals the site's host (duplicates removed, order kept). */
export function sitemapUrls(xml: string, siteUrl: string): string[] {
  const host = new URL(siteUrl).host
  const out: string[] = []
  for (const m of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) {
    const raw = m[1].replace(/&amp;/g, '&')
    let u: URL
    try {
      u = new URL(raw)
    } catch {
      continue
    }
    if (u.protocol === 'https:' && u.host === host && !out.includes(u.href)) out.push(u.href)
  }
  return out
}

export interface IndexNowBody {
  host: string
  key: string
  keyLocation: string
  urlList: string[]
}

export function buildIndexNowBodies(siteUrl: string, key: string, urls: string[]): IndexNowBody[] {
  const u = new URL(siteUrl)
  const bodies: IndexNowBody[] = []
  for (let i = 0; i < urls.length; i += MAX_URLS) {
    bodies.push({ host: u.host, key, keyLocation: `${u.origin}/${key}.txt`, urlList: urls.slice(i, i + MAX_URLS) })
  }
  return bodies
}

type Fetch = (url: string, init?: RequestInit) => Promise<Response>

/** POST each body; returns human-readable results. Never throws. */
export async function pingIndexNow(bodies: IndexNowBody[], fetchImpl: Fetch = (u, i) => fetch(u, i)): Promise<{ ok: boolean; lines: string[] }> {
  const lines: string[] = []
  let ok = true
  for (const body of bodies) {
    try {
      const res = await fetchImpl(INDEXNOW_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: JSON.stringify(body),
      })
      await res.arrayBuffer().catch(() => undefined)
      const accepted = res.status === 200 || res.status === 202
      ok &&= accepted
      lines.push(`IndexNow: ${body.urlList.length} URL(s) → HTTP ${res.status}${accepted ? '' : ' (not accepted)'}`)
    } catch (e) {
      ok = false
      lines.push(`IndexNow: request failed (${e instanceof Error ? e.message.slice(0, 120) : 'network error'})`)
    }
  }
  return { ok, lines }
}

function argValue(args: string[], name: string): string | undefined {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}

export async function main(args: string[]): Promise<number> {
  const [command, ...rest] = args
  const actions = process.env.GITHUB_ACTIONS === 'true'
  const warn = (text: string) => console.log(actions ? `::warning title=IndexNow::${text}` : `warning: ${text}`)
  if (command !== 'write-key' && command !== 'ping') {
    console.error('usage: indexnow.ts write-key --out DIR [--site URL] | ping --site URL --sitemap FILE [--dry-run]')
    return 2
  }
  const site = (argValue(rest, '--site') ?? process.env.SITE_URL ?? '').trim().replace(/\/+$/, '')
  const choice = await resolveIndexNowKey(process.env.INDEXNOW_KEY, site)
  if (choice.key === null) {
    console.log(`IndexNow: skipped — ${choice.reason}`)
    return 0
  }
  if (choice.warning) warn(choice.warning)
  const key = choice.key
  const { readFile, writeFile } = await import('node:fs/promises')
  const { existsSync } = await import('node:fs')
  const { join } = await import('node:path')

  if (command === 'write-key') {
    const out = argValue(rest, '--out') ?? 'out'
    if (!existsSync(out)) {
      console.error(`IndexNow: ${out} not found — build the site first`)
      return 1
    }
    await writeFile(join(out, `${key}.txt`), key)
    console.log(`IndexNow: wrote the key file to ${out}/ (served at /<key>.txt; key ${choice.source === 'variable' ? 'from MPC_INDEXNOW_KEY' : 'derived from the site URL'})`)
    return 0
  }

  const sitemap = argValue(rest, '--sitemap') ?? 'out/sitemap.xml'
  let urls: string[]
  try {
    urls = sitemapUrls(await readFile(sitemap, 'utf8'), site)
  } catch (e) {
    warn(`could not read ${sitemap} or --site is not a URL (${e instanceof Error ? e.message.slice(0, 120) : 'error'}); nothing sent`)
    return 0
  }
  if (!urls.length) {
    warn(`no URLs on ${site} in ${sitemap} (was the site built with NEXT_PUBLIC_SITE_URL = MPC_SITE_URL?); nothing sent`)
    return 0
  }
  const bodies = buildIndexNowBodies(site, key, urls)
  if (rest.includes('--dry-run')) {
    console.log(`IndexNow: dry run — would send ${urls.length} URL(s) in ${bodies.length} request(s) for ${bodies[0].host}`)
    return 0
  }
  const r = await pingIndexNow(bodies)
  for (const l of r.lines) console.log(l)
  if (!r.ok) warn('IndexNow did not accept the submission (see the log); the deploy is not affected')
  return 0
}
