'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { parseMessages } from '@/lib/budget/parse'
import { addTxs, useBudget, useHydrated } from '@/lib/budget/store'
import { formatMoney } from '@/lib/budget/stats'
import type { DraftTx } from '@/lib/budget/types'
import { DraftReview } from '../DraftReview'
import { Button, Card } from '../ui'

type Status = 'reading' | 'empty' | 'review' | 'saved'

/**
 * Landing page for phone automations (iOS Shortcuts, Android Tasker/MacroDroid,
 * the share sheet). The alert text arrives in the URL — `?text=...` — gets
 * parsed, and with `auto=1` is saved without any tapping.
 */
export default function IngestPage() {
  const { settings } = useBudget()
  const hydrated = useHydrated()
  const [status, setStatus] = useState<Status>('reading')
  const [drafts, setDrafts] = useState<DraftTx[]>([])
  const [saved, setSaved] = useState<{ added: number; duplicates: number } | null>(null)

  useEffect(() => {
    if (!hydrated) return

    const url = new URL(window.location.href)
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''))
    const text = url.searchParams.get('text') ?? hashParams.get('text') ?? ''
    const auto = (url.searchParams.get('auto') ?? hashParams.get('auto')) === '1'

    if (!text.trim()) {
      setStatus('empty')
      return
    }

    const parsed = parseMessages(text, settings.rules)
    if (parsed.length === 0) {
      setStatus('empty')
      return
    }

    if (auto) {
      setSaved(addTxs(parsed, 'sms'))
      setDrafts(parsed)
      setStatus('saved')
      return
    }

    setDrafts(parsed)
    setStatus('review')
    // Runs once per page load; the URL is the only input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated])

  if (!hydrated || status === 'reading') {
    return <div className="h-40 animate-pulse rounded-2xl bg-gray-100" />
  }

  if (status === 'empty') {
    return (
      <Card>
        <h1 className="text-base font-bold text-gray-900">자동 등록 주소</h1>
        <p className="mt-2 text-sm text-gray-600">
          이 주소는 휴대폰 자동화에서 사용합니다. 결제 문자를 <code className="rounded bg-gray-100 px-1">text</code>{' '}
          값으로 붙여 열면 자동으로 가계부에 저장됩니다.
        </p>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-gray-900 p-3 text-[11px] text-gray-100">
          /budget/ingest?auto=1&amp;text=[문자내용]
        </pre>
        <Link href="/budget/settings" className="mt-3 inline-block text-sm font-medium underline underline-offset-2">
          자동화 설정 방법 보기 →
        </Link>
      </Card>
    )
  }

  if (status === 'saved') {
    const total = drafts.reduce((sum, d) => (d.type === 'expense' ? sum + d.amount : sum), 0)
    return (
      <Card>
        <p className="text-4xl">✅</p>
        <h1 className="mt-2 text-lg font-bold text-gray-900">
          {saved?.added ?? 0}건 자동 저장 완료
        </h1>
        {saved?.duplicates ? (
          <p className="mt-1 text-sm text-gray-500">이미 등록된 {saved.duplicates}건은 건너뛰었어요.</p>
        ) : null}
        <ul className="mt-3 space-y-1 text-sm text-gray-700">
          {drafts.map((draft, i) => (
            <li key={i} className="flex justify-between gap-2">
              <span className="truncate">{draft.merchant}</span>
              <span className="shrink-0 font-semibold tabular-nums">
                {formatMoney(draft.amount, settings.currency)}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-gray-400">지출 합계 {formatMoney(total, settings.currency)}</p>
        <Link href="/budget" className="mt-4 block">
          <Button className="w-full">가계부 열기</Button>
        </Link>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-gray-900">자동 인식된 내역</h1>
      <DraftReview
        drafts={drafts}
        currency={settings.currency}
        onChange={setDrafts}
        onCancel={() => setStatus('empty')}
        onSave={(selected) => {
          setSaved(addTxs(selected, 'sms'))
          setDrafts(selected)
          setStatus('saved')
        }}
      />
    </div>
  )
}
