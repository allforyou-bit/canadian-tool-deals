// Live word counter for the writing tasks.

/**
 * Words are whitespace-separated tokens that contain at least one letter or digit, so
 * "don't", "well-known" and "3.5" count once and a lone dash or bullet does not count.
 */
export function countWords(text: string): number {
  let n = 0
  for (const token of text.split(/\s+/)) if (/[\p{L}\p{N}]/u.test(token)) n++
  return n
}

export type WordStatus = { state: 'empty' } | { state: 'under' | 'over'; diff: number } | { state: 'in' }

/** Where a count sits against the task's target range. */
export function wordStatus(count: number, min?: number, max?: number): WordStatus {
  if (count === 0) return { state: 'empty' }
  if (min !== undefined && count < min) return { state: 'under', diff: min - count }
  if (max !== undefined && count > max) return { state: 'over', diff: count - max }
  return { state: 'in' }
}
