import { afterEach, describe, expect, it, vi } from 'vitest'
import { reconcile, renderIssue, type D1Purchase, type StripeSession } from './reconcile-core'
import { listPaidWindowSessions } from './reconcile'

const now = new Date('2026-10-30T08:00:00Z')
const windowStart = new Date('2026-10-27T08:00:00Z')
const sec = (iso: string) => Math.floor(Date.parse(iso) / 1000)

const session = (id: string, createdIso: string, over: Partial<StripeSession> = {}): StripeSession => ({
  id,
  created: sec(createdIso),
  mode: 'payment',
  status: 'complete',
  payment_status: 'paid',
  amount_total: 3900,
  currency: 'cad',
  livemode: true,
  ...over,
})
const purchase = (id: string, createdIso: string, over: Partial<D1Purchase> = {}): D1Purchase => ({
  id,
  status: 'paid',
  amount_cents: 3900,
  currency: 'cad',
  created_at: createdIso,
  ...over,
})

describe('reconcile', () => {
  it('reports no mismatch when every paid session has a matching purchase', () => {
    const r = reconcile({
      sessions: [session('cs_a', '2026-10-28T10:00:00Z'), session('cs_b', '2026-10-29T10:00:00Z', { amount_total: 7900 })],
      purchases: [purchase('cs_a', '2026-10-28T10:00:01.000Z'), purchase('cs_b', '2026-10-29T10:00:01.000Z', { amount_cents: 7900, status: 'refunded' })],
      windowStart,
      now,
    })
    expect(r.mismatches).toEqual([])
    expect(r).toMatchObject({ stripePaid: 2, d1Paid: 2, skippedRecent: 0 })
  })

  it('finds each kind of mismatch', () => {
    const r = reconcile({
      sessions: [
        session('cs_missing', '2026-10-28T10:00:00Z'),
        session('cs_pending', '2026-10-28T11:00:00Z'),
        session('cs_amount', '2026-10-28T12:00:00Z'),
        session('cs_unpaid', '2026-10-28T13:00:00Z', { payment_status: 'unpaid' }),
      ],
      purchases: [
        purchase('cs_pending', '2026-10-28T11:00:01.000Z', { status: 'pending' }),
        purchase('cs_amount', '2026-10-28T12:00:01.000Z', { amount_cents: 7900 }),
        purchase('cs_ghost', '2026-10-29T09:00:00.000Z'),
        purchase('cs_unpaid', '2026-10-28T13:00:01.000Z', { status: 'pending' }),
      ],
      windowStart,
      now,
    })
    expect(r.mismatches.map((m) => [m.kind, m.id])).toEqual([
      ['missing_in_d1', 'cs_missing'],
      ['not_marked_paid', 'cs_pending'],
      ['amount_mismatch', 'cs_amount'],
      ['missing_in_stripe', 'cs_ghost'],
    ])
  })

  it('skips sessions paid within the grace period and items outside the window', () => {
    const r = reconcile({
      sessions: [session('cs_recent', '2026-10-30T07:30:00Z'), session('cs_old', '2026-10-26T10:00:00Z')],
      purchases: [purchase('cs_edge', '2026-10-27T08:00:05.000Z'), purchase('cs_old_row', '2026-10-26T10:00:01.000Z')],
      windowStart,
      now,
    })
    // cs_recent is inside the grace period; cs_old and cs_old_row are before the window;
    // cs_edge has no session in this list, so it is reported
    expect(r.skippedRecent).toBe(1)
    expect(r.mismatches.map((m) => m.id)).toEqual(['cs_edge'])
    // its session was created 10 s before the window start: the CLI lists sessions from one day
    // earlier (lookup margin), so the match is found and nothing is reported
    const withMargin = reconcile({
      sessions: [session('cs_edge', '2026-10-27T07:59:55Z')],
      purchases: [purchase('cs_edge', '2026-10-27T08:00:05.000Z')],
      windowStart,
      now,
    })
    expect(withMargin.mismatches).toEqual([])
  })

  it('renders an issue body with ids and counts only', () => {
    const r = reconcile({ sessions: [session('cs_missing', '2026-10-28T10:00:00Z')], purchases: [], windowStart, now })
    const md = renderIssue(r, true)
    expect(md).toContain('`cs_missing`')
    expect(md).toContain('Stripe mode: live')
    expect(md).not.toMatch(/@/)
  })
})

describe('listPaidWindowSessions', () => {
  afterEach(() => vi.restoreAllMocks())

  it('pages through the list with created[gte], status=complete and starting_after', async () => {
    const urls: string[] = []
    const pages = [
      { data: [{ id: 'cs_1', created: 1, mode: 'payment', status: 'complete', payment_status: 'paid', amount_total: 3900, currency: 'cad', livemode: false, customer_details: { email: 'x' } }], has_more: true },
      { data: [{ id: 'cs_2', created: 2, mode: 'payment', status: 'complete', payment_status: 'paid', amount_total: 7900, currency: 'cad', livemode: false }], has_more: false },
    ]
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      urls.push(String(url))
      expect((init?.headers as Record<string, string>).authorization).toBe('Bearer sk_test_dummy')
      return new Response(JSON.stringify(pages[urls.length - 1]), { status: 200 })
    })
    const sessions = await listPaidWindowSessions('sk_test_dummy', 1_761_552_000, fetchImpl as unknown as typeof fetch)
    expect(sessions.map((s) => s.id)).toEqual(['cs_1', 'cs_2'])
    expect(JSON.stringify(sessions)).not.toContain('customer_details')
    expect(decodeURIComponent(urls[0])).toContain('created[gte]=1761552000')
    expect(urls[0]).toContain('status=complete')
    expect(urls[1]).toContain('starting_after=cs_1')
  })

  it('throws on an HTTP error without including the response body', async () => {
    const fetchImpl = vi.fn(async () => new Response('{"error":{"message":"secret detail"}}', { status: 401 }))
    await expect(listPaidWindowSessions('sk_test_dummy', 0, fetchImpl as unknown as typeof fetch)).rejects.toThrow('Stripe list failed with HTTP 401')
  })
})
