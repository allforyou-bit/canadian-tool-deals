// Output filter (memo B3): no official/guarantee/score/band/level claims and no number presented
// as a result, in anything the grader writes. Explanation fields lose only the offending
// sentences (GRADER_OUTPUT_RULES); learner-language fields (quotes and rewrites) lose whole items,
// and only for claim-shaped text (GRADER_LEARNER_TEXT_RULES: "sea level" or "a small band" in a
// rewrite is fine). Refusals always show fixed copy, never model-written text (decision 3).
import type { GradeResult, Lang } from '../../../shared/api'
import { findClaims, GRADER_LEARNER_TEXT_RULES, GRADER_OUTPUT_RULES } from '../../../shared/content-rules'
import { FIELD_FALLBACK, SAFETY_REFUSAL, SCOPE_REFUSAL } from './copy'

/** Split on sentence-ending punctuation followed by space, or on line breaks. */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?。])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s !== '')
}

interface Cleaned {
  text: string
  removed: number
}

function cleanExplanation(text: string, fallback: string): Cleaned {
  const sentences = splitSentences(text)
  const kept = sentences.filter((s) => findClaims(s, GRADER_OUTPUT_RULES).length === 0)
  const joined = kept.join(' ')
  return { text: joined === '' ? fallback : joined, removed: sentences.length - kept.length }
}

function learnerFieldBlocked(text: string): boolean {
  return findClaims(text, GRADER_LEARNER_TEXT_RULES).length > 0
}

/**
 * Remove forbidden claims from a GradeResult. `removed` counts dropped sentences plus dropped
 * items. Empty explanation fields get a safe fallback in the explanation language. A refused result
 * gets SAFETY_REFUSAL when it came from the API's safety stop (parseGraderMessage sets that copy),
 * otherwise the fixed SCOPE_REFUSAL, whatever text the result carried.
 */
export function filterResult(result: GradeResult): { result: GradeResult; removed: number } {
  const lang: Lang = result.explanationLang
  let removed = 0
  const clean = (text: string, fallback: string): string => {
    const c = cleanExplanation(text, fallback)
    removed += c.removed
    return c.text
  }

  if (result.refused) {
    const refusalMessage = result.refusalMessage === SAFETY_REFUSAL[lang] ? SAFETY_REFUSAL[lang] : SCOPE_REFUSAL[lang]
    return { result: { ...result, refusalMessage, criteria: [], topErrors: [], rewrites: [], nextStep: '' }, removed }
  }

  const criteria = result.criteria.map((c) => ({
    name: clean(c.name, FIELD_FALLBACK.name[lang]),
    strengths: clean(c.strengths, FIELD_FALLBACK.strengths[lang]),
    improve: clean(c.improve, FIELD_FALLBACK.improve[lang]),
  }))

  const topErrors = result.topErrors
    .filter((e) => {
      const blocked = learnerFieldBlocked(e.original) || learnerFieldBlocked(e.correction)
      if (blocked) removed++
      return !blocked
    })
    .map((e) => ({ ...e, why: clean(e.why, FIELD_FALLBACK.why[lang]) }))

  const rewrites = result.rewrites.filter((r) => {
    const blocked = learnerFieldBlocked(r)
    if (blocked) removed++
    return !blocked
  })

  const nextStep = clean(result.nextStep, FIELD_FALLBACK.nextStep[lang])
  const out: GradeResult = { ...result, criteria, topErrors, rewrites, nextStep }
  // a refusal message only belongs on refused results
  delete out.refusalMessage
  return { result: out, removed }
}
