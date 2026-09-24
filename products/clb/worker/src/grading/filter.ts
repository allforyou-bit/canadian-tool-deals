// Output filter (memo B3): no official/guarantee/score/band/level claims and no number presented
// as a result, in anything the grader writes. Explanation fields lose only the offending
// sentences; learner-language fields (quotes and rewrites) lose whole items, and only for the
// claim ids that cannot be ordinary English ("sea level" in a rewrite is fine).
import type { GradeResult, Lang } from '../../../shared/api'
import { FORBIDDEN_CLAIMS, findClaims } from '../../../shared/content-rules'
import { FIELD_FALLBACK, SCOPE_REFUSAL } from './copy'

const LEARNER_FIELD_RULE_IDS = ['clb', 'band', 'score', 'numeric_result', 'official', 'guarantee']
const LEARNER_FIELD_RULES = FORBIDDEN_CLAIMS.filter((r) => LEARNER_FIELD_RULE_IDS.includes(r.id))

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
  const kept = sentences.filter((s) => findClaims(s).length === 0)
  const joined = kept.join(' ')
  return { text: joined === '' ? fallback : joined, removed: sentences.length - kept.length }
}

function learnerFieldBlocked(text: string): boolean {
  return findClaims(text, LEARNER_FIELD_RULES).length > 0
}

/**
 * Remove forbidden claims from a GradeResult. `removed` counts dropped sentences plus dropped
 * items. Empty explanation fields get a safe fallback in the explanation language.
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
    const refusalMessage = clean(result.refusalMessage ?? '', SCOPE_REFUSAL[lang])
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
