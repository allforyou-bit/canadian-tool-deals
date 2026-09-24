import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, ApiClientError, apiRequest, codeForStatus, speakingFormData, toApiClientError } from './api'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

async function caught(p: Promise<unknown>): Promise<ApiClientError> {
  try {
    await p
  } catch (e) {
    if (e instanceof ApiClientError) return e
    throw e
  }
  throw new Error('expected the call to fail')
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('error mapping', () => {
  it('keeps the server code, status and message', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: 'payment_required', message: 'Pass needed' }, 402)))
    const err = await caught(api.gradeWriting({ taskId: 'email', promptIndex: 0, text: 'Hi', explanationLang: 'en' }))
    expect(err).toBeInstanceOf(ApiClientError)
    expect(err.code).toBe('payment_required')
    expect(err.status).toBe(402)
    expect(err.message).toBe('Pass needed')
    expect(err.isNetwork).toBe(false)
  })

  it.each([
    ['free_unavailable', 429],
    ['grading_paused', 503],
    ['rate_limited', 429],
    ['turnstile_failed', 403],
    ['unauthorized', 401],
    ['too_large', 413],
    ['region_not_supported', 403],
    ['checkout_unavailable', 503],
  ] as const)('maps %s', async (code, status) => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: code, message: 'x' }, status)))
    const err = await caught(api.me())
    expect(err.code).toBe(code)
    expect(err.status).toBe(status)
  })

  it('falls back to the HTTP status when the body is not our JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>Bad gateway</html>', { status: 502 })))
    const err = await caught(api.health())
    expect(err.code).toBe('internal')
    expect(err.status).toBe(502)
  })

  it('ignores unknown error codes', () => {
    expect(toApiClientError(429, { error: 'slow_down', message: 'x' }).code).toBe('rate_limited')
    expect(toApiClientError(418, { error: 'teapot' }).code).toBe('internal')
  })

  it('maps statuses without a body', () => {
    expect(codeForStatus(401)).toBe('unauthorized')
    expect(codeForStatus(413)).toBe('too_large')
    expect(codeForStatus(500)).toBe('internal')
  })

  it('reports network failures with status 0', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))))
    const err = await caught(api.me())
    expect(err.code).toBe('internal')
    expect(err.status).toBe(0)
    expect(err.isNetwork).toBe(true)
  })

  it('rejects a 200 response that is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not json', { status: 200 })))
    const err = await caught(apiRequest('/api/me'))
    expect(err.code).toBe('internal')
    expect(err.status).toBe(200)
  })
})

describe('requests', () => {
  it('sends JSON POSTs with same-origin credentials', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => jsonResponse({ url: 'https://checkout.stripe.com/x' }))
    vi.stubGlobal('fetch', fetchMock)
    const res = await api.checkout({ sku: 'pass30', termsVersion: '2026-09-24', residentAttestation: true, lang: 'ko' })
    expect(res.url).toBe('https://checkout.stripe.com/x')
    const [input, init] = fetchMock.mock.calls[0]
    expect(input).toBe('/api/checkout')
    expect(init?.method).toBe('POST')
    expect(init?.credentials).toBe('same-origin')
    expect((init?.headers as Record<string, string>)['content-type']).toBe('application/json')
    expect(JSON.parse(String(init?.body))).toEqual({ sku: 'pass30', termsVersion: '2026-09-24', residentAttestation: true, lang: 'ko' })
  })

  it('uses GET for reads', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ items: [], recurring: [] }),
    )
    vi.stubGlobal('fetch', fetchMock)
    await api.history()
    expect(fetchMock.mock.calls[0][0]).toBe('/api/history')
    expect(fetchMock.mock.calls[0][1]?.method).toBe('GET')
    expect(fetchMock.mock.calls[0][1]?.body).toBeUndefined()
  })

  it('reads one saved history item by grade id (escaped into the query)', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ gradeId: 'g/1', taskId: 'email', kind: 'writing', createdAt: '2026-09-21T10:00:00.000Z', text: 'Hi', result: {} }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const item = await api.historyItem('g/1&x=2')
    expect(item.taskId).toBe('email')
    expect(fetchMock.mock.calls[0][0]).toBe('/api/history/item?id=g%2F1%26x%3D2')
    expect(fetchMock.mock.calls[0][1]?.method).toBe('GET')
  })

  it('posts the unsubscribe hash and signature without a session', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => jsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)
    await api.unsubscribe({ h: 'abc', s: 'def' })
    expect(fetchMock.mock.calls[0][0]).toBe('/api/unsubscribe')
    expect(fetchMock.mock.calls[0][1]?.method).toBe('POST')
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ h: 'abc', s: 'def' })
  })

  it('builds the multipart speaking request', async () => {
    const form = speakingFormData({
      taskId: 'advice',
      promptIndex: 1,
      explanationLang: 'en',
      audio: new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/webm' }),
      filename: 'answer.webm',
      durationSeconds: 42.5,
    })
    expect(form.get('taskId')).toBe('advice')
    expect(form.get('promptIndex')).toBe('1')
    expect(form.get('explanationLang')).toBe('en')
    expect(form.get('durationSeconds')).toBe('42.5')
    const audio = form.get('audio')
    expect(audio).toBeInstanceOf(Blob)
    expect((audio as File).name).toBe('answer.webm')
    expect((audio as Blob).size).toBe(3)
  })
})
