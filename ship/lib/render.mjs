/**
 * Page rendering.
 *
 * Output is a complete standalone HTML document: one inlined stylesheet, one
 * inlined SVG favicon, no external requests at all. That keeps the page fast
 * without a CDN, and it means a deployed site has no third-party dependency that
 * can break after handover.
 */

import { esc, attr, jsonLd, each, inline, paragraphs, slugify } from './html.mjs'
import { stylesheet, resolveAccent } from './css.mjs'

/** Derive a 1-2 character monogram from a business name. */
export function monogramFor(name) {
  const words = String(name ?? '').trim().split(/\s+/).filter(Boolean)
  if (!words.length) return '·'
  const initials = words.slice(0, 2).map(w => [...w][0]).join('')
  return initials.toUpperCase().slice(0, 2)
}

/**
 * An inline SVG favicon: the monogram on the accent colour.
 *
 * Data URI rather than a file so a deployed directory is genuinely
 * self-contained, and so no request 404s while a client's DNS settles.
 */
function faviconDataUri(monogram, accentName) {
  const a = resolveAccent(accentName)
  const size = [...monogram].length > 1 ? 46 : 58
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">` +
    `<rect width="100" height="100" rx="22" fill="${a.light}"/>` +
    `<text x="50" y="50" fill="${a.ink}" font-family="system-ui,sans-serif" font-size="${size}"` +
    ` font-weight="700" text-anchor="middle" dominant-baseline="central">${esc(monogram)}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

function renderCta(cta, variant, fallbackNote) {
  if (!cta?.label) return ''
  const cls = variant === 'primary' ? 'btn btn-primary' : 'btn btn-ghost'
  if (!cta.href) {
    // A tier or hero with no destination yet: render it visibly inert rather than
    // linking somewhere wrong. Proposal pages hit this constantly, by design.
    const note = fallbackNote ? ` title="${attr(fallbackNote)}"` : ''
    return `<span class="${cls}" aria-disabled="true" role="link"${note}>${esc(cta.label)}</span>`
  }
  const external = /^https?:\/\//i.test(cta.href)
  const rel = external ? ' target="_blank" rel="noopener noreferrer"' : ''
  return `<a class="${cls}" href="${attr(cta.href)}"${rel}>${esc(cta.label)}</a>`
}

function sectionHead(s) {
  const parts = []
  if (s.eyebrow) parts.push(`<span class="eyebrow">${esc(s.eyebrow)}</span>`)
  if (s.heading) parts.push(`<h2>${inline(s.heading)}</h2>`)
  if (s.intro) parts.push(`<p>${inline(s.intro)}</p>`)
  if (!parts.length) return ''
  return `<div class="section-head">\n${parts.join('\n')}\n</div>`
}

function sectionId(s, index) {
  return s.id ? slugify(s.id) : s.heading ? slugify(s.heading) : `section-${index + 1}`
}

const RENDERERS = {
  features(s) {
    return `<div class="grid grid-3">
${each(s.items, item => `<article class="card">
<h3>${inline(item.title)}</h3>
<p>${inline(item.body)}</p>
</article>`)}
</div>`
  },

  steps(s) {
    return `<ol class="grid grid-3" style="list-style:none;padding:0;margin:0">
${each(s.items, (item, i) => `<li class="card">
<span class="num" aria-hidden="true">${i + 1}</span>
<h3>${inline(item.title)}</h3>
<p>${inline(item.body)}</p>
</li>`)}
</ol>`
  },

  quote(s) {
    return `<figure class="quote">
<blockquote>${inline(s.text)}</blockquote>
<figcaption>${inline(s.attribution)}</figcaption>
</figure>`
  },

  pricing(s, brief) {
    const note = brief.mode === 'proposal'
      ? 'A checkout link goes here once you tell us which payment account to use.'
      : ''
    return `<div class="price-grid">
${each(s.tiers, t => `<div class="tier${t.featured ? ' featured' : ''}">
${t.tag ? `<span class="tag">${esc(t.tag)}</span>` : ''}
<h3>${esc(t.name)}</h3>
<p class="amount"><b>${esc(t.amount)}</b>${t.unit ? `<span>${esc(t.unit)}</span>` : ''}</p>
${t.desc ? `<p class="desc">${inline(t.desc)}</p>` : ''}
${Array.isArray(t.includes) && t.includes.length ? `<ul>
${each(t.includes, x => `<li>${inline(x)}</li>`)}
</ul>` : ''}
${renderCta(t.cta, 'primary', note)}
${t.fine ? `<p class="fine">${inline(t.fine)}</p>` : ''}
</div>`)}
</div>`
  },

  faq(s) {
    return `<div class="faq">
${each(s.items, item => `<details>
<summary>${inline(item.q)}</summary>
<div class="answer">${paragraphs(item.a)}</div>
</details>`)}
</div>`
  },

  text(s) {
    return `<div class="prose" style="padding-block:0">${paragraphs(s.body)}</div>`
  },

  final(s, brief) {
    const note = brief.mode === 'proposal' ? 'Your own booking or checkout link goes here.' : ''
    const ctas = [renderCta(s.primaryCta, 'primary', note), renderCta(s.secondaryCta, 'ghost', note)]
      .filter(Boolean).join('\n')
    const pairs = Array.isArray(s.pairs) && s.pairs.length
      ? `<dl class="pairs">
${each(s.pairs, p => `<div><dt>${esc(p.label)}</dt><dd>${inline(p.value)}</dd></div>`)}
</dl>`
      : ''
    return `${ctas ? `<div class="cta-row">\n${ctas}\n</div>` : ''}\n${pairs}`
  },
}

function renderSection(s, index, brief) {
  const body = RENDERERS[s.type]?.(s, brief) ?? ''
  if (!body.trim()) return ''
  const classes = [s.sunk ? 'sunk' : '', s.type === 'final' ? 'final' : ''].filter(Boolean).join(' ')
  return `<section id="${attr(sectionId(s, index))}"${classes ? ` class="${classes}"` : ''}>
<div class="wrap">
${sectionHead(s)}
${body}
</div>
</section>`
}

function renderHero(brief) {
  const h = brief.hero
  const note = brief.mode === 'proposal' ? 'Your own booking or checkout link goes here.' : ''
  const ctas = [renderCta(h.primaryCta, 'primary', note), renderCta(h.secondaryCta, 'ghost', note)]
    .filter(Boolean).join('\n')
  return `<section class="hero">
<div class="wrap">
${h.eyebrow ? `<span class="eyebrow">${esc(h.eyebrow)}</span>` : ''}
<h1>${inline(h.headline)}</h1>
<p class="lede">${inline(h.sub)}</p>
${ctas ? `<div class="cta-row">\n${ctas}\n</div>` : ''}
${h.note ? `<p class="note">${inline(h.note)}</p>` : ''}
${Array.isArray(h.trust) && h.trust.length ? `<ul class="trust">
${each(h.trust, t => `<li>${inline(t)}</li>`)}
</ul>` : ''}
</div>
</section>`
}

/**
 * The proposal banner.
 *
 * Mandatory on every proposal page. It states plainly that the page is an
 * unaffiliated draft and who made it, so a page showing someone what their site
 * could look like can never be mistaken for the business's own.
 */
function renderProposalBanner(brief) {
  const p = brief.proposal ?? {}
  return `<div class="banner">
<div class="wrap">
<p><strong>Draft proposal — not affiliated with, endorsed by or operated by ${esc(brief.meta.businessName)}.</strong>
Prepared for ${esc(p.preparedFor)} by ${esc(p.preparedBy)} (${esc(p.contact)}) as an example of what the page could look like.
Nothing here is live, no payment is collected and no order is taken.</p>
</div>
</div>`
}

function renderHeader(brief) {
  const nav = Array.isArray(brief.nav) && brief.nav.length
    ? `<nav class="nav" aria-label="Sections">
${each(brief.nav, item => `<a href="${attr(item.href)}">${esc(item.label)}</a>`)}
</nav>`
    : ''
  const monogram = brief.meta.monogram || monogramFor(brief.meta.businessName)
  return `<header class="site-head">
<div class="wrap row">
<a class="brand" href="#top"><span class="mark" aria-hidden="true">${esc(monogram)}</span>${esc(brief.meta.businessName)}</a>
${nav}
</div>
</header>`
}

function renderFooter(brief, { legalLinks = true } = {}) {
  const c = brief.contact ?? {}
  const bits = [
    c.email ? `<a href="mailto:${attr(c.email)}">${esc(c.email)}</a>` : '',
    c.phone ? `<a href="tel:${attr(c.phone.replace(/[^+\d]/g, ''))}">${esc(c.phone)}</a>` : '',
  ].filter(Boolean).join(' · ')
  const links = legalLinks
    ? `<nav aria-label="Legal"><a href="/privacy.html">Privacy</a><a href="/terms.html">Terms</a></nav>`
    : ''
  return `<footer class="site-foot">
<div class="wrap row">
<div>
<p style="margin:0">&copy; ${esc(brief.legal.effective.slice(0, 4))} ${esc(brief.legal.operator)}${bits ? ` · ${bits}` : ''}</p>
${brief.footer?.note ? `<p style="margin:0.4rem 0 0">${inline(brief.footer.note)}</p>` : ''}
</div>
${links}
</div>
</footer>`
}

/** Structured data — omitted entirely on proposal pages. */
function renderJsonLd(brief) {
  if (brief.mode !== 'live') return ''
  const c = brief.contact ?? {}
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: brief.meta.businessName,
    description: brief.meta.description,
  }
  if (brief.meta.url) data.url = brief.meta.url
  if (c.email) data.email = c.email
  if (c.phone) data.telephone = c.phone
  if (c.address) data.address = { '@type': 'PostalAddress', streetAddress: c.address }
  return `<script type="application/ld+json">\n${jsonLd(data)}\n</script>`
}

function renderHead(brief, { title, description, path = '/' } = {}) {
  const m = brief.meta
  const pageTitle = title ?? m.title ?? `${m.businessName} — ${m.tagline}`
  const desc = description ?? m.description
  const monogram = m.monogram || monogramFor(m.businessName)
  const canonical = m.url ? new URL(path, m.url.endsWith('/') ? m.url : `${m.url}/`).href : ''
  const robots = brief.mode === 'proposal' ? 'noindex, nofollow, noarchive' : 'index, follow'
  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(pageTitle)}</title>
<meta name="description" content="${attr(desc)}">
<meta name="robots" content="${robots}">
${canonical && brief.mode === 'live' ? `<link rel="canonical" href="${attr(canonical)}">` : ''}
<meta property="og:type" content="website">
<meta property="og:title" content="${attr(pageTitle)}">
<meta property="og:description" content="${attr(desc)}">
<meta property="og:locale" content="${attr((m.locale ?? 'en-CA').replace('-', '_'))}">
${canonical ? `<meta property="og:url" content="${attr(canonical)}">` : ''}
<meta name="twitter:card" content="summary">
<link rel="icon" href="${attr(faviconDataUri(monogram, m.accent))}">
<style>
${stylesheet(m.accent)}
</style>
${renderJsonLd(brief)}`
}

function document_(brief, { head, body }) {
  const lang = (brief.meta.locale ?? 'en-CA').split('-')[0]
  return `<!doctype html>
<html lang="${attr(lang)}">
<head>
${head}
</head>
<body id="top">
<a class="skip" href="#main">Skip to content</a>
${body}
</body>
</html>
`
}

/** The main page. */
export function renderPage(brief) {
  const sections = each(brief.sections, (s, i) => renderSection(s, i, brief))
  const body = [
    brief.mode === 'proposal' ? renderProposalBanner(brief) : '',
    renderHeader(brief),
    `<main id="main">`,
    renderHero(brief),
    sections,
    `</main>`,
    renderFooter(brief),
  ].filter(Boolean).join('\n')
  return document_(brief, { head: renderHead(brief), body })
}

/** A legal page: one `<h1>`, a last-updated line, and prose sections. */
export function renderLegalPage(brief, { title, slug, updated, blocks }) {
  const body = [
    brief.mode === 'proposal' ? renderProposalBanner(brief) : '',
    renderHeader(brief),
    `<main id="main"><div class="wrap prose">`,
    `<h1>${esc(title)}</h1>`,
    `<p class="updated">Last updated ${esc(updated)}</p>`,
    each(blocks, b => {
      if (b.table) {
        return `<h2>${esc(b.heading)}</h2>
<div class="table-scroll"><table>
<thead><tr>${each(b.table.head, h => `<th scope="col">${esc(h)}</th>`)}</tr></thead>
<tbody>${each(b.table.rows, r => `<tr>${each(r, cell => `<td>${inline(cell)}</td>`)}</tr>`)}</tbody>
</table></div>`
      }
      return `${b.heading ? `<h2>${esc(b.heading)}</h2>` : ''}\n${paragraphs(b.body)}`
    }),
    `</div></main>`,
    renderFooter(brief, { legalLinks: false }),
  ].filter(Boolean).join('\n')
  return document_(brief, {
    head: renderHead(brief, { title: `${title} — ${brief.meta.businessName}`, description: `${title} for ${brief.meta.businessName}.`, path: `/${slug}.html` }),
    body,
  })
}
