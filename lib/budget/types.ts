export type TxType = 'expense' | 'income'

export type TxSource = 'manual' | 'sms' | 'csv'

export interface Tx {
  id: string
  /** YYYY-MM-DD */
  date: string
  /** Always positive; `type` carries the sign. */
  amount: number
  type: TxType
  merchant: string
  /** Category id, see DEFAULT_CATEGORIES. */
  category: string
  /** Card or bank the money moved through, e.g. "신한카드", "TD Visa". */
  account: string
  memo?: string
  source: TxSource
  /** Original SMS / CSV row the transaction was parsed from. */
  raw?: string
  createdAt: number
}

export interface Category {
  id: string
  name: string
  emoji: string
  /** Tailwind-independent hex, used for bars and dots. */
  color: string
  type: TxType
}

export interface Rule {
  id: string
  keyword: string
  category: string
}

export interface Settings {
  currency: 'CAD' | 'KRW' | 'USD'
  /** Total spending budget for one month, 0 = not set. */
  monthlyBudget: number
  categoryBudgets: Record<string, number>
  rules: Rule[]
}

export interface BudgetState {
  txs: Tx[]
  settings: Settings
}

/** A transaction parsed out of text or CSV, before the user confirms it. */
export interface DraftTx {
  date: string
  amount: number
  type: TxType
  merchant: string
  category: string
  account: string
  raw: string
  /** 0–1, how sure the parser is. Low confidence rows get flagged in review. */
  confidence: number
}
