import { describe, expect, it } from 'vitest'
import { isSafeCheckoutUrl, loginHref, safeNextPath, tokenFromHash, unsubscribeFromHash } from './url'

const ORIGIN = 'https://coach.test'

describe('safeNextPath', () => {
  it('accepts same-origin paths', () => {
    expect(safeNextPath('/pricing/', ORIGIN)).toBe('/pricing/')
    expect(safeNextPath('/practice/speaking/advice/?x=1', ORIGIN)).toBe('/practice/speaking/advice/?x=1')
  })

  it('rejects other origins and tricks', () => {
    for (const bad of ['https://evil.test/', '//evil.test/', '/\\evil.test', 'javascript:alert(1)', 'pricing/', '', '/\u0000x']) {
      expect(safeNextPath(bad, ORIGIN)).toBeNull()
    }
    expect(safeNextPath(null, ORIGIN)).toBeNull()
    expect(safeNextPath(undefined, ORIGIN)).toBeNull()
  })

  it('keeps encoded characters encoded', () => {
    expect(safeNextPath('/%0d%0a', ORIGIN)).toBe('/%0d%0a')
  })

  it('never returns into the sign-in flow', () => {
    expect(safeNextPath('/login/', ORIGIN)).toBeNull()
    expect(safeNextPath('/auth/verify/', ORIGIN)).toBeNull()
  })
})

describe('isSafeCheckoutUrl', () => {
  it('requires https', () => {
    expect(isSafeCheckoutUrl('https://checkout.stripe.com/c/pay/cs_test_1')).toBe(true)
    expect(isSafeCheckoutUrl('http://checkout.stripe.com/')).toBe(false)
    expect(isSafeCheckoutUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeCheckoutUrl('/relative')).toBe(false)
    expect(isSafeCheckoutUrl(undefined)).toBe(false)
  })
})

describe('loginHref', () => {
  it('builds readable links', () => {
    expect(loginHref()).toBe('/login/')
    expect(loginHref('/pricing/')).toBe('/login/?next=/pricing/')
    expect(loginHref('/ko/pricing/', 'ko')).toBe('/login/?next=/ko/pricing/&lang=ko')
  })
})

describe('tokenFromHash', () => {
  it('reads #token=… and bare tokens', () => {
    expect(tokenFromHash('#token=abcDEF123_-xyz0123456')).toBe('abcDEF123_-xyz0123456')
    expect(tokenFromHash('#abcDEF123_-xyz0123456')).toBe('abcDEF123_-xyz0123456')
  })

  it('returns null when there is no usable token', () => {
    expect(tokenFromHash('')).toBeNull()
    expect(tokenFromHash('#')).toBeNull()
    expect(tokenFromHash('#token=')).toBeNull()
    expect(tokenFromHash('#main')).toBeNull()
  })
})

describe('unsubscribeFromHash', () => {
  const h = 'a'.repeat(64)
  const sig = '0123456789abcdef'.repeat(4)

  it('reads the email hash and signature from the fragment', () => {
    expect(unsubscribeFromHash(`#h=${h}&s=${sig}`)).toEqual({ h, s: sig })
    expect(unsubscribeFromHash(`s=${sig}&h=${h}`)).toEqual({ h, s: sig })
  })

  it('rejects incomplete or altered links', () => {
    expect(unsubscribeFromHash('')).toBeNull()
    expect(unsubscribeFromHash(`#h=${h}`)).toBeNull()
    expect(unsubscribeFromHash(`#h=${h}&s=`)).toBeNull()
    expect(unsubscribeFromHash(`#h=${h}&s=${sig.slice(0, 10)}`)).toBeNull()
    expect(unsubscribeFromHash(`#h=<script>&s=${sig}`)).toBeNull()
  })
})
