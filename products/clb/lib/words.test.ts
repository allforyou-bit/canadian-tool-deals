import { describe, expect, it } from 'vitest'
import { countWords, wordStatus } from './words'

describe('countWords', () => {
  it('counts nothing in empty or blank text', () => {
    expect(countWords('')).toBe(0)
    expect(countWords('   \n\t ')).toBe(0)
  })

  it('splits on any whitespace, including new lines', () => {
    expect(countWords('Dear neighbour,\n\nI hope you are well.')).toBe(7)
  })

  it('counts contractions, hyphenated words and numbers once', () => {
    expect(countWords("I don't park on the well-known 3.5 metre strip")).toBe(9)
  })

  it('ignores stray punctuation tokens', () => {
    expect(countWords('First point - second point — end .')).toBe(5)
  })

  it('counts non-Latin letters as words', () => {
    expect(countWords('café naïve 안녕하세요')).toBe(3)
  })
})

describe('wordStatus', () => {
  it('reports empty, under, in range and over', () => {
    expect(wordStatus(0, 150, 200)).toEqual({ state: 'empty' })
    expect(wordStatus(120, 150, 200)).toEqual({ state: 'under', diff: 30 })
    expect(wordStatus(150, 150, 200)).toEqual({ state: 'in' })
    expect(wordStatus(200, 150, 200)).toEqual({ state: 'in' })
    expect(wordStatus(214, 150, 200)).toEqual({ state: 'over', diff: 14 })
  })

  it('treats a missing bound as open', () => {
    expect(wordStatus(10)).toEqual({ state: 'in' })
  })
})
