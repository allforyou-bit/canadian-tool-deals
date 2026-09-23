import type { Bedrooms, DrivewaySize, PriceBook } from '@/config/prices'

export type CleaningType = 'standard' | 'deep' | 'moveOut'

export interface CleaningInput {
  type: CleaningType
  bedrooms: Bedrooms
  bathrooms: number
  addOns: string[]
  rush: boolean
}

export interface GutterInput {
  storeys: 1 | 2 | 3
  downspouts: boolean
}

export interface SnowInput {
  driveway: DrivewaySize
  walkway: boolean
  salting: boolean
}

export interface Line {
  en: string
  ko: string
  amount: number
}

export interface Estimate {
  lines: Line[]
  /** sum of lines (pre-tax) */
  low: number
  /** low × (1 + rangeUpliftPct), rounded up to $5 — condition confirmed on site */
  high: number
  /** present only when the business is registered for GST/HST */
  tax?: { label: string; lowAmount: number; highAmount: number }
  /** snow only: how the season price is billed */
  schedule?: { instalments: number; each: number; firstDue: string }
  /** snow only: rate for storms before the season starts */
  perVisit?: number
}

export const CLEANING_TYPE_LABEL: Record<CleaningType, { en: string; ko: string }> = {
  standard: { en: 'Standard clean', ko: '일반 청소' },
  deep: { en: 'Deep clean', ko: '딥클린(대청소)' },
  moveOut: { en: 'Move-in / move-out clean', ko: '입주·이사 청소' },
}

export const DRIVEWAY_LABEL: Record<DrivewaySize, { en: string; ko: string }> = {
  single: { en: 'Single driveway (1–2 cars)', ko: '1열 진입로(차 1–2대)' },
  double: { en: 'Double driveway (3–4 cars)', ko: '2열 진입로(차 3–4대)' },
  large: { en: 'Large driveway (5–6 cars)', ko: '대형 진입로(차 5–6대)' },
}

const roundUp5 = (n: number) => Math.ceil(n / 5) * 5
const cents = (n: number) => Math.round(n * 100) / 100

function finish(book: PriceBook, lines: Line[], taxRatePct: number | null, taxLabel: string): Estimate {
  const low = lines.reduce((s, l) => s + l.amount, 0)
  const high = roundUp5(low * (1 + book.rangeUpliftPct / 100))
  const est: Estimate = { lines, low, high }
  if (taxRatePct !== null) {
    est.tax = {
      label: taxLabel,
      lowAmount: cents((low * taxRatePct) / 100),
      highAmount: cents((high * taxRatePct) / 100),
    }
  }
  return est
}

export function estimateCleaning(
  book: PriceBook,
  input: CleaningInput,
  taxRatePct: number | null = null,
  taxLabel = '',
): Estimate {
  const c = book.cleaning
  const tier = c.tiers.find((t) => t.bedrooms === input.bedrooms)
  if (!tier) throw new Error(`No cleaning tier for ${input.bedrooms} bedrooms`)
  const base = tier[input.type]
  const label = CLEANING_TYPE_LABEL[input.type]
  const lines: Line[] = [
    {
      en: `${label.en}, ${input.bedrooms} bedroom${input.bedrooms > 1 ? 's' : ''} (incl. ${tier.includedBaths} bath${tier.includedBaths > 1 ? 's' : ''})`,
      ko: `${label.ko}, 침실 ${input.bedrooms}개 (욕실 ${tier.includedBaths}개 포함)`,
      amount: base,
    },
  ]
  const extraBaths = Math.max(0, Math.floor(input.bathrooms) - tier.includedBaths)
  if (extraBaths > 0) {
    lines.push({
      en: `Extra bathroom × ${extraBaths}`,
      ko: `추가 욕실 × ${extraBaths}`,
      amount: extraBaths * c.extraBathroom,
    })
  }
  for (const id of input.addOns) {
    const a = c.addOns.find((x) => x.id === id)
    if (a) lines.push({ en: a.en, ko: a.ko, amount: a.price })
  }
  if (input.rush) {
    const subtotal = lines.reduce((s, l) => s + l.amount, 0)
    lines.push({
      en: `Within 24 h / weekend / holiday (+${c.rushPremiumPct}%)`,
      ko: `24시간 내·주말·공휴일 (+${c.rushPremiumPct}%)`,
      amount: roundUp5((subtotal * c.rushPremiumPct) / 100),
    })
  }
  return finish(book, lines, taxRatePct, taxLabel)
}

export function estimateGutters(
  book: PriceBook,
  input: GutterInput,
  taxRatePct: number | null = null,
  taxLabel = '',
): Estimate {
  const g = book.gutters
  if (!g) throw new Error('Gutter cleaning is not offered in this city')
  const storeyLabel = { 1: ['Bungalow / 1 storey', '단층'], 2: ['2 storeys', '2층'], 3: ['3 storeys', '3층'] }[input.storeys]
  const lines: Line[] = [
    { en: `Gutter cleaning — ${storeyLabel[0]}`, ko: `홈통(처마 물받이) 청소 — ${storeyLabel[1]}`, amount: g.byStoreys[input.storeys] },
  ]
  if (input.downspouts) lines.push({ en: 'Downspout flush', ko: '배수관(다운스파우트) 뚫기', amount: g.downspoutFlush })
  return finish(book, lines, taxRatePct, taxLabel)
}

export function estimateSnow(
  book: PriceBook,
  input: SnowInput,
  taxRatePct: number | null = null,
  taxLabel = '',
): Estimate {
  const s = book.snow
  if (!s) throw new Error('Snow clearing is not offered in this city')
  const months = s.instalments
  const perMonth = s.mode === 'monthly'
  const mult = perMonth ? months : 1
  const lines: Line[] = [
    {
      en: `${DRIVEWAY_LABEL[input.driveway].en}${perMonth ? ` — $${s.driveway[input.driveway]}/month × ${months}` : ''}`,
      ko: `${DRIVEWAY_LABEL[input.driveway].ko}${perMonth ? ` — 월 $${s.driveway[input.driveway]} × ${months}개월` : ''}`,
      amount: s.driveway[input.driveway] * mult,
    },
  ]
  if (input.walkway) lines.push({ en: 'Front walkway and steps', ko: '현관 보도·계단', amount: s.walkwayAndSteps * mult })
  if (input.salting) lines.push({ en: 'Salting / ice melt', ko: '제빙(소금) 살포', amount: s.salting * mult })
  const est = finish(book, lines, taxRatePct, taxLabel)
  est.schedule = { instalments: months, each: cents(est.low / months), firstDue: 'Dec 1' }
  est.perVisit = s.perVisit
  return est
}
