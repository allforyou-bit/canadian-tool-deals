// Claim rules shared by the grader's output filter (worker/src/grading), the page/ads content lint
// (scripts/content-lint.ts) and the eval harness. Source: memo §1.4, B3, B9, B13 (Competition Act
// s.74.01 risk: no official/guarantee/score claims; trademarks only descriptively).
import { AI_DISCLOSURE, NOT_AFFILIATED } from './config'

export interface ClaimRule {
  id: string
  /** matched against text with ALLOWED_PHRASES removed first; case-insensitive unless noted */
  pattern: RegExp
}

/** Forbidden in grader explanations, pages and ads. */
export const FORBIDDEN_CLAIMS: ClaimRule[] = [
  { id: 'official', pattern: /\bofficial(ly)?\b/i },
  { id: 'guarantee', pattern: /\bguarantee(s|d)?\b/i },
  { id: 'clb', pattern: /\bCLB\b/i },
  { id: 'band', pattern: /\bband\b/i },
  { id: 'level', pattern: /\blevel\b/i },
  { id: 'score', pattern: /\bscor(e|es|ed|ing)\b/i },
  { id: 'accurate', pattern: /\baccura(te|tely|cy)\b/i },
  { id: 'aligned', pattern: /\baligned\b/i },
  // a number presented as a result, e.g. "7/12", "9 out of 12"
  { id: 'numeric_result', pattern: /\b\d{1,2}\s*(\/|out of)\s*12\b/i },
  { id: 'ko_official', pattern: /공식/ },
  { id: 'ko_guarantee', pattern: /보장/ },
  { id: 'ko_score', pattern: /점수/ },
  { id: 'ko_band_level', pattern: /밴드|레벨|등급/ },
]

/**
 * Grader explanation fields (criteria, why, nextStep): FORBIDDEN_CLAIMS plus every other way a model
 * can present a result or a level (memo B3: "any number presented as a result"; memo §0: never
 * predicts a score or level). Two rules differ from the page list: `numeric_result` covers the
 * usual rating scales, not only "/12", and `ko_official` lets 비공식(적) ("informal") through, which
 * is ordinary register feedback. A date such as "7/12" still matches `numeric_result`; the prompt asks
 * for dates in words. Patterns without the `i` flag are case-sensitive on purpose.
 */
const GRADER_OVERRIDES: Record<string, RegExp> = {
  // "8/10", "7 out of 10", "9/12", "85 out of 100", "4.5/5"
  numeric_result: /\b\d{1,3}(\.\d+)?\s*(\/|out of)\s*(4|5|6|9|10|12|100)\b/i,
  ko_official: /(?<!비)공식/,
}

export const GRADER_OUTPUT_RULES: ClaimRule[] = [
  ...FORBIDDEN_CLAIMS.map((r) => (GRADER_OVERRIDES[r.id] ? { id: r.id, pattern: GRADER_OVERRIDES[r.id] } : r)),
  { id: 'percent', pattern: /\d\s*(%|percent\b|per cent\b)/i },
  { id: 'stars', pattern: /\b(\d(\.\d)?|one|two|three|four|five)[\s-]*stars?\b/i },
  // a test name followed by a number: "CELPIP 9", "IELTS 6.5" (CLB is blocked on its own)
  { id: 'test_result', pattern: /\b(CELPIP|IELTS|CEFR)\b[^.!?\n]{0,20}?\d/i },
  { id: 'cefr', pattern: /\bCEFR\b/i },
  // CEFR levels A1–C2 (upper case only, so "a1" or "b2b" in ordinary text is not caught)
  { id: 'cefr_level', pattern: /\b[ABC][12]\b/ },
  { id: 'pass_fail', pattern: /\b(pass|fail)(es|s|ed|ing)?\b[^.!?\n]{0,30}?\b(test|exam)s?\b/i },
  // "8점", "10점 만점" (a digit before 점; 장점/단점/관점 are ordinary words)
  { id: 'ko_points', pattern: /\d\s*점|만점/ },
  { id: 'ko_level', pattern: /수준/ },
  // 합격 also covers 불합격
  { id: 'ko_pass', pattern: /합격/ },
]

/**
 * Grader learner-language fields (the quoted original, the correction and rewrites): English the
 * learner wrote or could write, so only claim-shaped text is blocked. "guarantee", "official",
 * "score", "level" or "band" alone are ordinary English ("I play guitar in a small band").
 */
export const GRADER_LEARNER_TEXT_RULES: ClaimRule[] = [
  { id: 'clb', pattern: /\bCLB\b/i },
  { id: 'test_result', pattern: /\b(CELPIP|IELTS|CEFR)\b[^.!?\n]{0,20}?\d/i },
  { id: 'band_number', pattern: /\bband\s*\d/i },
  // "9 out of 12" (the slash form is left alone: "7/12" is also a date)
  { id: 'rating_12', pattern: /\b\d{1,2}(\.\d)?\s*out of\s*12\b/i },
]

/** Additionally forbidden in ad text (memo B13): no test trademarks in ads at all. */
export const AD_ONLY_FORBIDDEN: ClaimRule[] = [
  { id: 'celpip', pattern: /\bCELPIP\b/i },
  { id: 'ielts', pattern: /\bIELTS\b/i },
]

/**
 * Exact sentences that may contain otherwise-forbidden words because they deny a claim.
 * Pages and emails must use these verbatim; any other wording must avoid the forbidden words.
 */
export const ALLOWED_PHRASES: string[] = [
  NOT_AFFILIATED.en,
  NOT_AFFILIATED.ko,
  AI_DISCLOSURE.en,
  AI_DISCLOSURE.ko,
  'We do not guarantee any test result.',
  '어떠한 시험 결과도 보장하지 않습니다.',
  'Feedback is not a score and does not predict test results.',
  '피드백은 점수가 아니며 시험 결과를 예측하지 않습니다.',
]

/** Returns the ids of every rule the text breaks (after removing allowed phrases). */
export function findClaims(text: string, rules: ClaimRule[] = FORBIDDEN_CLAIMS): string[] {
  let t = text
  for (const p of ALLOWED_PHRASES) t = t.split(p).join(' ')
  return rules.filter((r) => r.pattern.test(t)).map((r) => r.id)
}
