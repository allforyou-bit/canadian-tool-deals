import { describe, expect, it } from 'vitest'
import { adsAccountId } from './gads'

describe('adsAccountId', () => {
  it('takes the account part of a conversion send_to value', () => {
    expect(adsAccountId('AW-123456789/AbC-dE_f')).toBe('AW-123456789')
    expect(adsAccountId(' AW-1/x ')).toBe('AW-1')
  })

  it('rejects anything else', () => {
    for (const bad of ['', 'AW-123', 'G-ABC/def', 'AW-12/<script>', 'https://evil.test/AW-1/x']) {
      expect(adsAccountId(bad)).toBeNull()
    }
  })
})
