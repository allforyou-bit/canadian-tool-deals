import { guessCategory } from './categories'
import { toISODate } from './parse'
import type { DraftTx, Rule } from './types'

/**
 * CSV import for bank / credit-card statement exports. Canadian banks disagree
 * on headers, column order and sign conventions, so everything is auto-detected
 * and then shown to the user for confirmation.
 */

export type SignMode = 'auto' | 'negative-expense' | 'positive-expense'

export type Delimiter = ',' | '\t' | ';' | '|'

export interface CsvColumns {
  date: number
  description: number
  /** Single signed amount column, or -1 when debit/credit are split. */
  amount: number
  debit: number
  credit: number
  /** Running-balance column, detected so it is never mistaken for the amount. */
  balance: number
  hasHeader: boolean
}

/**
 * Works out how the columns are separated. Text copied from a bank website is
 * usually tab-separated; some tables come across with runs of spaces instead,
 * which get normalised to tabs.
 */
export function sniffDelimiter(text: string): { delimiter: Delimiter; normalized: string } {
  /** How table-like the text is once split on this separator. */
  const score = (candidate: string, source: string): number => {
    const lines = source
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 20)
    if (lines.length === 0) return 0

    const widths = lines.map((line) => line.split(candidate).length)
    const maxWidth = Math.max(...widths)
    if (maxWidth < 2) return 0

    const consistent = widths.filter((width) => width === maxWidth).length / lines.length
    return consistent * 10 + Math.min(maxWidth, 8)
  }

  // Runs of spaces are how an HTML table usually lands in the clipboard.
  const spaceNormalized = text.replace(/ {2,}/g, '\t')
  const candidates: Array<{ delimiter: Delimiter; normalized: string }> = [
    { delimiter: '\t', normalized: text },
    { delimiter: ';', normalized: text },
    { delimiter: '|', normalized: text },
    { delimiter: ',', normalized: text },
    { delimiter: '\t', normalized: spaceNormalized },
  ]

  let best = { delimiter: ',' as Delimiter, normalized: text, score: 0 }
  for (const candidate of candidates) {
    const value = score(candidate.delimiter, candidate.normalized)
    if (value > best.score) best = { ...candidate, score: value }
  }

  return { delimiter: best.delimiter, normalized: best.normalized }
}

/** RFC4180-ish parser: handles quoted fields, embedded separators and newlines. */
export function parseCsv(text: string, delimiter: Delimiter = ','): string[][] {
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
    } else if (char === delimiter) {
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
  balance: ['balance', 'running balance', '잔액', '잔고', '거래후잔액', '거래후 잔액'],
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

  // "Aug 12, 2026" and friends. Guarded by the month-name test, otherwise Date
  // happily turns a bare "12" into a date and every number becomes a date column.
  if (/[A-Za-z]{3}/.test(text) && /\d/.test(text)) {
    const parsed = new Date(text)
    if (!Number.isNaN(parsed.getTime())) return toISODate(parsed)
  }

  return ''
}

/** Reads "$1,234.56", "(45.00)", "-45.00" and "45.00-" as numbers. NaN otherwise. */
export function parseMoney(value: string): number {
  let text = value.replace(/[$₩\s]/g, '').replace(/,/g, '').replace(/(CAD|USD|KRW|원)/gi, '')
  if (!text) return NaN

  let negative = false
  if (/^\(.*\)$/.test(text)) {
    negative = true
    text = text.replace(/[()]/g, '')
  }
  if (text.endsWith('-')) {
    negative = true
    text = text.slice(0, -1)
  }
  // Strict, so a date like "2026-08-12" is never read as the number 2026.
  if (!/^[+-]?\d+(\.\d+)?$/.test(text)) return NaN

  const num = Number(text)
  if (!Number.isFinite(num)) return NaN
  return negative ? -Math.abs(num) : num
}

function isMoneyCell(cell: string): boolean {
  return cell.trim() !== '' && Number.isFinite(parseMoney(cell))
}

/**
 * A running-balance column moves by exactly the transaction amount from row to
 * row. Spotting it keeps the balance from being imported as the spend.
 */
function isRunningBalance(body: string[][], column: number, otherColumns: number[]): boolean {
  let comparable = 0
  let matches = 0

  for (let i = 0; i + 1 < body.length; i++) {
    const current = parseMoney(body[i][column] ?? '')
    const next = parseMoney(body[i + 1][column] ?? '')
    if (!Number.isFinite(current) || !Number.isFinite(next)) continue

    const delta = Math.abs(current - next)
    if (delta === 0) continue
    comparable++

    const amounts = otherColumns
      .flatMap((c) => [parseMoney(body[i][c] ?? ''), parseMoney(body[i + 1][c] ?? '')])
      .filter(Number.isFinite)
      .map(Math.abs)
    if (amounts.some((value) => Math.abs(value - delta) < 0.02)) matches++
  }

  return comparable >= 2 && matches / comparable >= 0.6
}

/** Withdrawals and deposits sit in two columns that are rarely both filled. */
function looksLikeDebitCreditPair(body: string[][], left: number, right: number): boolean {
  let either = 0
  let both = 0

  for (const row of body) {
    const hasLeft = isMoneyCell(row[left] ?? '')
    const hasRight = isMoneyCell(row[right] ?? '')
    if (hasLeft || hasRight) either++
    if (hasLeft && hasRight) both++
  }

  return either >= 2 && both / either <= 0.2
}

export function detectColumns(rows: string[][]): CsvColumns {
  const columns: CsvColumns = {
    date: -1,
    description: -1,
    amount: -1,
    debit: -1,
    credit: -1,
    balance: -1,
    hasHeader: false,
  }
  if (rows.length === 0) return columns

  const header = rows[0]
  const headerLooksLikeData = header.some((cell) => parseCsvDate(cell) !== '')

  if (!headerLooksLikeData) {
    columns.hasHeader = true
    header.forEach((cell, i) => {
      if (columns.date < 0 && headerMatch(cell, HEADER_HINTS.date)) columns.date = i
      else if (columns.balance < 0 && headerMatch(cell, HEADER_HINTS.balance)) columns.balance = i
      else if (columns.debit < 0 && headerMatch(cell, HEADER_HINTS.debit)) columns.debit = i
      else if (columns.credit < 0 && headerMatch(cell, HEADER_HINTS.credit)) columns.credit = i
      else if (columns.amount < 0 && headerMatch(cell, HEADER_HINTS.amount)) columns.amount = i
      else if (columns.description < 0 && headerMatch(cell, HEADER_HINTS.description)) columns.description = i
    })
  }

  const body = rows.slice(columns.hasHeader ? 1 : 0).slice(0, 30)
  const width = Math.max(...rows.map((r) => r.length))

  const dateHits = new Array<number>(width).fill(0)
  const moneyCells = new Array<number>(width).fill(0)
  const filledCells = new Array<number>(width).fill(0)
  const textLength = new Array<number>(width).fill(0)

  for (const row of body) {
    for (let i = 0; i < width; i++) {
      const cell = (row[i] ?? '').trim()
      if (cell === '') continue
      filledCells[i]++
      if (parseCsvDate(cell)) dateHits[i]++
      if (isMoneyCell(cell)) moneyCells[i]++
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

  // Columns whose every filled cell is a number are the money columns. A column
  // that repeats one value is an account or card number, not an amount.
  const moneyColumns: number[] = []
  for (let i = 0; i < width; i++) {
    if (i === columns.date || filledCells[i] === 0) continue
    if (moneyCells[i] !== filledCells[i]) continue
    const values = new Set(body.map((row) => (row[i] ?? '').trim()).filter(Boolean))
    if (values.size === 1 && filledCells[i] > 1) continue
    moneyColumns.push(i)
  }

  if (columns.description < 0) {
    columns.description = bestIndex(textLength, [columns.date, ...moneyColumns])
  }

  if (columns.amount < 0 && columns.debit < 0 && columns.credit < 0) {
    let candidates = moneyColumns.filter((c) => c !== columns.balance)

    if (columns.balance < 0) {
      const balance = candidates.find((c) =>
        isRunningBalance(body, c, candidates.filter((other) => other !== c)),
      )
      if (balance !== undefined && candidates.length > 1) {
        columns.balance = balance
        candidates = candidates.filter((c) => c !== balance)
      }
    }

    if (candidates.length === 2 && looksLikeDebitCreditPair(body, candidates[0], candidates[1])) {
      columns.debit = candidates[0]
      columns.credit = candidates[1]
    } else if (candidates.length > 0) {
      columns.amount = candidates[0]
    }
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

/**
 * Turns a statement export — or a table copied straight off a bank website —
 * into draft transactions.
 */
export function csvToDrafts(
  text: string,
  rules: Rule[] = [],
  mode: SignMode = 'auto',
  accountLabel = 'CSV 가져오기',
): CsvImportResult {
  const { delimiter, normalized } = sniffDelimiter(text)
  const rows = parseCsv(normalized, delimiter)
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
      account: accountLabel,
      raw: row.join(', '),
      confidence: 0.9,
    })
  }

  return { drafts, columns, skipped, totalRows: body.length }
}
