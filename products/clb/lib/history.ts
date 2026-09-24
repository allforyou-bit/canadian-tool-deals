// Account-page history: pages of GET /api/history (newest first) joined into one list.
import type { HistoryResponse } from '../shared/api'

/**
 * Add an older page below the items already shown. The recurring error types come from the first
 * page only (they describe recent work), so they are kept; the cursor moves to the new page's.
 * An item that is already listed is not listed twice, and a cursor that did not move ends paging
 * (so a faulty answer cannot leave a "Show older" button that never adds anything).
 */
export function appendHistoryPage(shown: HistoryResponse, older: HistoryResponse): HistoryResponse {
  const seen = new Set(shown.items.map((i) => i.gradeId))
  const added = older.items.filter((i) => !seen.has(i.gradeId))
  const cursor = older.nextBefore ?? null
  return {
    items: [...shown.items, ...added],
    recurring: shown.recurring,
    nextBefore: added.length > 0 && cursor !== shown.nextBefore ? cursor : null,
  }
}
