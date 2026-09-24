// Personal-data guard for files that get committed to git (ops/metrics/*.json). Memo §4.1: user
// text, emails and identifiers never enter git. The guard is deliberately blunt: any hit fails.
// Findings name the rule and position only — never the matched text, so a log cannot leak it.
import { MODELS } from '../../shared/config'

export interface PiiFinding {
  rule: 'at_sign' | 'forbidden_word' | 'token_like'
  /** 1-based line and column of the hit */
  line: number
  column: number
  /** for forbidden_word: the word from the list (safe to print); otherwise empty */
  word: string
}

/** Field names or words that only appear when user text or contact data leaked into an export. */
export const FORBIDDEN_WORDS = ['input_text', 'transcript', 'email', 'essay'] as const

/** Identifiers that are long and mix letters and digits but are known to be safe. */
const SAFE_TOKENS = new Set(Object.keys(MODELS.prices))

/**
 * A "token-like" string: 16+ characters of [A-Za-z0-9_-] containing both a letter and a digit
 * (API keys, Stripe ids, hashes, UUIDs, card fingerprints). Plain words, snake_case keys and
 * numbers do not match.
 */
export function isTokenLike(s: string): boolean {
  return s.length >= 16 && /[A-Za-z]/.test(s) && /[0-9]/.test(s) && !SAFE_TOKENS.has(s) && !/^\d{4}-\d{2}-\d{2}/.test(s)
}

function position(text: string, index: number): { line: number; column: number } {
  const before = text.slice(0, index)
  const line = before.split('\n').length
  return { line, column: index - before.lastIndexOf('\n') }
}

export function findPersonalData(text: string): PiiFinding[] {
  const findings: PiiFinding[] = []
  for (let i = text.indexOf('@'); i >= 0; i = text.indexOf('@', i + 1)) findings.push({ rule: 'at_sign', word: '', ...position(text, i) })
  const lower = text.toLowerCase()
  for (const word of FORBIDDEN_WORDS) {
    for (let i = lower.indexOf(word); i >= 0; i = lower.indexOf(word, i + 1)) findings.push({ rule: 'forbidden_word', word, ...position(text, i) })
  }
  for (const m of text.matchAll(/[A-Za-z0-9_-]{16,}/g)) {
    if (isTokenLike(m[0])) findings.push({ rule: 'token_like', word: '', ...position(text, m.index ?? 0) })
  }
  return findings.sort((a, b) => a.line - b.line || a.column - b.column)
}

export function describeFinding(f: PiiFinding): string {
  const what = f.rule === 'forbidden_word' ? `forbidden word "${f.word}"` : f.rule === 'at_sign' ? '"@" character' : 'token-like string (16+ chars, letters and digits)'
  return `line ${f.line}, column ${f.column}: ${what}`
}
