/// <reference types="vite/client" />
// Content lint for the static product pages (memo B9): every exported string in content/** passes
// findClaims() (ALLOWED_PHRASES excepted), doc pages carry lastReviewed, the formats pages cover all 10 task
// ids, links point at real routes, and prices/limits come from shared/config.ts. The "review round 1
// promises" block pins what the pages say to what the code does (integrator decisions 2–7, 11–15).
// Run: npx vitest run content
import { describe, expect, it } from 'vitest'
import { AI_DISCLOSURE, CAPS, NOT_AFFILIATED, RETENTION_DAYS, SKUS, TERMS_VERSION } from '../shared/config'
import { findClaims } from '../shared/content-rules'
import { TASKS } from '../shared/tasks'
import { MAX_TOP_ERRORS } from '../worker/src/grading/validate'
import { FORMAT_TASK_IDS, FORMAT_TIPS, FORMATS_INDEX, FORMATS_SPEAKING, FORMATS_WRITING } from './formats'
import { HELP_ACCOUNT, HELP_FEEDBACK, HELP_INDEX, HELP_PAGES, HELP_PASSES, HELP_PRIVACY, HELP_TROUBLESHOOTING } from './help'
import { faqJsonLd, plainText, productJsonLd, serializeJsonLd, websiteJsonLd } from './jsonld'
import { LANDING, LANDING_EN, LANDING_KO } from './landing'
import { AI_DISCLOSURE_PAGE, LEGAL_PAGES, PRIVACY, REFUNDS, TERMS } from './legal'
import { PRICING_EN, PRICING_KO } from './pricing'
import { CONTENT_ROUTES, FREE_WRITING_PATH, KNOWN_ROUTES, PRACTICE_ROUTES } from './routes'
import { pageMetadata } from './seo'
import {
  FACTS,
  FILTER_EN,
  LAST_REVIEWED,
  mailingAddressText,
  NO_FEEDBACK_LIMIT,
  PAUSE_EXTENSION,
  QUEBEC_RULE,
} from './site'
import type { DocPage, DocSection } from './types'

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
      // the terms and the refund policy show TERMS_VERSION, the version buyers accept at checkout
      const expected = page === TERMS || page === REFUNDS ? TERMS_VERSION : LAST_REVIEWED
      expect(page.lastReviewed, page.path).toBe(expected)
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
    expect(PRICING_EN.facts).toContain('Passes are not sold in Quebec.')
    expect(PRICING_KO.facts.join(' ')).toMatch(/캐나다 달러/)
    expect(PRICING_KO.facts).toContain(QUEBEC_RULE.ko)
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

describe('review round 1 promises', () => {
  const section = (page: DocPage, id: string): DocSection => {
    const s = page.sections.find((x) => x.id === id)
    if (!s) throw new Error(`${page.path} has no section #${id}`)
    return s
  }
  const text = (value: unknown): string => {
    const out: { path: string; text: string }[] = []
    collectStrings(value, '', out)
    return out.map((s) => s.text).join('\n')
  }
  const everything = () => allStrings().map((s) => s.text)

  it('promise up to three errors, and the grader returns at most three (decision 4)', () => {
    expect(MAX_TOP_ERRORS).toBe(3)
    expect(text(LANDING_EN.feedback.includes)).toContain('(up to three)')
    expect(text(LANDING_KO.feedback.includes)).toContain('최대 3개')
    expect(text(section(HELP_FEEDBACK, 'contents'))).toContain('Up to three errors')
    for (const t of everything()) expect(t).not.toMatch(/up to (four|five|[45])\b|최대 [45]개/i)
  })

  it('say that any pause extends active passes, in the same words everywhere (decision 12)', () => {
    for (const s of [
      section(TERMS, 'passes'),
      section(REFUNDS, 'other'),
      section(HELP_PASSES, 'how'),
      section(HELP_TROUBLESHOOTING, 'paused'),
      PRICING_EN.sections,
    ]) {
      expect(text(s)).toContain(PAUSE_EXTENSION.en)
    }
    expect(text(PRICING_KO.sections)).toContain(PAUSE_EXTENSION.ko)
    for (const t of everything()) {
      if (/length of the pause/.test(t)) expect(t).toContain(PAUSE_EXTENSION.en)
      if (/멈춘 시간만큼/.test(t)) expect(t).toContain(PAUSE_EXTENSION.ko)
      expect(t).not.toMatch(/instead of refunding|we extend active passes/)
    }
  })

  it('say "Passes are not sold in Quebec." and never that the whole service is unavailable there (decision 15)', () => {
    expect(QUEBEC_RULE.en).toBe('Passes are not sold in Quebec.')
    expect(text(section(TERMS, 'eligibility'))).toContain(QUEBEC_RULE.en)
    expect(LANDING_EN.pricing.note).toContain(QUEBEC_RULE.en)
    expect(LANDING_KO.pricing.note).toContain(QUEBEC_RULE.ko)
    expect(PRICING_KO.facts).toContain(QUEBEC_RULE.ko)
    for (const t of everything()) {
      expect(t).not.toMatch(/not available in Quebec/i)
      expect(t).not.toMatch(/퀘벡에서는 이용할 수 없어요/)
    }
  })

  it('count only graded tasks toward fair use and state the no-feedback cap from config (decision 2)', () => {
    expect(NO_FEEDBACK_LIMIT.en).toContain(`${CAPS.noFeedbackPerDay} per account per day`)
    expect(NO_FEEDBACK_LIMIT.ko).toContain(`하루 ${CAPS.noFeedbackPerDay}개`)
    for (const s of [
      section(TERMS, 'fair-use'),
      section(HELP_PASSES, 'fair-use'),
      section(HELP_TROUBLESHOOTING, 'limit'),
      PRICING_EN.sections.find((x) => x.id === 'fair-use'),
    ]) {
      expect(text(s)).toContain(NO_FEEDBACK_LIMIT.en)
    }
    expect(text(PRICING_KO.sections.find((x) => x.id === 'fair-use'))).toContain(NO_FEEDBACK_LIMIT.ko)
    expect(text(section(HELP_TROUBLESHOOTING, 'no-feedback'))).toContain(`up to ${CAPS.noFeedbackPerDay} requests without feedback`)
    // the old unconditional wording
    for (const t of everything()) expect(t).not.toMatch(/do not count toward these limits\.$|이민 관련 질문처럼 피드백을 드릴 수 없는 요청은 한도에 포함되지 않아요/)
  })

  it('describe the scope refusal as a fixed message (decision 3)', () => {
    const feedback = text(section(AI_DISCLOSURE_PAGE, 'feedback'))
    expect(feedback).toContain('fixed message that we wrote')
    expect(feedback).toMatch(/licensed immigration consultant or a lawyer/)
    expect(text(section(HELP_FEEDBACK, 'steps'))).toContain('fixed message that we wrote')
    for (const t of everything()) expect(t).not.toMatch(/Claude replies with a short message/)
  })

  it('claim only what the claim filter does', () => {
    expect(text(section(AI_DISCLOSURE_PAGE, 'feedback'))).toContain(FILTER_EN)
    expect(text(section(HELP_FEEDBACK, 'steps'))).toContain(FILTER_EN)
    for (const t of everything()) expect(t).not.toMatch(/looks like a test result or a prediction|exactly what to fix/i)
    // the two kinds of sentence FILTER_EN says it removes are the ones findClaims (and so the filter) catches
    expect(findClaims('This answer is about 9 out of 12.')).toContain('numeric_result')
    expect(findClaims('This is band 9 writing.')).toContain('band')
    expect(findClaims('Your score would be high.')).toContain('score')
  })

  it('describe deletion as removing answers and feedback while anonymous cost records stay (decision 5)', () => {
    const rights = text(section(PRIVACY, 'your-rights'))
    expect(rights).toMatch(/removes your email address, answers, transcripts, feedback, error types and support messages/)
    expect(rights).toContain('without anything that links them to you')
    const retention = text(section(PRIVACY, 'retention'))
    expect(retention).toMatch(/Task and cost records/)
    expect(retention).toMatch(/free speaking task is not given again/)
    expect(text(PRIVACY.sections)).toContain('we do not store them with your answers')
    expect(text(section(HELP_ACCOUNT, 'delete'))).toContain('without anything that links it to you')
    expect(text(section(HELP_PRIVACY, 'after-delete'))).toMatch(/processing cost/)
  })

  it('say saved answers and feedback open from the account page for the retention period (decision 6)', () => {
    expect(text(section(PRIVACY, 'your-rights'))).toContain(`open your saved answers and feedback from your account page for ${RETENTION_DAYS} days`)
    expect(text(section(HELP_FEEDBACK, 'steps'))).toContain(`open them again from your [account page](/account/) for ${RETENTION_DAYS} days`)
    for (const t of everything()) expect(t).not.toMatch(/your recent tasks and feedback are on your account page|saved to your history\./)
  })

  it('disclose where support messages go and how long mailbox copies are kept (decision 7)', () => {
    const providers = PRIVACY.sections.find((s) => s.id === 'providers')
    const google = text(providers).split('\n').find((t) => t.startsWith('Hosts our business email (Gmail)'))
    expect(google).toMatch(/Support messages are forwarded there/)
    expect(text(providers)).toMatch(/uses Claude as an assistant to draft replies to support messages.*reviews every reply and sends it/)
    expect(text(section(PRIVACY, 'retention'))).toContain(`Copies in our business mailbox, including our replies, are deleted ${RETENTION_DAYS} days after you send the message`)
    const summary = text(section(HELP_PRIVACY, 'summary'))
    expect(summary).toMatch(/Gmail/)
    expect(summary).toMatch(/Claude by Anthropic/)
    expect(summary).toMatch(/owner reviews every reply/)
    expect(text(AI_DISCLOSURE_PAGE.sections)).toMatch(/draft replies to messages sent through the support form/)
  })

  it('say every email carries the unsubscribe link (decision 11)', () => {
    expect(text(section(PRIVACY, 'marketing'))).toContain('the unsubscribe link at the end of every email we send')
    expect(text(section(HELP_ACCOUNT, 'marketing'))).toContain('the unsubscribe link at the end of every email we send')
    for (const t of everything()) expect(t).not.toMatch(/unsubscribe link in any marketing email/)
  })

  it('keep /unsubscribe/ (noindex) out of the sitemap routes', () => {
    expect([...CONTENT_ROUTES, ...PRACTICE_ROUTES]).not.toContain('/unsubscribe/')
  })

  it('show card-only payment and agreement at purchase, dated TERMS_VERSION (decision 13)', () => {
    expect(TERMS.lastReviewed).toBe(TERMS_VERSION)
    expect(REFUNDS.lastReviewed).toBe(TERMS_VERSION)
    expect(text(TERMS.intro)).toMatch(/When you buy a pass, you agree to these terms and our refund policy, as shown next to the buy button/)
    expect(text(REFUNDS.intro)).toMatch(/When you buy a pass, you agree to this policy/)
    expect(text(section(TERMS, 'passes'))).toMatch(/You pay by card .* We do not accept other payment methods\./)
    expect(text(section(TERMS, 'passes'))).toMatch(/or the payment was not made by card/)
    expect(text(section(REFUNDS, 'other'))).toMatch(/unused days of a pass is a partial refund.*The pass ends when the refund is made/)
    expect(text(PRICING_EN.sections)).toMatch(/Payment is by card only/)
    expect(text(PRICING_KO.sections)).toMatch(/카드로만/)
    expect(text(section(HELP_PASSES, 'buying'))).toMatch(/By buying, you agree to the \[terms of use\]/)
  })
})
