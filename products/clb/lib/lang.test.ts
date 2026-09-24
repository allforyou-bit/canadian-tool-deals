import { describe, expect, it } from 'vitest'
import { langForLocation, langFromSearch } from './lang'

describe('langFromSearch', () => {
  it('reads a supported ?lang=', () => {
    expect(langFromSearch('?lang=ko')).toBe('ko')
    expect(langFromSearch('lang=en&next=/pricing/')).toBe('en')
    expect(langFromSearch('?lang=fr')).toBeNull()
    expect(langFromSearch('')).toBeNull()
  })
})

describe('langForLocation', () => {
  it('treats the Korean pages as Korean', () => {
    expect(langForLocation('/ko/', '')).toBe('ko')
    expect(langForLocation('/ko/pricing/', '')).toBe('ko')
    expect(langForLocation('/ko', '')).toBe('ko')
  })

  it('follows ?lang= elsewhere (e.g. the Korean landing CTA and sign-in links)', () => {
    expect(langForLocation('/practice/writing/email/', 'lang=ko')).toBe('ko')
    expect(langForLocation('/login/', 'next=/ko/pricing/&lang=ko')).toBe('ko')
    expect(langForLocation('/login/', 'lang=en')).toBe('en')
  })

  it('keeps the remembered choice when the location says nothing', () => {
    expect(langForLocation('/account/', '')).toBeNull()
    expect(langForLocation('/kotlin/', '')).toBeNull()
  })
})
