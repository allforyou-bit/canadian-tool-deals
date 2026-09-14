#!/usr/bin/env node
/**
 * 48-Hour Ship — static site build.
 *
 *   node ship/build.mjs              build every brief
 *   node ship/build.mjs acme-co      build one brief by slug
 *   node ship/build.mjs --check      validate every brief, write nothing
 *
 * Briefs live in ship/briefs/*.json. `_site.json` is this service's own landing
 * page and builds to the output root; every other brief builds to its own
 * subdirectory. Files beginning with `_` other than `_site.json` are ignored, so
 * notes and schema docs can sit alongside the briefs.
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { validateBrief } from './lib/validate.mjs'
import { renderPage } from './lib/render.mjs'
import { renderPrivacy, renderTerms } from './lib/legal.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const BRIEFS = join(HERE, 'briefs')
const DIST = join(HERE, 'dist')

// Colour only when stdout is a TTY, so CI logs and piped output stay clean.
const tty = process.stdout.isTTY
const c = (code, s) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s)
const dim = s => c('2', s)
const red = s => c('31', s)
const yellow = s => c('33', s)
const green = s => c('32', s)
const bold = s => c('1', s)

/**
 * Content-Security-Policy for the generated pages.
 *
 * These pages carry no <script>, so `script-src 'none'` is accurate rather than
 * aspirational. The inlined stylesheet needs 'unsafe-inline' for style; images are
 * limited to same-origin plus the data: URI the favicon uses. If a client later
 * adds an embed, this header is the first thing to relax — see ship/README.md.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'none'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
].join('; ')

const HEADERS_FILE = `# Applied by Cloudflare Pages. See ship/build.mjs for why each one is here.
/*
  Content-Security-Policy: ${CSP}
  Referrer-Policy: strict-origin-when-cross-origin
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Permissions-Policy: geolocation=(), camera=(), microphone=(), payment=()
  Cross-Origin-Opener-Policy: same-origin
`

function readBriefFile(path) {
  const raw = readFileSync(path, 'utf8')
  try {
    return JSON.parse(raw)
  } catch (e) {
    throw new Error(`invalid JSON — ${e.message}`)
  }
}

/**
 * robots.txt for one site.
 *
 * `proposalPaths` only applies to the site at the output root: a crawler reads
 * `/robots.txt` and nothing else, so a `Disallow: /` sitting in `/<slug>/robots.txt`
 * protects nothing. Proposal directories have to be disallowed from the root file,
 * and the per-directory file is kept for the case where a site is deployed alone at
 * its own root.
 */
function robotsFor(brief, { proposalPaths = [] } = {}) {
  if (brief.mode === 'proposal') {
    // A proposal page is for one reader. Keep it out of every index.
    return 'User-agent: *\nDisallow: /\n'
  }
  const lines = ['User-agent: *', 'Allow: /']
  for (const path of proposalPaths) lines.push(`Disallow: ${path}`)
  if (brief.meta.url) {
    const base = brief.meta.url.replace(/\/+$/, '')
    lines.push('', `Sitemap: ${base}/sitemap.xml`)
  }
  return `${lines.join('\n')}\n`
}

function sitemapFor(brief) {
  if (brief.mode !== 'live' || !brief.meta.url) return null
  const base = brief.meta.url.replace(/\/+$/, '')
  const paths = ['/', '/privacy.html', '/terms.html']
  const urls = paths
    .map(p => `  <url>\n    <loc>${base}${p}</loc>\n    <lastmod>${brief.legal.effective}</lastmod>\n  </url>`)
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}

const kb = bytes => `${(bytes / 1024).toFixed(1)} kB`

function main() {
  const args = process.argv.slice(2)
  const checkOnly = args.includes('--check')
  const only = args.filter(a => !a.startsWith('-'))

  if (!existsSync(BRIEFS)) {
    console.error(red(`No briefs directory at ${BRIEFS}`))
    process.exit(1)
  }

  const files = readdirSync(BRIEFS)
    .filter(f => f.endsWith('.json'))
    .filter(f => f === '_site.json' || !f.startsWith('_'))
    .sort((a, b) => (a === '_site.json' ? -1 : b === '_site.json' ? 1 : a.localeCompare(b)))

  if (!files.length) {
    console.error(red(`No briefs found in ${BRIEFS}`))
    process.exit(1)
  }

  let failed = 0
  let warned = 0
  const writes = []

  for (const file of files) {
    const path = join(BRIEFS, file)
    const isSite = file === '_site.json'

    let brief
    try {
      brief = readBriefFile(path)
    } catch (e) {
      console.error(`${red('x')} ${file} — ${e.message}`)
      failed++
      continue
    }

    if (only.length && !only.includes(brief.slug) && !(isSite && only.includes('_site'))) continue

    const { errors, warnings } = validateBrief(brief, brief.slug || file)
    for (const w of warnings) console.warn(`  ${yellow('warn')} ${dim(w)}`)
    warned += warnings.length

    if (errors.length) {
      console.error(`${red('x')} ${file} — ${errors.length} error${errors.length === 1 ? '' : 's'}`)
      for (const e of errors) console.error(`    ${red(e)}`)
      failed++
      continue
    }

    // The landing page owns the output root; client sites get a subdirectory, so
    // one Cloudflare Pages project can serve the landing page and every sample.
    const outDir = isSite ? DIST : join(DIST, brief.slug)
    writes.push({ outDir, brief, isSite })
  }

  // Language links must be reciprocal. A switcher that only points one way strands
  // the reader in the language they just left, and it is the kind of mistake that
  // survives every check that looks at one page at a time.
  //
  // Only enforced on a full build: a filtered build does not know about the
  // siblings it was not asked to render.
  if (!only.length) {
    const bySlug = new Map(writes.map(w => [w.brief.slug, w.brief]))
    for (const { brief } of writes) {
      for (const alt of brief.alternates ?? []) {
        const targetSlug = alt.href.replace(/^\/|\/$/g, '')
        const target = bySlug.get(targetSlug)
        if (!target) {
          console.error(`${red('x')} ${brief.slug}: alternates points at "${alt.href}" but no brief builds that directory`)
          failed++
          continue
        }
        const back = (target.alternates ?? []).some(a => a.href.replace(/^\/|\/$/g, '') === brief.slug)
        if (!back) {
          console.error(`${red('x')} ${brief.slug}: "${targetSlug}" does not link back — add { href: "/${brief.slug}/" } to its alternates`)
          failed++
        }
      }
    }
    if (failed) {
      console.error(`\n${red(bold('Build aborted'))} — language links are not reciprocal. Nothing was written.`)
      process.exit(1)
    }
  }

  // Rendering happens after every brief is known, so the root robots.txt can
  // disallow each proposal directory by path.
  const proposalPaths = writes
    .filter(w => !w.isSite && w.brief.mode === 'proposal')
    .map(w => `/${w.brief.slug}/`)

  for (const w of writes) {
    const { brief, isSite } = w
    w.pages = [
      ['index.html', renderPage(brief)],
      ['privacy.html', renderPrivacy(brief)],
      ['terms.html', renderTerms(brief)],
      ['robots.txt', robotsFor(brief, isSite ? { proposalPaths } : {})],
    ]
    const sitemap = sitemapFor(brief)
    if (sitemap) w.pages.push(['sitemap.xml', sitemap])
  }

  const built = writes.length

  if (!built && !failed) {
    console.error(red(`Nothing matched${only.length ? ` ${only.join(', ')}` : ''}`))
    process.exit(1)
  }

  if (checkOnly) {
    console.log(`\n${built} brief${built === 1 ? '' : 's'} valid, ${failed} failed, ${warned} warning${warned === 1 ? '' : 's'}`)
    process.exit(failed ? 1 : 0)
  }

  if (failed) {
    console.error(`\n${red(bold('Build aborted'))} — fix the ${failed} failing brief${failed === 1 ? '' : 's'} first. Nothing was written.`)
    process.exit(1)
  }

  // Only clear the output once every brief has validated, so a bad brief never
  // leaves a half-deployed directory behind.
  //
  // A filtered build clears only what it is about to rewrite. The runbook tells
  // the operator to run `node ship/build.mjs <prospect>` while working a lead;
  // wiping the landing page and every sample to rebuild one site would be a
  // genuinely bad surprise.
  if (only.length) {
    for (const { outDir, isSite } of writes) {
      if (!isSite) rmSync(outDir, { recursive: true, force: true })
    }
  } else {
    rmSync(DIST, { recursive: true, force: true })
  }
  mkdirSync(DIST, { recursive: true })
  writeFileSync(join(DIST, '_headers'), HEADERS_FILE)

  for (const { outDir, pages, brief, isSite } of writes) {
    mkdirSync(outDir, { recursive: true })
    let total = 0
    for (const [name, contents] of pages) {
      writeFileSync(join(outDir, name), contents)
      total += Buffer.byteLength(contents)
    }
    const where = isSite ? '/' : `/${brief.slug}/`
    const tag = brief.mode === 'proposal' ? yellow('proposal') : green('live')
    console.log(`${green('ok')} ${where.padEnd(26)} ${tag.padEnd(10)} ${dim(`${pages.length} files, ${kb(total)}`)}`)
  }

  console.log(`\n${bold(`${built} site${built === 1 ? '' : 's'}`)} -> ${dim('ship/dist')}${warned ? ` ${yellow(`(${warned} warning${warned === 1 ? '' : 's'})`)}` : ''}`)
}

main()
