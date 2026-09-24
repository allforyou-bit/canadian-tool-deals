import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MeResponse } from '../shared/api'

type MeModule = typeof import('./me')

function meBody(signedIn: boolean): MeResponse {
  return {
    signedIn,
    ...(signedIn ? { email: 'learner@example.test' } : {}),
    pass: null,
    free: { writing: true, speaking: false },
    usage: { writingToday: 0, speakingToday: 0, graded30d: 0 },
    flags: { checkoutEnabled: true, gradingEnabled: true, freeEnabled: true, banner: '', speakingAvailable: true },
    auth: { google: true, magicLink: 'owner' },
  }
}

/** A fetch stub whose answers the test releases one by one, in any order. */
function controlledFetch() {
  const pending: { resolve: (r: Response) => void }[] = []
  const fetchMock = vi.fn(
    () =>
      new Promise<Response>((resolve) => {
        pending.push({ resolve })
      }),
  )
  const answer = (i: number, body: unknown, status = 200) =>
    pending[i].resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }))
  return { fetchMock, answer }
}

let store: MeModule

beforeEach(async () => {
  // a fresh module per test: the store is module state
  vi.resetModules()
  store = await import('./me')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('refreshMe', () => {
  it('shares one request between callers', async () => {
    const { fetchMock, answer } = controlledFetch()
    vi.stubGlobal('fetch', fetchMock)
    const a = store.refreshMe()
    const b = store.refreshMe()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    answer(0, meBody(false))
    expect(await a).toEqual(await b)
  })

  it('force starts a new request, and a late answer from the older one cannot overwrite it (sign-in race)', async () => {
    const { fetchMock, answer } = controlledFetch()
    vi.stubGlobal('fetch', fetchMock)
    const early = store.refreshMe() // e.g. the header, before the session cookie existed
    const forced = store.refreshMe({ force: true }) // after POST /api/auth/verify
    expect(fetchMock).toHaveBeenCalledTimes(2)

    answer(1, meBody(true))
    expect((await forced)?.signedIn).toBe(true)
    answer(0, meBody(false)) // the stale answer arrives last
    // the superseded caller gets the newest answer too, and the store keeps it
    expect((await early)?.signedIn).toBe(true)
    const state = store.getMeState()
    expect(state.status === 'ready' && state.me.signedIn).toBe(true)
  })

  it('a stale answer that arrives first is not shown once a forced request is running', async () => {
    const { fetchMock, answer } = controlledFetch()
    vi.stubGlobal('fetch', fetchMock)
    const seen: boolean[] = []
    store.subscribeMe(() => {
      const s = store.getMeState()
      if (s.status === 'ready') seen.push(s.me.signedIn)
    })
    // subscribeMe started the first request
    const forced = store.refreshMe({ force: true })
    answer(0, meBody(false))
    answer(1, meBody(true))
    await forced
    expect(seen).toEqual([true])
  })

  it('a non-forced call joins the newest request', async () => {
    const { fetchMock, answer } = controlledFetch()
    vi.stubGlobal('fetch', fetchMock)
    void store.refreshMe()
    const forced = store.refreshMe({ force: true })
    const joined = store.refreshMe()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    answer(1, meBody(true))
    answer(0, meBody(false))
    expect((await joined)?.signedIn).toBe(true)
    expect((await forced)?.signedIn).toBe(true)
  })

  it('stores failures as an error state and never rejects', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'internal', message: 'x' }), { status: 500 })))
    expect(await store.refreshMe()).toBeNull()
    const state = store.getMeState()
    expect(state.status).toBe('error')
  })
})

describe('freeSample', () => {
  const meWith = (free: MeResponse['free'], freeEnabled: boolean): MeResponse => ({
    ...meBody(false),
    free,
    flags: { ...meBody(false).flags, freeEnabled },
  })

  it('reports an unused sample as available and a used one as used', () => {
    expect(store.freeSample(meWith({ writing: true, speaking: false }, true), 'writing')).toBe('available')
    expect(store.freeSample(meWith({ writing: true, speaking: false }, true), 'speaking')).toBe('used')
  })

  it('says "off", never "used", while free samples are switched off (a new visitor has used nothing)', () => {
    // /api/me reports every sample as unavailable while free_enabled is false
    expect(store.freeSample(meWith({ writing: false, speaking: false }, false), 'writing')).toBe('off')
    expect(store.freeSample(meWith({ writing: false, speaking: false }, false), 'speaking')).toBe('off')
    expect(store.freeSample(meWith({ writing: true, speaking: true }, false), 'writing')).toBe('off')
  })

  it('treats a missing flag (an older Worker) as on', () => {
    const me = meBody(false)
    const legacy = { ...me, flags: { checkoutEnabled: true, gradingEnabled: true, banner: '' } } as unknown as MeResponse
    expect(store.freeSample(legacy, 'writing')).toBe('available')
  })
})

describe('accessEndsAt', () => {
  const now = new Date('2026-09-24T12:00:00.000Z')
  const pass = { sku: 'pass30' as const, startsAt: '2026-09-20T12:00:00.000Z', endsAt: '2026-10-20T12:00:00.000Z' }

  it('uses the end of the pass chain when it runs past the active pass', () => {
    expect(store.accessEndsAt({ ...meBody(true), pass, accessEndsAt: '2027-01-18T12:00:00.000Z' }, now)).toBe('2027-01-18T12:00:00.000Z')
  })

  it('falls back to the active pass, and is null when everything has ended', () => {
    expect(store.accessEndsAt({ ...meBody(true), pass }, now)).toBe(pass.endsAt)
    expect(store.accessEndsAt({ ...meBody(true), pass: null, accessEndsAt: '2026-09-01T00:00:00.000Z' }, now)).toBeNull()
  })
})

describe('speakingOpen', () => {
  it('follows the site-wide daily speaking budget flag', () => {
    const me = meBody(true)
    expect(store.speakingOpen(me)).toBe(true)
    expect(store.speakingOpen({ ...me, flags: { ...me.flags, speakingAvailable: false } })).toBe(false)
  })

  it('is not open while grading is paused', () => {
    const me = meBody(true)
    expect(store.speakingOpen({ ...me, flags: { ...me.flags, gradingEnabled: false, speakingAvailable: false } })).toBe(false)
  })

  it('treats a missing flag (an older Worker) as open', () => {
    const me = meBody(false)
    const { speakingAvailable: _omit, ...older } = me.flags
    expect(store.speakingOpen({ ...me, flags: older } as unknown as MeResponse)).toBe(true)
  })
})

describe('speakingStatus', () => {
  const withFlags = (flags: Partial<MeResponse['flags']>): MeResponse => {
    const me = meBody(true)
    return { ...me, flags: { ...me.flags, ...flags } }
  }

  it('says "paused", never "closed for today", while grading is paused (/api/me then reports speaking unavailable too)', () => {
    expect(store.speakingStatus(withFlags({ gradingEnabled: false, speakingAvailable: false }))).toBe('paused')
    expect(store.speakingStatus(withFlags({ gradingEnabled: false, speakingAvailable: true }))).toBe('paused')
  })

  it('says "closed" only for a real capacity closure (grading on, the daily speaking budget used up)', () => {
    expect(store.speakingStatus(withFlags({ gradingEnabled: true, speakingAvailable: false }))).toBe('closed')
  })

  it('is open otherwise, and for an older Worker without the flags', () => {
    expect(store.speakingStatus(withFlags({}))).toBe('open')
    const me = meBody(false)
    const legacy = { ...me, flags: { checkoutEnabled: true, banner: '' } } as unknown as MeResponse
    expect(store.speakingStatus(legacy)).toBe('open')
  })
})
