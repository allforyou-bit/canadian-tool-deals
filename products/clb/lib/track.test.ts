import { describe, expect, it } from 'vitest'
import type { EventRequest } from '../shared/api'
import { extractUtm, isClientEvent, trackOnce, type TrackEnv } from './track'

class MemoryStorage {
  private map = new Map<string, string>()
  getItem(key: string): string | null {
    return this.map.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value)
  }
}

function env(search: string, path = '/', storage: TrackEnv['storage'] = new MemoryStorage()) {
  const sent: EventRequest[] = []
  const e: TrackEnv = { storage, search, path, send: (r) => sent.push(r) }
  return { e, sent }
}

describe('extractUtm', () => {
  it('keeps only campaign parameters and gclid', () => {
    expect(
      extractUtm('?utm_source=google&utm_medium=cpc&utm_campaign=writing&gclid=Cj0KCQ&email=a%40b.c&name=Kim&utm_id=9'),
    ).toEqual({ utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'writing', gclid: 'Cj0KCQ' })
  })

  it('drops empty values, email addresses and URLs', () => {
    expect(
      extractUtm('?utm_source=&utm_medium=%20&utm_term=me%40example.com&utm_campaign=https%3A%2F%2Fx.test%2F%3Fa%3D1&utm_content=ad-1_b'),
    ).toEqual({ utm_content: 'ad-1_b' })
  })

  it('keeps spaces and the other characters the Worker accepts', () => {
    expect(extractUtm('?utm_campaign=Fall+2026+writing.v2~a')).toEqual({ utm_campaign: 'Fall 2026 writing.v2~a' })
  })

  it('trims and caps long values', () => {
    const long = 'x'.repeat(300)
    expect(extractUtm(`?utm_campaign=%20${long}%20`).utm_campaign).toHaveLength(100)
  })
})

describe('trackOnce', () => {
  it('sends landing once per session with the captured campaign', () => {
    const storage = new MemoryStorage()
    const first = env('?utm_source=google&gclid=abc&email=x', '/', storage)
    expect(trackOnce('landing', first.e)).toBe(true)
    expect(first.sent).toEqual([{ name: 'landing', path: '/', utm: { utm_source: 'google', gclid: 'abc' } }])

    const again = env('?utm_source=other', '/pricing/', storage)
    expect(trackOnce('landing', again.e)).toBe(false)
    expect(again.sent).toEqual([])
  })

  it('attaches the landing campaign to later sample events, once per task page', () => {
    const storage = new MemoryStorage()
    trackOnce('landing', env('?utm_source=google', '/', storage).e)

    const writing = env('', '/practice/writing/email/', storage)
    expect(trackOnce('sample_start', writing.e)).toBe(true)
    expect(trackOnce('sample_start', writing.e)).toBe(false)
    expect(writing.sent).toEqual([
      { name: 'sample_start', path: '/practice/writing/email/', utm: { utm_source: 'google' } },
    ])

    const speaking = env('', '/practice/speaking/advice/', storage)
    expect(trackOnce('sample_start', speaking.e)).toBe(true)
    expect(trackOnce('sample_done', speaking.e)).toBe(true)
    expect(speaking.sent.map((s) => s.name)).toEqual(['sample_start', 'sample_done'])
  })

  it('omits utm when there is none', () => {
    const { e, sent } = env('?ref=newsletter')
    trackOnce('landing', e)
    expect(sent).toEqual([{ name: 'landing', path: '/' }])
  })

  it('still de-duplicates when storage throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    }
    const a = env('', '/practice/writing/survey/', broken)
    expect(trackOnce('sample_done', a.e)).toBe(true)
    expect(trackOnce('sample_done', a.e)).toBe(false)
  })

  it('refuses server-only event names', () => {
    for (const name of ['signup', 'checkout_start', 'purchase', 'refund']) expect(isClientEvent(name)).toBe(false)
    const { e, sent } = env('')
    // @ts-expect-error server-only names are not ClientEventName
    expect(trackOnce('purchase', e)).toBe(false)
    expect(sent).toEqual([])
  })
})
