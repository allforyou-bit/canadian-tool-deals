'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { categoryOf } from '@/lib/budget/categories'
import { useBudget, useHydrated } from '@/lib/budget/store'
import {
  budgetPace,
  formatDay,
  formatMoney,
  monthKey,
  monthLabel,
  shiftMonth,
  summarize,
} from '@/lib/budget/stats'
import type { MonthSummary } from '@/lib/budget/stats'
import type { Settings, Tx } from '@/lib/budget/types'
import { Button, Card, CardTitle, EmptyState } from './ui'

export default function BudgetHome() {
  const { txs, settings } = useBudget()
  const hydrated = useHydrated()
  const [month, setMonth] = useState(monthKey())

  const summary = useMemo(() => summarize(txs, month, settings), [txs, month, settings])
  const recent = useMemo(
    () =>
      [...txs]
        .filter((tx) => tx.date.startsWith(month))
        .sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : b.date.localeCompare(a.date)))
        .slice(0, 6),
    [txs, month],
  )

  if (!hydrated) {
    return <div className="h-64 animate-pulse rounded-2xl bg-gray-100" />
  }

  return (
    <div className="space-y-4">
      <MonthSwitcher month={month} onChange={setMonth} />

      <SummaryCard summary={summary} settings={settings} />

      {txs.length === 0 ? (
        <EmptyState
          title="아직 등록된 내역이 없어요"
          hint="결제 문자를 붙여넣으면 날짜·금액·가맹점·분류가 자동으로 채워집니다."
          action={
            <Link href="/budget/add">
              <Button>문자 붙여넣고 시작하기</Button>
            </Link>
          }
        />
      ) : (
        <>
          <DailySpendChart summary={summary} currency={settings.currency} />
          <CategoryBreakdown summary={summary} currency={settings.currency} />
          <RecentList txs={recent} currency={settings.currency} />
        </>
      )}
    </div>
  )
}

function MonthSwitcher({ month, onChange }: { month: string; onChange: (month: string) => void }) {
  const isCurrent = month === monthKey()
  return (
    <div className="flex items-center justify-between">
      <button
        type="button"
        onClick={() => onChange(shiftMonth(month, -1))}
        aria-label="이전 달"
        className="rounded-full px-3 py-1.5 text-lg text-gray-400 hover:bg-gray-200/60"
      >
        ‹
      </button>
      <h1 className="text-base font-bold text-gray-900">{monthLabel(month)}</h1>
      <button
        type="button"
        onClick={() => onChange(shiftMonth(month, 1))}
        disabled={isCurrent}
        aria-label="다음 달"
        className="rounded-full px-3 py-1.5 text-lg text-gray-400 hover:bg-gray-200/60 disabled:opacity-30"
      >
        ›
      </button>
    </div>
  )
}

function SummaryCard({ summary, settings }: { summary: MonthSummary; settings: Settings }) {
  const { currency, monthlyBudget } = settings
  const pace = budgetPace(summary.month)
  const used = monthlyBudget > 0 ? summary.expense / monthlyBudget : 0
  const remaining = monthlyBudget - summary.expense
  const onTrack = used <= pace

  return (
    <Card>
      <p className="text-sm text-gray-500">이번 달 지출</p>
      <p className="mt-1 text-4xl font-bold tracking-tight text-gray-900 tabular-nums">
        {formatMoney(summary.expense, currency)}
      </p>

      <dl className="mt-3 flex gap-6 text-sm">
        <div>
          <dt className="text-gray-500">수입</dt>
          <dd className="font-semibold text-emerald-700 tabular-nums">
            {formatMoney(summary.income, currency)}
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">남은 돈</dt>
          <dd
            className={`font-semibold tabular-nums ${summary.net < 0 ? 'text-red-600' : 'text-gray-900'}`}
          >
            {formatMoney(summary.net, currency)}
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">건수</dt>
          <dd className="font-semibold text-gray-900 tabular-nums">{summary.txCount}건</dd>
        </div>
      </dl>

      {monthlyBudget > 0 ? (
        <div className="mt-4">
          <div className="mb-1.5 flex items-baseline justify-between text-xs">
            <span className="font-medium text-gray-700">
              예산 {formatMoney(monthlyBudget, currency, true)} 중 {Math.round(used * 100)}% 사용
            </span>
            <span className={remaining < 0 ? 'font-semibold text-red-600' : 'text-gray-500'}>
              {remaining < 0
                ? `${formatMoney(Math.abs(remaining), currency, true)} 초과`
                : `${formatMoney(remaining, currency, true)} 남음`}
            </span>
          </div>
          <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className={`h-full rounded-full ${remaining < 0 ? 'bg-red-500' : onTrack ? 'bg-emerald-600' : 'bg-amber-500'}`}
              style={{ width: `${Math.min(100, used * 100)}%` }}
            />
          </div>
          <div className="relative mt-1 h-3">
            <span
              className="absolute -translate-x-1/2 text-[10px] whitespace-nowrap text-gray-400"
              style={{ left: `${Math.min(100, pace * 100)}%` }}
            >
              ▲ 오늘 기준 {Math.round(pace * 100)}%
            </span>
          </div>
        </div>
      ) : (
        <Link
          href="/budget/settings"
          className="mt-4 inline-block text-xs font-medium text-gray-500 underline underline-offset-2"
        >
          월 예산을 정하면 남은 돈이 한눈에 보여요 →
        </Link>
      )}
    </Card>
  )
}

function DailySpendChart({ summary, currency }: { summary: MonthSummary; currency: Settings['currency'] }) {
  const max = Math.max(...summary.byDay.map((d) => d.total), 1)
  const todayDay = monthKey() === summary.month ? new Date().getDate() : -1
  const lastDay = summary.byDay.length

  return (
    <Card>
      <CardTitle>일별 지출</CardTitle>
      <div className="flex h-28 items-end gap-[3px]">
        {summary.byDay.map((entry) => (
          <div key={entry.day} className="group relative flex h-full flex-1 items-end">
            <button
              type="button"
              aria-label={`${entry.day}일 ${formatMoney(entry.total, currency)}`}
              className={`w-full rounded-t-[4px] transition-colors ${
                entry.total > 0
                  ? 'bg-[#2a78d6] hover:bg-[#1f5fae]'
                  : entry.day === todayDay
                    ? 'bg-gray-400'
                    : 'bg-gray-200'
              } ${entry.day === todayDay && entry.total > 0 ? 'ring-2 ring-gray-900/60' : ''}`}
              style={{ height: entry.total > 0 ? `${Math.max(4, (entry.total / max) * 100)}%` : '3px' }}
            />
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded-lg bg-gray-900 px-2 py-1 text-[11px] whitespace-nowrap text-white group-hover:block group-focus-within:block">
              {entry.day}일 · {formatMoney(entry.total, currency)}
            </span>
          </div>
        ))}
      </div>
      <div className="relative mt-1.5 h-4 text-[10px] text-gray-400 tabular-nums">
        {[1, 10, 20, lastDay].map((day) => (
          <span
            key={day}
            className="absolute -translate-x-1/2"
            style={{ left: `${((day - 0.5) / lastDay) * 100}%` }}
          >
            {day}
          </span>
        ))}
      </div>
    </Card>
  )
}

function CategoryBreakdown({
  summary,
  currency,
}: {
  summary: MonthSummary
  currency: Settings['currency']
}) {
  if (summary.byCategory.length === 0) {
    return (
      <Card>
        <CardTitle>분류별 지출</CardTitle>
        <p className="text-sm text-gray-500">이번 달 지출 내역이 없어요.</p>
      </Card>
    )
  }

  return (
    <Card>
      <CardTitle
        action={
          <Link href="/budget/list" className="text-xs font-medium text-gray-500 underline underline-offset-2">
            전체 보기
          </Link>
        }
      >
        분류별 지출
      </CardTitle>
      <ul className="space-y-3">
        {summary.byCategory.map((category) => (
          <li key={category.id}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate font-medium text-gray-800">
                <span aria-hidden>{category.emoji}</span> {category.name}
                <span className="ml-1.5 text-xs text-gray-400">{Math.round(category.share * 100)}%</span>
              </span>
              <span className="shrink-0 font-semibold text-gray-900 tabular-nums">
                {formatMoney(category.total, currency)}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(2, category.share * 100)}%`, backgroundColor: category.color }}
              />
            </div>
            {category.budget > 0 && (
              <p className="mt-1 text-[11px] text-gray-400">
                분류 예산 {formatMoney(category.budget, currency, true)} 중{' '}
                {Math.round((category.total / category.budget) * 100)}% 사용
              </p>
            )}
          </li>
        ))}
      </ul>
    </Card>
  )
}

function RecentList({ txs, currency }: { txs: Tx[]; currency: Settings['currency'] }) {
  if (txs.length === 0) return null
  return (
    <Card>
      <CardTitle
        action={
          <Link href="/budget/list" className="text-xs font-medium text-gray-500 underline underline-offset-2">
            전체 보기
          </Link>
        }
      >
        최근 내역
      </CardTitle>
      <ul className="divide-y divide-gray-100">
        {txs.map((tx) => {
          const category = categoryOf(tx.category)
          return (
            <li key={tx.id} className="flex items-center gap-3 py-2.5">
              <span aria-hidden className="text-lg">
                {category.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">{tx.merchant}</p>
                <p className="text-xs text-gray-500">
                  {formatDay(tx.date)} · {tx.account}
                </p>
              </div>
              <span
                className={`shrink-0 text-sm font-semibold tabular-nums ${
                  tx.type === 'income' ? 'text-emerald-700' : 'text-gray-900'
                }`}
              >
                {tx.type === 'income' ? '+' : '−'}
                {formatMoney(tx.amount, currency)}
              </span>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
