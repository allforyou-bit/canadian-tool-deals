import { describe, expect, it } from 'vitest'
import type { MeResponse } from '../shared/api'
import { findClaims } from '../shared/content-rules'
import { nextUtcMidnight, practiceCta, practiceModeFromSearch, SELF_CHECK } from './practice'

const PASS = { sku: 'pass30' as const, startsAt: '2026-09-20T12:00:00.000Z', endsAt: '2099-10-20T12:00:00.000Z' }

function me(extra: Partial<MeResponse> = {}, flags: Partial<MeResponse['flags']> = {}): MeResponse {
  return {
    signedIn: false,
    pass: null,
    free: { writing: true, speaking: false },
    usage: { writingToday: 0, speakingToday: 0, graded30d: 0 },
    flags: { checkoutEnabled: true, gradingEnabled: true, freeEnabled: true, banner: '', speakingAvailable: true, ...flags },
    auth: { google: true, magicLink: 'owner' },
    ...extra,
  }
}

describe('practiceModeFromSearch', () => {
  it('reads ?mode=practice and ?mode=feedback only', () => {
    expect(practiceModeFromSearch('?mode=practice')).toBe('practice')
    expect(practiceModeFromSearch('?lang=ko&mode=feedback')).toBe('feedback')
    expect(practiceModeFromSearch('?mode=other')).toBeNull()
    expect(practiceModeFromSearch('')).toBeNull()
  })
})

describe('SELF_CHECK', () => {
  it('has the same short list in English and Korean, without forbidden claims', () => {
    for (const kind of ['writing', 'speaking'] as const) {
      const { en, ko } = SELF_CHECK[kind]
      expect(en.length).toBe(ko.length)
      expect(en.length).toBeGreaterThanOrEqual(3)
      expect(en.length).toBeLessThanOrEqual(6)
      for (const item of [...en, ...ko]) expect({ item, claims: findClaims(item) }).toEqual({ item, claims: [] })
    }
  })
})

describe('practiceCta', () => {
  it('writing: offers AI feedback on the same answer while the free sample or a pass allows it', () => {
    expect(practiceCta(me(), 'writing')).toEqual({ feedback: true, signIn: false, writingSample: false, pricing: true })
    expect(practiceCta(me({ signedIn: true, pass: PASS }), 'writing')).toEqual({
      feedback: true,
      signIn: false,
      writingSample: false,
      pricing: false,
    })
    // used, or switched off: pricing only
    expect(practiceCta(me({ free: { writing: false, speaking: false } }), 'writing')).toMatchObject({ feedback: false, pricing: true })
    expect(practiceCta(me({}, { freeEnabled: false }), 'writing')).toMatchObject({ feedback: false, pricing: true })
  })

  it('speaking, signed out: sign in for the free speaking task, and the free writing sample', () => {
    expect(practiceCta(me(), 'speaking')).toEqual({ feedback: false, signIn: true, writingSample: true, pricing: true })
    // free samples off: no promise of a free task
    expect(practiceCta(me({ free: { writing: false, speaking: false } }, { freeEnabled: false }), 'speaking')).toEqual({
      feedback: false,
      signIn: false,
      writingSample: false,
      pricing: true,
    })
  })

  it('speaking, signed in: feedback with a pass or the free speaking task, never while speaking is closed for the day', () => {
    expect(practiceCta(me({ signedIn: true, free: { writing: false, speaking: true } }), 'speaking')).toMatchObject({
      feedback: true,
      signIn: false,
    })
    expect(practiceCta(me({ signedIn: true, pass: PASS }), 'speaking')).toEqual({
      feedback: true,
      signIn: false,
      writingSample: false,
      pricing: false,
    })
    expect(practiceCta(me({ signedIn: true, pass: PASS }, { speakingAvailable: false }), 'speaking')).toMatchObject({ feedback: false })
    expect(practiceCta(me({}, { speakingAvailable: false }), 'speaking')).toMatchObject({ signIn: false, writingSample: true })
  })

  it('offers the free options while /api/me is unknown (the server decides)', () => {
    expect(practiceCta(null, 'writing')).toEqual({ feedback: true, signIn: false, writingSample: false, pricing: true })
    expect(practiceCta(null, 'speaking')).toEqual({ feedback: false, signIn: true, writingSample: true, pricing: true })
  })
})

describe('nextUtcMidnight', () => {
  it('is the next 00:00 UTC, also across month and year ends', () => {
    expect(nextUtcMidnight(new Date('2026-09-24T12:34:56.000Z')).toISOString()).toBe('2026-09-25T00:00:00.000Z')
    expect(nextUtcMidnight(new Date('2026-09-24T00:00:00.000Z')).toISOString()).toBe('2026-09-25T00:00:00.000Z')
    expect(nextUtcMidnight(new Date('2026-12-31T23:59:59.000Z')).toISOString()).toBe('2027-01-01T00:00:00.000Z')
  })
})
