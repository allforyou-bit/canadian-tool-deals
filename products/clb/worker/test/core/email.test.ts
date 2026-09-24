// email.ts (memo §7.2 Z4, Z5): no email to learners unless LEARNER_EMAIL=on; owner alerts always go out;
// the footer names the seller.
import { env } from 'cloudflare:workers'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { alertOwner, isOwnerAddress, learnerEmailMode, sendEmail, senderFooter } from '../../src/email'
import type { Env } from '../../src/env'
import { stubFetch } from './helpers'

const base = () => ({ ...(env as Env), LEARNER_EMAIL: undefined, LEGAL_NAME: undefined }) as Env

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('LEARNER_EMAIL', () => {
  it("defaults to 'off'; only 'on' turns learner email on", () => {
    expect(learnerEmailMode(base())).toBe('off')
    expect(learnerEmailMode({ ...base(), LEARNER_EMAIL: ' ON ' })).toBe('on')
    expect(learnerEmailMode({ ...base(), LEARNER_EMAIL: 'yes' })).toBe('off')
    expect(isOwnerAddress(base(), ' Owner@Coach.test ')).toBe(true)
    expect(isOwnerAddress(base(), 'someone@example.com')).toBe(false)
    expect(isOwnerAddress({ ...base(), OWNER_EMAIL: '' }, '')).toBe(false)
  })

  it('off: mail to a learner is skipped without calling Resend, and the log names no address', async () => {
    const stub = stubFetch()
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const sent = await sendEmail(base(), { to: 'learner@example.com', subject: 'Your pass', text: 'Active', kind: 'transactional' })
    expect(sent).toBe(false)
    expect(stub.calls).toHaveLength(0)
    expect(log).toHaveBeenCalledWith('email skipped: learner email disabled', { kind: 'transactional' })
    expect(JSON.stringify(log.mock.calls)).not.toContain('learner@example.com')
  })

  it('off: owner alerts and mail to the owner address still go out', async () => {
    const stub = stubFetch()
    expect(await alertOwner(base(), 'Spend', 'details')).toBe(true)
    expect(await sendEmail(base(), { to: 'OWNER@coach.test', subject: 'Sign-in link', text: 'link', kind: 'transactional' })).toBe(true)
    expect(stub.emails().map((m) => [m.to, m.subject])).toEqual([
      [['owner@coach.test'], '[MPC] Spend'],
      [['OWNER@coach.test'], 'Sign-in link'],
    ])
  })

  it('on: learner mail is sent, with the unsubscribe link', async () => {
    const stub = stubFetch()
    const on = { ...base(), LEARNER_EMAIL: 'on' } as Env
    expect(await sendEmail(on, { to: 'learner@example.com', subject: 'Your pass', text: 'Active', kind: 'transactional' })).toBe(true)
    expect(stub.emails()[0]?.to).toEqual(['learner@example.com'])
    expect(stub.emails()[0]?.text).toMatch(/\/unsubscribe\/#h=[0-9a-f]{64}&s=[0-9a-f]{64}/)
  })
})

describe('senderFooter (memo §7.2 Z5)', () => {
  it('names the seller when LEGAL_NAME is set and shows the mailing address only when it is real', () => {
    const withName = { ...base(), LEGAL_NAME: 'Jane Example' } as Env
    expect(senderFooter(withName)).toBe(
      [
        '—',
        'Maple Practice Coach (independent practice tool)',
        'Maple Practice Coach is sold by Jane Example, a sole proprietor in Ontario',
        '1 Test St, Toronto ON M5V 0A1',
        'https://coach.test',
      ].join('\n'),
    )
    for (const MAILING_ADDRESS of ['', 'SET-BEFORE-LAUNCH (CASL: owner mailing address)']) {
      const footer = senderFooter({ ...base(), MAILING_ADDRESS } as Env)
      expect(footer).toBe(['—', 'Maple Practice Coach (independent practice tool)', 'https://coach.test'].join('\n'))
    }
  })

  it('is on owner alerts too', async () => {
    const stub = stubFetch()
    await alertOwner({ ...base(), LEGAL_NAME: 'Jane Example' } as Env, 'Test', 'body')
    expect(stub.emails()[0]?.text).toContain('sold by Jane Example, a sole proprietor in Ontario')
    expect(stub.emails()[0]?.text).not.toContain('/unsubscribe/')
  })
})
