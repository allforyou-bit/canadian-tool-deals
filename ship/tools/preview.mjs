#!/usr/bin/env node
/**
 * Screenshot the built pages, and check them for horizontal overflow while doing it.
 *
 *   node ship/tools/preview.mjs                     every built site
 *   node ship/tools/preview.mjs acme-co             one site
 *   node ship/tools/preview.mjs --check             no images, overflow check only
 *   node ship/tools/preview.mjs --out ./somewhere   where the PNGs go
 *
 * Two reasons this exists:
 *  - "works on a phone" is a claim made on the landing page, so it gets verified
 *    on every build rather than eyeballed once.
 *  - a client who is about to pay wants to see the page, and a PNG travels through
 *    email and a phone better than a URL does.
 */

import { readdirSync, existsSync, mkdirSync, writeFileSync, statSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { withPage } from '../lib/chrome.mjs'

const DIST = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist')

const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844, mobile: true, theme: 'light' },
  { name: 'desktop', width: 1280, height: 900, mobile: false, theme: 'light' },
  { name: 'desktop-dark', width: 1280, height: 900, mobile: false, theme: 'dark' },
]

/**
 * Elements sticking out past the viewport.
 *
 * Anything positioned far off-canvas is skipped: the skip link lives at
 * `left: -9999px` by design and is not an overflow bug.
 */
const OVERFLOW_PROBE = `(() => {
  const de = document.documentElement
  const out = []
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect()
    if (r.width === 0 && r.height === 0) continue
    if (r.left < -500) continue
    if (r.right > de.clientWidth + 1) {
      out.push({
        tag: el.tagName.toLowerCase(),
        cls: typeof el.className === 'string' ? el.className.slice(0, 40) : '',
        right: Math.round(r.right),
        text: (el.textContent || '').trim().slice(0, 40),
      })
    }
  }
  return { viewport: de.clientWidth, scrollWidth: de.scrollWidth, overflowing: out.slice(0, 6) }
})()`

function sitesToShoot(only) {
  if (!existsSync(DIST)) {
    console.error(`No build found at ${DIST}. Run: node ship/build.mjs`)
    process.exit(1)
  }
  const sites = []
  if (existsSync(join(DIST, 'index.html'))) sites.push({ slug: '_site', file: join(DIST, 'index.html') })
  for (const entry of readdirSync(DIST)) {
    const dir = join(DIST, entry)
    if (!statSync(dir).isDirectory()) continue
    const file = join(dir, 'index.html')
    if (existsSync(file)) sites.push({ slug: entry, file })
  }
  return only.length ? sites.filter(s => only.includes(s.slug)) : sites
}

const args = process.argv.slice(2)
const checkOnly = args.includes('--check')
const outIdx = args.indexOf('--out')
if (outIdx !== -1 && !args[outIdx + 1]) {
  console.error('--out needs a directory')
  process.exit(1)
}
const outDir = outIdx !== -1 ? resolve(args[outIdx + 1]) : join(DIST, '_preview')
const only = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--out')

const sites = sitesToShoot(only)
if (!sites.length) {
  console.error(`Nothing to preview${only.length ? ` for ${only.join(', ')}` : ''}.`)
  process.exit(1)
}

if (!checkOnly) mkdirSync(outDir, { recursive: true })

let failures = 0

await withPage(async page => {
  for (const site of sites) {
    for (const vp of VIEWPORTS) {
      await page.viewport(vp)
      await page.colorScheme(vp.theme)
      await page.goto(pathToFileURL(site.file).href)

      const { viewport, scrollWidth, overflowing } = await page.evaluate(OVERFLOW_PROBE)

      let note = ''
      if (!checkOnly) {
        const name = `${site.slug}-${vp.name}.png`
        const buf = await page.screenshot()
        writeFileSync(join(outDir, name), buf)
        note = ` -> ${name} (${(buf.length / 1024).toFixed(0)} kB)`
      }

      if (scrollWidth > viewport + 1) {
        failures++
        console.error(`FAIL ${site.slug} ${vp.name}: scrollWidth ${scrollWidth} > viewport ${viewport}`)
        for (const o of overflowing) {
          console.error(`       <${o.tag}${o.cls ? ` class="${o.cls}"` : ''}> right=${o.right} :: ${JSON.stringify(o.text)}`)
        }
      } else {
        console.log(`ok   ${site.slug.padEnd(28)} ${vp.name.padEnd(13)} ${String(vp.width).padStart(4)}px${note}`)
      }
    }
  }
})

if (failures) {
  console.error(`\n${failures} viewport${failures === 1 ? '' : 's'} overflow horizontally.`)
  process.exit(1)
}
console.log(`\nAll viewports clean${checkOnly ? '' : ` — images in ${outDir}`}`)
