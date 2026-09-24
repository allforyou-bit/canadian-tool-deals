import { AI_DISCLOSURE, NOT_AFFILIATED } from '../shared/config'

/**
 * Required on every practice page ABOVE the answer input, before any submission (memo B1):
 * the AI disclosure in English and Korean, plus the not-affiliated statement.
 */
export function AiDisclosure() {
  return (
    <div role="note" aria-label="AI feedback notice" className="rounded-md border border-sky-300 bg-sky-50 p-4" data-testid="ai-disclosure">
      <p className="font-semibold text-sky-950">{AI_DISCLOSURE.en}</p>
      <p lang="ko" className="mt-1 text-sm text-sky-950">
        {AI_DISCLOSURE.ko}
      </p>
      <p className="mt-3 text-xs text-slate-700">{NOT_AFFILIATED.en}</p>
    </div>
  )
}
