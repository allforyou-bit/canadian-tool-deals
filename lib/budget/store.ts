'use client'

import { useCallback, useSyncExternalStore } from 'react'
import type { BudgetState, DraftTx, Settings, Tx } from './types'

/**
 * All data lives in the browser's localStorage — no account, no server, nothing
 * leaves the phone. Backup/restore is a JSON file the user downloads.
 */

const STORAGE_KEY = 'budget:v1'

export const DEFAULT_SETTINGS: Settings = {
  currency: 'CAD',
  monthlyBudget: 0,
  categoryBudgets: {},
  rules: [],
}

const EMPTY_STATE: BudgetState = { txs: [], settings: DEFAULT_SETTINGS }

let cache: BudgetState | null = null
const listeners = new Set<() => void>()

function readStorage(): BudgetState {
  if (typeof window === 'undefined') return EMPTY_STATE
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY_STATE
    const parsed = JSON.parse(raw) as Partial<BudgetState>
    return {
      txs: Array.isArray(parsed.txs) ? parsed.txs : [],
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
    }
  } catch {
    return EMPTY_STATE
  }
}

function getSnapshot(): BudgetState {
  if (!cache) cache = readStorage()
  return cache
}

function getServerSnapshot(): BudgetState {
  return EMPTY_STATE
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function commit(next: BudgetState) {
  cache = next
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Quota exceeded or private mode — keep the in-memory state so the UI still works.
    }
  }
  listeners.forEach((listener) => listener())
}

function update(mutate: (state: BudgetState) => BudgetState) {
  commit(mutate(getSnapshot()))
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/** Same day + same amount + same merchant = the same payment, seen twice. */
function dedupeKey(tx: Pick<Tx, 'date' | 'amount' | 'merchant' | 'type'>): string {
  return `${tx.date}|${tx.amount}|${tx.merchant.trim().toLowerCase()}|${tx.type}`
}

export function draftToTx(draft: DraftTx, source: Tx['source']): Tx {
  return {
    id: newId(),
    date: draft.date,
    amount: draft.amount,
    type: draft.type,
    merchant: draft.merchant,
    category: draft.category,
    account: draft.account,
    source,
    raw: draft.raw,
    createdAt: Date.now(),
  }
}

export function addTxs(drafts: DraftTx[], source: Tx['source']): { added: number; duplicates: number } {
  const state = getSnapshot()
  const seen = new Set(state.txs.map(dedupeKey))
  const fresh: Tx[] = []
  let duplicates = 0

  for (const draft of drafts) {
    const key = dedupeKey(draft)
    if (seen.has(key)) {
      duplicates++
      continue
    }
    seen.add(key)
    fresh.push(draftToTx(draft, source))
  }

  if (fresh.length > 0) {
    update((prev) => ({ ...prev, txs: [...fresh, ...prev.txs] }))
  }
  return { added: fresh.length, duplicates }
}

export function updateTx(id: string, patch: Partial<Tx>) {
  update((prev) => ({
    ...prev,
    txs: prev.txs.map((tx) => (tx.id === id ? { ...tx, ...patch } : tx)),
  }))
}

export function deleteTx(id: string) {
  update((prev) => ({ ...prev, txs: prev.txs.filter((tx) => tx.id !== id) }))
}

export function saveSettings(patch: Partial<Settings>) {
  update((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } }))
}

export function replaceAll(state: BudgetState) {
  commit({
    txs: state.txs ?? [],
    settings: { ...DEFAULT_SETTINGS, ...(state.settings ?? {}) },
  })
}

export function clearAll() {
  commit(EMPTY_STATE)
}

export function useBudget() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const isEmpty = state.txs.length === 0
  return { ...state, isEmpty }
}

/** True once localStorage has been read, so pages can avoid flashing empty state. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    useCallback((listener: () => void) => {
      listener()
      return () => {}
    }, []),
    () => true,
    () => false,
  )
}

export function exportJson(state: BudgetState): string {
  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), ...state }, null, 2)
}

export function txsToCsv(txs: Tx[]): string {
  const header = ['date', 'type', 'amount', 'merchant', 'category', 'account', 'memo']
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`
  const lines = txs.map((tx) =>
    [tx.date, tx.type, String(tx.amount), tx.merchant, tx.category, tx.account, tx.memo ?? '']
      .map(escape)
      .join(','),
  )
  return [header.join(','), ...lines].join('\n')
}
