// Content lint (memo B9, B13): no forbidden claim on any exported page or in any ad line.
// Rules come from shared/content-rules.ts (single source of truth, also used by the grader filter).
//
//   lintText(text, {ads})  → rule ids broken by plain text (ads adds the trademark rules)
//   lintHtml(html)         → findings for one exported page: claims in visible text, meta tags,
//                            alt/title attributes and JSON-LD, plus the trademark-notice rule
//   lintAdsCsv(csv)        → findings for ops/ads/google.csv (claims, lengths, structure)
//
// CLI (from products/clb):  node scripts/run.mjs scripts/content-lint.ts [--out out] [--ads ../../ops/ads/google.csv]
//                            node scripts/run.mjs scripts/content-lint.ts --text "banner text"   (flags.yml)
// Exits 1 on any finding and prints "file: rule-id — excerpt". Missing inputs are skipped with a notice.
import { NOT_AFFILIATED } from '../shared/config'
import { AD_ONLY_FORBIDDEN, ALLOWED_PHRASES, FORBIDDEN_CLAIMS, findClaims, type ClaimRule } from '../shared/content-rules'
import { parseCsvRecords } from './lib/csv'

export interface Finding {
  rule: string
  /** where in the input: "text", "line 12", a field name, ... */
  where: string
  excerpt: string
}

const ALL_AD_RULES: ClaimRule[] = [...FORBIDDEN_CLAIMS, ...AD_ONLY_FORBIDDEN]
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

/** Rule ids the text breaks. `ads: true` also applies AD_ONLY_FORBIDDEN (no test trademarks). */
export function lintText(text: string, opts: { ads?: boolean } = {}): string[] {
  return findClaims(normalizeWhitespace(text), opts.ads ? ALL_AD_RULES : FORBIDDEN_CLAIMS)
}

/** Like lintText, with an excerpt around each hit so the owner can find it. */
export function lintTextFindings(text: string, where: string, opts: { ads?: boolean } = {}): Finding[] {
  const rules = opts.ads ? ALL_AD_RULES : FORBIDDEN_CLAIMS
  const t = normalizeWhitespace(text)
  return findClaims(t, rules).map((rule) => ({ rule, where, excerpt: excerptFor(t, rules.find((r) => r.id === rule)) }))
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

// ---------- ads CSV (layout documented in ops/ads/README.md) ----------

export const ADS_HEADER = ['type', 'ad_group', 'match_type', 'text'] as const
const HEADLINE_MAX = 30
const DESCRIPTION_MAX = 90
/** Google's responsive search ad minimums as the owner will enter them [unverified: prior knowledge]. */
const MIN_HEADLINES = 3
const MIN_DESCRIPTIONS = 2

export function lintAdsCsv(csv: string): Finding[] {
  const findings: Finding[] = []
  const { header, records } = parseCsvRecords(csv)
  if (header.join(',') !== ADS_HEADER.join(',')) {
    return [{ rule: 'csv_header', where: 'line 1', excerpt: `expected "${ADS_HEADER.join(',')}", got "${header.join(',')}"` }]
  }
  const groups = new Map<string, { headlines: string[]; descriptions: number; urls: number; keywords: number; line: number }>()
  const group = (name: string, line: number) => {
    let g = groups.get(name)
    if (!g) groups.set(name, (g = { headlines: [], descriptions: 0, urls: 0, keywords: 0, line }))
    return g
  }
  for (const { values: r, line } of records) {
    const where = `line ${line}`
    const text = r.text
    const add = (rule: string, excerpt = text) => findings.push({ rule, where, excerpt })
    if (text === '') add('empty_text')
    switch (r.type) {
      case 'negative':
        // negatives are never shown; they may name what we block, but never a test trademark
        if (!['broad', 'phrase', 'exact'].includes(r.match_type)) add('match_type', r.match_type)
        findClaims(text, AD_ONLY_FORBIDDEN).forEach((rule) => add(rule))
        continue
      case 'keyword':
        if (!['phrase', 'exact'].includes(r.match_type)) add('match_type', r.match_type)
        group(r.ad_group, line).keywords++
        break
      case 'headline': {
        const g = group(r.ad_group, line)
        if ([...text].length > HEADLINE_MAX) add('headline_too_long', `${[...text].length} chars: ${text}`)
        if (g.headlines.includes(text.toLowerCase())) add('duplicate')
        g.headlines.push(text.toLowerCase())
        break
      }
      case 'description':
        if ([...text].length > DESCRIPTION_MAX) add('description_too_long', `${[...text].length} chars: ${text}`)
        group(r.ad_group, line).descriptions++
        break
      case 'final_url':
        if (!/^https:\/\/[^/\s]+\/\S*$/.test(text)) add('final_url')
        group(r.ad_group, line).urls++
        break
      default:
        add('unknown_type', r.type)
        continue
    }
    if (r.ad_group === '') add('missing_ad_group')
    lintTextFindings(text, where, { ads: true }).forEach((f) => findings.push(f))
  }
  for (const [name, g] of groups) {
    const missing: string[] = []
    if (g.headlines.length < MIN_HEADLINES) missing.push(`${MIN_HEADLINES}+ headlines`)
    if (g.descriptions < MIN_DESCRIPTIONS) missing.push(`${MIN_DESCRIPTIONS}+ descriptions`)
    if (g.urls !== 1) missing.push('exactly 1 final_url')
    if (g.keywords === 0) missing.push('1+ keyword')
    if (missing.length) findings.push({ rule: 'ad_group_incomplete', where: `ad group "${name}"`, excerpt: `needs ${missing.join(', ')}` })
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
  const outDir = argValue(args, '--out', 'out')
  const adsCsv = argValue(args, '--ads', '../../ops/ads/google.csv')
  const report: string[] = []
  let checked = 0

  if (existsSync(outDir)) {
    const files = await listHtml(outDir)
    for (const file of files) {
      checked++
      for (const f of lintHtml(await readFile(file, 'utf8'))) report.push(`${file}: ${f.rule} (${f.where}) — ${f.excerpt}`)
    }
    console.log(`content-lint: ${files.length} HTML page(s) in ${outDir}`)
  } else {
    console.log(`content-lint: skipped pages — ${outDir} not found (run the site build first)`)
  }

  if (existsSync(adsCsv)) {
    checked++
    for (const f of lintAdsCsv(await readFile(adsCsv, 'utf8'))) report.push(`${adsCsv}: ${f.rule} (${f.where}) — ${f.excerpt}`)
    console.log(`content-lint: checked ${adsCsv}`)
  } else {
    console.log(`content-lint: skipped ads — ${adsCsv} not found`)
  }

  if (report.length) {
    console.error(`content-lint: ${report.length} finding(s)`)
    for (const line of report) console.error(`  ${line}`)
    return 1
  }
  console.log(`content-lint: OK (${checked} file(s), no findings)`)
  return 0
}
