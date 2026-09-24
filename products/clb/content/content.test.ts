/// <reference types="vite/client" />
// Content lint for the static product pages (memo B9): every exported string in content/** passes
// findClaims() (ALLOWED_PHRASES excepted), doc pages carry lastReviewed, the formats pages cover all 10 task
// ids, links point at real routes, and prices/limits come from shared/config.ts.
// Run: npx vitest run content
import { describe, expect, it } from 'vitest'
import { AI_DISCLOSURE, NOT_AFFILIATED, SKUS } from '../shared/config'
import { findClaims } from '../shared/content-rules'
import { TASKS } from '../shared/tasks'
import { FORMAT_TASK_IDS, FORMAT_TIPS, FORMATS_INDEX, FORMATS_SPEAKING, FORMATS_WRITING } from './formats'
import { HELP_INDEX, HELP_PAGES } from './help'
import { faqJsonLd, plainText, productJsonLd, serializeJsonLd, websiteJsonLd } from './jsonld'
import { LANDING, LANDING_EN, LANDING_KO } from './landing'
import { LEGAL_PAGES, PRIVACY } from './legal'
import { PRICING_EN, PRICING_KO } from './pricing'
import { CONTENT_ROUTES, FREE_WRITING_PATH, KNOWN_ROUTES } from './routes'
import { pageMetadata } from './seo'
import { FACTS, LAST_REVIEWED, mailingAddressText } from './site'
import type { DocPage } from './types'

// Every content module, found by Vite's import.meta.glob so a new content file is linted automatically.
const MODULES = import.meta.glob(['./**/*.ts', '!./**/*.test.ts'], { eager: true }) as Record<string, Record<string, unknown>>

/** All string leaves reachable from a value (objects, arrays, sets, maps); functions are skipped. */
function collectStrings(value: unknown, path: string, out: { path: string; text: string }[], seen = new Set<unknown>()) {
  if (typeof value === 'string') {
    out.push({ path, text: value })
    return
  }
  if (value === null || typeof value !== 'object' || seen.has(value)) return
  seen.add(value)
  if (value instanceof Set || value instanceof Map) {
    let i = 0
    for (const v of value.values()) collectStrings(v, `${path}[${i++}]`, out, seen)
    return
  }
  for (const [k, v] of Object.entries(value)) collectStrings(v, `${path}.${k}`, out, seen)
}

const DOC_PAGES: DocPage[] = [
  FORMATS_INDEX,
  FORMATS_WRITING.page,
  FORMATS_SPEAKING.page,
  HELP_INDEX,
  ...HELP_PAGES,
  ...LEGAL_PAGES,
]

// Generated structured data and metadata are part of the page too.
const GENERATED = {
  jsonld: [websiteJsonLd('en'), websiteJsonLd('ko'), productJsonLd('en'), productJsonLd('ko'), faqJsonLd(LANDING_EN.faq.items, 'en'), faqJsonLd(LANDING_KO.faq.items, 'ko')],
  metadata: [
    ...DOC_PAGES.map((p) => pageMetadata(p)),
    pageMetadata({ path: '/', title: LANDING_EN.meta.title, description: LANDING_EN.meta.description, brandFirst: true }),
    pageMetadata({ path: '/ko/', title: LANDING_KO.meta.title, description: LANDING_KO.meta.description, lang: 'ko', brandFirst: true }),
    pageMetadata({ path: PRICING_EN.path, title: PRICING_EN.meta.title, description: PRICING_EN.meta.description }),
    pageMetadata({ path: PRICING_KO.path, title: PRICING_KO.meta.title, description: PRICING_KO.meta.description, lang: 'ko' }),
  ],
}

function allStrings(): { path: string; text: string }[] {
  const out: { path: string; text: string }[] = []
  for (const [file, mod] of Object.entries(MODULES)) collectStrings(mod, file, out)
  collectStrings(GENERATED, 'generated', out)
  return out
}

const LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g

describe('content modules', () => {
  it('were all found by the glob', () => {
    const files = Object.keys(MODULES).sort()
    for (const f of ['./formats.ts', './help.ts', './landing.ts', './pricing.ts', './site.ts', './legal/privacy.ts', './legal/terms.ts']) {
      expect(files).toContain(f)
    }
  })
})

describe('claims lint (findClaims)', () => {
  it('every exported content string passes, except the exact allowed phrases', () => {
    const strings = allStrings()
    expect(strings.length).toBeGreaterThan(300)
    const failures = strings
      .map((s) => ({ ...s, rules: findClaims(s.text) }))
      .filter((s) => s.rules.length > 0)
      .map((s) => `${s.path}: [${s.rules.join(', ')}] ${s.text.slice(0, 120)}`)
    expect(failures).toEqual([])
  })

  it('names tests only descriptively', () => {
    for (const { path, text } of allStrings()) {
      const t = text.replace(/CELPIP and IELTS are trademarks of their respective owners/g, '')
      // "CELPIP" only as "the CELPIP-General test" / "CELPIP-General 시험"; "IELTS" only in the trademark line
      expect(t.replace(/CELPIP-General (test|시험)/g, ''), path).not.toMatch(/CELPIP/)
      expect(t, path).not.toMatch(/IELTS|\bCLB\b/)
    }
  })

  it('has balanced inline markup', () => {
    for (const { path, text } of allStrings()) {
      const stripped = plainText(text)
      expect(stripped, path).not.toMatch(/\]\(|\*\*/)
    }
  })
})

describe('links', () => {
  it('every internal link points at a known route', () => {
    const bad: string[] = []
    const check = (href: string, where: string) => {
      if (href.startsWith('mailto:') || href.startsWith('https://')) return
      const path = href.split(/[?#]/)[0]
      if (!KNOWN_ROUTES.has(path)) bad.push(`${where}: ${href}`)
    }
    for (const { path, text } of allStrings()) {
      for (const m of text.matchAll(LINK)) check(m[2], path)
      if (/\.href$/.test(path)) check(text, path)
    }
    for (const page of DOC_PAGES) for (const r of page.related ?? []) check(r.href, page.path)
    expect(bad).toEqual([])
  })
})

describe('doc pages', () => {
  it('has 8–10 product documentation pages (memo B1/B9), plus the legal pages', () => {
    const productDocs = DOC_PAGES.filter((p) => !p.path.startsWith('/legal/'))
    expect(productDocs.length).toBeGreaterThanOrEqual(8)
    expect(productDocs.length).toBeLessThanOrEqual(10)
    expect(LEGAL_PAGES.map((p) => p.path).sort()).toEqual(
      ['/legal/ai-disclosure/', '/legal/not-affiliated/', '/legal/privacy/', '/legal/refunds/', '/legal/terms/'].sort(),
    )
  })

  it('every doc page shows a lastReviewed date', () => {
    expect(LAST_REVIEWED).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    for (const page of DOC_PAGES) {
      expect(page.lastReviewed, page.path).toBe(LAST_REVIEWED)
      expect(['Last reviewed', 'Last updated'], page.path).toContain(page.lastReviewedLabel)
      expect(page.description.length, page.path).toBeGreaterThan(40)
      expect(CONTENT_ROUTES, page.path).toContain(page.path)
    }
  })

  it('legal pages carry the owner-review draft note', () => {
    for (const page of LEGAL_PAGES) {
      expect(page.draftComment, page.path).toMatch(/^DRAFT /)
      expect(page.draftComment, page.path).toMatch(/before launch/)
    }
  })

  it('section ids are unique within each page', () => {
    for (const page of DOC_PAGES) {
      const ids = page.sections.map((s) => s.id)
      expect(new Set(ids).size, page.path).toBe(ids.length)
    }
  })

  it('the privacy policy shows the mailing address or a visible placeholder', () => {
    const who = PRIVACY.sections.find((s) => s.id === 'who-we-are')
    expect(JSON.stringify(who)).toContain(mailingAddressText)
    expect(mailingAddressText.length).toBeGreaterThan(5)
  })
})

describe('formats pages', () => {
  it('reference all 10 task ids, split by kind', () => {
    expect([...FORMAT_TASK_IDS].sort()).toEqual(TASKS.map((t) => t.id).sort())
    expect(FORMAT_TASK_IDS).toHaveLength(10)
    expect(FORMATS_WRITING.tasks.every((t) => t.kind === 'writing')).toBe(true)
    expect(FORMATS_SPEAKING.tasks.every((t) => t.kind === 'speaking')).toBe(true)
    expect(FORMATS_WRITING.tasks).toHaveLength(2)
    expect(FORMATS_SPEAKING.tasks).toHaveLength(8)
  })

  it('give every task tips, criteria, an example prompt and a practice link', () => {
    for (const t of [...FORMATS_WRITING.tasks, ...FORMATS_SPEAKING.tasks]) {
      expect(FORMAT_TIPS[t.id]?.length, t.id).toBeGreaterThanOrEqual(3)
      expect(t.criteria.length, t.id).toBe(4)
      expect(t.examplePrompt.length, t.id).toBeGreaterThan(20)
      expect(t.practiceHref, t.id).toBe(`/practice/${t.kind}/${t.id}/`)
    }
  })

  it('show the not-affiliated notice in the page body', () => {
    for (const page of [FORMATS_INDEX, FORMATS_WRITING.page, FORMATS_SPEAKING.page]) {
      expect(page.intro, page.path).toContainEqual({ note: NOT_AFFILIATED.en })
    }
  })

  it('call the timings practice defaults', () => {
    for (const page of [FORMATS_INDEX, FORMATS_WRITING.page, FORMATS_SPEAKING.page]) {
      expect(JSON.stringify(page.intro), page.path).toMatch(/practice defaults/)
    }
  })
})

describe('landing pages', () => {
  it('show the AI disclosure verbatim', () => {
    expect(LANDING_EN.disclosure.text).toBe(AI_DISCLOSURE.en)
    expect(LANDING_KO.disclosure.text).toBe(AI_DISCLOSURE.ko)
  })

  it('send the free-task CTA to the email writing task', () => {
    expect(LANDING_EN.hero.cta).toEqual({ label: 'Try a free writing task', href: FREE_WRITING_PATH })
    expect(LANDING_KO.hero.cta.href).toBe(`${FREE_WRITING_PATH}?lang=ko`)
  })

  it('list all 10 task types in both languages', () => {
    for (const copy of Object.values(LANDING)) {
      const ids = [...copy.tasks.writing, ...copy.tasks.speaking].map((t) => t.id).sort()
      expect(ids).toEqual(TASKS.map((t) => t.id).sort())
    }
  })

  it('quote prices from shared/config.ts', () => {
    const teaser = LANDING_EN.pricing.items.join(' ')
    expect(teaser).toContain(`C$${SKUS.pass30.priceCents / 100}`)
    expect(teaser).toContain(`C$${SKUS.pass90.priceCents / 100}`)
    expect(FACTS.price.pass30).toBe('C$39')
    expect(FACTS.price.pass90).toBe('C$79')
  })
})

describe('pricing pages', () => {
  it('state the currency and the Quebec exclusion', () => {
    expect(PRICING_EN.facts).toContain('Prices in Canadian dollars.')
    expect(PRICING_EN.facts).toContain('Not available in Quebec.')
    expect(PRICING_KO.facts.join(' ')).toMatch(/캐나다 달러/)
    expect(PRICING_KO.facts.join(' ')).toMatch(/퀘벡/)
  })

  it('link the refund policy and describe the fair-use caps from config', () => {
    const text = JSON.stringify(PRICING_EN.sections)
    expect(text).toContain('/legal/refunds/')
    expect(text).toContain(`${FACTS.writingPerDay} writing tasks`)
    expect(text).toContain(`${FACTS.speakingPerDay} speaking tasks`)
    expect(text).toContain(`${FACTS.gradedPer30Days} tasks in any 30 days`)
  })

  it('have Product JSON-LD with two CAD offers priced from SKUS', () => {
    for (const lang of ['en', 'ko'] as const) {
      const ld = productJsonLd(lang) as { '@type': string; offers: { price: string; priceCurrency: string }[] }
      expect(ld['@type']).toBe('Product')
      expect(ld.offers).toHaveLength(2)
      expect(ld.offers.map((o) => o.priceCurrency)).toEqual(['CAD', 'CAD'])
      expect(ld.offers.map((o) => o.price)).toEqual([
        (SKUS.pass30.priceCents / 100).toFixed(2),
        (SKUS.pass90.priceCents / 100).toFixed(2),
      ])
    }
  })
})

describe('structured data and metadata', () => {
  it('escapes "<" in JSON-LD', () => {
    expect(serializeJsonLd({ name: '</script><b>' })).not.toContain('<')
  })

  it('FAQ JSON-LD answers are plain text', () => {
    const ld = faqJsonLd(LANDING_EN.faq.items, 'en') as { mainEntity: { acceptedAnswer: { text: string } }[] }
    for (const q of ld.mainEntity) expect(q.acceptedAnswer.text).not.toMatch(/\]\(|\*\*/)
  })

  it('gives the EN/KO pages hreflang alternates and absolute canonicals', () => {
    const home = pageMetadata({ path: '/', title: 't', description: 'd', brandFirst: true })
    expect(home.alternates?.languages).toMatchObject({ en: expect.stringMatching(/^https:\/\/.+\/$/), ko: expect.stringMatching(/\/ko\/$/) })
    const help = pageMetadata(HELP_INDEX)
    expect(String(help.alternates?.canonical)).toMatch(/^https:\/\/.+\/help\/$/)
    expect(help.alternates?.languages).toBeUndefined()
  })
})
