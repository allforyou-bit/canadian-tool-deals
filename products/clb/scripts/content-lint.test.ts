import { describe, expect, it } from 'vitest'
import adsCsv from '../../../ops/ads/google.csv?raw'
import { AI_DISCLOSURE, NOT_AFFILIATED } from '../shared/config'
import { decodeEntities, htmlToText, lintAdsCsv, lintHtml, lintText } from './content-lint'

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

  it('applies the trademark rules to ads only', () => {
    expect(lintText('CELPIP writing practice')).toEqual([])
    expect(lintText('CELPIP writing practice', { ads: true })).toEqual(['celpip'])
    expect(lintText('IELTS tips', { ads: true })).toEqual(['ielts'])
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

describe('lintAdsCsv', () => {
  const header = 'type,ad_group,match_type,text\n'
  const group = (name: string) =>
    [
      `keyword,${name},phrase,english writing practice test canada`,
      `headline,${name},,Timed Writing Practice`,
      `headline,${name},,Feedback on Every Sentence`,
      `headline,${name},,Practise Emails in English`,
      `description,${name},,Write under a timer and get feedback on content and grammar.`,
      `description,${name},,Explanations in English or Korean. One-time passes.`,
      `final_url,${name},,https://coach.example/practice/writing/email/`,
    ].join('\n')

  it('passes a complete, clean ad group', () => {
    expect(lintAdsCsv(`${header}${group('Writing email')}\nnegative,,phrase,free\n`)).toEqual([])
  })

  it('fails claims, trademarks, lengths and structure', () => {
    const csv = `${header}${group('G')}\nheadline,G,,Official CLB Score Guaranteed\nheadline,G,,This headline is far too long to fit\ndescription,G,,${'x'.repeat(91)}\nnegative,,phrase,celpip answers\nkeyword,G,broad,english test\nfoo,G,,bar\n`
    const rules = lintAdsCsv(csv).map((f) => f.rule)
    expect(rules).toEqual(
      expect.arrayContaining(['official', 'clb', 'score', 'guarantee', 'headline_too_long', 'description_too_long', 'celpip', 'match_type', 'unknown_type']),
    )
  })

  it('reports incomplete ad groups and a wrong header', () => {
    expect(lintAdsCsv(`${header}keyword,Solo,exact,english speaking practice\n`).map((f) => f.rule)).toEqual(['ad_group_incomplete'])
    expect(lintAdsCsv('kind,text\nheadline,x\n').map((f) => f.rule)).toEqual(['csv_header'])
  })

  it('passes the committed ops/ads/google.csv', () => {
    expect(lintAdsCsv(adsCsv)).toEqual([])
  })
})
