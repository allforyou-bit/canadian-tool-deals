import { describe, expect, it } from 'vitest'
import type { HistoryItem, HistoryResponse } from '../shared/api'
import { appendHistoryPage } from './history'

const item = (id: string, createdAt: string): HistoryItem => ({ gradeId: id, taskId: 'email', createdAt, topErrorKinds: [] })

const first: HistoryResponse = {
  items: [item('g1', '2026-09-21T10:00:00.000Z'), item('g2', '2026-09-20T10:00:00.000Z')],
  recurring: [{ kind: 'grammar', count: 3 }],
  nextBefore: '2026-09-20T10:00:00.000Z|g2',
}

describe('appendHistoryPage', () => {
  it('adds the older page below, keeps the recurring block from the first page and moves the cursor', () => {
    const older: HistoryResponse = {
      items: [item('g3', '2026-06-01T10:00:00.000Z')],
      recurring: [],
      nextBefore: '2026-06-01T10:00:00.000Z|g3',
    }
    const joined = appendHistoryPage(first, older)
    expect(joined.items.map((i) => i.gradeId)).toEqual(['g1', 'g2', 'g3'])
    expect(joined.recurring).toEqual([{ kind: 'grammar', count: 3 }])
    expect(joined.nextBefore).toBe('2026-06-01T10:00:00.000Z|g3')
  })

  it('ends paging on the last page', () => {
    const last = appendHistoryPage(first, { items: [item('g3', '2026-06-01T10:00:00.000Z')], recurring: [], nextBefore: null })
    expect(last.nextBefore).toBeNull()
  })

  it('never lists an item twice, and stops when a page adds nothing or the cursor does not move', () => {
    const repeat = appendHistoryPage(first, { items: [item('g2', '2026-09-20T10:00:00.000Z')], recurring: [], nextBefore: 'elsewhere' })
    expect(repeat.items.map((i) => i.gradeId)).toEqual(['g1', 'g2'])
    expect(repeat.nextBefore).toBeNull()
    const stuck = appendHistoryPage(first, { items: [item('g3', '2026-06-01T10:00:00.000Z')], recurring: [], nextBefore: first.nextBefore })
    expect(stuck.items).toHaveLength(3)
    expect(stuck.nextBefore).toBeNull()
  })

  it('treats a missing cursor (an older Worker) as the last page', () => {
    const legacy = { items: [item('g3', '2026-06-01T10:00:00.000Z')], recurring: [] } as unknown as HistoryResponse
    expect(appendHistoryPage(first, legacy).nextBefore).toBeNull()
  })
})
