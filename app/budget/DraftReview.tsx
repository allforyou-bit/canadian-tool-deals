'use client'

import { useState } from 'react'
import { EXPENSE_CATEGORIES, DEFAULT_CATEGORIES } from '@/lib/budget/categories'
import { formatMoney } from '@/lib/budget/stats'
import type { DraftTx, Settings } from '@/lib/budget/types'
import { Button, inputClass } from './ui'

/**
 * Confirmation step shared by the paste, CSV and automation flows. Nothing is
 * saved until the user presses the button here, and low-confidence rows are
 * flagged so they get a second look.
 */
export function DraftReview({
  drafts,
  currency,
  onChange,
  onSave,
  onCancel,
  saveLabel,
}: {
  drafts: DraftTx[]
  currency: Settings['currency']
  onChange: (next: DraftTx[]) => void
  onSave: (selected: DraftTx[]) => void
  onCancel: () => void
  saveLabel?: string
}) {
  const [excluded, setExcluded] = useState<Set<number>>(new Set())
  const [expanded, setExpanded] = useState<number | null>(null)

  const selected = drafts.filter((_, i) => !excluded.has(i))
  const total = selected.reduce((sum, d) => sum + (d.type === 'expense' ? d.amount : 0), 0)
  // Amounts are stored as plain numbers, so a 원 alert under a $ setting would read wrong.
  const currencyMismatch = currency !== 'KRW' && drafts.some((d) => d.raw.includes('원'))

  const toggle = (index: number) => {
    setExcluded((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const patch = (index: number, changes: Partial<DraftTx>) => {
    onChange(drafts.map((d, i) => (i === index ? { ...d, ...changes } : d)))
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        {drafts.length}건을 찾았어요. 확인하고 저장하세요.
        <span className="ml-1 text-gray-400">지출 합계 {formatMoney(total, currency)}</span>
      </p>

      {currencyMismatch && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
          원화 문자로 보여요. 설정에서 통화를 KRW로 바꾸면 금액이 원 단위로 표시됩니다.
        </p>
      )}

      <ul className="space-y-2">
        {drafts.map((draft, index) => {
          const isExcluded = excluded.has(index)
          const isOpen = expanded === index
          const uncertain = draft.confidence < 0.7
          return (
            <li
              key={index}
              className={`rounded-2xl border bg-white p-3 shadow-sm transition-opacity ${
                isExcluded ? 'border-gray-200 opacity-40' : 'border-gray-200'
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={!isExcluded}
                  onChange={() => toggle(index)}
                  aria-label={`${draft.merchant} 포함`}
                  className="mt-1 size-5 shrink-0 accent-gray-900"
                />
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : index)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-semibold text-gray-900">{draft.merchant}</span>
                    <span
                      className={`shrink-0 text-sm font-semibold tabular-nums ${
                        draft.type === 'income' ? 'text-emerald-700' : 'text-gray-900'
                      }`}
                    >
                      {draft.type === 'income' ? '+' : '−'}
                      {formatMoney(draft.amount, currency)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-gray-500">
                    <span>{draft.date}</span>
                    <span>·</span>
                    <span>{draft.account}</span>
                    <span>·</span>
                    <span>
                      {DEFAULT_CATEGORIES.find((c) => c.id === draft.category)?.emoji}{' '}
                      {DEFAULT_CATEGORIES.find((c) => c.id === draft.category)?.name}
                    </span>
                    {uncertain && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800">
                        확인 필요
                      </span>
                    )}
                  </div>
                </button>
              </div>

              {isOpen && (
                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-gray-100 pt-3">
                  <label className="col-span-2 block">
                    <span className="mb-1 block text-xs text-gray-500">내용</span>
                    <input
                      className={inputClass}
                      value={draft.merchant}
                      onChange={(e) => patch(index, { merchant: e.target.value })}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-gray-500">날짜</span>
                    <input
                      type="date"
                      className={inputClass}
                      value={draft.date}
                      onChange={(e) => patch(index, { date: e.target.value })}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-gray-500">금액</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      className={inputClass}
                      value={draft.amount}
                      onChange={(e) => patch(index, { amount: Number(e.target.value) })}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-gray-500">분류</span>
                    <select
                      className={inputClass}
                      value={draft.category}
                      onChange={(e) => patch(index, { category: e.target.value })}
                    >
                      {EXPENSE_CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.emoji} {c.name}
                        </option>
                      ))}
                      <option value="income">💰 수입</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-gray-500">유형</span>
                    <select
                      className={inputClass}
                      value={draft.type}
                      onChange={(e) =>
                        patch(index, {
                          type: e.target.value as DraftTx['type'],
                          category: e.target.value === 'income' ? 'income' : draft.category,
                        })
                      }
                    >
                      <option value="expense">지출</option>
                      <option value="income">수입</option>
                    </select>
                  </label>
                  {draft.raw && (
                    <p className="col-span-2 rounded-xl bg-gray-50 p-2 text-[11px] leading-relaxed whitespace-pre-wrap text-gray-500">
                      {draft.raw}
                    </p>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>

      <div className="flex gap-2">
        <Button onClick={() => onSave(selected)} disabled={selected.length === 0} className="flex-1">
          {saveLabel ?? `${selected.length}건 저장`}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          취소
        </Button>
      </div>
    </div>
  )
}
