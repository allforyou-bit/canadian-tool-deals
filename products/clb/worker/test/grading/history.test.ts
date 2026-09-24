import { env } from 'cloudflare:test'
import { exports } from 'cloudflare:workers'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { HistoryResponse } from '../../../shared/api'
import { apiMessage, createUser, ORIGIN, postWriting, SIMPLE_OUTPUT, stubGrader, writingBody, golden } from './helpers'

afterEach(() => {
  vi.unstubAllGlobals()
})

const getHistory = (cookie?: string) =>
  exports.default.fetch(`${ORIGIN}/api/history`, { headers: cookie ? { cookie } : {} })

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
  })

  it('shows a grade made through the writing endpoint', async () => {
    const { cookie } = await createUser({ pass: true })
    stubGrader(apiMessage(SIMPLE_OUTPUT))
    const graded = (await (await postWriting(writingBody(golden[0]), { cookie })).json()) as { gradeId: string }
    const body = (await (await getHistory(cookie)).json()) as HistoryResponse
    expect(body.items).toEqual([{ gradeId: graded.gradeId, taskId: 'email', createdAt: expect.any(String), topErrorKinds: ['grammar', 'spelling'] }])
    expect(body.recurring).toEqual([
      { kind: 'grammar', count: 1 },
      { kind: 'spelling', count: 1 },
    ])
  })
})
