import { csvToDrafts, detectColumns, parseCsv, sniffDelimiter } from './csv'
import type { CsvColumns, SignMode } from './csv'
import { parseMessages } from './parse'
import type { DraftTx, Rule } from './types'

/**
 * One entry point for "the user pasted something". Text copied out of a bank's
 * transaction table is read as a table; a card alert is read as a message.
 */

export type PasteKind = 'table' | 'message'

export interface PasteResult {
  kind: PasteKind
  drafts: DraftTx[]
  columns?: CsvColumns
  /** Rows that had no usable date/amount — headers, subtotals, "no transactions" lines. */
  skipped: number
  totalRows: number
}

/** True when the text has repeating columns with a date and an amount in them. */
export function looksTabular(text: string): boolean {
  const { delimiter, normalized } = sniffDelimiter(text)
  const rows = parseCsv(normalized, delimiter).filter((row) => row.length > 1)
  if (rows.length < 2) return false

  const widths = rows.map((row) => row.length)
  const maxWidth = Math.max(...widths)
  if (maxWidth < 3) return false

  // Most rows should have the same shape; ragged text is not a table.
  const consistent = widths.filter((width) => width >= maxWidth - 1).length
  if (consistent < Math.ceil(rows.length * 0.6)) return false

  const columns = detectColumns(rows)
  return columns.date >= 0 && (columns.amount >= 0 || columns.debit >= 0 || columns.credit >= 0)
}

export function parsePasted(text: string, rules: Rule[] = [], mode: SignMode = 'auto'): PasteResult {
  if (looksTabular(text)) {
    const result = csvToDrafts(text, rules, mode, '붙여넣기')
    if (result.drafts.length > 0) {
      return { kind: 'table', ...result }
    }
  }

  const drafts = parseMessages(text, rules)
  return { kind: 'message', drafts, skipped: 0, totalRows: drafts.length }
}
