import { guessCategory } from './categories'
import { toISODate } from './parse'
import type { DraftTx, Rule } from './types'

/**
 * CSV import for bank / credit-card statement exports. Canadian banks disagree
 * on headers, column order and sign conventions, so everything is auto-detected
 * and then shown to the user for confirmation.
 */

export type SignMode = 'auto' | 'negative-expense' | 'positive-expense'

export interface CsvColumns {
  date: number
  description: number
  /** Single signed amount column, or -1 when debit/credit are split. */
  amount: number
  debit: number
  credit: number
  hasHeader: boolean
}

/** RFC4180-ish parser: handles quoted fields, embedded commas and newlines. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  const input = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n')

  for (let i = 0; i < input.length; i++) {
    const char = input[i]
    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }
    if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      row.push(field.trim())
      field = ''
    } else if (char === '\n') {
      row.push(field.trim())
      if (row.some((c) => c !== '')) rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }
  row.push(field.trim())
  if (row.some((c) => c !== '')) rows.push(row)

  return rows
}

const HEADER_HINTS = {
  date: ['date', 'transaction date', 'posted', 'posting date', '날짜', '거래일', '이용일', '승인일'],
  description: ['description', 'merchant', 'details', 'payee', 'narrative', 'memo', 'name',
    '내용', '적요', '가맹점', '거래처', '내역'],
  amount: ['amount', 'cad$', 'value', '금액', '거래금액', '이용금액'],
  debit: ['debit', 'withdrawal', 'withdrawals', 'charge', 'money out', 'spent', '출금', '지출'],
  credit: ['credit', 'deposit', 'deposits', 'money in', 'received', '입금', '수입'],
}

function headerMatch(cell: string, hints: string[]): boolean {
  const value = cell.toLowerCase().trim()
  return hints.some((hint) => value === hint || value.includes(hint))
}

/** Parses the date formats statement exports actually use. Returns '' on failure. */
export function parseCsvDate(value: string): string {
  const text = value.trim()
  if (!text) return ''

  const iso = text.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/)
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`

  const slash = text.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{2,4})/)
  if (slash) {
    let first = +slash[1]
    let second = +slash[2]
    // Canadian exports are usually MM/DD/YYYY; flip when the first field can't be a month.
    if (first > 12 && second <= 12) [first, second] = [second, first]
    const year = slash[3].length === 2 ? 2000 + +slash[3] : +slash[3]
    if (first >= 1 && first <= 12 && second >= 1 && second <= 31) {
      return `${year}-${String(first).padStart(2, '0')}-${String(second).padStart(2, '0')}`
    }
  }

  const parsed = new Date(text)
  if (!Number.isNaN(parsed.getTime())) return toISODate(parsed)

  return ''
}

/** Reads "$1,234.56", "(45.00)" and "-45.00" as numbers. Returns NaN otherwise. */
export function parseMoney(value: string): number {
  const text = value.replace(/[$₩\s]/g, '').replace(/,/g, '').replace(/(CAD|USD|KRW|원)/gi, '')
  if (!text) return NaN
  const negative = /^\(.*\)$/.test(text)
  const num = parseFloat(negative ? text.replace(/[()]/g, '') : text)
  if (!Number.isFinite(num)) return NaN
  return negative ? -num : num
}

export function detectColumns(rows: string[][]): CsvColumns {
  const columns: CsvColumns = { date: -1, description: -1, amount: -1, debit: -1, credit: -1, hasHeader: false }
  if (rows.length === 0) return columns

  const header = rows[0]
  const headerLooksLikeData = header.some((cell) => parseCsvDate(cell) !== '')

  if (!headerLooksLikeData) {
    columns.hasHeader = true
    header.forEach((cell, i) => {
      if (columns.date < 0 && headerMatch(cell, HEADER_HINTS.date)) columns.date = i
      else if (columns.debit < 0 && headerMatch(cell, HEADER_HINTS.debit)) columns.debit = i
      else if (columns.credit < 0 && headerMatch(cell, HEADER_HINTS.credit)) columns.credit = i
      else if (columns.amount < 0 && headerMatch(cell, HEADER_HINTS.amount)) columns.amount = i
      else if (columns.description < 0 && headerMatch(cell, HEADER_HINTS.description)) columns.description = i
    })
  }

  const body = rows.slice(columns.hasHeader ? 1 : 0).slice(0, 30)
  const width = Math.max(...rows.map((r) => r.length))

  const dateHits = new Array(width).fill(0)
  const moneyHits = new Array(width).fill(0)
  const textLength = new Array(width).fill(0)

  for (const row of body) {
    for (let i = 0; i < width; i++) {
      const cell = row[i] ?? ''
      if (parseCsvDate(cell)) dateHits[i]++
      if (Number.isFinite(parseMoney(cell))) moneyHits[i]++
      else textLength[i] += cell.length
    }
  }

  const bestIndex = (scores: number[], exclude: number[]) => {
    let best = -1
    let bestScore = 0
    scores.forEach((score, i) => {
      if (exclude.includes(i)) return
      if (score > bestScore) {
        bestScore = score
        best = i
      }
    })
    return best
  }

  if (columns.date < 0) columns.date = bestIndex(dateHits, [])
  if (columns.description < 0) {
    columns.description = bestIndex(textLength, [columns.date, columns.amount, columns.debit, columns.credit])
  }
  if (columns.amount < 0 && columns.debit < 0 && columns.credit < 0) {
    columns.amount = bestIndex(moneyHits, [columns.date, columns.description])
  }

  return columns
}

/** Chooses which sign means "money spent", based on how the file leans. */
function resolveSignMode(values: number[], mode: SignMode): 'negative-expense' | 'positive-expense' {
  if (mode !== 'auto') return mode
  const negatives = values.filter((v) => v < 0).length
  const positives = values.filter((v) => v > 0).length
  return negatives > positives ? 'negative-expense' : 'positive-expense'
}

export interface CsvImportResult {
  drafts: DraftTx[]
  columns: CsvColumns
  skipped: number
  totalRows: number
}

export function csvToDrafts(text: string, rules: Rule[] = [], mode: SignMode = 'auto'): CsvImportResult {
  const rows = parseCsv(text)
  const columns = detectColumns(rows)
  const body = rows.slice(columns.hasHeader ? 1 : 0)

  const signedValues = columns.amount >= 0
    ? body.map((r) => parseMoney(r[columns.amount] ?? '')).filter(Number.isFinite)
    : []
  const signMode = resolveSignMode(signedValues, mode)

  const drafts: DraftTx[] = []
  let skipped = 0

  for (const row of body) {
    const date = parseCsvDate(row[columns.date] ?? '')
    const merchant = (row[columns.description] ?? '').trim() || '미분류 결제'

    let amount = NaN
    let type: DraftTx['type'] = 'expense'

    if (columns.debit >= 0 || columns.credit >= 0) {
      const debit = parseMoney(row[columns.debit] ?? '')
      const credit = parseMoney(row[columns.credit] ?? '')
      if (Number.isFinite(debit) && debit !== 0) {
        amount = Math.abs(debit)
        type = 'expense'
      } else if (Number.isFinite(credit) && credit !== 0) {
        amount = Math.abs(credit)
        type = 'income'
      }
    } else if (columns.amount >= 0) {
      const value = parseMoney(row[columns.amount] ?? '')
      if (Number.isFinite(value) && value !== 0) {
        amount = Math.abs(value)
        const isNegative = value < 0
        type = signMode === 'negative-expense'
          ? (isNegative ? 'expense' : 'income')
          : (isNegative ? 'income' : 'expense')
      }
    }

    if (!date || !Number.isFinite(amount) || amount <= 0) {
      skipped++
      continue
    }

    drafts.push({
      date,
      amount,
      type,
      merchant,
      category: type === 'income' ? 'income' : guessCategory(merchant, rules),
      account: 'CSV 가져오기',
      raw: row.join(', '),
      confidence: 0.9,
    })
  }

  return { drafts, columns, skipped, totalRows: body.length }
}
