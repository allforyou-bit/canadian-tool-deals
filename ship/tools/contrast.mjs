#!/usr/bin/env node
/**
 * WCAG contrast check on the rendered pages.
 *
 *   node ship/tools/contrast.mjs              every built site
 *   node ship/tools/contrast.mjs acme-co      one site
 *   node ship/tools/contrast.mjs --verbose    print passes too
 *
 * The landing page claims these pages are readable in dark mode. This is where
 * that is verified rather than asserted.
 *
 * It measures the colours the browser actually computed, not the tokens in the
 * stylesheet, so `color-mix()`, inherited colour and stacked backgrounds are all
 * accounted for. AA thresholds: 4.5:1 for body text, 3:1 for large text (>=24px,
 * or >=18.66px bold), per WCAG 2.1 SC 1.4.3.
 */

import { readdirSync, existsSync, statSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { withPage } from '../lib/chrome.mjs'

const DIST = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist')

/** Every text role on the page, by the selector that finds one. */
const ROLES = [
  ['body text', 'p'],
  ['h1', 'h1'],
  ['h2', 'h2'],
  ['h3', 'h3'],
  ['lede', '.lede'],
  ['eyebrow', '.eyebrow'],
  ['nav link', '.nav a'],
  ['hero note', '.hero .note'],
  ['trust item', '.trust li'],
  ['card body', '.card p'],
  ['section intro', '.section-head p'],
  ['tier desc', '.tier .desc'],
  ['tier includes', '.tier li'],
  ['tier fine', '.tier .fine'],
  ['faq summary', '.faq summary'],
  ['faq answer', '.faq .answer'],
  ['pairs label', '.pairs dt'],
  ['pairs value', '.pairs dd'],
  ['quote', 'figure.quote blockquote'],
  ['quote caption', 'figure.quote figcaption'],
  ['footer', '.site-foot p'],
  ['footer link', '.site-foot a'],
  ['primary button', '.btn-primary'],
  ['ghost button', '.btn-ghost'],
  ['banner', '.banner p'],
  ['prose', '.prose p'],
  ['prose updated', '.prose .updated'],
]

const PROBE = roles => `(() => {
  const parse = c => { const m = c.match(/[\\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m[3] === undefined ? 1 : m[3] } }
  const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
  const lum = c => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b)
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
  // Walk up for the first ancestor that actually paints a background.
  const backdrop = el => {
    let n = el
    while (n && n !== document.documentElement) {
      const c = parse(getComputedStyle(n).backgroundColor)
      if (c.a > 0) return c
      n = n.parentElement
    }
    return parse(getComputedStyle(document.body).backgroundColor)
  }
  const out = []
  for (const [name, sel] of ${JSON.stringify(roles)}) {
    const el = document.querySelector(sel)
    if (!el) continue
    const cs = getComputedStyle(el)
    const px = parseFloat(cs.fontSize)
    const large = px >= 24 || (px >= 18.66 && parseInt(cs.fontWeight, 10) >= 700)
    out.push({
      name, px: Math.round(px * 10) / 10, large,
      ratio: Math.round(ratio(parse(cs.color), backdrop(el)) * 100) / 100,
      fg: cs.color,
    })
  }
  return out
})()`

function sites(only) {
  if (!existsSync(DIST)) {
    console.error(`No build at ${DIST}. Run: node ship/build.mjs`)
    process.exit(1)
  }
  const found = []
  for (const page of ['index.html', 'privacy.html']) {
    if (existsSync(join(DIST, page))) found.push({ slug: `_site/${page}`, file: join(DIST, page) })
  }
  for (const entry of readdirSync(DIST)) {
    const dir = join(DIST, entry)
    if (!statSync(dir).isDirectory()) continue
    for (const page of ['index.html', 'privacy.html']) {
      if (existsSync(join(dir, page))) found.push({ slug: `${entry}/${page}`, file: join(dir, page) })
    }
  }
  return only.length ? found.filter(s => only.some(o => s.slug.startsWith(o))) : found
}

const args = process.argv.slice(2)
const verbose = args.includes('--verbose')
const only = args.filter(a => !a.startsWith('--'))
const targets = sites(only)

if (!targets.length) {
  console.error(`Nothing to check${only.length ? ` for ${only.join(', ')}` : ''}.`)
  process.exit(1)
}

let failures = 0
let checked = 0

await withPage(async page => {
  for (const theme of ['light', 'dark']) {
    await page.colorScheme(theme)
    for (const site of targets) {
      await page.goto(pathToFileURL(site.file).href)
      for (const r of await page.evaluate(PROBE(ROLES))) {
        const need = r.large ? 3 : 4.5
        const ok = r.ratio >= need
        checked++
        if (!ok) {
          failures++
          console.error(`FAIL ${theme.padEnd(5)} ${site.slug.padEnd(34)} ${r.name.padEnd(15)} ${String(r.ratio).padStart(6)}:1 < ${need} (${r.px}px${r.large ? ' large' : ''}, ${r.fg})`)
        } else if (verbose) {
          console.log(`ok   ${theme.padEnd(5)} ${site.slug.padEnd(34)} ${r.name.padEnd(15)} ${String(r.ratio).padStart(6)}:1`)
        }
      }
    }
  }
}, { settle: 500 })

if (failures) {
  console.error(`\n${failures} of ${checked} contrast checks below WCAG AA.`)
  process.exit(1)
}
console.log(`All ${checked} contrast checks meet WCAG AA, in light and dark.`)
