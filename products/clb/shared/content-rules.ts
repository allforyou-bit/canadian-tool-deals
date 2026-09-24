// Claim rules shared by the grader's output filter (worker/src/grading), the page/ads content lint
// (scripts/content-lint.ts) and the eval harness. Source: memo §1.4, B3, B9, B13 (Competition Act
// s.74.01 risk: no official/guarantee/score claims; trademarks only descriptively).
import { AI_DISCLOSURE, NOT_AFFILIATED } from './config'

export interface ClaimRule {
  id: string
  /** case-insensitive; matched against text with ALLOWED_PHRASES removed first */
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
