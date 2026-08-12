import { categoryOf } from './categories'
import type { Settings, Tx } from './types'

export interface CategoryTotal {
  id: string
  name: string
  emoji: string
  color: string
  total: number
  share: number
  budget: number
  count: number
}

export interface MonthSummary {
  month: string
  expense: number
  income: number
  net: number
  byCategory: CategoryTotal[]
  byDay: Array<{ day: number; total: number }>
  txCount: number
}

/** YYYY-MM for a date, or for today when omitted. */
export function monthKey(date: Date | string = new Date()): string {
  if (typeof date === 'string') return date.slice(0, 7)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split('-').map(Number)
  const date = new Date(year, m - 1 + delta, 1)
  return monthKey(date)
}

export function monthLabel(month: string): string {
  const [year, m] = month.split('-')
  return `${year}년 ${Number(m)}월`
}

export function daysInMonth(month: string): number {
  const [year, m] = month.split('-').map(Number)
  return new Date(year, m, 0).getDate()
}

export function txsInMonth(txs: Tx[], month: string): Tx[] {
  return txs.filter((tx) => tx.date.startsWith(month))
}

export function summarize(txs: Tx[], month: string, settings: Settings): MonthSummary {
  const scoped = txsInMonth(txs, month)
  const expense = scoped.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
  const income = scoped.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0)

  const totals = new Map<string, { total: number; count: number }>()
  for (const tx of scoped) {
    if (tx.type !== 'expense') continue
    const entry = totals.get(tx.category) ?? { total: 0, count: 0 }
    entry.total += tx.amount
    entry.count += 1
    totals.set(tx.category, entry)
  }

  const byCategory: CategoryTotal[] = [...totals.entries()]
    .map(([id, entry]) => {
      const category = categoryOf(id)
      return {
        id,
        name: category.name,
        emoji: category.emoji,
        color: category.color,
        total: entry.total,
        count: entry.count,
        share: expense > 0 ? entry.total / expense : 0,
        budget: settings.categoryBudgets[id] ?? 0,
      }
    })
    .sort((a, b) => b.total - a.total)

  const byDay = Array.from({ length: daysInMonth(month) }, (_, i) => ({ day: i + 1, total: 0 }))
  for (const tx of scoped) {
    if (tx.type !== 'expense') continue
    const day = Number(tx.date.slice(8, 10))
    if (day >= 1 && day <= byDay.length) byDay[day - 1].total += tx.amount
  }

  return { month, expense, income, net: income - expense, byCategory, byDay, txCount: scoped.length }
}

/** Months that have at least one transaction, newest first, always including now. */
export function availableMonths(txs: Tx[]): string[] {
  const months = new Set(txs.map((tx) => tx.date.slice(0, 7)))
  months.add(monthKey())
  return [...months].sort().reverse()
}

const CURRENCY_LOCALE: Record<Settings['currency'], string> = {
  CAD: 'en-CA',
  USD: 'en-US',
  KRW: 'ko-KR',
}

export function formatMoney(amount: number, currency: Settings['currency'], compact = false): string {
  const fractionDigits = currency === 'KRW' ? 0 : 2
  return new Intl.NumberFormat(CURRENCY_LOCALE[currency], {
    style: 'currency',
    currency,
    minimumFractionDigits: compact ? 0 : fractionDigits,
    maximumFractionDigits: compact ? 0 : fractionDigits,
  }).format(amount)
}

export function formatDay(date: string): string {
  const [, month, day] = date.split('-')
  return `${Number(month)}/${Number(day)}`
}

/**
 * Spend pace: how much of the budget should be used by today if spending were
 * even across the month. Used to tell "over budget" from "just early in the month".
 */
export function budgetPace(month: string, now = new Date()): number {
  if (monthKey(now) !== month) return 1
  return now.getDate() / daysInMonth(month)
}
