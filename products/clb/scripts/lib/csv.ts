// Minimal RFC 4180 CSV parser (quoted fields, doubled quotes, CRLF or LF). No dependencies, so the
// ops scripts stay npm-free. Blank lines are skipped; each row keeps the 1-based line it starts on.

export interface CsvRow {
  fields: string[]
  line: number
}

export function parseCsv(text: string): CsvRow[] {
  const rows: CsvRow[] = []
  const src = text.replace(/^﻿/, '')
  let fields: string[] = []
  let field = ''
  let quoted = false
  let line = 1
  let rowLine = 1
  const endRow = () => {
    fields.push(field)
    if (fields.some((f) => f !== '')) rows.push({ fields, line: rowLine })
    fields = []
    field = ''
  }
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') {
        quoted = false
      } else {
        if (c === '\n') line++
        field += c
      }
      continue
    }
    if (c === '"' && field === '') quoted = true
    else if (c === ',') {
      fields.push(field)
      field = ''
    } else if (c === '\r' || c === '\n') {
      if (c === '\r' && src[i + 1] === '\n') i++
      endRow()
      line++
      rowLine = line
    } else field += c
  }
  if (quoted) throw new Error(`CSV: unterminated quoted field starting on line ${rowLine}`)
  endRow()
  return rows
}

export interface CsvRecord {
  values: Record<string, string>
  line: number
}

/** Parse a CSV whose first row is the header into records keyed by (trimmed) header name. */
export function parseCsvRecords(text: string): { header: string[]; records: CsvRecord[] } {
  const rows = parseCsv(text)
  if (rows.length === 0) return { header: [], records: [] }
  const header = rows[0].fields.map((h) => h.trim())
  const records = rows.slice(1).map((r) => ({
    values: Object.fromEntries(header.map((h, i) => [h, (r.fields[i] ?? '').trim()])),
    line: r.line,
  }))
  return { header, records }
}
