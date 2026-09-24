import { env } from 'cloudflare:test'
import { exports } from 'cloudflare:workers'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ApiError, GradeResponse, GradeResult, HistoryItemResponse, HistoryResponse } from '../../../shared/api'
import { HISTORY_PAGE_SIZE, historyCursor } from '../../src/grading'
import { randomToken } from '../../src/lib/crypto'
import { apiMessage, createUser, ORIGIN, postWriting, SIMPLE_OUTPUT, stubGrader, writingBody, golden, probes } from './helpers'

afterEach(() => {
  vi.unstubAllGlobals()
})

const getHistory = (cookie?: string, before?: string) =>
  exports.default.fetch(`${ORIGIN}/api/history${before === undefined ? '' : `?before=${encodeURIComponent(before)}`}`, {
    headers: cookie ? { cookie } : {},
  })

/** Every page, following nextBefore. */
async function allPages(cookie: string): Promise<HistoryResponse[]> {
  const pages: HistoryResponse[] = []
  let before: string | undefined
  for (let i = 0; i < 10; i++) {
    const res = await getHistory(cookie, before)
    expect(res.status).toBe(200)
    const page = (await res.json()) as HistoryResponse
    pages.push(page)
    if (page.nextBefore === null) return pages
    before = page.nextBefore
  }
  throw new Error('history did not end')
}

async function insert(userId: string, rows: { kinds: string | null; refused?: number; minutesAgo: number; taskId?: string }[]) {
  const now = Date.now()
  await env.DB.batch(
    rows.map((r, i) =>
      env.DB.prepare(
        `INSERT INTO grades (id, user_id, task_id, prompt_index, kind, error_kinds, refused, model, created_at)
         VALUES (?1, ?2, ?3, 0, 'writing', ?4, ?5, 'claude-opus-5', ?6)`,
      ).bind(`g_h_${userId}_${i}`, userId, r.taskId ?? 'email', r.kinds, r.refused ?? 0, new Date(now - r.minutesAgo * 60_000).toISOString()),
    ),
  )
}

describe('GET /api/history', () => {
  it('requires sign-in', async () => {
    const res = await getHistory()
    expect(res.status).toBe(401)
  })

  it('lists recent non-refused grades, newest first, with recurring error kinds', async () => {
    const { user, cookie } = await createUser({ pass: true })
    const other = await createUser({ pass: true })
    await insert(user.id, [
      { kinds: 'grammar,vocabulary', minutesAgo: 30, taskId: 'email' },
      { kinds: 'grammar', minutesAgo: 20, taskId: 'survey' },
      { kinds: 'grammar,spelling,tone_register', minutesAgo: 10, taskId: 'advice' },
      { kinds: null, minutesAgo: 5 },
      { kinds: 'grammar', refused: 1, minutesAgo: 1 },
    ])
    await insert(other.user.id, [{ kinds: 'coherence', minutesAgo: 1 }])

    const res = await getHistory(cookie)
    expect(res.status).toBe(200)
    const body = (await res.json()) as HistoryResponse
    expect(body.items.map((i) => i.taskId)).toEqual(['email', 'advice', 'survey', 'email'])
    expect(body.items[1].topErrorKinds).toEqual(['grammar', 'spelling', 'tone_register'])
    expect(body.items[0].topErrorKinds).toEqual([])
    expect(body.recurring).toEqual([
      { kind: 'grammar', count: 3 },
      { kind: 'spelling', count: 1 },
      { kind: 'tone_register', count: 1 },
      { kind: 'vocabulary', count: 1 },
    ])
    expect(body.nextBefore).toBeNull()
  })

  it('returns at most 50 items and the top 5 recurring kinds', async () => {
    const { user, cookie } = await createUser()
    const kinds = ['grammar', 'vocabulary', 'spelling', 'punctuation', 'coherence', 'organization', 'fluency']
    await insert(
      user.id,
      Array.from({ length: 55 }, (_, i) => ({ kinds: kinds.slice(0, 1 + (i % kinds.length)).join(','), minutesAgo: i + 1 })),
    )
    const body = (await (await getHistory(cookie)).json()) as HistoryResponse
    expect(body.items).toHaveLength(50)
    expect(body.recurring).toHaveLength(5)
    expect(body.recurring[0]).toEqual({ kind: 'grammar', count: 50 })
    const counts = body.recurring.map((r) => r.count)
    expect([...counts].sort((a, b) => b - a)).toEqual(counts)
    expect(body.nextBefore).toBe(historyCursor(body.items[49].createdAt, body.items[49].gradeId))
  })

  it('pages through every saved answer with ?before=, newest first; recurring only on the first page', async () => {
    const { user, cookie } = await createUser()
    const other = await createUser()
    await insert(user.id, Array.from({ length: 60 }, (_, i) => ({ kinds: 'grammar', minutesAgo: i + 1 })))
    // refused rows and other learners' rows never appear on any page
    await insert(other.user.id, [{ kinds: 'grammar', minutesAgo: 30.5 }])
    await env.DB.prepare(
      `INSERT INTO grades (id, user_id, task_id, prompt_index, kind, refused, model, created_at) VALUES (?1, ?2, 'email', 0, 'writing', 1, 'claude-opus-5', ?3)`,
    )
      .bind(`g_refused_${user.id}`, user.id, new Date(Date.now() - 45.5 * 60_000).toISOString())
      .run()

    const pages = await allPages(cookie)
    expect(pages.map((p) => p.items.length)).toEqual([HISTORY_PAGE_SIZE, 10])
    const ids = pages.flatMap((p) => p.items.map((i) => i.gradeId))
    expect(ids).toEqual(Array.from({ length: 60 }, (_, i) => `g_h_${user.id}_${i}`))
    expect(pages[0].recurring).toEqual([{ kind: 'grammar', count: HISTORY_PAGE_SIZE }])
    expect(pages[1].recurring).toEqual([])
    expect(pages[1].nextBefore).toBeNull()
  })

  it('breaks ties on id, so rows with the same time are neither repeated nor skipped across pages', async () => {
    const { user, cookie } = await createUser()
    const at = '2026-09-20T10:00:00.000Z'
    const ids = Array.from({ length: HISTORY_PAGE_SIZE + 3 }, (_, i) => `g_tie_${user.id}_${String(i).padStart(2, '0')}`)
    await env.DB.batch(
      ids.map((id) =>
        env.DB.prepare(
          `INSERT INTO grades (id, user_id, task_id, prompt_index, kind, refused, model, created_at) VALUES (?1, ?2, 'email', 0, 'writing', 0, 'claude-opus-5', ?3)`,
        ).bind(id, user.id, at),
      ),
    )
    const pages = await allPages(cookie)
    expect(pages[0].nextBefore).toBe(historyCursor(at, ids[3]))
    expect(pages.flatMap((p) => p.items.map((i) => i.gradeId))).toEqual([...ids].reverse())
  })

  it('an exactly full page has no next page', async () => {
    const { user, cookie } = await createUser()
    await insert(user.id, Array.from({ length: HISTORY_PAGE_SIZE }, (_, i) => ({ kinds: null, minutesAgo: i + 1 })))
    const body = (await (await getHistory(cookie)).json()) as HistoryResponse
    expect(body.items).toHaveLength(HISTORY_PAGE_SIZE)
    expect(body.nextBefore).toBeNull()
  })

  it('rejects a malformed cursor', async () => {
    const { cookie } = await createUser()
    for (const before of [
      '',
      'garbage',
      '2026-09-20T10:00:00.000Z',
      '2026-09-20T10:00:00.000Z|',
      '2026-09-20|g_abc',
      '2026-09-20T10:00:00.000Z|g_abc|x',
      "2026-09-20T10:00:00.000Z|g_' OR 1=1 --",
      `2026-09-20T10:00:00.000Z|g_${'x'.repeat(80)}`,
    ]) {
      const res = await getHistory(cookie, before)
      expect(res.status).toBe(400)
      expect(((await res.json()) as ApiError).error).toBe('bad_request')
    }
    // a well-formed cursor older than every row: an empty last page
    const empty = (await (await getHistory(cookie, historyCursor('2000-01-01T00:00:00.000Z', 'g_x'))).json()) as HistoryResponse
    expect(empty).toEqual({ items: [], recurring: [], nextBefore: null })
  })

  it('leaves out rows whose model call is still running', async () => {
    const { user, cookie } = await createUser()
    await insert(user.id, [{ kinds: 'grammar', minutesAgo: 3 }])
    await env.DB.prepare(
      `INSERT INTO grades (id, user_id, task_id, prompt_index, kind, pending, model, created_at) VALUES (?1, ?2, 'email', 0, 'writing', 1, 'claude-opus-5', ?3)`,
    )
      .bind(`g_pending_${user.id}`, user.id, new Date().toISOString())
      .run()
    const body = (await (await getHistory(cookie)).json()) as HistoryResponse
    expect(body.items.map((i) => i.gradeId)).toEqual([`g_h_${user.id}_0`])
  })

  it('shows a grade made through the writing endpoint', async () => {
    const { cookie } = await createUser({ pass: true })
    stubGrader(apiMessage(SIMPLE_OUTPUT))
    const graded = (await (await postWriting(writingBody(golden[0]), { cookie })).json()) as { gradeId: string }
    const body = (await (await getHistory(cookie)).json()) as HistoryResponse
    expect(body.nextBefore).toBeNull()
    expect(body.items).toEqual([{ gradeId: graded.gradeId, taskId: 'email', createdAt: expect.any(String), topErrorKinds: ['grammar', 'spelling'] }])
    expect(body.recurring).toEqual([
      { kind: 'grammar', count: 1 },
      { kind: 'spelling', count: 1 },
    ])
  })
})

const getItem = (id: string | null, cookie?: string) =>
  exports.default.fetch(`${ORIGIN}/api/history/item${id === null ? '' : `?id=${encodeURIComponent(id)}`}`, {
    headers: cookie ? { cookie } : {},
  })

const RESULT: GradeResult = {
  refused: false,
  criteria: [{ name: 'Content and task completion', strengths: 'Clear.', improve: 'Add an example.' }],
  topErrors: [{ kind: 'grammar', original: 'I goes', correction: 'I go', why: 'Base form after "I".' }],
  rewrites: ['I go to work.'],
  nextStep: 'Practise verb forms.',
  explanationLang: 'en',
  bandShown: false,
  wordCount: 3,
}

async function insertSaved(
  userId: string,
  over: { text?: string | null; result?: string | null; refused?: number; pending?: number; kind?: string } = {},
): Promise<string> {
  const id = 'g_item_' + randomToken(8)
  await env.DB.prepare(
    `INSERT INTO grades (id, user_id, task_id, prompt_index, kind, input_text, result_json, refused, pending, outcome, model, created_at)
     VALUES (?1, ?2, 'email', 0, ?3, ?4, ?5, ?6, ?7, 'graded', 'claude-opus-5', ?8)`,
  )
    .bind(
      id,
      userId,
      over.kind ?? 'writing',
      over.text === undefined ? 'I goes to work.' : over.text,
      over.result === undefined ? JSON.stringify(RESULT) : over.result,
      over.refused ?? 0,
      over.pending ?? 0,
      '2026-09-20T10:00:00.000Z',
    )
    .run()
  return id
}

async function expectNotFound(res: Response) {
  expect(res.status).toBe(404)
  expect(((await res.json()) as ApiError).error).toBe('not_found')
}

describe('GET /api/history/item', () => {
  it('requires sign-in', async () => {
    const { user } = await createUser()
    const id = await insertSaved(user.id)
    expect((await getItem(id)).status).toBe(401)
  })

  it("returns the learner's own saved answer and feedback", async () => {
    const { user, cookie } = await createUser()
    const id = await insertSaved(user.id)
    const res = await getItem(id, cookie)
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect((await res.json()) as HistoryItemResponse).toEqual({
      gradeId: id,
      taskId: 'email',
      kind: 'writing',
      createdAt: '2026-09-20T10:00:00.000Z',
      text: 'I goes to work.',
      result: RESULT,
    })
  })

  it("answers 404 for another learner's row, as for one that does not exist", async () => {
    const owner = await createUser()
    const other = await createUser()
    const id = await insertSaved(owner.user.id)
    await expectNotFound(await getItem(id, other.cookie))
    await expectNotFound(await getItem('g_nope', other.cookie))
  })

  it('answers 404 once the text is purged, and for refused, pending or anonymous rows', async () => {
    const { user, cookie } = await createUser()
    await expectNotFound(await getItem(await insertSaved(user.id, { text: null, result: null }), cookie))
    await expectNotFound(await getItem(await insertSaved(user.id, { result: null }), cookie))
    await expectNotFound(await getItem(await insertSaved(user.id, { refused: 1 }), cookie))
    await expectNotFound(await getItem(await insertSaved(user.id, { pending: 1 }), cookie))
    await expectNotFound(await getItem(await insertSaved(user.id, { result: '{broken' }), cookie))
  })

  it('rejects a missing or oversized id', async () => {
    const { cookie } = await createUser()
    expect((await getItem(null, cookie)).status).toBe(400)
    expect((await getItem('g_' + 'x'.repeat(80), cookie)).status).toBe(400)
  })

  it('opens a grade made through the writing endpoint, but not a refused one', async () => {
    const { cookie } = await createUser({ pass: true })
    stubGrader(apiMessage(SIMPLE_OUTPUT))
    const graded = (await (await postWriting(writingBody(golden[0]), { cookie })).json()) as GradeResponse
    const item = (await (await getItem(graded.gradeId, cookie)).json()) as HistoryItemResponse
    expect(item).toMatchObject({ gradeId: graded.gradeId, kind: 'writing', text: golden[0].text.trim(), result: graded.result })

    stubGrader(probes[0].apiResponse)
    const refused = (await (await postWriting(writingBody(probes[0]), { cookie })).json()) as GradeResponse
    await expectNotFound(await getItem(refused.gradeId, cookie))
  })
})
