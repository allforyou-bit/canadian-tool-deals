#!/usr/bin/env node
/**
 * Self-test for the generator's safety properties.
 *
 *   node ship/tools/selftest.mjs
 *
 * These pages carry copy that arrives by email from strangers, and they are
 * published under a client's name. Three properties have to hold every time:
 *
 *  1. No brief can inject executable markup. Checked by rendering a page full of
 *     payloads, loading it in a real browser, and asking the DOM — not by pattern
 *     matching the HTML, which cannot tell escaped text from a live attribute.
 *  2. No brief can write outside its own output directory.
 *  3. The pages really do make zero external requests and set zero cookies, which
 *     is claimed in writing on the landing page.
 */

import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { validateBrief } from '../lib/validate.mjs'
import { renderPage } from '../lib/render.mjs'
import { renderPrivacy, renderTerms } from '../lib/legal.mjs'
import { withPage } from '../lib/chrome.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const TMP = resolve(HERE, '..', 'dist', '_selftest')

let passed = 0
const failures = []

function check(name, ok, detail = '') {
  if (ok) {
    passed++
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`)
    console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

const baseBrief = () => ({
  slug: 'selftest',
  mode: 'live',
  meta: { businessName: 'A', tagline: 't', description: 'd' },
  hero: { headline: 'h', sub: 's' },
  sections: [{ type: 'text', heading: 'H', body: 'b' }],
  legal: { operator: 'Op', jurisdiction: 'Ontario, Canada', contactEmail: 'a@b.ca', effective: '2026-09-14' },
})

// ── 1. A slug can never escape its directory ────────────────────────────────
for (const slug of ['../../etc', 'a/../b', '..', '.', 'a b', 'A', '-x', 'x/y', 'x\\y', '']) {
  const brief = { ...baseBrief(), slug }
  check(`slug ${JSON.stringify(slug)} rejected`, validateBrief(brief, 't').errors.some(e => e.includes('.slug')))
}

// ── 2. Only hrefs we are willing to emit get through ────────────────────────
for (const href of ['javascript:alert(1)', 'JaVaScRiPt:x', 'data:text/html,<script>x</script>', 'vbscript:x', ' javascript:x']) {
  const brief = { ...baseBrief(), nav: [{ label: 'L', href }] }
  check(`href ${JSON.stringify(href.slice(0, 20))} rejected`, validateBrief(brief, 't').errors.some(e => e.includes('href')))
}

// ── 3. null is not an object ────────────────────────────────────────────────
for (const key of ['meta', 'hero', 'legal']) {
  const brief = { ...baseBrief(), [key]: null }
  check(`${key}: null rejected`, validateBrief(brief, 't').errors.some(e => e.includes(`${key}:`)))
}

// ── 4. meta.url must be absolute, because new URL() resolves it ─────────────
for (const url of ['/relative', 'example.ca', 'ftp://x.ca']) {
  const brief = baseBrief()
  brief.meta = { ...brief.meta, url }
  check(`meta.url ${JSON.stringify(url)} rejected`, validateBrief(brief, 't').errors.some(e => e.includes('meta.url')))
}
const absolute = baseBrief()
absolute.meta = { ...absolute.meta, url: 'https://x.pages.dev' }
check('absolute meta.url accepted', validateBrief(absolute, 't').errors.length === 0)

// ── 5. Query strings survive the markdown link rewriter ─────────────────────
const withQuery = baseBrief()
withQuery.sections = [{ type: 'text', heading: 'H', body: '[Pay](https://buy.stripe.com/x?a=1&b=2&c=3)' }]
const queryHtml = renderPage(withQuery)
check('checkout link keeps every query parameter',
  queryHtml.includes('href="https://buy.stripe.com/x?a=1&amp;b=2&amp;c=3"'),
  'a double-escaped & silently truncates the client\'s checkout URL')

// ── 6. Nothing a brief can say becomes executable markup ────────────────────
const PAYLOAD = '"><script>window.__pwned=1</script><img src=x onerror="window.__pwned2=1"><svg onload="window.__pwned3=1">'
const hostile = {
  slug: 'selftest', mode: 'live',
  meta: { businessName: PAYLOAD, tagline: PAYLOAD, description: PAYLOAD, monogram: PAYLOAD, url: 'https://ok.ca' },
  hero: { headline: PAYLOAD, sub: PAYLOAD, note: PAYLOAD, trust: [PAYLOAD], primaryCta: { label: PAYLOAD, href: 'https://ok.ca' } },
  nav: [{ label: PAYLOAD, href: '#a' }],
  sections: [
    { type: 'text', heading: PAYLOAD, intro: PAYLOAD, body: PAYLOAD },
    { type: 'features', heading: 'F', items: [{ title: PAYLOAD, body: PAYLOAD }] },
    { type: 'steps', heading: 'S', items: [{ title: PAYLOAD, body: PAYLOAD }] },
    { type: 'pricing', heading: 'P', tiers: [{ name: PAYLOAD, amount: PAYLOAD, unit: PAYLOAD, desc: PAYLOAD, tag: PAYLOAD, includes: [PAYLOAD], fine: PAYLOAD }] },
    { type: 'faq', heading: 'Q', items: [{ q: PAYLOAD, a: PAYLOAD }] },
    { type: 'quote', text: PAYLOAD, attribution: PAYLOAD },
    { type: 'final', heading: 'E', pairs: [{ label: PAYLOAD, value: PAYLOAD }] },
  ],
  contact: { email: PAYLOAD, phone: PAYLOAD, address: PAYLOAD },
  legal: { operator: PAYLOAD, jurisdiction: PAYLOAD, contactEmail: PAYLOAD, effective: '2026-09-14', collects: [PAYLOAD], refund: PAYLOAD, deliverable: PAYLOAD },
  footer: { note: PAYLOAD },
}
check('a brief full of payloads still validates (escaping is the defence, not rejection)',
  validateBrief(hostile, 't').errors.length === 0)

rmSync(TMP, { recursive: true, force: true })
mkdirSync(TMP, { recursive: true })
writeFileSync(join(TMP, 'index.html'), renderPage(hostile))
writeFileSync(join(TMP, 'privacy.html'), renderPrivacy(hostile))
writeFileSync(join(TMP, 'terms.html'), renderTerms(hostile))

const DOM_PROBE = `(() => ({
  pwned: !!window.__pwned || !!window.__pwned2 || !!window.__pwned3,
  eventAttrs: [...document.querySelectorAll('*')]
    .flatMap(el => [...el.attributes].filter(a => /^on/i.test(a.name)).map(a => el.tagName + '[' + a.name + ']')),
  liveScripts: [...document.querySelectorAll('script')].map(s => s.type).filter(t => t !== 'application/ld+json'),
  injected: document.querySelectorAll('img, svg, iframe, object, embed').length,
  cookies: document.cookie,
}))()`

await withPage(async page => {
  for (const file of ['index.html', 'privacy.html', 'terms.html']) {
    await page.goto(pathToFileURL(join(TMP, file)).href)
    const r = await page.evaluate(DOM_PROBE)
    check(`${file}: no payload executed`, !r.pwned)
    check(`${file}: no event-handler attributes in the DOM`, r.eventAttrs.length === 0, r.eventAttrs.join(', '))
    check(`${file}: no executable script tags`, r.liveScripts.length === 0, r.liveScripts.join(', '))
    check(`${file}: no injected img/svg/iframe`, r.injected === 0, String(r.injected))
  }

  // ── 7. The "no cookies, no third-party requests" claim ────────────────────
  //
  // Only elements that actually cause a fetch count. A `rel="canonical"` link is
  // metadata and is never requested, so counting every `link[href]` would fail a
  // page that is in fact making zero requests.
  await page.send('Network.enable')
  await page.send('Network.clearBrowserCookies')
  await page.goto(pathToFileURL(join(TMP, 'index.html')).href)
  const { cookies } = await page.send('Network.getCookies')
  const state = await page.evaluate(`({
    cookie: document.cookie,
    external: [...document.querySelectorAll(
      'script[src], img[src], iframe[src], source[src], video[src], audio[src], embed[src], object[data],' +
      'link[rel~="stylesheet"], link[rel~="preload"], link[rel~="prefetch"], link[rel~="icon"], link[rel~="manifest"]'
    )]
      .map(e => e.getAttribute('src') || e.getAttribute('href') || e.getAttribute('data'))
      .filter(u => u && /^https?:/i.test(u)),
  })`)
  check('no cookies set', cookies.length === 0 && state.cookie === '', `${cookies.length} cookies`)
  check('no fetchable external subresources', state.external.length === 0, state.external.join(', '))
}, { settle: 700 })

rmSync(TMP, { recursive: true, force: true })

if (failures.length) {
  console.error(`\n${failures.length} of ${passed + failures.length} self-tests failed.`)
  process.exit(1)
}
console.log(`All ${passed} self-tests passed.`)
