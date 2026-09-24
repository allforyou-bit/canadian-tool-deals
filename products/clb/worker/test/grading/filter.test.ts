import { describe, expect, it } from 'vitest'
import type { GradeResult, Lang } from '../../../shared/api'
import { FORBIDDEN_CLAIMS, findClaims, GRADER_LEARNER_TEXT_RULES, GRADER_OUTPUT_RULES } from '../../../shared/content-rules'
import { FIELD_FALLBACK, SAFETY_REFUSAL, SCOPE_REFUSAL } from '../../src/grading/copy'
import { filterResult, splitSentences } from '../../src/grading/filter'
import { validateGradeJson } from '../../src/grading/validate'
import { golden, graderOutput, probes, themed } from './helpers'

/** One sentence per GRADER_OUTPUT_RULES id that breaks exactly that rule. */
const SAMPLES: Record<string, { lang: Lang; sentence: string }> = {
  official: { lang: 'en', sentence: 'This is how official examiners would read it.' },
  guarantee: { lang: 'en', sentence: 'These changes guarantee a better result.' },
  clb: { lang: 'en', sentence: 'This reads like CLB 7 writing.' },
  band: { lang: 'en', sentence: 'This is a strong band answer.' },
  level: { lang: 'en', sentence: 'Your vocabulary is at a high level.' },
  score: { lang: 'en', sentence: 'You would score well with this email.' },
  accurate: { lang: 'en', sentence: 'Your grammar is accurate.' },
  aligned: { lang: 'en', sentence: 'The structure is aligned with the rubric.' },
  numeric_result: { lang: 'en', sentence: 'I would rate this 8/10.' },
  ko_official: { lang: 'ko', sentence: '공식 기준으로 보면 좋은 답안이에요.' },
  ko_guarantee: { lang: 'ko', sentence: '이렇게 쓰면 좋은 결과가 보장돼요.' },
  ko_score: { lang: 'ko', sentence: '점수가 높게 나올 거예요.' },
  ko_band_level: { lang: 'ko', sentence: '레벨이 높은 글이에요.' },
  percent: { lang: 'en', sentence: 'Overall this is 85% of the way there.' },
  stars: { lang: 'en', sentence: 'I would give it 4 stars.' },
  test_result: { lang: 'en', sentence: 'This is IELTS 6.5 writing.' },
  cefr: { lang: 'en', sentence: 'Compare your answer with the CEFR descriptors.' },
  cefr_level: { lang: 'en', sentence: 'This reads like solid B2 writing.' },
  pass_fail: { lang: 'en', sentence: 'You will pass the test with this.' },
  ko_points: { lang: 'ko', sentence: '10점 만점에 8점이에요.' },
  ko_level: { lang: 'ko', sentence: '이 글은 중급 수준이에요.' },
  ko_pass: { lang: 'ko', sentence: '이 정도면 시험에 합격할 수 있어요.' },
}

const findGrader = (t: string) => findClaims(t, GRADER_OUTPUT_RULES)

const CLEAN = { en: 'Your opening is clear.', ko: '첫 문장이 분명해요.' }

function base(lang: Lang, overrides: Partial<GradeResult> = {}): GradeResult {
  return {
    refused: false,
    criteria: [{ name: lang === 'en' ? 'Content and task completion' : '내용과 과제 수행', strengths: CLEAN[lang], improve: CLEAN[lang] }],
    topErrors: [{ kind: 'grammar', original: 'I goes', correction: 'I go', why: CLEAN[lang] }],
    rewrites: ['I go to work at seven.'],
    nextStep: CLEAN[lang],
    explanationLang: lang,
    bandShown: false,
    ...overrides,
  }
}

function explanationTexts(r: GradeResult): string[] {
  return [r.refusalMessage ?? '', r.nextStep, ...r.criteria.flatMap((c) => [c.name, c.strengths, c.improve]), ...r.topErrors.map((e) => e.why)]
}

describe('filterResult: explanation fields', () => {
  it('has a sample for every GRADER_OUTPUT_RULES rule, and each sample breaks exactly that rule', () => {
    expect(Object.keys(SAMPLES).sort()).toEqual(GRADER_OUTPUT_RULES.map((r) => r.id).sort())
    for (const [id, s] of Object.entries(SAMPLES)) expect(findGrader(s.sentence), s.sentence).toEqual([id])
  })

  it('covers every page rule (FORBIDDEN_CLAIMS) by id', () => {
    const ids = GRADER_OUTPUT_RULES.map((r) => r.id)
    for (const r of FORBIDDEN_CLAIMS) expect(ids).toContain(r.id)
  })

  it('catches the numeric ratings and level or pass claims the page rules miss', () => {
    const claims = [
      'I would rate this 8/10.',
      'This answer is about 7 out of 10.',
      'I would give it 4 stars.',
      'This is a five-star answer.',
      'Overall this is 85% of the way there.',
      'This is roughly a CELPIP 9 response.',
      'This is IELTS 6.5 writing.',
      'This reads like B2 on the CEFR.',
      'You will pass the test with this.',
      'You would fail the exam with this ending.',
      '10점 만점에 8점이에요.',
      '이 글은 중급 수준이에요.',
      '이 정도면 시험에 합격할 수 있어요.',
      '이대로면 불합격할 수도 있어요.',
      'CELPIP 9 정도의 답안이에요.',
    ]
    for (const c of claims) expect(findGrader(c), c).not.toEqual([])
  })

  it('keeps ordinary register and content feedback', () => {
    const ok = [
      '너무 비공식적인 표현이에요.',
      '격식 있는 표현을 써 보세요.',
      '장점은 예시가 구체적이라는 점이에요.',
      'Your email covers all 3 points in the prompt.',
      'Use July 12 instead of a number-only date.',
      'You passed the salt in your story, which is a nice detail.',
    ]
    for (const t of ok) expect(findGrader(t), t).toEqual([])
  })

  const fields = ['name', 'strengths', 'improve', 'why', 'nextStep'] as const
  for (const [id, { lang, sentence }] of Object.entries(SAMPLES)) {
    for (const field of fields) {
      it(`strips a "${id}" sentence from ${field} and keeps clean sentences`, () => {
        const text = `${CLEAN[lang]} ${sentence}`
        const r = base(lang)
        if (field === 'why') r.topErrors[0].why = text
        else if (field === 'nextStep') r.nextStep = text
        else r.criteria[0][field] = text
        const { result, removed } = filterResult(r)
        expect(removed).toBe(1)
        for (const t of explanationTexts(result)) expect(findGrader(t)).toEqual([])
        const after = field === 'why' ? result.topErrors[0].why : field === 'nextStep' ? result.nextStep : result.criteria[0][field]
        expect(after).toBe(CLEAN[lang])
      })
    }
  }

  it('gives an emptied field a safe fallback in the explanation language', () => {
    const r = base('ko')
    r.criteria[0].improve = SAMPLES.ko_score.sentence
    r.nextStep = SAMPLES.ko_band_level.sentence
    const { result } = filterResult(r)
    expect(result.criteria[0].improve).toBe(FIELD_FALLBACK.improve.ko)
    expect(result.nextStep).toBe(FIELD_FALLBACK.nextStep.ko)
  })

  it('removes numeric results in either form, on any common scale', () => {
    const r = base('en', { nextStep: 'I would give this 9 out of 12. Keep practising linking words.' })
    r.criteria[0].strengths = 'Overall 7/12. Your greeting is friendly.'
    const { result, removed } = filterResult(r)
    expect(removed).toBe(2)
    expect(result.nextStep).toBe('Keep practising linking words.')
    expect(result.criteria[0].strengths).toBe('Your greeting is friendly.')
  })

  it('keeps 비공식 ("informal") register feedback but strips 공식 claims', () => {
    const r = base('ko', { nextStep: '너무 비공식적인 표현이에요. 공식 기준으로는 좋아요.' })
    const { result, removed } = filterResult(r)
    expect(removed).toBe(1)
    expect(result.nextStep).toBe('너무 비공식적인 표현이에요.')
  })

  it('keeps sentences that use an allowed disclaimer verbatim', () => {
    const r = base('en', { nextStep: 'Feedback is not a score and does not predict test results. Keep going.' })
    expect(filterResult(r)).toMatchObject({ removed: 0, result: { nextStep: 'Feedback is not a score and does not predict test results. Keep going.' } })
  })
})

describe('filterResult: refusals (fixed copy only)', () => {
  for (const lang of ['en', 'ko'] as const) {
    it(`replaces any model-written refusal text with SCOPE_REFUSAL (${lang})`, () => {
      const refused = { ...base(lang), refused: true, criteria: [], topErrors: [], rewrites: [], nextStep: '' }
      for (const refusalMessage of ['You need a CRS score of 470 for Express Entry.', 'Please ask a lawyer.', '', undefined]) {
        const { result } = filterResult({ ...refused, refusalMessage })
        expect(result.refusalMessage).toBe(SCOPE_REFUSAL[lang])
      }
    })

    it(`keeps SAFETY_REFUSAL for a safety stop (${lang})`, () => {
      const { result } = filterResult({ ...base(lang), refused: true, refusalMessage: SAFETY_REFUSAL[lang], criteria: [], topErrors: [], rewrites: [], nextStep: '' })
      expect(result).toMatchObject({ refusalMessage: SAFETY_REFUSAL[lang], criteria: [], topErrors: [], rewrites: [], nextStep: '' })
    })
  }
})

describe('filterResult: learner-language fields', () => {
  it('keeps ordinary English such as "sea level", "accurate" and "aligned" in rewrites and quotes', () => {
    const r = base('en', {
      rewrites: ['Our town is only ten metres above sea level.', 'The shelves were neatly aligned and the labels were accurate.'],
      topErrors: [{ kind: 'vocabulary', original: 'the water level are high', correction: 'the water level is high', why: CLEAN.en }],
    })
    const { result, removed } = filterResult(r)
    expect(removed).toBe(0)
    expect(result.rewrites).toEqual(r.rewrites)
    expect(result.topErrors).toHaveLength(1)
  })

  it('keeps ordinary uses of guarantee, official, score, band and dates (review R6)', () => {
    const r = base('en', {
      topErrors: [
        { kind: 'grammar', original: 'the centre guarantee that the course will finish', correction: 'the centre guaranteed that the course would finish', why: CLEAN.en },
        { kind: 'vocabulary', original: 'the official of the centre', correction: 'the manager of the centre', why: CLEAN.en },
        { kind: 'grammar', original: 'our team score two goals', correction: 'our team scored two goals', why: CLEAN.en },
      ],
      rewrites: ['The website guaranteed that the course would run until 7/12.', 'I play guitar in a small band on weekends.'],
    })
    const { result, removed } = filterResult(r)
    expect(removed).toBe(0)
    expect(result.topErrors).toHaveLength(3)
    expect(result.rewrites).toEqual(r.rewrites)
  })

  /** One learner-field sentence per GRADER_LEARNER_TEXT_RULES id. */
  const LEARNER_SAMPLES: Record<string, string> = {
    clb: 'I reached CLB 7 last spring.',
    test_result: 'My goal is IELTS 7 by June.',
    band_number: 'I am aiming for band 9.',
    rating_12: 'This answer is 9 out of 12.',
  }

  it('has a learner-field sample for every GRADER_LEARNER_TEXT_RULES rule', () => {
    expect(Object.keys(LEARNER_SAMPLES).sort()).toEqual(GRADER_LEARNER_TEXT_RULES.map((r) => r.id).sort())
    for (const [id, s] of Object.entries(LEARNER_SAMPLES)) expect(findClaims(s, GRADER_LEARNER_TEXT_RULES), s).toEqual([id])
  })

  for (const [id, sentence] of Object.entries(LEARNER_SAMPLES)) {
    it(`drops a rewrite and an error item that contain "${id}" claims`, () => {
      const r = base('en', {
        rewrites: [sentence, 'I go to work at seven.'],
        topErrors: [
          { kind: 'grammar', original: sentence, correction: 'x', why: CLEAN.en },
          { kind: 'grammar', original: 'I goes', correction: 'I go', why: CLEAN.en },
        ],
      })
      const { result, removed } = filterResult(r)
      expect(removed).toBe(2)
      expect(result.rewrites).toEqual(['I go to work at seven.'])
      expect(result.topErrors.map((e) => e.original)).toEqual(['I goes'])
    })
  }
})

describe('fixed copy', () => {
  it('passes findClaims in both languages', () => {
    const texts = [SCOPE_REFUSAL, SAFETY_REFUSAL, ...Object.values(FIELD_FALLBACK)].flatMap((b) => [b.en, b.ko])
    for (const t of texts) expect([findClaims(t), findGrader(t)]).toEqual([[], []])
  })
})

describe('golden fixtures', () => {
  it('pass through the filter unchanged', () => {
    for (const f of [...golden, ...themed, ...probes]) {
      const parsed = validateGradeJson(graderOutput(f), f.explanationLang)
      const { result, removed } = filterResult(parsed)
      expect(removed, f.id).toBe(0)
      expect(result.criteria, f.id).toEqual(parsed.criteria)
    }
  })
})

describe('splitSentences', () => {
  it('splits on sentence punctuation and line breaks', () => {
    expect(splitSentences('One. Two? Three!\nFour 좋아요. 다섯이에요.')).toEqual(['One.', 'Two?', 'Three!', 'Four 좋아요.', '다섯이에요.'])
  })
})
