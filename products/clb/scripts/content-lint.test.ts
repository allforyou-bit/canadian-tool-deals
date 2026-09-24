import { describe, expect, it } from 'vitest'
import { AI_DISCLOSURE, NOT_AFFILIATED } from '../shared/config'
import { MAILING_ADDRESS_PLACEHOLDER } from '../content/site'
import { ADDRESS_PAGE, addressPlaceholderFindings, ADDRESS_PLACEHOLDERS, addressShownFindings, decodeEntities, htmlToText, LEGAL_NAME_PAGES, legalNameFindings, lintHtml, lintText } from './content-lint'

const page = (body: string, head = '<title>Practice</title>') =>
  `<!DOCTYPE html><html lang="en"><head>${head}</head><body>${body}<footer><p>${NOT_AFFILIATED.en}</p></footer></body></html>`

describe('lintText', () => {
  it('fails on "official CLB score" (memo B9 acceptance)', () => {
    expect(lintText('Get your official CLB score today.')).toEqual(expect.arrayContaining(['official', 'clb', 'score']))
  })

  it('passes clean product copy', () => {
    expect(lintText('Timed writing and speaking practice with feedback on four criteria.')).toEqual([])
  })

  it('ignores forbidden words inside the allowed disclaimer sentences only', () => {
    expect(lintText(`${NOT_AFFILIATED.en} ${AI_DISCLOSURE.en}`)).toEqual([])
    expect(lintText('Feedback is not calibrated against official scores')).toEqual(['official', 'score'])
  })

  it('flags a number presented as a result', () => {
    expect(lintText('You would get 9 out of 12.')).toContain('numeric_result')
    expect(lintText('Write 150 to 200 words.')).toEqual([])
  })

  it('allows naming a test in page copy (the not-affiliated notice is checked per page)', () => {
    expect(lintText('CELPIP writing practice')).toEqual([])
  })

  it('checks Korean terms', () => {
    expect(lintText('공식 점수를 보장합니다')).toEqual(expect.arrayContaining(['ko_official', 'ko_score', 'ko_guarantee']))
  })
})

describe('htmlToText', () => {
  it('drops scripts, styles and comments and decodes entities', () => {
    const { body } = htmlToText(
      '<style>.score{}</style><script>self.x="official score"</script><p>Don&#x27;t&nbsp;rush &amp; plan<!-- --> ahead</p>',
    )
    expect(body).toBe("Don't rush & plan ahead")
  })

  it('keeps words apart across block tags and sibling links', () => {
    expect(htmlToText('<p>Pricing</p><p>Help</p><a href="/">Home</a><a href="/x/">Formats</a>').body).toBe('Pricing Help Home Formats')
  })

  it('collects meta descriptions, alt text and JSON-LD strings', () => {
    const { extra } = htmlToText(
      '<meta name="description" content="Official prep"><img alt="Score chart" src="a.png"><script type="application/ld+json">{"name":"Guaranteed results"}</script>',
    )
    expect(extra).toContain('Official prep')
    expect(extra).toContain('Score chart')
    expect(extra).toContain('Guaranteed results')
  })

  it('decodes numeric and named entities', () => {
    expect(decodeEntities('&lt;b&gt; &#65;&#x42; &rsquo; &unknown;')).toBe('<b> AB ’ &unknown;')
  })
})

describe('lintHtml', () => {
  it('fails a page claiming an "official CLB score"', () => {
    const rules = lintHtml(page('<h1>Get an <strong>official CLB score</strong> in minutes</h1>')).map((f) => f.rule)
    expect(rules).toEqual(expect.arrayContaining(['official', 'clb', 'score']))
  })

  it('passes a clean page that names a test with the not-affiliated notice', () => {
    const html = page(
      `<h1>Writing and speaking practice</h1><p>Tasks follow the formats of Canadian general English tests such as CELPIP.</p><aside>${AI_DISCLOSURE.en}</aside>`,
      '<title>Practice | Maple Practice Coach</title><meta name="description" content="Timed practice with feedback">',
    )
    expect(lintHtml(html)).toEqual([])
  })

  it('still matches the notice when inline tags split it', () => {
    const [first, ...rest] = NOT_AFFILIATED.en.split(' ')
    const html = `<html><body><p>Like IELTS practice.</p><footer><p><strong>${first}</strong> ${rest.join(' ')}</p></footer></body></html>`
    expect(lintHtml(html)).toEqual([])
  })

  it('requires the notice on pages that name CELPIP or IELTS', () => {
    const html = '<html><body><p>Practice for CELPIP writing.</p></body></html>'
    expect(lintHtml(html).map((f) => f.rule)).toEqual(['trademark_without_notice'])
  })

  it('checks meta tags and JSON-LD, not only visible text', () => {
    const html = page('<p>Practice</p>', '<meta property="og:title" content="Guaranteed band 9">')
    expect(lintHtml(html).map((f) => f.rule)).toEqual(expect.arrayContaining(['guarantee', 'band']))
  })
})

describe('addressPlaceholderFindings (--require-address, decision 16)', () => {
  it('fails a page that still shows the mailing-address placeholder, even split by inline tags', () => {
    const html = page(`<p>Mailing address: Maple Practice Coach, <span>${MAILING_ADDRESS_PLACEHOLDER}</span></p>`)
    expect(addressPlaceholderFindings(html).map((f) => [f.rule, f.excerpt])).toEqual([['mailing_address_placeholder', MAILING_ADDRESS_PLACEHOLDER]])
    const [first, ...rest] = MAILING_ADDRESS_PLACEHOLDER.split(' ')
    expect(addressPlaceholderFindings(page(`<p><strong>${first}</strong> ${rest.join(' ')}</p>`))).toHaveLength(1)
  })

  it('fails the Worker placeholder and the old consent fallback wording, in text and attributes', () => {
    expect(addressPlaceholderFindings(page('<p>Maple Practice Coach, SET-BEFORE-LAUNCH (CASL: owner mailing address)</p>'))).toHaveLength(1)
    expect(addressPlaceholderFindings(page('<label>…from Maple Practice Coach, mailing address on our Privacy page, .</label>'))).toHaveLength(1)
    expect(addressPlaceholderFindings(page('<input aria-label="개인정보 처리방침 페이지의 우편 주소">'))).toHaveLength(1)
    expect(ADDRESS_PLACEHOLDERS).toContain(MAILING_ADDRESS_PLACEHOLDER)
  })

  it('passes a page with a real address', () => {
    expect(addressPlaceholderFindings(page('<p>Mailing address: Maple Practice Coach, 1 Test St, Toronto ON M5V 0A1</p>'))).toEqual([])
  })

  it('requires the set address on the privacy page, never printing it (Z5)', () => {
    const address = '1 Test St,\n  Toronto ON  M5V 0A1'
    const shown = page('<p>Mailing address: Jiwoo Kim (Maple Practice Coach), 1 Test St, Toronto ON M5V 0A1</p>')
    expect(ADDRESS_PAGE).toBe('legal/privacy/index.html')
    expect(addressShownFindings(shown, address)).toEqual([])
    const missing = addressShownFindings(page('<p>Use the support form on your account page.</p>'), address)
    expect(missing.map((f) => f.rule)).toEqual(['mailing_address_missing'])
    expect(JSON.stringify(missing)).not.toContain('Test St')
    expect(addressShownFindings(null, address).map((f) => f.rule)).toEqual(['mailing_address_page_missing'])
    // no address set: nothing to require
    expect(addressShownFindings(null, '  ')).toEqual([])
  })
})

describe('legalNameFindings (--require-legal-name, memo §7.2 Z5)', () => {
  const name = 'Jiwoo O\u2019Brien-Kim'
  const sold = (n: string) => page(`<p>Maple Practice Coach is sold by <strong>${n}</strong>, a sole proprietor in Ontario.</p>`)

  it('passes when the terms and privacy pages both name the seller, entities and inline tags included', () => {
    const html = sold('Jiwoo O&rsquo;Brien-Kim')
    expect(legalNameFindings({ 'legal/terms/index.html': html, 'legal/privacy/index.html': html }, name)).toEqual([])
    expect(legalNameFindings({ 'legal/terms/index.html': html, 'legal/privacy/index.html': html }, `  ${name}\n`)).toEqual([])
    expect(LEGAL_NAME_PAGES).toEqual(['legal/terms/index.html', 'legal/privacy/index.html'])
  })

  it('fails a page without the name, a missing page and an empty name, never printing the name', () => {
    const found = legalNameFindings({ 'legal/terms/index.html': sold(name), 'legal/privacy/index.html': page('<p>Privacy</p>') }, name)
    expect(found.map((f) => [f.rule, f.where])).toEqual([['legal_name_missing', 'legal/privacy/index.html']])
    expect(JSON.stringify(found)).not.toContain('Jiwoo')
    // text only in an attribute or a script does not count as shown
    const hidden = page(`<p title="${name}">Terms</p><script>var n="${name}"</script>`)
    expect(legalNameFindings({ 'legal/terms/index.html': hidden, 'legal/privacy/index.html': sold(name) }, name).map((f) => f.where)).toEqual(['legal/terms/index.html'])
    expect(legalNameFindings({ 'legal/terms/index.html': sold(name) }, name).map((f) => f.rule)).toEqual(['legal_name_page_missing'])
    expect(legalNameFindings({}, '  ').map((f) => f.rule)).toEqual(['legal_name_missing'])
  })
})
