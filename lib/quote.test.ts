import { describe, expect, it } from 'vitest'
import { PRICE_BOOKS } from '@/config/prices'
import { estimateCleaning, estimateGutters, estimateSnow } from './quote'

const gta = PRICE_BOOKS.gta
const calgary = PRICE_BOOKS.calgary

describe('cleaning (GTA price book)', () => {
  const cases: Array<[string, Parameters<typeof estimateCleaning>[1], number, number]> = [
    ['standard 1BR', { type: 'standard', bedrooms: 1, bathrooms: 1, addOns: [], rush: false }, 150, 175],
    ['standard 2BR', { type: 'standard', bedrooms: 2, bathrooms: 1, addOns: [], rush: false }, 180, 210],
    ['standard 3BR 2 baths', { type: 'standard', bedrooms: 3, bathrooms: 2, addOns: [], rush: false }, 220, 255],
    ['standard 3BR 3 baths', { type: 'standard', bedrooms: 3, bathrooms: 3, addOns: [], rush: false }, 250, 290],
    ['deep 1BR', { type: 'deep', bedrooms: 1, bathrooms: 1, addOns: [], rush: false }, 230, 265],
    ['deep 4BR 2 baths', { type: 'deep', bedrooms: 4, bathrooms: 2, addOns: [], rush: false }, 370, 430],
    ['deep 5BR 4 baths', { type: 'deep', bedrooms: 5, bathrooms: 4, addOns: [], rush: false }, 450, 520],
    ['move-out 1BR', { type: 'moveOut', bedrooms: 1, bathrooms: 1, addOns: [], rush: false }, 260, 300],
    ['move-out 2BR + oven + fridge', { type: 'moveOut', bedrooms: 2, bathrooms: 1, addOns: ['oven', 'fridge'], rush: false }, 375, 435],
    ['move-out 3BR all add-ons', { type: 'moveOut', bedrooms: 3, bathrooms: 2, addOns: ['oven', 'fridge', 'cabinets'], rush: false }, 475, 550],
    ['standard 2BR rush (+15% of 180 = 27 → 30)', { type: 'standard', bedrooms: 2, bathrooms: 1, addOns: [], rush: true }, 210, 245],
    ['deep 3BR 2 baths rush (+15% of 320 = 48 → 50)', { type: 'deep', bedrooms: 3, bathrooms: 2, addOns: [], rush: true }, 370, 430],
    ['unknown add-on ignored', { type: 'standard', bedrooms: 1, bathrooms: 1, addOns: ['nope'], rush: false }, 150, 175],
    ['fewer baths than included is not discounted', { type: 'standard', bedrooms: 3, bathrooms: 1, addOns: [], rush: false }, 220, 255],
  ]
  for (const [name, input, low, high] of cases) {
    it(name, () => {
      const e = estimateCleaning(gta, input)
      expect(e.low).toBe(low)
      expect(e.high).toBe(high)
      expect(e.tax).toBeUndefined()
    })
  }

  it('adds HST lines only when a tax rate is passed', () => {
    const e = estimateCleaning(gta, { type: 'standard', bedrooms: 1, bathrooms: 1, addOns: [], rush: false }, 13, 'HST 13%')
    expect(e.tax).toEqual({ label: 'HST 13%', lowAmount: 19.5, highAmount: 22.75 })
  })
})

describe('gutters', () => {
  it('GTA bungalow', () => expect(estimateGutters(gta, { storeys: 1, downspouts: false }).low).toBe(175))
  it('GTA 2 storeys + downspouts', () => {
    const e = estimateGutters(gta, { storeys: 2, downspouts: true })
    expect(e.low).toBe(295)
    expect(e.high).toBe(340)
  })
  it('Calgary 2 storeys', () => expect(estimateGutters(calgary, { storeys: 2, downspouts: false }).low).toBe(240))
  it('throws where gutters are not offered', () =>
    expect(() => estimateGutters(PRICE_BOOKS.montreal, { storeys: 1, downspouts: false })).toThrow())
})

describe('snow', () => {
  it('GTA single driveway season, 4 instalments of $125, Nov per-visit $60', () => {
    const e = estimateSnow(gta, { driveway: 'single', walkway: false, salting: false })
    expect(e.low).toBe(500)
    expect(e.schedule).toEqual({ instalments: 4, each: 125, firstDue: 'Dec 1' })
    expect(e.perVisit).toBe(60)
  })
  it('GTA double + walkway + salting', () => {
    const e = estimateSnow(gta, { driveway: 'double', walkway: true, salting: true })
    expect(e.low).toBe(850)
    expect(e.schedule?.each).toBe(212.5)
  })
  it('Calgary monthly mode multiplies by 4 billed months', () => {
    const e = estimateSnow(calgary, { driveway: 'single', walkway: true, salting: false })
    expect(e.low).toBe((150 + 25) * 4)
    expect(e.schedule?.each).toBe(175)
  })
  it('throws for Metro Vancouver (snow not offered)', () =>
    expect(() => estimateSnow(PRICE_BOOKS.vancouver, { driveway: 'single', walkway: false, salting: false })).toThrow())
})

describe('price book sanity', () => {
  it('every city has 5 cleaning tiers ascending in price', () => {
    for (const book of Object.values(PRICE_BOOKS)) {
      const t = book.cleaning.tiers
      expect(t.map((x) => x.bedrooms)).toEqual([1, 2, 3, 4, 5])
      for (let i = 1; i < t.length; i++) {
        expect(t[i].standard).toBeGreaterThan(t[i - 1].standard)
        expect(t[i].deep).toBeGreaterThan(t[i - 1].deep)
        expect(t[i].moveOut).toBeGreaterThan(t[i - 1].moveOut)
      }
      for (const x of t) {
        expect(x.deep).toBeGreaterThan(x.standard)
        expect(x.moveOut).toBeGreaterThan(x.deep)
      }
    }
  })
  it('every source is either linked or explicitly marked owner-choice / not-found', () => {
    for (const book of Object.values(PRICE_BOOKS)) {
      const all = [...book.cleaning.sources, ...(book.gutters?.sources ?? []), ...(book.snow?.sources ?? []), ...book.cityNotes]
      for (const s of all) {
        if (s.status === 'snippet') expect(s.url).toMatch(/^https:\/\//)
        else expect(['owner-choice', 'not-found']).toContain(s.status)
      }
    }
  })
})

describe('rounding', () => {
  it('floating-point noise never adds an extra $5 to the upper end', () => {
    const book = { ...gta, rangeUpliftPct: 10 }
    // 200 × 1.1 = 220.00000000000003 in floating point → must stay 220
    const e = estimateCleaning(book, { type: 'standard', bedrooms: 1, bathrooms: 2, addOns: [], rush: false })
    expect(e.low).toBe(180)
    expect(e.high).toBe(200)
    const e2 = estimateGutters({ ...gta, rangeUpliftPct: 10, gutters: { ...gta.gutters!, byStoreys: { 1: 200, 2: 225, 3: 300 } } }, { storeys: 1, downspouts: false })
    expect(e2.high).toBe(220)
  })
})
