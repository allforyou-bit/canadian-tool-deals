import { describe, expect, it } from 'vitest'
import type { GradeResult, Lang } from '../../../shared/api'
import { FORBIDDEN_CLAIMS, findClaims } from '../../../shared/content-rules'
import { FIELD_FALLBACK, SAFETY_REFUSAL, SCOPE_REFUSAL } from '../../src/grading/copy'
import { filterResult, splitSentences } from '../../src/grading/filter'
import { validateGradeJson } from '../../src/grading/validate'
import { golden, graderOutput, probes, themed } from './helpers'

/** One sentence per rule id that breaks exactly that rule. */
const SAMPLES: Record<string, { lang: Lang; sentence: string }> = {
  official: { lang: 'en', sentence: 'This is how official examiners would read it.' },
  guarantee: { lang: 'en', sentence: 'These changes guarantee a better result.' },
  clb: { lang: 'en', sentence: 'This reads like CLB 7 writing.' },
  band: { lang: 'en', sentence: 'This is a strong band answer.' },
  level: { lang: 'en', sentence: 'Your vocabulary is at a high level.' },
  score: { lang: 'en', sentence: 'You would score well with this email.' },
  accurate: { lang: 'en', sentence: 'Your grammar is accurate.' },
  aligned: { lang: 'en', sentence: 'The structure is aligned with the rubric.' },
  numeric_result: { lang: 'en', sentence: 'I would give this 9/12.' },
  ko_official: { lang: 'ko', sentence: '공식 기준으로 보면 좋은 답안이에요.' },
  ko_guarantee: { lang: 'ko', sentence: '이렇게 쓰면 합격이 보장돼요.' },
  ko_score: { lang: 'ko', sentence: '점수가 높게 나올 거예요.' },
  ko_band_level: { lang: 'ko', sentence: '레벨이 높은 글이에요.' },
}

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
  it('has a sample for every FORBIDDEN_CLAIMS rule, and each sample breaks exactly that rule', () => {
    expect(Object.keys(SAMPLES).sort()).toEqual(FORBIDDEN_CLAIMS.map((r) => r.id).sort())
    for (const [id, s] of Object.entries(SAMPLES)) expect(findClaims(s.sentence)).toEqual([id])
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
        for (const t of explanationTexts(result)) expect(findClaims(t)).toEqual([])
        const after = field === 'why' ? result.topErrors[0].why : field === 'nextStep' ? result.nextStep : result.criteria[0][field]
        expect(after).toBe(CLEAN[lang])
      })
    }
    it(`strips a "${id}" sentence from a refusal message and falls back when emptied`, () => {
      const { result, removed } = filterResult({ ...base(lang), refused: true, refusalMessage: sentence, criteria: [], topErrors: [], rewrites: [], nextStep: '' })
      expect(removed).toBe(1)
      expect(result.refusalMessage).toBe(SCOPE_REFUSAL[lang])
    })
  }

  it('gives an emptied field a safe fallback in the explanation language', () => {
    const r = base('ko')
    r.criteria[0].improve = SAMPLES.ko_score.sentence
    r.nextStep = SAMPLES.ko_band_level.sentence
    const { result } = filterResult(r)
    expect(result.criteria[0].improve).toBe(FIELD_FALLBACK.improve.ko)
    expect(result.nextStep).toBe(FIELD_FALLBACK.nextStep.ko)
  })

  it('removes numeric results in either form', () => {
    const r = base('en', { nextStep: 'I would give this 9 out of 12. Keep practising linking words.' })
    r.criteria[0].strengths = 'Overall 7/12. Your greeting is friendly.'
    const { result, removed } = filterResult(r)
    expect(removed).toBe(2)
    expect(result.nextStep).toBe('Keep practising linking words.')
    expect(result.criteria[0].strengths).toBe('Your greeting is friendly.')
  })

  it('keeps sentences that use an allowed disclaimer verbatim', () => {
    const r = base('en', { nextStep: 'Feedback is not a score and does not predict test results. Keep going.' })
    expect(filterResult(r)).toMatchObject({ removed: 0, result: { nextStep: 'Feedback is not a score and does not predict test results. Keep going.' } })
  })
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

  const blockedIds = ['clb', 'band', 'score', 'numeric_result', 'official', 'guarantee']
  for (const id of blockedIds) {
    it(`drops a rewrite and an error item that contain "${id}" claims`, () => {
      const sentence = SAMPLES[id].sentence
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
    for (const t of texts) expect(findClaims(t)).toEqual([])
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
