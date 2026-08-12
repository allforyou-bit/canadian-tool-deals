'use client'

import { useMemo, useState } from 'react'
import { DEFAULT_CATEGORIES, EXPENSE_CATEGORIES, categoryOf } from '@/lib/budget/categories'
import { deleteTx, updateTx, useBudget, useHydrated } from '@/lib/budget/store'
import { availableMonths, formatMoney, monthKey, monthLabel } from '@/lib/budget/stats'
import type { Tx } from '@/lib/budget/types'
import { Button, Card, EmptyState, inputClass } from '../ui'

export default function ListPage() {
  const { txs, settings } = useBudget()
  const hydrated = useHydrated()
  const [month, setMonth] = useState<string>(monthKey())
  const [category, setCategory] = useState('all')
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  const months = useMemo(() => availableMonths(txs), [txs])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return txs
      .filter((tx) => (month === 'all' ? true : tx.date.startsWith(month)))
      .filter((tx) => (category === 'all' ? true : tx.category === category))
      .filter(
        (tx) =>
          !needle ||
          tx.merchant.toLowerCase().includes(needle) ||
          tx.account.toLowerCase().includes(needle) ||
          (tx.memo ?? '').toLowerCase().includes(needle),
      )
      .sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : b.date.localeCompare(a.date)))
  }, [txs, month, category, query])

  const groups = useMemo(() => {
    const map = new Map<string, Tx[]>()
    for (const tx of filtered) {
      const list = map.get(tx.date) ?? []
      list.push(tx)
      map.set(tx.date, list)
    }
    return [...map.entries()]
  }, [filtered])

  const expense = filtered.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)

  if (!hydrated) return <div className="h-64 animate-pulse rounded-2xl bg-gray-100" />

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-gray-900">내역</h1>

      <div className="space-y-2">
        <div className="flex gap-2">
          <select value={month} onChange={(e) => setMonth(e.target.value)} className={`${inputClass} py-2`}>
            {months.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
            <option value="all">전체 기간</option>
          </select>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={`${inputClass} py-2`}
          >
            <option value="all">전체 분류</option>
            {DEFAULT_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji} {c.name}
              </option>
            ))}
          </select>
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="가맹점, 결제 수단 검색"
          className={`${inputClass} py-2`}
        />
      </div>

      <p className="text-sm text-gray-500">
        {filtered.length}건 · 지출 합계{' '}
        <span className="font-semibold text-gray-900">{formatMoney(expense, settings.currency)}</span>
      </p>

      {filtered.length === 0 ? (
        <EmptyState title="조건에 맞는 내역이 없어요" hint="필터를 바꾸거나 새 내역을 추가해 보세요." />
      ) : (
        <div className="space-y-3">
          {groups.map(([date, items]) => (
            <Card key={date}>
              <h2 className="mb-2 text-xs font-semibold text-gray-500">{date}</h2>
              <ul className="divide-y divide-gray-100">
                {items.map((tx) => (
                  <TxRow
                    key={tx.id}
                    tx={tx}
                    currency={settings.currency}
                    open={openId === tx.id}
                    onToggle={() => setOpenId(openId === tx.id ? null : tx.id)}
                  />
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function TxRow({
  tx,
  currency,
  open,
  onToggle,
}: {
  tx: Tx
  currency: 'CAD' | 'KRW' | 'USD'
  open: boolean
  onToggle: () => void
}) {
  const category = categoryOf(tx.category)

  return (
    <li className="py-2.5">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 text-left">
        <span aria-hidden className="text-lg">
          {category.emoji}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-gray-900">{tx.merchant}</span>
          <span className="block text-xs text-gray-500">
            {category.name} · {tx.account}
          </span>
        </span>
        <span
          className={`shrink-0 text-sm font-semibold tabular-nums ${
            tx.type === 'income' ? 'text-emerald-700' : 'text-gray-900'
          }`}
        >
          {tx.type === 'income' ? '+' : '−'}
          {formatMoney(tx.amount, currency)}
        </span>
      </button>

      {open && (
        <div className="mt-2 space-y-2 rounded-xl bg-gray-50 p-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-xs text-gray-500">내용</span>
              <input
                className={`${inputClass} py-2 text-sm`}
                value={tx.merchant}
                onChange={(e) => updateTx(tx.id, { merchant: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-gray-500">금액</span>
              <input
                type="number"
                step="0.01"
                className={`${inputClass} py-2 text-sm`}
                value={tx.amount}
                onChange={(e) => updateTx(tx.id, { amount: Number(e.target.value) })}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-gray-500">날짜</span>
              <input
                type="date"
                className={`${inputClass} py-2 text-sm`}
                value={tx.date}
                onChange={(e) => updateTx(tx.id, { date: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-gray-500">분류</span>
              <select
                className={`${inputClass} py-2 text-sm`}
                value={tx.category}
                onChange={(e) => updateTx(tx.id, { category: e.target.value })}
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.emoji} {c.name}
                  </option>
                ))}
                <option value="income">💰 수입</option>
              </select>
            </label>
            <label className="col-span-2 block">
              <span className="mb-1 block text-xs text-gray-500">메모</span>
              <input
                className={`${inputClass} py-2 text-sm`}
                value={tx.memo ?? ''}
                placeholder="선택 사항"
                onChange={(e) => updateTx(tx.id, { memo: e.target.value })}
              />
            </label>
          </div>
          {tx.raw && (
            <p className="rounded-lg bg-white p-2 text-[11px] leading-relaxed whitespace-pre-wrap text-gray-500">
              {tx.raw}
            </p>
          )}
          <div className="flex justify-end">
            <Button variant="danger" onClick={() => deleteTx(tx.id)}>
              삭제
            </Button>
          </div>
        </div>
      )}
    </li>
  )
}
