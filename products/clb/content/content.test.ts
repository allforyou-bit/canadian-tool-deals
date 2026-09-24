/// <reference types="vite/client" />
// Content lint for the static product pages (memo B9): every exported string in content/** passes
// findClaims() (ALLOWED_PHRASES excepted), doc pages carry lastReviewed, the formats pages cover all 10 task
// ids, links point at real routes, and prices/limits come from shared/config.ts. The "review round 1
// promises" block pins what the pages say to what the code does (integrator decisions 2–7, 11–15); the
// "zero-capital launch" block does the same for memo §7.2 Z1, Z2, Z3, Z4, Z5 and Z9.
// Run: npx vitest run content
import { describe, expect, it } from 'vitest'
import { AI_DISCLOSURE, BRAND, CAPS, NOT_AFFILIATED, RETENTION_DAYS, SKUS, TERMS_VERSION } from '../shared/config'
import { findClaims } from '../shared/content-rules'
import { TASKS } from '../shared/tasks'
import { MAX_TOP_ERRORS } from '../worker/src/grading/validate'
import { FORMAT_TASK_IDS, FORMAT_TIPS, FORMATS_INDEX, FORMATS_SPEAKING, FORMATS_WRITING } from './formats'
import {
  HELP_ACCOUNT,
  HELP_FEEDBACK,
  HELP_INDEX,
  HELP_PAGES,
  HELP_PASSES,
  HELP_PRIVACY,
  HELP_RECORDING,
  HELP_TROUBLESHOOTING,
} from './help'
import { faqJsonLd, plainText, productJsonLd, serializeJsonLd, websiteJsonLd } from './jsonld'
import { LANDING, LANDING_EN, LANDING_KO } from './landing'
import { AI_DISCLOSURE_PAGE, LEGAL_PAGES, NOT_AFFILIATED_PAGE, PRIVACY, REFUNDS, TERMS } from './legal'
import { whoWeAreBlocks } from './legal/privacy'
import { NOT_FOUND } from './not-found'
import { PRICING_EN, PRICING_KO } from './pricing'
import { CONTENT_ROUTES, FREE_WRITING_PATH, KNOWN_ROUTES, PATHS, PRACTICE_ROUTES } from './routes'
import { pageMetadata } from './seo'
import {
  buildContactLines,
  CONTACT_LINES_EN,
  DAILY_RESET_EN,
  DAILY_RESET_KO,
  FACTS,
  FILTER_EN,
  GOOGLE_SIGN_IN,
  LAST_REVIEWED,
  LEGAL_NAME,
  LEGAL_NAME_PLACEHOLDER,
  legalNameOrPlaceholder,
  legalNameText,
  MAILING_ADDRESS,
  MAILING_ADDRESS_PLACEHOLDER,
  NO_FEEDBACK_LIMIT,
  NO_LEARNER_EMAIL,
  PAUSE_EXTENSION,
  PRACTICE_MODE,
  QUEBEC_RULE,
  SELLER,
  sellerLine,
  SPEAKING_CAPACITY,
  SUPPORT_FORM_LINE,
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

  it('the privacy policy names the seller and shows the mailing address only when it is set (Z5)', () => {
    const who = JSON.stringify(PRIVACY.sections.find((s) => s.id === 'who-we-are'))
    expect(who).toContain(SELLER.en)
    expect(who).toContain(legalNameText)
    if (MAILING_ADDRESS) expect(who).toContain(`Mailing address: ${legalNameText} (${BRAND.en}), ${MAILING_ADDRESS}`)
    else expect(who).not.toContain('Mailing address')
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
    const google = text(providers).split('\n').find((t) => t.includes('hosts our business email (Gmail)'))
    expect(google).toMatch(/Support messages are forwarded there/)
    expect(text(providers)).toMatch(/uses Claude as an assistant to draft replies to support messages.*reviews every reply and sends it/)
    expect(text(section(PRIVACY, 'retention'))).toContain(`Copies in our business mailbox, including our replies, are deleted ${RETENTION_DAYS} days after you send the message`)
    const summary = text(section(HELP_PRIVACY, 'summary'))
    expect(summary).toMatch(/Gmail/)
    expect(summary).toMatch(/Claude by Anthropic/)
    expect(summary).toMatch(/owner reviews every reply/)
    expect(text(AI_DISCLOSURE_PAGE.sections)).toMatch(/draft replies to messages sent through the support form/)
  })

  it('describe the unsubscribe link accurately while no marketing email is sent (decision 11, Z4)', () => {
    const privacy = text(section(PRIVACY, 'marketing'))
    expect(privacy).toContain('We do not send marketing email')
    expect(privacy).toMatch(/every marketing email will end with an unsubscribe link.*stops marketing emails without signing in/s)
    expect(privacy).toContain('within 10 business days')
    const help = text(section(HELP_ACCOUNT, 'emails'))
    expect(help).toContain('We do not send marketing email')
    expect(help).toContain('unsubscribe link that works without signing in')
    for (const t of everything()) {
      // no longer true: learners get no email from the site (Z4)
      expect(t).not.toMatch(/the unsubscribe link at the end of every email we send|unsubscribe link in any marketing email/)
    }
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

describe('zero-capital launch promises (memo §7.2)', () => {
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

  it('mention no advertising tag anywhere (Z1)', () => {
    for (const t of everything()) {
      expect(t).not.toMatch(/Google Ads|conversion (tag|measurement)|gclid|click id|arrive from an ad|an ad led to/i)
    }
    expect(text(section(PRIVACY, 'cookies'))).toContain('We do not use advertising cookies or advertising tags anywhere on the site.')
    expect(text(section(PRIVACY, 'what-we-collect'))).not.toMatch(/advertising campaign/)
  })

  it('name the owner as the seller, with a visible placeholder until NEXT_PUBLIC_LEGAL_NAME is set (Z5)', () => {
    expect(sellerLine('Jane Q. Doe').en).toBe('Maple Practice Coach is sold by Jane Q. Doe, a sole proprietor in Ontario.')
    expect(sellerLine('Jane Q. Doe').ko).toContain('Jane Q. Doe')
    expect(sellerLine(null).en).toBe(`Maple Practice Coach is sold by ${LEGAL_NAME_PLACEHOLDER}, a sole proprietor in Ontario.`)
    expect(legalNameOrPlaceholder(null)).toBe(LEGAL_NAME_PLACEHOLDER)
    expect(LEGAL_NAME_PLACEHOLDER).toMatch(/not set/)
    expect(SELLER).toEqual(sellerLine(LEGAL_NAME))
    expect(legalNameText).toBe(LEGAL_NAME ?? LEGAL_NAME_PLACEHOLDER)
    // terms, privacy and the not-affiliated notice all identify the seller the same way
    expect(text(TERMS.intro)).toContain(SELLER.en)
    expect(text(TERMS.intro)).toContain(`an agreement between you and ${legalNameText} ("we", "us")`)
    expect(text(section(PRIVACY, 'who-we-are'))).toContain(SELLER.en)
    expect(text(section(NOT_AFFILIATED_PAGE, 'independent'))).toContain(SELLER.en)
    for (const t of everything()) expect(t).not.toMatch(/operated by a sole proprietor|is run by a sole proprietor/)
  })

  it('show the mailing address only when it is set, otherwise the signed-in support form (Z5)', () => {
    const withAddress = text(whoWeAreBlocks({ legalName: 'Jane Doe', mailingAddress: '1 Main St, Toronto ON' }))
    expect(withAddress).toContain('Mailing address: Jane Doe (Maple Practice Coach), 1 Main St, Toronto ON')
    expect(withAddress).toContain('Jane Doe, the owner of the business, is the person accountable')
    const without = text(whoWeAreBlocks({ legalName: 'Jane Doe', mailingAddress: null }))
    expect(without).not.toContain('Mailing address')
    expect(without).toContain('use the support form on your [account page](/account/) (you need to be signed in)')
    expect(text(whoWeAreBlocks({ legalName: null, mailingAddress: null }))).toContain(LEGAL_NAME_PLACEHOLDER)

    expect(buildContactLines({ supportEmail: null, mailingAddress: null, legalName: 'Jane Doe' })).toEqual([SUPPORT_FORM_LINE])
    expect(buildContactLines({ supportEmail: 'help@example.ca', mailingAddress: '1 Main St', legalName: 'Jane Doe' })).toEqual([
      SUPPORT_FORM_LINE,
      'Email us at [help@example.ca](mailto:help@example.ca).',
      'Write to us by mail: Jane Doe (Maple Practice Coach), 1 Main St',
    ])
    expect(CONTACT_LINES_EN[0]).toBe(SUPPORT_FORM_LINE)
    // the bracketed placeholder must never be read as a [label](href) link by components/content/Rich.tsx
    for (const line of [
      ...buildContactLines({ supportEmail: null, mailingAddress: '1 Main St', legalName: null }).slice(1),
      ...(whoWeAreBlocks({ legalName: null, mailingAddress: '1 Main St' }) as string[]),
      sellerLine(null).en,
      sellerLine(null).ko,
    ]) {
      expect(line).toContain(LEGAL_NAME_PLACEHOLDER)
      expect(plainText(line)).toContain(LEGAL_NAME_PLACEHOLDER)
    }
    // the old address placeholder is never shown on a page any more
    for (const t of everything()) if (t !== MAILING_ADDRESS_PLACEHOLDER) expect(t).not.toContain(MAILING_ADDRESS_PLACEHOLDER)
  })

  it('describe sign-in with Google: what we receive, and that a Google account is needed (Z3)', () => {
    expect(GOOGLE_SIGN_IN.en).toContain('We receive only your email address and your Google account id from Google.')
    expect(text(HELP_ACCOUNT.intro)).toContain('You need a Google account to sign in.')
    expect(text(section(HELP_ACCOUNT, 'how'))).toContain('Continue with Google')
    expect(text(section(HELP_ACCOUNT, 'no-google-account'))).toMatch(/create a Google account/)
    expect(text(section(HELP_ACCOUNT, 'what-google-shares'))).toMatch(/only for your email address/)
    const providers = text(section(PRIVACY, 'providers'))
    expect(providers).toContain(GOOGLE_SIGN_IN.en)
    expect(providers).toMatch(/Sign-in: when you choose to continue with Google/)
    expect(text(section(PRIVACY, 'what-we-collect'))).toMatch(/Google account id/)
    expect(text(section(PRIVACY, 'cookies'))).toMatch(/Google sign-in cookie/)
    expect(text(section(TERMS, 'accounts'))).toMatch(/You sign in with your Google account/)
    expect(text(section(HELP_TROUBLESHOOTING, 'sign-in'))).toMatch(/You need a Google account/)
    expect(LANDING_EN.pricing.items.join(' ')).toMatch(/after you sign in with Google/)
    expect(LANDING_KO.pricing.items.join(' ')).toMatch(/Google 계정으로 로그인/)
    expect(PRICING_EN.free.items.join(' ')).toMatch(/after you sign in with Google/)
    expect(PRICING_KO.free.items.join(' ')).toMatch(/Google 계정으로 로그인/)
    // the learner email link is gone from every page
    for (const t of everything()) {
      expect(t).not.toMatch(/sign-in links?\b|link we email|we email you a|sign in with your email|verify your email|email does not arrive|이메일로 로그인/i)
    }
  })

  it('promise no email to learners: pass, refunds and the Stripe receipt link are on the account page (Z4)', () => {
    expect(NO_LEARNER_EMAIL.en).toMatch(/We do not send you emails about your account or your pass/)
    expect(NO_LEARNER_EMAIL.en).toMatch(/link to the Stripe receipt/)
    for (const s of [section(HELP_PASSES, 'how'), section(TERMS, 'passes'), section(PRIVACY, 'marketing'), section(HELP_ACCOUNT, 'emails')]) {
      expect(text(s)).toContain(NO_LEARNER_EMAIL.en)
    }
    expect(text(PRICING_EN.sections.find((x) => x.id === 'one-time'))).toContain(NO_LEARNER_EMAIL.en)
    expect(text(PRICING_KO.sections.find((x) => x.id === 'one-time'))).toContain(NO_LEARNER_EMAIL.ko)
    expect(text(section(REFUNDS, 'how'))).toMatch(/Your account page shows the refund.*We do not send a confirmation by email\./)
    expect(text(section(REFUNDS, 'automatic'))).toMatch(/Your account page shows that the payment was refunded; we do not send an email\./)
    expect(text(section(PRIVACY, 'what-we-collect'))).toMatch(/link to Stripe's receipt/)
    expect(text(section(PRIVACY, 'changes'))).toMatch(/notice on the site and on your account page/)
    expect(text(section(TERMS, 'changes'))).toMatch(/with a notice on the site and on your account page/)
    for (const t of everything()) {
      expect(t).not.toMatch(/email you a confirmation|we email you to let you know|we will email you|tell account holders by email|Sends our emails|send sign-in links/i)
    }
  })

  it('list Resend as the owner-alert processor, including forwarded support messages (Z4)', () => {
    const resend = text(section(PRIVACY, 'providers')).split('\n').find((t) => t.startsWith("Delivers the site's email alerts"))
    expect(resend).toMatch(/owner's mailbox.*support messages you send us, with your email address.*We do not use Resend to email you/s)
    expect(text(section(HELP_PRIVACY, 'providers'))).toMatch(/Delivers the site's email alerts to the owner, including the support messages/)
  })

  it('say that speaking feedback can close for the day at the shared capacity, without calling it a pause (Z2)', () => {
    expect(SPEAKING_CAPACITY.en).toContain(DAILY_RESET_EN)
    expect(SPEAKING_CAPACITY.ko).toContain(DAILY_RESET_KO)
    expect(SPEAKING_CAPACITY.en).not.toMatch(/extend|paused/)
    for (const s of [
      section(HELP_TROUBLESHOOTING, 'speaking-closed'),
      section(HELP_RECORDING, 'capacity'),
      section(HELP_PASSES, 'fair-use'),
      section(TERMS, 'fair-use'),
      PRICING_EN.sections.find((x) => x.id === 'fair-use'),
    ]) {
      expect(text(s)).toContain(SPEAKING_CAPACITY.en)
    }
    expect(text(PRICING_KO.sections.find((x) => x.id === 'fair-use'))).toContain(SPEAKING_CAPACITY.ko)
  })

  it('offer free practice without feedback: what it is, audio stays on the device, no sign-in (Z9)', () => {
    expect(PRACTICE_MODE.label.en).toBe('Practise without feedback')
    expect(PRACTICE_MODE.audio.en).toMatch(/stay in your browser on your device\. They are never uploaded/)
    for (const copy of [LANDING_EN, LANDING_KO]) {
      expect(copy.practice.cta.label).toBe(PRACTICE_MODE.label[copy.lang])
      expect(copy.practice.items).toContain(PRACTICE_MODE.audio[copy.lang])
      expect(copy.practice.items.join(' ')).toMatch(/\*\*(Writing|쓰기)\*\*/)
      expect(copy.practice.items.join(' ')).toMatch(/\*\*(Speaking|말하기)\*\*/)
      expect(copy.practice.next).toContain(FREE_WRITING_PATH)
    }
    expect(LANDING_EN.practice.cta.href).toBe(PATHS.practice)
    expect(LANDING_KO.practice.cta.href).toBe(`${PATHS.practice}?lang=ko`)
    expect(LANDING_EN.practice.intro).toMatch(/free, you do not need to sign in, and nothing you write or say is sent to us/)
    expect(LANDING_KO.practice.intro).toMatch(/로그인이 필요 없으며/)
    expect(LANDING_EN.hero.note).toContain(`[practise without feedback](${PATHS.practice})`)
    expect(LANDING_EN.pricing.items[0]).toMatch(/^Practice without feedback: free/)
    expect(PRICING_EN.free.items.join(' ')).toContain(`[Start practising](${PATHS.practice})`)
    expect(text(LANDING_EN.faq.items)).toContain(PRACTICE_MODE.audio.en)
    expect(text(LANDING_KO.faq.items)).toContain(PRACTICE_MODE.audio.ko)

    const formats = text(section(FORMATS_INDEX, 'practice-mode'))
    expect(formats).toContain(PRACTICE_MODE.label.en)
    expect(formats).toContain(PRACTICE_MODE.audio.en)
    expect(text(FORMATS_WRITING.page.intro)).toMatch(/Practise without feedback.*self-check list, free and without signing in/)
    expect(text(FORMATS_SPEAKING.page.intro)).toContain(PRACTICE_MODE.audio.en)

    const help = text(section(HELP_FEEDBACK, 'practice-mode'))
    expect(help).toMatch(/free, needs no account and uses no AI/)
    expect(help).toContain(PRACTICE_MODE.audio.en)
    expect(help).toContain(`(${FREE_WRITING_PATH})`)
    expect(text(section(HELP_RECORDING, 'practice-mode'))).toContain(PRACTICE_MODE.audio.en)
    expect(text(section(HELP_PRIVACY, 'summary'))).toContain(PRACTICE_MODE.audio.en)
    expect(text(section(PRIVACY, 'what-we-collect'))).toContain(PRACTICE_MODE.audio.en)
    expect(text(section(AI_DISCLOSURE_PAGE, 'practice-mode'))).toMatch(/no AI is involved/)
    expect(text(section(TERMS, 'free'))).toContain(PRACTICE_MODE.audio.en)
    expect(NOT_FOUND.en.links.map((l) => l.href)).toContain(PATHS.practice)
  })

  it('keep the legal DRAFT notes pointing at the owner decisions still open (Z5)', () => {
    expect(PRIVACY.draftComment).toMatch(/MPC_LEGAL_NAME/)
    expect(PRIVACY.draftComment).toMatch(/\[미확인\].*4\.8\.2\(a\)/)
    expect(TERMS.draftComment).toMatch(/\[미확인\] Ontario Business Names Act/)
    expect(TERMS.draftComment).toMatch(/ServiceOntario/)
  })
})
