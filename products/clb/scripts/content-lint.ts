// Content lint (memo B9): no forbidden claim on any exported page. Rules come from
// shared/content-rules.ts (single source of truth, also used by the grader filter). There are no ads to
// lint any more (memo §7.2 Z1: no ad budget; ops/ads was removed).
//
//   lintText(text)         → rule ids broken by plain text
//   lintHtml(html)         → findings for one exported page: claims in visible text, meta tags,
//                            alt/title attributes and JSON-LD, plus the trademark-notice rule
//
// CLI (from products/clb):  node scripts/run.mjs scripts/content-lint.ts [--out out] [--require-address] [--require-legal-name]
//                            node scripts/run.mjs scripts/content-lint.ts --text "banner text"   (flags.yml)
// Exits 1 on any finding and prints "file: rule-id — excerpt". A missing out/ is skipped with a notice.
// --require-address (deploy.yml, only when MPC_MAILING_ADDRESS is set; memo §7.2 Z5): also fails when any
// exported page still shows the mailing-address placeholder, i.e. the address did not reach the build
// (NEXT_PUBLIC_MAILING_ADDRESS).
// --require-legal-name (deploy.yml; production always, Z5): fails when the terms or privacy page does not
// show the seller's legal name from the environment variable LEGAL_NAME (NEXT_PUBLIC_LEGAL_NAME did not
// reach the build). The name is never printed.
// With either flag, a missing out/ directory is an error instead of a skip.
import { MAILING_ADDRESS_PLACEHOLDER } from '../content/site'
import { NOT_AFFILIATED } from '../shared/config'
import { ALLOWED_PHRASES, FORBIDDEN_CLAIMS, findClaims, type ClaimRule } from '../shared/content-rules'

export interface Finding {
  rule: string
  /** where in the input: "text", "line 12", a field name, ... */
  where: string
  excerpt: string
}

const TRADEMARK = /\b(CELPIP|IELTS)\b/i

export function normalizeWhitespace(text: string): string {
  return text.replace(/[\s ]+/g, ' ').trim()
}

function withoutAllowedPhrases(text: string): string {
  let t = text
  for (const p of ALLOWED_PHRASES) t = t.split(p).join(' ')
  return t
}

function excerptFor(text: string, rule: ClaimRule | undefined): string {
  const t = withoutAllowedPhrases(text)
  const m = rule ? new RegExp(rule.pattern.source, rule.pattern.flags.replace('g', '')).exec(t) : null
  if (!m) return normalizeWhitespace(t).slice(0, 80)
  const start = Math.max(0, m.index - 40)
  const end = Math.min(t.length, m.index + m[0].length + 40)
  return `${start > 0 ? '…' : ''}${normalizeWhitespace(t.slice(start, end))}${end < t.length ? '…' : ''}`
}

/** Rule ids the text breaks. */
export function lintText(text: string): string[] {
  return findClaims(normalizeWhitespace(text), FORBIDDEN_CLAIMS)
}

/** Like lintText, with an excerpt around each hit so the owner can find it. */
export function lintTextFindings(text: string, where: string): Finding[] {
  const t = normalizeWhitespace(text)
  return findClaims(t, FORBIDDEN_CLAIMS).map((rule) => ({ rule, where, excerpt: excerptFor(t, FORBIDDEN_CLAIMS.find((r) => r.id === rule)) }))
}

// ---------- HTML ----------

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  hellip: '…',
  middot: '·',
  copy: '©',
  reg: '®',
  trade: '™',
  laquo: '«',
  raquo: '»',
  bull: '•',
  times: '×',
}

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z][a-z0-9]*);/gi, (whole, name: string) => {
    if (name[0] === '#') {
      const code = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10)
      return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole
    }
    return NAMED_ENTITIES[name.toLowerCase()] ?? whole
  })
}

/**
 * Inline elements are removed without a space so a sentence split by <strong> still matches an
 * allowed phrase verbatim; every other tag becomes a space.
 */
const INLINE_TAGS = new Set([
  'a', 'abbr', 'b', 'bdi', 'bdo', 'cite', 'code', 'data', 'dfn', 'em', 'i', 'kbd', 'mark', 'q', 's', 'samp',
  'small', 'span', 'strong', 'sub', 'sup', 'time', 'u', 'var', 'wbr',
])

function attr(tag: string, name: string): string | null {
  const m = new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i').exec(tag)
  return m ? (m[2] ?? m[3] ?? '') : null
}

function jsonStrings(value: unknown, out: string[]): void {
  if (typeof value === 'string') out.push(value)
  else if (Array.isArray(value)) value.forEach((v) => jsonStrings(v, out))
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => jsonStrings(v, out))
}

export interface PageText {
  /** visible text: tags, scripts and styles removed, entities decoded, whitespace collapsed */
  body: string
  /** meta description / og / twitter content, alt/title/aria-label/placeholder attributes, JSON-LD strings */
  extra: string
}

/** Extract everything a visitor or a search result can show from an exported HTML page. */
export function htmlToText(html: string): PageText {
  const extra: string[] = []
  let h = html.replace(/<!--[\s\S]*?-->/g, '')
  h = h.replace(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi, (_m, attrs: string, body: string) => {
    if (/type\s*=\s*["']application\/ld\+json["']/i.test(attrs)) {
      try {
        jsonStrings(JSON.parse(body), extra)
      } catch {
        extra.push(body)
      }
    }
    return ' '
  })
  h = h.replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, ' ')
  for (const m of h.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = m[0]
    const key = (attr(tag, 'name') ?? attr(tag, 'property') ?? '').toLowerCase()
    const content = attr(tag, 'content')
    if (content !== null && (key === 'description' || key.startsWith('og:') || key.startsWith('twitter:'))) extra.push(content)
  }
  for (const m of h.matchAll(/<[a-z][^>]*>/gi)) {
    for (const name of ['alt', 'title', 'aria-label', 'placeholder']) {
      const v = attr(m[0], name)
      if (v) extra.push(v)
    }
  }
  // "</a><a>" between sibling links must not glue two words together
  h = h.replace(/(<\/[a-z][a-z0-9-]*\s*>)(?=<[a-z])/gi, '$1 ')
  const body = h.replace(/<\/?([a-z][a-z0-9-]*)\b[^>]*>/gi, (_m, tag: string) => (INLINE_TAGS.has(tag.toLowerCase()) ? '' : ' '))
  return {
    body: normalizeWhitespace(decodeEntities(body)),
    extra: normalizeWhitespace(decodeEntities(extra.join(' \n '))),
  }
}

/**
 * Findings for one exported page. A page that names CELPIP or IELTS must also show the
 * not-affiliated notice verbatim (memo §1.1 "Name rules"); the Korean notice counts on Korean pages.
 */
export function lintHtml(html: string): Finding[] {
  const { body, extra } = htmlToText(html)
  const findings = [...lintTextFindings(body, 'text'), ...lintTextFindings(extra, 'meta/attributes')]
  const all = `${body} ${extra}`
  if (TRADEMARK.test(all) && !all.includes(NOT_AFFILIATED.en) && !all.includes(NOT_AFFILIATED.ko)) {
    const m = TRADEMARK.exec(all)
    findings.push({
      rule: 'trademark_without_notice',
      where: 'text',
      excerpt: m ? normalizeWhitespace(all.slice(Math.max(0, m.index - 40), m.index + 40)) : '',
    })
  }
  return findings
}

// ---------- mailing address (integrator decision 16) ----------

/**
 * Text that shows only while the owner's mailing address is not configured: the privacy/contact
 * placeholder (content/site.ts), the Worker's wrangler.jsonc placeholder prefix, and the older consent
 * fallback wording. Any of them in an exported page means the build had no NEXT_PUBLIC_MAILING_ADDRESS.
 */
export const ADDRESS_PLACEHOLDERS: readonly string[] = [
  MAILING_ADDRESS_PLACEHOLDER,
  'SET-BEFORE-LAUNCH',
  'mailing address on our Privacy page',
  '개인정보 처리방침 페이지의 우편 주소',
]

/** Findings for placeholder address text in one exported page (visible text, meta tags, attributes). */
export function addressPlaceholderFindings(html: string): Finding[] {
  const { body, extra } = htmlToText(html)
  const all = `${body} ${extra}`
  return ADDRESS_PLACEHOLDERS.filter((p) => all.includes(normalizeWhitespace(p))).map((p) => ({ rule: 'mailing_address_placeholder', where: 'text', excerpt: p }))
}

// ---------- seller's legal name (memo §7.2 Z5) ----------

/** Exported pages that must name the seller ("… is sold by <legal name>, a sole proprietor in Ontario"). */
export const LEGAL_NAME_PAGES: readonly string[] = ['legal/terms/index.html', 'legal/privacy/index.html']

/**
 * Findings for pages that do not show `legalName` in their visible text (entities decoded, whitespace
 * collapsed, case kept). `pages` maps a path relative to out/ to its HTML, or null when the file is
 * missing. The excerpt never contains the name.
 */
export function legalNameFindings(pages: Record<string, string | null>, legalName: string): Finding[] {
  const name = normalizeWhitespace(legalName)
  if (!name) return [{ rule: 'legal_name_missing', where: 'LEGAL_NAME', excerpt: 'no legal name given to check (set MPC_LEGAL_NAME)' }]
  const findings: Finding[] = []
  for (const path of LEGAL_NAME_PAGES) {
    const html = pages[path] ?? null
    if (html === null) findings.push({ rule: 'legal_name_page_missing', where: path, excerpt: 'page not in the export' })
    else if (!htmlToText(html).body.includes(name)) findings.push({ rule: 'legal_name_missing', where: path, excerpt: 'the seller\'s legal name is not on this page (was the site built with NEXT_PUBLIC_LEGAL_NAME?)' })
  }
  return findings
}

// ---------- CLI ----------

async function listHtml(dir: string): Promise<string[]> {
  const { readdir } = await import('node:fs/promises')
  const { join } = await import('node:path')
  const out: string[] = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...(await listHtml(p)))
    else if (entry.isFile() && entry.name.endsWith('.html')) out.push(p)
  }
  return out.sort()
}

function argValue(args: string[], name: string, fallback: string): string {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}

export async function main(args: string[]): Promise<number> {
  if (args.includes('--text')) {
    // one piece of site copy, e.g. the banner shown on every page
    const findings = lintTextFindings(argValue(args, '--text', ''), 'text')
    for (const f of findings) console.error(`content-lint: ${f.rule} — ${f.excerpt}`)
    console.log(`content-lint: ${findings.length ? `${findings.length} finding(s)` : 'OK'}`)
    return findings.length ? 1 : 0
  }
  const { existsSync } = await import('node:fs')
  const { readFile } = await import('node:fs/promises')
  const { join, relative, sep } = await import('node:path')
  const outDir = argValue(args, '--out', 'out')
  const requireAddress = args.includes('--require-address')
  const requireLegalName = args.includes('--require-legal-name')
  const report: string[] = []
  let checked = 0

  if (existsSync(outDir)) {
    const files = await listHtml(outDir)
    const pages: Record<string, string | null> = {}
    for (const file of files) {
      checked++
      const html = await readFile(file, 'utf8')
      const rel = relative(outDir, file).split(sep).join('/')
      if (LEGAL_NAME_PAGES.includes(rel)) pages[rel] = html
      const findings = [...lintHtml(html), ...(requireAddress ? addressPlaceholderFindings(html) : [])]
      for (const f of findings) report.push(`${file}: ${f.rule} (${f.where}) — ${f.excerpt}`)
    }
    const required = [requireAddress ? 'mailing address' : '', requireLegalName ? 'legal name' : ''].filter(Boolean).join(' and ')
    console.log(`content-lint: ${files.length} HTML page(s) in ${outDir}${required ? ` (${required} required)` : ''}`)
    if (requireAddress && files.length === 0) report.push(`${outDir}: no HTML pages to check for the mailing address`)
    if (requireLegalName) {
      for (const f of legalNameFindings(pages, process.env.LEGAL_NAME ?? '')) report.push(`${join(outDir, f.where)}: ${f.rule} — ${f.excerpt}`)
    }
  } else if (requireAddress || requireLegalName) {
    report.push(`${outDir}: not found — --require-address and --require-legal-name need the built site`)
  } else {
    console.log(`content-lint: skipped pages — ${outDir} not found (run the site build first)`)
  }

  if (report.length) {
    console.error(`content-lint: ${report.length} finding(s)`)
    for (const line of report) console.error(`  ${line}`)
    if (report.some((l) => l.includes('mailing_address_placeholder'))) {
      console.error('content-lint: the mailing address did not reach the site build — check the MPC_MAILING_ADDRESS repository variable (business/online/owner-setup.md)')
    }
    if (report.some((l) => l.includes('legal_name_'))) {
      console.error("content-lint: the seller's legal name did not reach the terms and privacy pages — check the MPC_LEGAL_NAME repository variable (business/online/owner-setup.md)")
    }
    return 1
  }
  console.log(`content-lint: OK (${checked} file(s), no findings)`)
  return 0
}
