import { guessCategory } from './categories'
import type { DraftTx, Rule, TxType } from './types'

/**
 * Parses payment alerts — Korean card/bank SMS and Canadian bank/credit card
 * notifications — into draft transactions. Everything here is best-effort:
 * the UI always shows the result for confirmation before saving.
 */

const ISSUERS: Array<[RegExp, string]> = [
  [/신한\s?카드/, '신한카드'],
  [/삼성\s?카드/, '삼성카드'],
  [/현대\s?카드/, '현대카드'],
  [/(KB)?국민\s?카드/i, 'KB국민카드'],
  [/롯데\s?카드/, '롯데카드'],
  [/하나\s?카드/, '하나카드'],
  [/우리\s?카드/, '우리카드'],
  [/BC\s?카드/i, 'BC카드'],
  [/(NH)?농협\s?카드/i, 'NH농협카드'],
  [/카카오뱅크|카카오페이/, '카카오'],
  [/토스/, '토스'],
  [/케이뱅크/, '케이뱅크'],
  [/신한은행/, '신한은행'],
  [/국민은행/, '국민은행'],
  [/우리은행/, '우리은행'],
  [/하나은행/, '하나은행'],
  [/american express|amex/i, 'Amex'],
  [/scotiabank|scotia/i, 'Scotiabank'],
  [/\bTD\b|td bank|td canada trust/i, 'TD'],
  [/\bRBC\b|royal bank/i, 'RBC'],
  [/\bCIBC\b/i, 'CIBC'],
  [/\bBMO\b|bank of montreal/i, 'BMO'],
  [/tangerine/i, 'Tangerine'],
  [/simplii/i, 'Simplii'],
  [/\bEQ Bank\b/i, 'EQ Bank'],
  [/wealthsimple/i, 'Wealthsimple'],
  [/desjardins/i, 'Desjardins'],
  [/national bank/i, 'National Bank'],
  [/pc financial|pc money/i, 'PC Financial'],
  [/neo financial/i, 'Neo Financial'],
  [/rogers bank/i, 'Rogers Bank'],
]

const INCOME_HINTS = [
  '입금', '급여', '월급', '상여', '환급', '환불', '취소', '이체받',
  'deposit', 'refund', 'received', 'credited', 'reversal', 'reimbursement', 'payroll', 'cashback',
]

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
}

/** Card/account digits that would otherwise look like an amount. */
const DIGIT_NOISE = [
  /\(\s*\d{3,4}\s*\)/g,
  /(?:ending(?:\s+in)?|ending\s+with|card\s+#?)\s*[*x•]*\s*\d{3,6}/gi,
  /[*x•]{2,}\s*\d{3,6}/gi,
  /카드\s*\d{4}/g,
  /\b\d{2}:\d{2}(:\d{2})?\b/g,
]

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function today(): string {
  return toISODate(new Date())
}

/** Builds YYYY-MM-DD from a month/day that has no year, assuming the recent past. */
function resolveYear(month: number, day: number, now = new Date()): string {
  let year = now.getFullYear()
  const candidate = new Date(year, month - 1, day)
  const threeDaysAhead = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
  if (candidate > threeDaysAhead) year -= 1
  return `${year}-${pad(month)}-${pad(day)}`
}

function extractDate(text: string): { date: string; found: boolean } {
  const full = text.match(/(20\d{2})[-./](\d{1,2})[-./](\d{1,2})/)
  if (full) {
    return { date: `${full[1]}-${pad(+full[2])}-${pad(+full[3])}`, found: true }
  }

  const monthName = text.match(
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})\b(?:,?\s*(20\d{2}))?/i,
  )
  if (monthName) {
    const month = MONTHS[monthName[1].toLowerCase()]
    const day = +monthName[2]
    if (monthName[3]) return { date: `${monthName[3]}-${pad(month)}-${pad(day)}`, found: true }
    return { date: resolveYear(month, day), found: true }
  }

  // 08/12, 08-12, 08.12 — month/day, the common Korean SMS form.
  const short = text.match(/(?:^|[^\d.])(\d{1,2})[/.-](\d{1,2})(?![\d/.-])/)
  if (short) {
    const month = +short[1]
    const day = +short[2]
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { date: resolveYear(month, day), found: true }
    }
  }

  return { date: today(), found: false }
}

interface AmountHit {
  value: number
  score: number
  index: number
}

function extractAmount(text: string): AmountHit | null {
  let best: AmountHit | null = null
  const re = /([$₩]|CA\$|US\$)?\s*(\d{1,3}(?:,\d{3})+|\d+(?:\.\d{1,2})?)\s*(원|KRW|CAD|USD|달러)?/gi
  let m: RegExpExecArray | null

  while ((m = re.exec(text)) !== null) {
    const [, symbol, digits, unit] = m
    const value = parseFloat(digits.replace(/,/g, ''))
    if (!Number.isFinite(value) || value <= 0) continue

    let score = 0
    if (symbol) score += 3
    if (unit) score += 3
    if (digits.includes(',')) score += 1
    if (/\.\d{2}$/.test(digits)) score += 1

    // "누적 1,234,567원" / "Available balance $2,100" are not the charge.
    const before = text.slice(Math.max(0, m.index - 14), m.index).toLowerCase()
    if (/누적|잔액|한도|balance|available|limit|remaining|points/.test(before)) score -= 5

    if (score <= 0) continue
    if (!best || score > best.score || (score === best.score && m.index < best.index)) {
      best = { value, score, index: m.index }
    }
  }

  return best
}

/** Words that are never a merchant name on their own. */
const CAPS_STOPWORDS = new Set([
  'A', 'AN', 'AT', 'ON', 'IN', 'OF', 'TO', 'FOR', 'AND', 'THE', 'WAS', 'YOU', 'YOUR', 'CARD',
  'CAD', 'USD', 'KRW', 'AM', 'PM', 'ATM', 'NEW', 'PURCHASE', 'CHARGE', 'PAYMENT',
])

function cleanMerchant(raw: string): string {
  return raw
    .replace(/\[.*?\]/g, ' ')
    .replace(/(일시불|무이자|할부|승인|취소|사용|결제|입금|출금|누적|잔액|한도)/g, ' ')
    .replace(/\d+개월/g, ' ')
    .replace(/[$₩]?\s*\d[\d,]*(\.\d{1,2})?\s*(원|CAD|USD|KRW)?/g, ' ')
    .replace(/\s[/.\-:*]+\s/g, ' ')
    .replace(/[\s/.,;:*•\-]+$/, '')
    .replace(/^[\s/.,;:*•\-]+/, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/** Longest run of capitalised tokens — how most English alerts print the merchant. */
function capsRun(text: string): string | null {
  const matches = text.match(/\b[A-Z][A-Z0-9&'’.\-]*(?:\s+[A-Z][A-Z0-9&'’.\-]*)*\b/g) ?? []
  const candidates = matches
    .map((m) => m.trim())
    .filter((m) => {
      const tokens = m.split(/\s+/).filter((t) => !CAPS_STOPWORDS.has(t.replace(/[.\-]/g, '')))
      return tokens.length > 0 && tokens.join('').length >= 3
    })
  if (candidates.length === 0) return null
  return candidates.sort((a, b) => b.length - a.length)[0]
}

function extractMerchant(text: string): { merchant: string; found: boolean } {
  // Drop a leading "TD:" / "Scotiabank:" style sender prefix.
  const body = text.replace(/^\s*[A-Za-z][A-Za-z&.\- ]{1,24}:\s*/, '')

  // "... at TIM HORTONS on Aug 12" / "purchase at METRO with your card"
  const atMatch = body.match(/\bat\s+(.+?)(?=\s+(?:on|with|for|using|was|has)\b|[.,;\n]|$)/i)
  if (atMatch) {
    const merchant = cleanMerchant(atMatch[1])
    if (merchant) return { merchant, found: true }
  }

  // "08/12 14:23 스타벅스" — merchant trails the time stamp.
  const afterTime = text.match(/\d{1,2}:\d{2}(?::\d{2})?\s+(.+)$/m)
  if (afterTime) {
    const merchant = cleanMerchant(afterTime[1])
    if (merchant) return { merchant, found: true }
  }

  // "5,500원 승인 CU편의점" / "12,000원 일시불 스타벅스"
  const afterKeyword = text.match(/(?:승인|사용|결제|입금|출금)\s+(.+)$/m)
  if (afterKeyword) {
    const merchant = cleanMerchant(afterKeyword[1])
    if (merchant) return { merchant, found: true }
  }

  // "direct deposit from ACME PAYROLL" / "received $250 from JOHN SMITH"
  const fromMatch = body.match(/\bfrom\s+(.+?)(?=\s+(?:on|to|for)\b|[.,;\n]|$)/i)
  if (fromMatch) {
    const merchant = cleanMerchant(fromMatch[1])
    if (merchant) return { merchant, found: true }
  }

  const caps = capsRun(body)
  if (caps) {
    const merchant = cleanMerchant(caps)
    if (merchant) return { merchant, found: true }
  }

  // Last resort: the last meaningful line of the message.
  const lines = text.split('\n').map((l) => cleanMerchant(l)).filter(Boolean)
  const candidate = lines.reverse().find((l) => l.length >= 2 && !/^\[?web발신\]?$/i.test(l))
  if (candidate) return { merchant: candidate.slice(0, 40), found: false }

  return { merchant: '미분류 결제', found: false }
}

function extractAccount(text: string): string {
  for (const [pattern, name] of ISSUERS) {
    if (pattern.test(text)) {
      const digits = text.match(/\(\s*(\d{4})\s*\)|ending(?:\s+in)?\s*[*x•]*\s*(\d{4})/i)
      const last4 = digits?.[1] ?? digits?.[2]
      return last4 ? `${name} ${last4}` : name
    }
  }
  return '기타'
}

function detectType(text: string): TxType {
  const lower = text.toLowerCase()
  return INCOME_HINTS.some((hint) => lower.includes(hint)) ? 'income' : 'expense'
}

/** Parses a single alert. Returns null when no plausible amount is present. */
export function parseAlert(text: string, rules: Rule[] = []): DraftTx | null {
  const trimmed = text.trim()
  if (!trimmed) return null

  let scrubbed = trimmed
  for (const pattern of DIGIT_NOISE) scrubbed = scrubbed.replace(pattern, ' ')

  const amount = extractAmount(scrubbed)
  if (!amount) return null

  const { date, found: dateFound } = extractDate(trimmed)
  const { merchant, found: merchantFound } = extractMerchant(trimmed)
  const type = detectType(trimmed)
  const account = extractAccount(trimmed)
  const category = type === 'income' ? 'income' : guessCategory(merchant, rules)

  let confidence = 0.4
  if (amount.score >= 4) confidence += 0.3
  if (merchantFound) confidence += 0.2
  if (dateFound) confidence += 0.1

  return {
    date,
    amount: amount.value,
    type,
    merchant,
    category,
    account,
    raw: trimmed,
    confidence: Math.round(Math.min(1, confidence) * 100) / 100,
  }
}

/**
 * Splits pasted text into individual alerts and parses each one. Handles both
 * a single multi-line SMS and a stack of one-line notifications.
 */
export function parseMessages(input: string, rules: Rule[] = []): DraftTx[] {
  const blocks = input
    .split(/\n\s*\n+/)
    .map((b) => b.trim())
    .filter(Boolean)

  const drafts: DraftTx[] = []
  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean)
    const everyLineHasAmount =
      lines.length > 1 && lines.every((line) => extractAmount(line) !== null)

    if (everyLineHasAmount) {
      for (const line of lines) {
        const draft = parseAlert(line, rules)
        if (draft) drafts.push(draft)
      }
    } else {
      const draft = parseAlert(block, rules)
      if (draft) drafts.push(draft)
    }
  }
  return drafts
}
