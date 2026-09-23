#!/usr/bin/env node
/**
 * Builds the CRM + finance workbook (decision memo §10, build items 11, 15 and 16).
 *
 *   business/crm/crm.xlsx      13 sheets with real Excel formulas, validation lists and frozen headers
 *   business/crm/csv/*.csv     import templates (header row + 2 fake EXAMPLE rows)
 *
 * Usage:  node scripts/build-crm.mjs [--city=gta|ottawa|calgary|vancouver|montreal] [--force]
 *
 * - Prices are read from config/prices.ts (the live price book), brand and sales-tax defaults
 *   from config/business.ts, so the workbook cannot disagree with the website.
 * - Contact details come from the NEXT_PUBLIC_* environment variables when set; otherwise the
 *   workbook shows {MAILING_ADDRESS}, {PHONE}, {EMAIL} and {WEBSITE} placeholders.
 * - It refuses to overwrite a crm.xlsx that already contains data rows, and skips any CSV that
 *   holds non-EXAMPLE rows, unless --force is given.
 *
 * Every number in the workbook is either from the decision memo (with its F-/A- reference and
 * source link) or labelled 추정/ESTIMATE, 가정/assumption or 확인 필요/not verified.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ExcelJS from 'exceljs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = path.join(ROOT, 'business', 'crm')
const CSV_DIR = path.join(OUT_DIR, 'csv')
const XLSX_PATH = path.join(OUT_DIR, 'crm.xlsx')

const ARGS = process.argv.slice(2)
const FORCE = ARGS.includes('--force')
const CITY = (ARGS.find((a) => a.startsWith('--city='))?.slice(7) || process.env.NEXT_PUBLIC_CITY || 'gta').trim()

// ---------------------------------------------------------------------------
// Config loading
// ---------------------------------------------------------------------------

/** Imports config/prices.ts. Node 22.18+ strips TypeScript types natively. */
async function loadPriceBooks() {
  const file = path.join(ROOT, 'config', 'prices.ts')
  const emit = process.emitWarning
  // hide the harmless "Module type ... not specified" / type-stripping notices
  process.emitWarning = function (w, ...rest) {
    const text = `${typeof w === 'string' ? w : w?.message ?? ''} ${JSON.stringify(rest)}`
    if (/Module type of|MODULE_TYPELESS_PACKAGE_JSON|Type Stripping|stripTypeScriptTypes/i.test(text)) return
    return emit.call(process, w, ...rest)
  }
  try {
    try {
      return (await import(pathToFileURL(file).href)).PRICE_BOOKS
    } catch (first) {
      const mod = await import('node:module')
      if (typeof mod.stripTypeScriptTypes !== 'function') throw first
      const js = mod.stripTypeScriptTypes(fs.readFileSync(file, 'utf8'))
      return (await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)).PRICE_BOOKS
    }
  } catch (err) {
    throw new Error(`Cannot load config/prices.ts (${err.message}). Use Node 22.18 or newer.`)
  } finally {
    process.emitWarning = emit
  }
}

/** Reads brand, site and tax defaults from config/business.ts (and NEXT_PUBLIC_* env overrides). */
function loadBusinessDefaults(city) {
  const src = fs.readFileSync(path.join(ROOT, 'config', 'business.ts'), 'utf8')
  const fileDefault = (name) => src.match(new RegExp(`env\\('${name}'\\)\\s*\\?\\?\\s*'([^']*)'`))?.[1] ?? ''
  const envVal = (name) => (process.env[name] ?? '').trim()
  const tax = src.match(
    new RegExp(`\\b${city}:\\s*\\{\\s*province:\\s*'(\\w+)',\\s*ratePct:\\s*([\\d.]+),\\s*label:\\s*'([^']+)'`),
  )
  if (!tax) console.warn(`! Could not read the ${city} tax rule from config/business.ts — the tax-rate cell is left blank.`)
  const site = envVal('NEXT_PUBLIC_SITE_URL') || fileDefault('NEXT_PUBLIC_SITE_URL')
  return {
    brandEn: envVal('NEXT_PUBLIC_BRAND_EN') || fileDefault('NEXT_PUBLIC_BRAND_EN') || '{BRAND}',
    brandKo: envVal('NEXT_PUBLIC_BRAND_KO') || fileDefault('NEXT_PUBLIC_BRAND_KO') || '{BRAND}',
    mailing: envVal('NEXT_PUBLIC_MAILING_ADDRESS') || '{MAILING_ADDRESS}',
    phone: envVal('NEXT_PUBLIC_PHONE') || '{PHONE}',
    email: envVal('NEXT_PUBLIC_EMAIL') || '{EMAIL}',
    web: site && !site.includes('example.pages.dev') ? site : '{WEBSITE}',
    taxRate: tax ? Number(tax[2]) / 100 : '',
    taxLabel: tax ? tax[3] : '',
  }
}

// ---------------------------------------------------------------------------
// Constants, sources, styles
// ---------------------------------------------------------------------------

const SH = {
  settings: '설정 Settings',
  doors: '문 두드리기 Doors',
  quotes: '견적 Quotes',
  jobs: '작업 Jobs',
  payments: '입금 Payments',
  followups: '후속 Follow-ups',
  dash: '지표 Dashboard',
  ei: 'EI 주간신고',
  tax: '세금 Tax',
  be: '손익분기 Break-even',
  invoice: '인보이스 Invoice',
  expenses: '지출 Expenses',
  mileage: '주행 Mileage',
}

// Source links, copied from the decision memo's facts table (section 4).
const U = {
  memo: 'business/research/decision-memo.md',
  eiRegs: 'https://github.com/justicecanada/laws-lois-xml/blob/main/eng/regulations/SOR-96-332.xml',
  eiAct: 'https://github.com/justicecanada/laws-lois-xml/blob/main/eng/acts/E-5.6.xml',
  eiMax: 'https://github.com/Artzp/RetireOps/blob/main/docs/source-of-truth/19-benefits-tax-credits-2026.md',
  eta: 'https://github.com/justicecanada/laws-lois-xml/blob/main/eng/acts/E-15.xml',
  cpp: 'https://github.com/justicecanada/laws-lois-xml/blob/main/eng/acts/C-8.xml',
  ita: 'https://github.com/justicecanada/laws-lois-xml/blob/main/eng/acts/I-3.3.xml',
  casl: 'https://github.com/justicecanada/laws-lois-xml/blob/main/eng/acts/E-1.6.xml',
  sor2012: 'https://github.com/justicecanada/laws-lois-xml/blob/main/eng/regulations/SOR-2012-36.xml',
  cgl: 'https://www.thinkinsure.ca/business-insurance/cleaning-insurance',
  heightIns: 'https://rates.ca/insurance-quotes/business/contractor/window-cleaning',
  snowIns: 'https://getcertain.ca/how-much-does-snow-removal-insurance-cost-in-canada/',
  blower: 'https://forums.redflagdeals.com/tags/snowblower/',
  gutterGta: 'https://professionalroofers.com/blogs/gutter-cleaning-cost-in-toronto-2025/',
  snowGta: 'https://silverlightwindowsandeaves.ca/how-much-does-snow-removal-cost-in-toronto/',
  ontarioCancel: 'https://www.ontario.ca/page/your-rights-when-signing-or-cancelling-contract',
  etransfer: 'https://github.com/nifabulous/Relay/blob/885bdf20a690d77dd2b93e46a52a597382039c6e/app/data/payment_schemes.py',
  stripe: 'https://github.com/kurtrgoddard/Bilingua-App/blob/b1f427aae94ef32e9f78ad5543dad81c330e7956/economy/research-pricing.md',
}

const FONT = 'Malgun Gothic'
const COLOR = {
  head: 'FF1F4E78',
  headCalc: 'FF595959',
  input: 'FFFFF2CC',
  calc: 'FFF2F2F2',
  example: 'FFE7E6E6',
  section: 'FFDDEBF7',
  blue: 'FF0000FF',
  grey: 'FF7F7F7F',
  white: 'FFFFFFFF',
}
const FMT = {
  date: 'yyyy-mm-dd',
  money: '$#,##0.00;[Red]-$#,##0.00',
  money0: '$#,##0;[Red]-$#,##0',
  pct: '0.0%',
  int: '0',
  num1: '0.0',
  num2: '0.00',
}
const FIRST = 3 // first data row on the data-entry sheets (row 1 = header, row 2 = example)

const font = (o = {}) => ({ name: FONT, size: 10, ...o })
const fill = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } })
const thin = { style: 'thin', color: { argb: 'FFBFBFBF' } }
const BORDER = { top: thin, left: thin, bottom: thin, right: thin }
const f = (formula) => ({ formula })
const q = (name) => `'${name.replace(/'/g, "''")}'`
const utc = (y, m, d) => new Date(Date.UTC(y, m - 1, d))
const iso = (d) => d.toISOString().slice(0, 10)
const colLetter = (n) => {
  let s = ''
  while (n > 0) {
    const m = (n - 1) % 26
    s = String.fromCharCode(65 + m) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}
/** Excel caps each string literal inside a formula at 255 characters, so long text is split. */
const lit = (s) => {
  const parts = []
  for (let i = 0; i < s.length; i += 200) parts.push(`"${s.slice(i, i + 200).replace(/"/g, '""')}"`)
  return parts.length > 1 ? `(${parts.join('&')})` : parts[0] ?? '""'
}
/** YYYY-MM-DD text built without TEXT() date codes (those depend on the Excel language). */
const ymd = (ref) => `YEAR(${ref})&"-"&TEXT(MONTH(${ref}),"00")&"-"&TEXT(DAY(${ref}),"00")`

/** Rough row height for wrapped text in a column of the given width (Hangul ≈ 1.8 character widths). */
function fitHeight(text, width, min = 15) {
  const w = [...String(text ?? '')].reduce((n, ch) => n + (/[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/.test(ch) ? 1.8 : 1), 0)
  const lines = Math.max(1, Math.ceil(w / Math.max(8, width - 2)))
  return Math.max(min, lines * 13 + 3)
}

function styleHeader(cell, calc = false) {
  cell.font = font({ bold: true, color: { argb: COLOR.white } })
  cell.fill = fill(calc ? COLOR.headCalc : COLOR.head)
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  cell.border = BORDER
}
function styleInput(cell, fmt) {
  cell.fill = fill(COLOR.input)
  cell.font = font({ color: { argb: COLOR.blue } })
  cell.border = BORDER
  if (fmt) cell.numFmt = fmt
}
function styleCalc(cell, fmt, bold = false) {
  cell.fill = fill(COLOR.calc)
  cell.font = font({ bold })
  cell.border = BORDER
  if (fmt) cell.numFmt = fmt
}
function styleNote(cell, italic = true) {
  cell.font = font({ italic, color: { argb: COLOR.grey } })
  cell.alignment = { vertical: 'top', wrapText: true }
}
function titleRow(ws, text, lastCol, sub) {
  ws.mergeCells(1, 1, 1, lastCol)
  const t = ws.getCell(1, 1)
  t.value = text
  t.font = font({ bold: true, size: 14, color: { argb: COLOR.head } })
  t.alignment = { vertical: 'middle' }
  ws.getRow(1).height = 24
  if (sub) {
    ws.mergeCells(2, 1, 2, lastCol)
    const s = ws.getCell(2, 1)
    s.value = sub
    styleNote(s)
    ws.getRow(2).height = 42
  }
}
function sectionRow(ws, row, text, lastCol) {
  ws.mergeCells(row, 1, row, lastCol)
  const c = ws.getCell(row, 1)
  c.value = text
  c.font = font({ bold: true, size: 11, color: { argb: COLOR.head } })
  c.fill = fill(COLOR.section)
  c.alignment = { vertical: 'middle', wrapText: true }
  ws.getRow(row).height = 20
}
function listDV(list, message) {
  return {
    type: 'list',
    allowBlank: true,
    formulae: [list.startsWith("'") ? list : `"${list}"`],
    showErrorMessage: true,
    errorStyle: 'stop', // OOXML allows only stop | warning | information
    errorTitle: '목록에서 고르세요 / Pick from the list',
    error: message ?? `${list}`,
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const PRICE_BOOKS = await loadPriceBooks()
if (!PRICE_BOOKS[CITY]) {
  console.error(`Unknown city "${CITY}". Use one of: ${Object.keys(PRICE_BOOKS).join(', ')}`)
  process.exit(1)
}
const BOOK = PRICE_BOOKS[CITY]
const BIZ = loadBusinessDefaults(CITY)
const TIERS = BOOK.cleaning.tiers
const tier = (b) => TIERS.find((t) => t.bedrooms === b)
const GUT = BOOK.gutters
const SNOW = BOOK.snow
const SNOW_SEASON_BASE = SNOW ? (SNOW.mode === 'monthly' ? SNOW.driveway.single * SNOW.instalments : SNOW.driveway.single) : ''

// Only the Ontario door-to-door rule (F32) and Ontario HST were researched. Other provinces get a
// "not verified" label instead of Ontario wording.
const ONTARIO = BOOK.city === 'gta' || BOOK.city === 'ottawa'
const NOT_VERIFIED_PROV = '확인 필요 / not verified for this province'
const TAX_BASIS =
  {
    gta: '온타리오 HST 13% (ETA s.165, Sched. VIII, F8)',
    ottawa: '온타리오 HST 13% (ETA s.165, Sched. VIII, F8)',
    calgary: '앨버타 GST 5% (ETA s.165, F8)',
    vancouver: 'BC GST 5% (ETA s.165, F8). BC PST 7%가 이 서비스에 붙는지는 확인 필요 (F8, 2차 출처)',
    montreal: `퀘벡 GST 5% + QST 9.975%는 조사에서 확인하지 못함 — ${NOT_VERIFIED_PROV}`,
  }[BOOK.city] ?? NOT_VERIFIED_PROV

// ----- Settings sheet entries (layout computed before any formula is written) -----

const YESNO = 'YES,NO'
const SETTINGS = [
  { section: '브랜드·연락처 Brand & contact — 이메일·문자마다 이름, 우편 주소, 연락처, 수신거부 문구가 필요합니다 (CASL, F11–F13)' },
  { key: 'brand_en', ko: '브랜드 (영문)', en: 'Brand (EN)', v: BIZ.brandEn, basis: '{BRAND}. config/business.ts 기본값 (NEXT_PUBLIC_BRAND_EN). 인보이스에 나옵니다.' },
  { key: 'brand_ko', ko: '브랜드 (한글)', en: 'Brand (KO)', v: BIZ.brandKo, basis: '{BRAND}. config/business.ts 기본값 (NEXT_PUBLIC_BRAND_KO). 상호 등록 필요 여부는 확인 필요 (memo §6).' },
  { key: 'mailing', ko: '우편 주소', en: 'Mailing address', v: BIZ.mailing, basis: 'CASL 필수: "the mailing address" (SOR/2012-36 s.2(1)(d), F13). 사서함(PO box)도 되는지는 규정에 없음 — 확인 필요.', url: U.sor2012 },
  { key: 'phone', ko: '전화', en: 'Phone', v: BIZ.phone, basis: '{PHONE}' },
  { key: 'email', ko: '이메일', en: 'Email', v: BIZ.email, basis: '{EMAIL}' },
  { key: 'web', ko: '웹사이트', en: 'Website', v: BIZ.web, basis: '{WEBSITE}' },
  { key: 'etransfer', ko: 'e-Transfer 받을 이메일', en: 'e-Transfer email', v: () => f(S('email')), basis: '기본값은 위 이메일. 다른 주소로 받으면 직접 입력하세요.' },
  { key: 'card_ok', ko: '카드 결제 받음?', en: 'Card accepted?', v: 'NO', list: YESNO, basis: '카드 결제 서비스를 실제로 쓸 때만 YES. Stripe 캐나다 수수료 2.9% + $0.30 (F37, SECONDARY).', url: U.stripe },
  { key: 'city', ko: '도시 (빌드 기준)', en: 'City (build)', v: CITY, kind: 'info', basis: '가격·세율 기본값의 기준 도시. 바꾸려면 다시 빌드: node scripts/build-crm.mjs --city=ottawa' },
  { key: 'plan_start', ko: '계획 시작일', en: 'Plan start (day 1)', v: utc(2026, 9, 28), fmt: FMT.date, basis: 'memo: Mon 2026-09-28' },
  { key: 'asof', ko: '기준일', en: 'As-of date', v: f('TODAY()'), fmt: FMT.date, basis: '보통 TODAY(). 날짜를 직접 넣으면 그날 기준으로 지표·중단 기준·DAILY 줄을 다시 계산합니다.' },

  { section: '소비자 계약·CASL Consumer contracts & CASL (F11, F32) — 법률 자문 아님' },
  { key: 'cancel_days', ko: '방문 계약 취소 가능 기간', en: 'Door-signed cancellation period', v: 10, fmt: FMT.int, unit: '일', kind: 'info', basis: ONTARIO ? '온타리오 방문(direct) 계약: 고객은 계약서 사본을 받은 다음 날부터 10일 안에 취소 가능 (F32, SNIPPET). 기간 중 작업한 경우의 효과는 조사 안 됨.' : `10은 온타리오 값입니다 (F32). 이 주의 방문 계약 취소 기간은 ${NOT_VERIFIED_PROV}.`, url: U.ontarioCancel },
  { key: 'refund_days', ko: '취소 시 환불 기한', en: 'Refund due after cancellation', v: 15, fmt: FMT.int, unit: '일', kind: 'info', basis: ONTARIO ? '취소 통지를 받은 다음 날부터 15일 안에 환불 (F32, SNIPPET)' : `15는 온타리오 값입니다 (F32). 이 주의 환불 기한은 ${NOT_VERIFIED_PROV}.`, url: U.ontarioCancel },
  { key: 'inquiry_months', ko: '문의 후 묵시적 동의 기간', en: 'Implied consent after an inquiry', v: 6, fmt: FMT.int, unit: '개월', kind: 'info', basis: 'CASL s.10(10) (F11). 그 뒤 문자·이메일을 보내려면 다른 동의 근거(예: 명시적 동의)가 필요.', url: U.casl },
  { key: 'unsub_days', ko: '수신거부 처리 기한', en: 'Unsubscribe processing time', v: 10, fmt: FMT.int, unit: '영업일', kind: 'info', basis: 'CASL: 수신거부는 10영업일 안에 처리, 수신거부 방법은 60일 동안 유효 (F11)', url: U.casl },

  { section: '세금 Tax (F7–F10) — 세무 자문 아님' },
  { key: 'hst_reg', ko: 'GST/HST 등록?', en: 'HST registered', v: 'NO', list: YESNO, basis: 'NO가 기본. 4분기 합계 $30,000 전까지 소규모 사업자 (ETA s.148, F7). 자발적 등록은 1년간 취소 불가 (s.242(2), F8). YES면 인보이스에 세금 줄이 나타납니다.', url: U.eta },
  { key: 'hst_no', ko: 'GST/HST 등록번호', en: 'GST/HST number', v: '', basis: '등록한 뒤에만 입력' },
  { key: 'tax_rate', ko: '세율', en: 'Tax rate', v: BIZ.taxRate, fmt: FMT.pct, basis: `config/business.ts TAX_RULES (${CITY}). ${TAX_BASIS}.`, url: U.eta },
  { key: 'tax_label', ko: '세금 이름', en: 'Tax label', v: BIZ.taxLabel, basis: 'config/business.ts TAX_RULES' },
  { key: 'gst_threshold', ko: '소규모 사업자 기준', en: 'Small-supplier threshold', v: 30000, fmt: FMT.money0, unit: '$', basis: '4분기 합계 테스트 + 단일 분기 테스트 (ETA s.148, F7)', url: U.eta },
  { key: 'warn_rolling', ko: '4분기 합계 경고선', en: 'Rolling 4-quarter warning', v: 25000, fmt: FMT.money0, unit: '$', basis: 'memo §10 item 15 (미리 준비하기 위한 경고선)' },
  { key: 'warn_quarter', ko: '단일 분기 경고선', en: 'Single-quarter warning', v: 20000, fmt: FMT.money0, unit: '$', basis: 'memo §10 item 15' },
  { key: 'incl_platform', ko: '플랫폼 수입을 과세매출에 포함?', en: 'Count platform income in HST test', v: 'YES', list: YESNO, basis: '플랫폼 수입이 본인 과세 공급인지 확인 안 됨 (memo 5.5). 보수적으로 YES.' },
  { key: 'cpp_rate', ko: 'CPP 적립률 (자영업)', en: 'CPP rate (self-employed)', v: 0.119, fmt: FMT.pct, basis: '9.9% + 2.0% = 11.9% (CPP Act, F9)', url: U.cpp },
  { key: 'cpp_exempt', ko: 'CPP 기본 공제', en: 'CPP basic exemption', v: 3500, fmt: FMT.money0, unit: '$/년', basis: 'F9. 적립 권장액은 보수적으로 이 공제를 무시합니다 (memo 5.4).', url: U.cpp },
  { key: 'card_pct', ko: '카드 수수료율', en: 'Card fee %', v: 0.029, fmt: FMT.pct, basis: 'Stripe 캐나다 (F37, SECONDARY)', url: U.stripe },
  { key: 'card_fixed', ko: '카드 건당 수수료', en: 'Card fee per charge', v: 0.3, fmt: FMT.money, unit: '$', basis: 'Stripe 캐나다 (F37, SECONDARY)', url: U.stripe },
  { key: 'etr_limit', ko: 'e-Transfer 분할 안내 기준', en: 'Split e-Transfer above', v: 2000, fmt: FMT.money0, unit: '$', basis: '은행별 한도 보통 $2,000–3,000 (F36, SECONDARY/사례). 넘으면 나눠 받기.', url: U.etransfer },

  { section: 'EI 고용보험 (memo 5.4, F1–F6) — 모든 계산은 추정. 판단은 Service Canada가 합니다' },
  { key: 'ei_eligible', ko: 'EI 자격?', en: 'EI eligible?', v: 'UNKNOWN', list: 'YES,NO,UNKNOWN', basis: '보험가입 근로 420–700시간 필요. 비행(misconduct)이나 정당한 이유 없는 자진 퇴사는 자격 없음 (EI Act s.7(2), s.30(1), F6). 본인이 확인. NO면 EI 계산이 꺼집니다.', url: U.eiAct },
  { key: 'ei_deadline', ko: 'EI 신청 마감', en: 'EI filing deadline', v: utc(2026, 10, 10), fmt: FMT.date, basis: 'Pilot 24: 2026-10-10까지 시작하는 수급 기간 (SOR-96-332 ss.77.996–77.999, F1). 연장 여부 찾지 못함.', url: U.eiRegs },
  { key: 'ei_claim_start', ko: 'EI 시작 주 (일요일)', en: 'Benefit period start (Sunday)', v: utc(2026, 10, 4), fmt: FMT.date, basis: '10/10까지 신청하면 10/4 시작 (EI Act s.10(1), F2). 실제 날짜로 바꾸세요.', url: U.eiAct },
  { key: 'ei_B', ko: '주간 EI 수령액 B', en: 'Weekly benefit B', v: 729, fmt: FMT.money0, unit: '$/주', basis: '예시 = 2026 최대치. 2차 출처 + 법 조항 공식 (68,900 ÷ 52 × 55% = 728.75, F5 SECONDARY). 본인 실제 금액으로 바꾸세요.', url: U.eiMax },
  { key: 'ei_wie', ko: '주당 보험가입소득', en: 'Weekly insurable earnings', v: 1325, fmt: FMT.money0, unit: '$/주', basis: '예시 = 최대 보험가입소득 68,900 ÷ 52 ≈ 1,325 (F5). 본인 금액으로 바꾸세요.', url: U.eiMax },
  { key: 'ei_ded_rate', ko: '수입 공제율', en: 'Earnings deduction rate', v: 0.5, fmt: FMT.pct, basis: '주당 보험가입소득의 90%까지는 50%, 그 위는 100% (EI Act s.19(2),(3), F4)', url: U.eiAct },
  { key: 'ei_cap_pct', ko: '50% 구간 한도', en: '50% zone cap', v: 0.9, fmt: FMT.pct, basis: '주당 보험가입소득의 90% (F4)', url: U.eiAct },
  { key: 'pathA_net', ko: 'Path A 계획 주간 순수입 A', en: 'Planned Path A weekly net (A)', v: 400, fmt: FMT.money0, unit: '$/주', basis: 'memo 5.4 예시 ($400). "경미한 정도(minor extent)" 인정 여부는 Service Canada에 전화로 확인 (Regs s.30, F3).', url: U.eiRegs },

  { section: '문 두드리기 퍼널 Door funnel — 가정 (출처 없음, F45). 시도 30회부터 측정값으로 바뀝니다' },
  { key: 'ans_rate', ko: '응답률 (가정)', en: 'Answer % (assumption A8)', v: 0.35, fmt: FMT.pct, basis: '가정 A8 — 근거 자료 없음 (F45)' },
  { key: 'quote_rate', ko: '견적 요청률 (가정)', en: 'Quote % (assumption A9)', v: 0.1, fmt: FMT.pct, basis: '가정 A9 — 대화 중 견적 요청 비율' },
  { key: 'close_rate', ko: '계약률 (가정)', en: 'Close % (assumption A10)', v: 0.4, fmt: FMT.pct, basis: '가정 A10 — 견적 중 계약 비율. 합치면 1.4% → 계약 1건당 약 71.4문' },
  { key: 'min_attempts', ko: '측정값 사용 최소 시도', en: 'Min attempts to use measured rates', v: 30, fmt: FMT.int, unit: '회', basis: '이 수 이상이면 측정값 사용. 측정값이 0이면 그 비율만 가정값 사용.' },
  { key: 'scenario', ko: '시나리오', en: 'Scenario', v: 'B1', list: 'B1,B2', basis: 'B1 = 청소+플랫폼, B2 = 관문 G1 통과 후 홈통 청소·제설 추가 (memo 5.2, 5.3)' },
  { key: 'closes_manual', ko: '다음 주 필요 계약 수 (직접)', en: 'Closes needed next week (manual)', v: '', fmt: FMT.num1, basis: '비워 두면 아래 주별 목표표에서 자동으로 가져옵니다 (memo §7).' },
  { key: 'closes_needed', ko: '다음 주 필요 계약 수 (사용값)', en: 'Closes needed next week (used)', kind: 'calc', fmt: FMT.num2, v: () => f(closesNeededFormula()), basis: '= 그다음 주 완료 목표 (계약이 완료보다 약 1주 앞섬, memo §7 가정). 1월 이후는 직접 입력.' },
  { key: 'active_cluster', ko: '현재 클러스터 번호', en: 'Active cluster #', v: 1, fmt: FMT.int, list: '1,2,3', basis: '지표 시트의 "남은 가구"는 이 클러스터 기준' },
  { key: 'cluster1', ko: '클러스터 1 가구 수', en: 'Cluster 1 homes', v: 2000, fmt: FMT.int, unit: '가구', basis: '추정: memo §7은 B1에 2,000가구 이상 권장. 실제로 세어서 바꾸세요.' },
  { key: 'cluster2', ko: '클러스터 2 가구 수', en: 'Cluster 2 homes', v: 0, fmt: FMT.int, unit: '가구', basis: '열 때 입력' },
  { key: 'cluster3', ko: '클러스터 3 가구 수', en: 'Cluster 3 homes', v: 0, fmt: FMT.int, unit: '가구', basis: '열 때 입력' },
  { key: 'door_min', ko: '문 1회 소요 시간', en: 'Minutes per door attempt', v: 2, fmt: FMT.int, unit: '분', basis: '가정 A11' },
  { key: 'max_doors_jobday', ko: '작업 있는 날 최대 문', en: 'Max doors on a job day', v: 40, fmt: FMT.int, unit: '문', basis: 'memo §7 하루 한도' },
  { key: 'quote_fu_days', ko: '견적 후 후속 연락까지', en: 'Days before quote follow-up', v: 2, fmt: FMT.int, unit: '일', basis: '운영 선택 (owner choice) — 근거 자료 없음' },

  { section: '비용 가정 Costs — 추정 (출처 없음)' },
  { key: 'dc_clean', ko: '청소 직접비율', en: 'Cleaning direct cost %', v: 0.2, fmt: FMT.pct, basis: '가정 A2 (청소 조사 자료의 임시값. 용품 가격은 못 찾음)' },
  { key: 'dc_platform', ko: '플랫폼 작업 직접비율', en: 'Platform direct cost %', v: 0.1, fmt: FMT.pct, basis: '가정 A3 (용품·교통)' },
  { key: 'dc_snow', ko: '제설 직접비율', en: 'Snow direct cost %', v: 0.15, fmt: FMT.pct, basis: '가정 A4 (소금·연료)' },
  { key: 'dc_gutter', ko: '홈통 작업당 변동비', en: 'Gutter variable cost / job', v: 20, fmt: FMT.money0, unit: '$', basis: '가정 A6 (출처 없음)' },
  { key: 'overhead', ko: '월 고정비', en: 'Monthly overhead', v: 200, fmt: FMT.money0, unit: '$/월', basis: '가정 A7 (전화·인쇄·광고)' },
  { key: 'cgl_premium', ko: '청소 CGL 보험료 (연)', en: 'Cleaning CGL premium (yr)', v: 500, fmt: FMT.money0, unit: '$/년', basis: '"$500부터" (F23, SNIPPET). 실제 견적으로 바꾸세요.', url: U.cgl },

  { section: '손익분기 입력 Break-even inputs (memo 5.3) — 첫 시즌 기준, 추정' },
  { key: 'gut_setup', ko: '홈통 설비비', en: 'Gutter setup', v: 1500, fmt: FMT.money0, unit: '$', basis: '가정 A5 (사다리·스태빌라이저·도구·블로어). 보험 제외. 캐나다 사다리 가격 못 찾음.' },
  { key: 'gut_ins', ko: '사다리·높이 보험 추가', en: 'Ladder / height cover', v: 450, fmt: FMT.money0, unit: '$', basis: '창문 청소 $2M 약 $450/년 (F27 하한, SNIPPET). 홈통 전용 견적 못 찾음.', url: U.heightIns },
  { key: 'gut_ins_actual', ko: '실제 사다리 보험 견적', en: 'Actual ladder cover quote', v: '', fmt: FMT.money0, unit: '$', basis: '받으면 입력 (비우면 위 추정 사용)' },
  { key: 'gut_ticket_base', ko: '홈통 가격 — 기본', en: 'Gutter ticket — base', v: GUT ? GUT.byStoreys[2] : '', fmt: FMT.money0, unit: '$', kind: 'info', basis: 'config/prices.ts 2층 기본값 (memo 5.3 기본 $225). 가격표를 바꾸면 다시 빌드.', url: U.gutterGta },
  { key: 'gut_ticket_cons', ko: '홈통 가격 — 보수', en: 'Gutter ticket — conservative', v: 175, fmt: FMT.money0, unit: '$', basis: 'memo 5.1 보수 가정 ($150–350 범위 하단 근처)' },
  { key: 'snow_cover_base', ko: '제설 보험 — 기본', en: 'Snow cover — base', v: 1000, fmt: FMT.money0, unit: '$', basis: '"일반적" $1,000–3,000의 하단 (F29, SNIPPET)', url: U.snowIns },
  { key: 'snow_cover_cons', ko: '제설 보험 — 보수', en: 'Snow cover — conservative', v: 1800, fmt: FMT.money0, unit: '$', basis: '"삽질하는 핸디맨 $1,800/년" (F29, 출처 불확실)', url: U.snowIns },
  { key: 'snow_cover_actual', ko: '실제 제설 보험 견적', en: 'Actual snow cover quote', v: '', fmt: FMT.money0, unit: '$', basis: '받으면 입력 (관문 S: 계약 전 서면 보험 필수)' },
  { key: 'blower_base', ko: '제설기 — 기본', en: 'Snowblower — base', v: 1299, fmt: FMT.money0, unit: '$', basis: '24" 2단 2025–26 할인가 $1,299–1,999 (F30, 포럼 요약)', url: U.blower },
  { key: 'blower_cons', ko: '제설기 — 보수', en: 'Snowblower — conservative', v: 1999, fmt: FMT.money0, unit: '$', basis: 'F30 범위 상단', url: U.blower },
  { key: 'blower_actual', ko: '실제 제설기 가격', en: 'Actual snowblower price', v: '', fmt: FMT.money0, unit: '$', basis: '사면 입력 (11/20 손익분기 전에는 사지 않기)' },
  { key: 'snow_price_base', ko: '제설 시즌 가격 — 기본', en: 'Snow season price — base', v: SNOW_SEASON_BASE, fmt: FMT.money0, unit: '$', kind: 'info', basis: SNOW ? `config/prices.ts 1열 진입로${SNOW.mode === 'monthly' ? ' (월 가격 × 회수)' : ''} (memo 5.3 기본 $500)` : '이 도시는 제설 없음 (config/prices.ts)', url: U.snowGta },
  { key: 'snow_price_cons', ko: '제설 시즌 가격 — 보수', en: 'Snow season price — conservative', v: 400, fmt: FMT.money0, unit: '$', basis: 'memo 5.1 보수 가정' },
  { key: 'snow_per_visit', ko: '11월 1회 방문 가격', en: 'November per-visit rate', v: SNOW ? SNOW.perVisit : '', fmt: FMT.money0, unit: '$', kind: 'info', basis: 'config/prices.ts (memo: 기본 $60, F28 $50–150 범위에서 선택). 계약서에서 11월 옵션을 선택한 고객만, 계약 확정일부터 11/30까지 출동 기준 적설량 이상 내린 눈에 적용. 12/1 첫 분할금과 함께 청구 (12/1 전 받지 않음)' },
  { key: 'snow_instalments', ko: '제설 분할 횟수', en: 'Snow instalments', v: SNOW ? SNOW.instalments : 4, fmt: FMT.int, unit: '회', kind: 'info', basis: 'config/prices.ts: 현장에서 확정한 시즌 요금 ÷ 4, 12/1, 1/1, 2/1, 3/1에 청구 (memo §2)' },
  { key: 'snow_method', ko: '제설 방식', en: 'Snow method', v: 'BLOWER', list: 'BLOWER,SHOVEL', basis: 'SHOVEL = 차 없이 삽만 (memo §2 관문 S, §9)' },
  { key: 'shovel_cap', ko: '삽 제설 최대 곳 수', en: 'Shovel-only cap', v: 10, fmt: FMT.int, unit: '곳', basis: '가정: 진입로 1곳 소요 시간을 재기 전까지 10곳 (memo §9)' },

  { section: '관문·점검 Gates & checks (memo §2, §8) — 상태를 직접 바꾸세요' },
  { key: 'cgl_bound', ko: '청소 CGL 보험 가입됨?', en: 'Cleaning CGL bound?', v: 'NO', list: YESNO, basis: '가입 전에는 직접 고객 금지 (memo §6). 사이트 "Insured" 표시도 가입 후에만.' },
  { key: 'platform_ok', ko: '플랫폼 승인됨?', en: 'Platform approved?', v: 'NO', list: YESNO, basis: 'TaskRabbit/Jiffy 승인 기간 못 찾음 (F21)' },
  { key: 'g1', ko: '관문 G1 통과?', en: 'Gate G1 passed?', v: 'PENDING', list: 'YES,NO,PENDING', basis: '5개 모두: 차량, 사다리 가능, 브로커 서면 확인, 자금, 날짜 잡힌 홈통 예약 5건 (memo §2)' },
  { key: 'g1_min_booked', ko: '관문 G1 최소 홈통 예약', en: 'G1 min gutter bookings', v: 5, fmt: FMT.int, unit: '건', basis: 'memo §2 관문 G1 조건 5 — 사다리는 그 뒤에 구매' },
  { key: 'gate_s', ko: '제설 서면 보험 (관문 S)?', en: 'Gate S — written snow cover?', v: 'NO', list: YESNO, basis: '제설 계약 서명 전 필수. 목표 10/30 (memo §2)' },
  { key: 'cash_now', ko: '현재 현금', en: 'Cash on hand', v: '', fmt: FMT.money0, unit: '$', basis: '직접 입력 (매주 갱신)' },
  { key: 'runway_floor', ko: '최소 현금선', en: 'Runway floor', v: '', fmt: FMT.money0, unit: '$', basis: '첫날 질문 10: 버틸 수 있는 월세 개월 수 기준 (memo §7)' },
  { key: 'd7', ko: 'Day 7 점검일', en: 'Day 7 check', v: utc(2026, 10, 4), fmt: FMT.date, basis: 'memo §8' },
  { key: 'd10', ko: 'Day 10 점검일', en: 'Day 10 check', v: utc(2026, 10, 7), fmt: FMT.date, basis: 'memo §8 (CGL 가입)' },
  { key: 'g1_stop', ko: '관문 G1 최종 마감', en: 'G1 hard stop', v: utc(2026, 10, 9), fmt: FMT.date, basis: 'memo §2' },
  { key: 'd14', ko: 'Day 14 점검일', en: 'Day 14 check', v: utc(2026, 10, 11), fmt: FMT.date, basis: 'memo §8' },
  { key: 'd21', ko: 'Day 21 점검일', en: 'Day 21 check', v: utc(2026, 10, 18), fmt: FMT.date, basis: 'memo §8' },
  { key: 'd28', ko: 'Day 28 점검일', en: 'Day 28 check', v: utc(2026, 10, 25), fmt: FMT.date, basis: 'memo §8' },
  { key: 'd30', ko: 'Day 30 점검일', en: 'Day 30 check', v: utc(2026, 10, 27), fmt: FMT.date, basis: 'memo §8' },
  { key: 'snow_deadline', ko: '제설 최소 계약 마감', en: 'Snow minimum-contracts deadline', v: utc(2026, 11, 20), fmt: FMT.date, basis: 'memo §2: 이날까지 전체 제설 계약(모든 지역 합산)이 최소 건수(손익분기 수)에 이르지 않으면 모든 계약 무효, 고객이 낼 돈 없음' },
  { key: 'gut_from', ko: 'Day 21 홈통 예약 구간 시작', en: 'Gutter booking window from', v: utc(2026, 10, 19), fmt: FMT.date, basis: 'memo §8' },
  { key: 'gut_to', ko: 'Day 21 홈통 예약 구간 끝', en: 'Gutter booking window to', v: utc(2026, 11, 30), fmt: FMT.date, basis: 'memo §8' },
  { key: 'k_d7_doors', ko: 'Day 7: 시도 수', en: 'Day 7: attempts', v: 160, fmt: FMT.int, basis: 'memo §8: 160회 이상 + 견적 0건 → 스크립트 변경 (중단 아님)' },
  { key: 'k_d14_doors', ko: 'Day 14: 시도 수', en: 'Day 14: attempts', v: 400, fmt: FMT.int, basis: 'memo §8: 400회 이상 후 완료 0 + 예약 2건 미만 → Plan C' },
  { key: 'k_d14_booked', ko: 'Day 14: 예약 최소', en: 'Day 14: min booked', v: 2, fmt: FMT.int, basis: 'memo §8' },
  { key: 'k_d21_completed', ko: 'Day 21: 완료 최소 (B1)', en: 'Day 21: min completed (B1)', v: 2, fmt: FMT.int, basis: 'memo §8' },
  { key: 'k_d21_runrate', ko: 'Day 21: run-rate 최소 (B1)', en: 'Day 21: min run-rate (B1)', v: 150, fmt: FMT.money0, unit: '$/주', basis: 'memo §8' },
  { key: 'k_d21_gutter', ko: 'Day 21: 홈통 예약 최소 (B2)', en: 'Day 21: min gutter bookings (B2)', v: 5, fmt: FMT.int, basis: 'memo §8 (10/19–11/30 예약)' },
  { key: 'k_d21_doorjob', ko: 'Day 21: 문→계약 최소 (B2)', en: 'Day 21: min door→job (B2)', v: 0.01, fmt: FMT.pct, basis: 'memo §8: 1% 미만이면 보수 시나리오' },
  { key: 'k_b2_doorjob', ko: 'B2 기본 11월에 필요한 문→계약', en: 'Door→job needed for base B2 Nov', v: 0.018, fmt: FMT.pct, basis: 'memo 5.3 (36 ÷ 2,000, 추정)' },
  { key: 'k_d28_runrate', ko: 'Day 28: run-rate 최소', en: 'Day 28: min run-rate', v: 400, fmt: FMT.money0, unit: '$/주', basis: 'memo §8 (기본 11월 속도 $819의 약 50%)' },
  { key: 'k_pathB_memo', ko: 'Path B 기준 (memo 참고값)', en: 'Path B line (memo reference)', v: 1000, fmt: FMT.money0, unit: '$/주', kind: 'info', basis: 'memo 5.4: 최대 EI 기준 약 $1,000/주. 실제 판단은 EI 시트의 재계산 값 사용.' },
]

// Row layout for the Settings sheet
const SROW = {}
let settingsRow = 4
SETTINGS.forEach((e, i) => {
  if (e.section) {
    if (i > 0) settingsRow += 1
    e.row = settingsRow
  } else {
    e.row = settingsRow
    SROW[e.key] = settingsRow
  }
  settingsRow += 1
})
/** Absolute reference to a Settings value cell. Throws on typos. */
function S(key) {
  if (!SROW[key]) throw new Error(`Unknown settings key: ${key}`)
  return `${q(SH.settings)}!$C$${SROW[key]}`
}
const ASOF = S('asof')

// Service table (below the settings entries)
const SERVICES = [
  { code: 'CL-STD', ko: '일반 청소', en: 'Standard clean', pct: 'dc_clean', basis: '가정 A2' },
  { code: 'CL-DEEP', ko: '딥클린(대청소)', en: 'Deep clean', pct: 'dc_clean', basis: '가정 A2' },
  { code: 'CL-MOVE', ko: '입주·이사 청소', en: 'Move-in / move-out clean', pct: 'dc_clean', basis: '가정 A2' },
  { code: 'CL-RECUR', ko: '정기 청소(격주)', en: 'Recurring clean (biweekly)', pct: 'dc_clean', basis: '가정 A2' },
  { code: 'GUT', ko: '홈통(처마 물받이) 청소', en: 'Gutter cleaning', fixed: 'dc_gutter', basis: '가정 A6' },
  { code: 'SNOW', ko: '제설 시즌 계약 (할부 1회분)', en: 'Snow season contract (1 instalment)', pct: 'dc_snow', basis: '가정 A4' },
  { code: 'SNOW-VISIT', ko: '제설 1회 방문 (11월)', en: 'Snow clearing, per visit (November)', pct: 'dc_snow', basis: '가정 A4' },
  { code: 'PLAT', ko: '플랫폼 작업 (TaskRabbit·Jiffy)', en: 'Platform task (TaskRabbit / Jiffy)', pct: 'dc_platform', basis: '가정 A3' },
  { code: 'OTHER', ko: '기타', en: 'Other', basis: '직접비 0 — 실제 비용을 작업 시트에 입력' },
]
const SERVICE_CODES = SERVICES.map((s) => s.code).join(',')
const SVC_HEAD = settingsRow + 2
const SVC_FIRST = SVC_HEAD + 1
const SVC_LAST = SVC_FIRST + SERVICES.length - 1
const SVC = `${q(SH.settings)}!$A$${SVC_FIRST}:$F$${SVC_LAST}`

// Weekly completed-job targets (memo §7; Nov–Jan rows are ESTIMATE = monthly jobs ÷ 4.33)
const WEEKS = [
  { from: utc(2026, 9, 28), to: utc(2026, 10, 4), label: 'Wk 1 (9/28–10/4)', b1: 0, b1d: 160, b2: 0, b2d: 160, basis: 'memo §7' },
  { from: utc(2026, 10, 5), to: utc(2026, 10, 11), label: 'Wk 2 (10/5–10/11)', b1: 1, b1d: 150, b2: 1, b2d: 215, basis: 'memo §7' },
  { from: utc(2026, 10, 12), to: utc(2026, 10, 18), label: 'Wk 3 (10/12–10/18)', b1: 2, b1d: 150, b2: 3, b2d: 360, basis: 'memo §7 (B2 = 청소 1 + 홈통 2)' },
  { from: utc(2026, 10, 19), to: utc(2026, 10, 25), label: 'Wk 4 (10/19–10/25)', b1: 2, b1d: 230, b2: 5, b2d: 400, basis: 'memo §7 (B2 = 청소 2 + 홈통 3)' },
  { from: utc(2026, 10, 26), to: utc(2026, 10, 31), label: '10/26–10/31', b1: 1, b1d: 250, b2: 3, b2d: 400, basis: 'memo §7 (B2 = 청소 2 + 홈통 1)' },
  { from: utc(2026, 11, 1), to: utc(2026, 11, 30), label: '11월 (주당)', b1: 'ROUND(IFERROR(14/4.33,0),2)', b1d: '', b2: 'ROUND(IFERROR(36/4.33,0),2)', b2d: '', basis: '추정: memo 5.2/5.3 11월 B1 14건, B2 36건 ÷ 4.33주' },
  { from: utc(2026, 12, 1), to: utc(2026, 12, 31), label: '12월 (주당)', b1: 'ROUND(IFERROR(20/4.33,0),2)', b1d: '', b2: 'ROUND(IFERROR(20/4.33,0),2)', b2d: '', basis: '추정: memo 5.2/5.3 12월 청소 20건 ÷ 4.33 (제설 계약은 작업 수에서 제외)' },
  { from: utc(2027, 1, 1), to: utc(2027, 1, 31), label: '1월 (주당)', b1: 'ROUND(IFERROR(24/4.33,0),2)', b1d: '', b2: 'ROUND(IFERROR(22/4.33,0),2)', b2d: '', basis: '추정: memo 5.2/5.3 1월 B1 24건, B2 청소 22건 ÷ 4.33' },
]
const WK_HEAD = SVC_LAST + 3
const WK_FIRST = WK_HEAD + 1
const WK_LAST = WK_FIRST + WEEKS.length - 1
const wkRange = (col) => `${q(SH.settings)}!$${col}$${WK_FIRST}:$${col}$${WK_LAST}`

function closesNeededFormula() {
  const t = `${ASOF}+14`
  const m = `MATCH(${t},${wkRange('A')},1)`
  return (
    `IF(${S('closes_manual')}<>"",${S('closes_manual')},IFERROR(IF(${t}<=INDEX(${wkRange('B')},${m}),` +
    `IF(${S('scenario')}="B2",INDEX(${wkRange('F')},${m}),INDEX(${wkRange('D')},${m})),""),""))`
  )
}

// ---------------------------------------------------------------------------
// Data-entry sheets (row 1 header, row 2 example that formulas ignore, data from row 3)
// ---------------------------------------------------------------------------

const EX_NOTE = '예시 행 — 계산에서 제외됨 / EXAMPLE row, not counted'
const SOURCES = 'DOOR,KIJIJI,FACEBOOK,KOREAN,REFERRAL,B2B,WEB,PHONE,PLATFORM,REPEAT,OTHER'
const SOURCE_NOTE =
  'DOOR 문 두드리기 · KIJIJI · FACEBOOK · KOREAN 한인 커뮤니티 · REFERRAL 소개 · B2B 부동산·관리회사 · WEB 웹사이트 · PHONE 전화 문의 · PLATFORM TaskRabbit/Jiffy · REPEAT 기존 고객 · OTHER'
const SERVICE_NOTE = SERVICES.map((s) => `${s.code} ${s.ko}`).join(' · ')

const SPECS = {
  doors: {
    sheet: SH.doors,
    rows: 10000,
    tab: 'FF2E75B6',
    csv: 'doors.csv',
    cols: [
      { key: 'date', csv: 'date', ko: '날짜', en: 'Date', w: 12, fmt: FMT.date, ex: [utc(2026, 9, 30), utc(2026, 9, 30)] },
      { key: 'street', csv: 'street', ko: '거리', en: 'Street', w: 22, ex: ['EXAMPLE St', 'EXAMPLE St'] },
      { key: 'house', csv: 'house_no', ko: '집 번호', en: 'House #', w: 10, ex: ['101', '103'] },
      { key: 'attempt', csv: 'attempt_no', ko: '시도 #', en: 'Attempt #', w: 10, fmt: FMT.int, ex: [1, 1], dv: { type: 'whole', operator: 'between', allowBlank: true, formulae: [1, 20], showErrorMessage: true, error: '1–20' }, note: '같은 집을 몇 번째 두드리는지. 부재(NA) 뒤 다시 가면 2, 3… 재방문도 시도 1회로 셉니다 (memo §7).' },
      { key: 'outcome', csv: 'outcome', ko: '결과 코드', en: 'Outcome', w: 11, list: 'NA,NI,Q,B,CB,NS', ex: ['NA', 'Q'], note: 'NA 부재 · NI 관심 없음 · Q 견적 요청 · B 바로 예약 · CB 다시 연락 · NS 방문판매 금지 표시 (시도에서 제외)' },
      { key: 'notes', csv: 'notes', ko: '메모', en: 'Notes', w: 40, ex: ['EXAMPLE - fake row - delete', 'EXAMPLE - fake row - delete (see quote EX-Q1)'] },
      { key: 'cluster', csv: 'cluster', ko: '클러스터', en: 'Cluster #', w: 10, fmt: FMT.int, ex: [1, 1], dv: { type: 'whole', operator: 'between', allowBlank: true, formulae: [1, 9], showErrorMessage: true, error: '1–9' }, note: '비워 두면 1로 계산합니다.' },
    ],
  },
  quotes: {
    sheet: SH.quotes,
    rows: 1000,
    tab: 'FF2E75B6',
    csv: 'quotes.csv',
    cols: [
      { key: 'id', csv: 'quote_id', ko: '견적 ID', en: 'Quote ID', w: 10, ex: ['EX-Q1', 'EX-Q2'], note: '예: Q-001, Q-002 … 중복 없이' },
      { key: 'date', csv: 'request_date', ko: '요청일', en: 'Request date', w: 12, fmt: FMT.date, ex: [utc(2026, 9, 30), utc(2026, 10, 1)] },
      { key: 'source', csv: 'source', ko: '출처', en: 'Source', w: 11, list: SOURCES, ex: ['DOOR', 'KIJIJI'], note: SOURCE_NOTE },
      { key: 'name', csv: 'name', ko: '고객 이름', en: 'Customer', w: 20, ex: ['EXAMPLE Customer A', 'EXAMPLE Customer B'] },
      { key: 'address', csv: 'address', ko: '주소', en: 'Address', w: 24, ex: ['103 EXAMPLE St', '5 EXAMPLE Ave'] },
      { key: 'contact', csv: 'contact', ko: '연락처', en: 'Phone / email', w: 20, ex: ['555-0100', 'b@example.com'] },
      { key: 'service', csv: 'service', ko: '서비스', en: 'Service', w: 12, list: SERVICE_CODES, ex: ['CL-DEEP', 'CL-MOVE'], note: SERVICE_NOTE },
      { key: 'price', csv: 'quote_price', ko: '견적 금액 (세전)', en: 'Quote $ (pre-tax)', w: 13, fmt: FMT.money, ex: [tier(2).deep, tier(2).moveOut], note: '가격표(config/prices.ts)와 같은 금액. 제설(SNOW)은 시즌 총액.' },
      { key: 'status', csv: 'status', ko: '상태', en: 'Status', w: 9, list: 'OPEN,WON,LOST', ex: ['WON', 'OPEN'], note: 'OPEN 답 기다림 · WON 계약 성사 · LOST 안 됨' },
      { key: 'won', csv: 'won_date', ko: '계약일', en: 'Won date', w: 12, fmt: FMT.date, ex: [utc(2026, 10, 2), ''] },
      { key: 'sched', csv: 'scheduled_date', ko: '작업 예정일', en: 'Scheduled', w: 12, fmt: FMT.date, ex: [utc(2026, 10, 14), ''] },
      { key: 'door', csv: 'door_signed', ko: '방문 계약?', en: 'Door-signed (Y/N)', w: 11, list: 'Y,N', ex: ['Y', 'N'], note: ONTARIO ? '고객 집에서 서명한 온타리오 계약 = Y. 취소권 안내 필수: 계약서 사본을 받은 다음 날부터 10일 안에 취소, 취소 통지를 받은 다음 날부터 15일 안에 환불 (F32).' : `고객 집에서 서명한 계약 = Y. 이 주의 취소권·환불 규칙은 ${NOT_VERIFIED_PROV} (온타리오 규칙 F32만 조사됨).` },
      { key: 'optin', csv: 'marketing_optin', ko: '마케팅 수신 동의', en: 'Marketing opt-in (Y/N)', w: 12, list: 'Y,N', ex: ['N', 'N'], note: '따로 체크한 경우만 Y (CASL 명시적 동의). 동의 문구와 날짜는 메모에.' },
      { key: 'notes', csv: 'notes', ko: '메모', en: 'Notes', w: 30, ex: ['EXAMPLE - fake row - delete', 'EXAMPLE - fake row - delete'] },
      {
        key: 'cancel_by', ko: '취소 가능 기한 (추정)', en: 'Cancel-by (est.)', w: 14, fmt: FMT.date,
        f: (r) => `IF(AND($L${r}="Y",$J${r}<>""),$J${r}+${S('cancel_days')},"")`,
        note: ONTARIO
          ? '방문 계약: 계약서 사본을 받은 다음 날부터 10일 (F32, SNIPPET). 여기서는 계약일 + 10일로 추정. 기간 중 작업한 경우의 효과는 조사 안 됨.'
          : `온타리오 기준(10일, F32)으로 계산한 값입니다. 이 주의 취소 기간은 ${NOT_VERIFIED_PROV}.`,
      },
      {
        key: 'est_net', ko: '예상 순이익', en: 'Est. net', w: 12, fmt: FMT.money,
        f: (r) => `IF($H${r}="","",$H${r}-ROUND(IFERROR($H${r}*VLOOKUP($G${r},${SVC},4,0)+VLOOKUP($G${r},${SVC},5,0),0),2))`,
        note: '견적 금액 − 추정 직접비 (설정 시트 서비스표, 가정 A2–A6)',
      },
      {
        key: 'fu', ko: '후속 알림', en: 'Follow-up', w: 16,
        f: (r) => `IF(AND($I${r}="OPEN",$B${r}<>""),IF(${ASOF}-$B${r}>=${S('quote_fu_days')},"후속 연락 필요",""),"")`,
      },
    ],
  },
  jobs: {
    sheet: SH.jobs,
    rows: 1000,
    tab: 'FF2E75B6',
    csv: 'jobs.csv',
    cols: [
      { key: 'id', csv: 'job_id', ko: '작업 ID', en: 'Job ID', w: 10, ex: ['EX-J1', 'EX-J2'], note: '예: J-001 … 인보이스 번호는 INV-작업ID' },
      { key: 'quote', csv: 'quote_id', ko: '견적 ID', en: 'Quote ID', w: 10, ex: ['EX-Q1', ''] },
      { key: 'date', csv: 'completed_date', ko: '완료일', en: 'Completed date', w: 12, fmt: FMT.date, ex: [utc(2026, 10, 14), utc(2026, 10, 15)], note: '작업을 끝낸 날 (EI: 일한 주에 배분, s.36(6)). 제설 시즌 계약은 할부 1회마다 한 줄 (현장 확정 시즌 요금 ÷ 4, 12/1, 1/1, 2/1, 3/1).' },
      { key: 'name', csv: 'name', ko: '고객 이름', en: 'Customer', w: 20, ex: ['EXAMPLE Customer A', 'EXAMPLE Customer C'] },
      { key: 'address', csv: 'address', ko: '주소', en: 'Address', w: 24, ex: ['103 EXAMPLE St', '7 EXAMPLE Cres'] },
      { key: 'service', csv: 'service', ko: '서비스', en: 'Service', w: 12, list: SERVICE_CODES, ex: ['CL-DEEP', 'CL-STD'], note: SERVICE_NOTE },
      { key: 'source', csv: 'source', ko: '출처', en: 'Source', w: 11, list: SOURCES, ex: ['DOOR', 'REFERRAL'], note: SOURCE_NOTE },
      { key: 'price', csv: 'price', ko: '금액 (세전)', en: 'Price $ (pre-tax)', w: 13, fmt: FMT.money, ex: [tier(2).deep, tier(1).standard] },
      { key: 'direct', csv: 'direct_costs_actual', ko: '직접비 (실제)', en: 'Direct costs $ (actual)', w: 13, fmt: FMT.money, ex: ['', ''], note: '비워 두면 추정 비율을 씁니다 (청소 20%, 홈통 $20, 제설 15%, 플랫폼 10% — 가정 A2–A6). 세금·EI에는 지출 시트의 실제 영수증만 씁니다.' },
      { key: 'door', csv: 'door_signed', ko: '방문 계약?', en: 'Door-signed (Y/N)', w: 11, list: 'Y,N', ex: ['Y', 'N'], note: ONTARIO ? 'Y면 인보이스에 온타리오 10일 취소권 안내가 나옵니다 (F32).' : `Y면 인보이스에 "${NOT_VERIFIED_PROV}" 줄이 나옵니다. 이 주의 취소권 문구를 확인해 바꾼 뒤 보내세요.` },
      { key: 'notes', csv: 'notes', ko: '메모', en: 'Notes', w: 30, ex: ['EXAMPLE - fake row - delete', 'EXAMPLE - fake row - delete'] },
      {
        key: 'direct_used', ko: '적용 직접비', en: 'Direct cost used', w: 12, fmt: FMT.money,
        f: (r) => `IF($C${r}="","",IF($I${r}="",ROUND(IFERROR($H${r}*VLOOKUP($F${r},${SVC},4,0)+VLOOKUP($F${r},${SVC},5,0),0),2),$I${r}))`,
      },
      { key: 'net', ko: '순이익', en: 'Net', w: 12, fmt: FMT.money, f: (r) => `IF($C${r}="","",$H${r}-$L${r})`, note: '금액 − 직접비. run-rate(최근 7일)의 기준 (memo §8).' },
      { key: 'basis', ko: '직접비 근거', en: 'Cost basis', w: 13, f: (r) => `IF($C${r}="","",IF($I${r}="","추정 ESTIMATE","실제 ACTUAL"))` },
      { key: 'paid', ko: '입금 합계', en: 'Paid', w: 12, fmt: FMT.money, f: (r) => `IF($A${r}="","",SUMIFS(${R('payments', 'amount')},${R('payments', 'job')},$A${r}))` },
      {
        key: 'balance', ko: '미수금', en: 'Balance due', w: 12, fmt: FMT.money,
        f: (r) => `IF($C${r}="","",ROUND($H${r}*(1+IF(${S('hst_reg')}="YES",${S('tax_rate')},0)),2)-N($O${r}))`,
        note: '금액 (+ 등록했으면 세금) − 입금 합계',
      },
      { key: 'invoice', ko: '인보이스 번호', en: 'Invoice #', w: 13, f: (r) => `IF($A${r}="","","INV-"&$A${r})` },
      {
        key: 'split', ko: '분할 안내', en: 'Split note', w: 22,
        f: (r) => `IF($H${r}="","",IF($H${r}>${S('etr_limit')},"$2,000 초과: e-Transfer 나눠 받기 (F36)",""))`,
      },
    ],
  },
  payments: {
    sheet: SH.payments,
    rows: 1000,
    tab: 'FF2E75B6',
    csv: 'payments.csv',
    cols: [
      { key: 'date', csv: 'date', ko: '입금일', en: 'Date', w: 12, fmt: FMT.date, ex: [utc(2026, 10, 14), utc(2026, 10, 15)] },
      { key: 'job', csv: 'job_id', ko: '작업 ID', en: 'Job ID', w: 10, ex: ['EX-J1', 'EX-J2'] },
      { key: 'amount', csv: 'amount', ko: '금액', en: 'Amount $', w: 12, fmt: FMT.money, ex: [tier(2).deep, tier(1).standard] },
      { key: 'method', csv: 'method', ko: '방법', en: 'Method', w: 12, list: 'ETRANSFER,CASH,CARD,CHEQUE,PLATFORM', ex: ['ETRANSFER', 'CASH'], note: 'ETRANSFER · CASH 현금 · CARD 카드 · CHEQUE 수표 · PLATFORM 플랫폼 정산' },
      { key: 'ref', csv: 'reference', ko: '참조번호', en: 'Reference', w: 18, ex: ['EXAMPLE-REF-001', ''] },
      { key: 'notes', csv: 'notes', ko: '메모', en: 'Notes', w: 30, ex: ['EXAMPLE - fake row - delete', 'EXAMPLE - fake row - delete'] },
      { key: 'name', ko: '고객 (자동)', en: 'Customer (auto)', w: 20, f: (r) => `IF($B${r}="","",IFERROR(INDEX(${R('jobs', 'name')},MATCH($B${r},${R('jobs', 'id')},0)),"작업 ID 없음"))` },
      { key: 'fee', ko: '카드 수수료 (추정)', en: 'Card fee (est.)', w: 12, fmt: FMT.money, f: (r) => `IF($C${r}="","",IF($D${r}="CARD",ROUND($C${r}*${S('card_pct')}+${S('card_fixed')},2),0))` },
      { key: 'split', ko: '분할 안내', en: 'Split note', w: 26, f: (r) => `IF($C${r}="","",IF($C${r}>${S('etr_limit')},"$2,000 초과: 은행 한도 확인, 나눠 받기 (F36)",""))` },
      { key: 'job_balance', ko: '작업 잔액', en: 'Job balance', w: 12, fmt: FMT.money, f: (r) => `IF($B${r}="","",IFERROR(INDEX(${R('jobs', 'balance')},MATCH($B${r},${R('jobs', 'id')},0)),""))` },
    ],
  },
  followups: {
    sheet: SH.followups,
    rows: 1000,
    tab: 'FF2E75B6',
    csv: 'followups.csv',
    cols: [
      { key: 'created', csv: 'created_date', ko: '등록일', en: 'Created', w: 12, fmt: FMT.date, ex: [utc(2026, 10, 1), utc(2026, 10, 14)] },
      { key: 'name', csv: 'name', ko: '고객', en: 'Customer', w: 20, ex: ['EXAMPLE Customer B', 'EXAMPLE Customer A'] },
      { key: 'related', csv: 'related_id', ko: '관련 ID', en: 'Quote / Job ID', w: 11, ex: ['EX-Q2', 'EX-J1'] },
      { key: 'type', csv: 'type', ko: '유형', en: 'Type', w: 11, list: 'QUOTE,CALLBACK,RECURRING,REFERRAL,REVIEW,SNOW,OTHER', ex: ['QUOTE', 'RECURRING'], note: 'QUOTE 견적 후속 · CALLBACK 다시 연락(CB) · RECURRING 정기 청소 제안 · REFERRAL 소개 부탁 · REVIEW 후기 부탁 · SNOW 제설 안내 · OTHER' },
      { key: 'channel', csv: 'channel', ko: '채널', en: 'Channel', w: 11, list: 'PHONE,SMS,EMAIL,DOOR,IN-PERSON', ex: ['SMS', 'PHONE'] },
      { key: 'due', csv: 'due_date', ko: '예정일', en: 'Due', w: 12, fmt: FMT.date, ex: [utc(2026, 10, 3), utc(2026, 10, 21)] },
      { key: 'done', csv: 'done', ko: '완료?', en: 'Done (Y/N)', w: 9, list: 'Y,N', ex: ['N', 'N'] },
      { key: 'consent', csv: 'consent_basis', ko: '동의 근거', en: 'Consent basis', w: 12, list: 'EXPRESS,INQUIRY,REPLY,REFERRAL,NONE', ex: ['INQUIRY', ''], note: '문자·이메일일 때 필수 (CASL). EXPRESS 따로 동의함 · INQUIRY 문의 후 6개월 (s.10(10)) · REPLY 문의에 대한 직접 답장 (SOR/2013-221 s.3(b)) · REFERRAL 첫 메시지에 소개자 이름 (s.4(1)) · NONE 없음 → 전화·방문만' },
      { key: 'unsub', csv: 'unsubscribed', ko: '수신거부?', en: 'Unsubscribed (Y/N)', w: 11, list: 'Y,N', ex: ['N', 'N'], note: 'STOP 등 수신거부를 받으면 Y. 10영업일 안에 처리 (F11).' },
      { key: 'result', csv: 'result', ko: '결과', en: 'Result', w: 20, ex: ['', ''] },
      { key: 'notes', csv: 'notes', ko: '메모', en: 'Notes', w: 30, ex: ['EXAMPLE - fake row - delete', 'EXAMPLE - fake row - delete'] },
      {
        key: 'status', ko: '상태', en: 'Status', w: 13,
        f: (r) => `IF($A${r}="","",IF($G${r}="Y","완료 DONE",IF($F${r}="","날짜 없음",IF($F${r}<${ASOF},"지남 OVERDUE",IF($F${r}=${ASOF},"오늘 TODAY","예정 OPEN")))))`,
      },
      {
        key: 'casl', ko: 'CASL 확인', en: 'CASL check', w: 34,
        // Fails closed: REFERRAL covers only the first message (s.4(1)), REPLY only a direct answer to
        // the inquiry (s.3(b)), INQUIRY needs the quote's request date (F11, F12).
        f: (r) =>
          `IF($A${r}="","",IF($I${r}="Y","수신거부: 문자·이메일 보내지 않기",IF(OR($E${r}="SMS",$E${r}="EMAIL"),` +
          `IF(OR($H${r}="",$H${r}="NONE"),"동의 근거 없음: 전화·방문만",` +
          `IF($H${r}="INQUIRY",IF(N($N${r})=0,"견적 요청일을 못 찾음: 관련 ID에 견적 ID(Q-…)를 넣었는지 확인",IF(${ASOF}>N($N${r}),"문의 후 6개월 지남: 다른 동의 근거 필요","OK: 이름·주소·연락처·수신거부 문구 넣기")),` +
          `IF($H${r}="REFERRAL","소개 후 첫 메시지만 OK: 소개자 이름 + 이름·주소·연락처·수신거부 문구. 두 번째부터는 다른 동의 근거 필요",` +
          `IF(AND($H${r}="REPLY",$D${r}<>"QUOTE",$D${r}<>"CALLBACK"),"문의에 대한 답장이 아님: EXPRESS 또는 INQUIRY 동의 필요",` +
          `"OK: 이름·주소·연락처·수신거부 문구 넣기")))),"")))`,
      },
      {
        key: 'consent_end', ko: '문의 동의 만료', en: 'Inquiry consent ends', w: 13, fmt: FMT.date,
        f: (r) => `IF($H${r}="INQUIRY",IFERROR(EDATE(INDEX(${R('quotes', 'date')},MATCH($C${r},${R('quotes', 'id')},0)),${S('inquiry_months')}),""),"")`,
        note: '문의 → 6개월 묵시적 동의 (CASL s.10(10), F11). 견적 요청일 기준.',
      },
    ],
  },
  expenses: {
    sheet: SH.expenses,
    rows: 1000,
    tab: 'FFBF8F00',
    cols: [
      { key: 'date', ko: '날짜', en: 'Date', w: 12, fmt: FMT.date, ex: [utc(2026, 9, 29)] },
      { key: 'desc', ko: '내용', en: 'Description', w: 28, ex: ['EXAMPLE door-hanger printing'] },
      { key: 'vendor', ko: '거래처', en: 'Vendor', w: 18, ex: ['EXAMPLE Print Shop'] },
      { key: 'amount', ko: '금액 (세금 포함)', en: 'Amount $ (incl. tax)', w: 14, fmt: FMT.money, ex: [60] },
      { key: 'cat', ko: 'T2125 분류', en: 'T2125 category', w: 34, listRange: true, ex: ['8521 Advertising'], note: '세금 시트의 T2125 목록에서 고르기 (확인 필요 — 모르면 "미분류")' },
      { key: 'method', ko: '결제 방법', en: 'Paid by', w: 12, list: 'CARD,DEBIT,CASH,ETRANSFER,CHEQUE,OTHER', ex: ['DEBIT'] },
      { key: 'receipt', ko: '영수증 보관?', en: 'Receipt kept (Y/N)', w: 11, list: 'Y,N', ex: ['Y'] },
      { key: 'job', ko: '관련 작업 ID', en: 'Job ID (optional)', w: 11, ex: [''] },
      { key: 'notes', ko: '메모', en: 'Notes', w: 30, ex: ['EXAMPLE - fake row - delete'] },
      { key: 'week', ko: '주 시작 (일)', en: 'Week start (Sun)', w: 12, fmt: FMT.date, f: (r) => `IF($A${r}="","",$A${r}-WEEKDAY($A${r},1)+1)` },
      { key: 'quarter', ko: '분기', en: 'Quarter', w: 9, f: (r) => `IF($A${r}="","",YEAR($A${r})&"Q"&ROUNDUP(IFERROR(MONTH($A${r})/3,0),0))` },
    ],
  },
  mileage: {
    sheet: SH.mileage,
    rows: 1000,
    tab: 'FFBF8F00',
    cols: [
      { key: 'date', ko: '날짜', en: 'Date', w: 12, fmt: FMT.date, ex: [utc(2026, 10, 14)] },
      { key: 'from', ko: '출발', en: 'From', w: 20, ex: ['Home'] },
      { key: 'to', ko: '도착', en: 'To', w: 20, ex: ['103 EXAMPLE St'] },
      { key: 'purpose', ko: '업무 목적', en: 'Business purpose', w: 26, ex: ['EXAMPLE job EX-J1'] },
      { key: 'job', ko: '관련 작업 ID', en: 'Job ID', w: 11, ex: ['EX-J1'] },
      { key: 'km', ko: '거리 (km)', en: 'Distance (km)', w: 11, fmt: FMT.num1, ex: [12] },
      { key: 'notes', ko: '메모', en: 'Notes', w: 30, ex: ['EXAMPLE - fake row - delete'] },
      { key: 'year', ko: '연도', en: 'Year', w: 8, f: (r) => `IF($A${r}="","",YEAR($A${r}))` },
    ],
  },
}

/** Absolute reference to one column of a data-entry sheet (rows FIRST..last). Throws on typos. */
function R(sheetKey, colKey) {
  const spec = SPECS[sheetKey]
  if (!spec) throw new Error(`Unknown sheet key: ${sheetKey}`)
  const i = spec.cols.findIndex((c) => c.key === colKey)
  if (i < 0) throw new Error(`Unknown column ${sheetKey}.${colKey}`)
  const L = colLetter(i + 1)
  return `${q(spec.sheet)}!$${L}$${FIRST}:$${L}$${FIRST + spec.rows - 1}`
}

// Sanity-check that the hard-coded column letters used in the row formulas match the layout.
function assertCol(sheetKey, colKey, letter) {
  const i = SPECS[sheetKey].cols.findIndex((c) => c.key === colKey)
  if (colLetter(i + 1) !== letter) throw new Error(`${sheetKey}.${colKey} is ${colLetter(i + 1)}, formulas expect ${letter}`)
}
;[
  ['quotes', 'date', 'B'], ['quotes', 'service', 'G'], ['quotes', 'price', 'H'], ['quotes', 'status', 'I'],
  ['quotes', 'won', 'J'], ['quotes', 'door', 'L'],
  ['jobs', 'id', 'A'], ['jobs', 'date', 'C'], ['jobs', 'service', 'F'], ['jobs', 'price', 'H'], ['jobs', 'direct', 'I'],
  ['jobs', 'direct_used', 'L'], ['jobs', 'paid', 'O'],
  ['payments', 'job', 'B'], ['payments', 'amount', 'C'], ['payments', 'method', 'D'],
  ['followups', 'created', 'A'], ['followups', 'related', 'C'], ['followups', 'type', 'D'], ['followups', 'channel', 'E'], ['followups', 'due', 'F'],
  ['followups', 'done', 'G'], ['followups', 'consent', 'H'], ['followups', 'unsub', 'I'], ['followups', 'consent_end', 'N'],
  ['expenses', 'date', 'A'], ['mileage', 'date', 'A'],
].forEach(([s, c, l]) => assertCol(s, c, l))

// T2125 expense categories (Tax sheet). NOT in the research: listed for convenience, verify on the CRA form.
const T2125 = [
  ['8521 Advertising', '광고', '문고리 광고지·전단 인쇄, 유료 광고'],
  ['8523 Meals and entertainment', '식대·접대', '공제 한도 규정 확인 필요'],
  ['8590 Bad debts', '대손 (못 받은 돈)', ''],
  ['8690 Insurance', '보험', '청소 CGL, 사다리·제설 보험'],
  ['8710 Interest and bank charges', '이자·은행 수수료', '카드 결제 수수료 분류 확인 필요'],
  ['8760 Business taxes, licences and memberships', '사업세·면허·회비', '플랫폼 가입비(TaskRabbit $25, 검색 요약 F21) 분류 확인 필요'],
  ['8810 Office expenses', '사무 비용', ''],
  ['8811 Office stationery and supplies', '사무용품·소모품', '청소 용품 분류는 확인 필요'],
  ['8860 Professional fees', '전문가 수수료 (회계·법률)', ''],
  ['8871 Management and administration fees', '관리·행정 수수료', ''],
  ['8910 Rent', '임차료', ''],
  ['8960 Repairs and maintenance', '수리·유지보수', ''],
  ['9060 Salaries, wages and benefits', '급여', '첫 달에는 고용 없음 (memo §3)'],
  ['9180 Property taxes', '재산세', ''],
  ['9200 Travel expenses', '출장·여행', ''],
  ['9220 Utilities', '공과금', '휴대폰 요금 분류 확인 필요'],
  ['9224 Fuel costs (except for motor vehicles)', '연료 (차량 제외)', '제설기 연료 등'],
  ['9275 Delivery, freight and express', '배송·운송', ''],
  ['9281 Motor vehicle expenses (not including CCA)', '차량 비용 (감가상각 제외)', '주행 시트 기록 필요'],
  ['9936 Capital cost allowance (CCA)', '감가상각 (CCA)', '사다리·제설기 등 — 확인 필요'],
  ['9945 Business-use-of-home expenses', '자택 사업 사용분', ''],
  ['9270 Other expenses', '기타 비용', ''],
  ['미분류 Not sure', '미분류', '회계사에게 확인'],
]
const TAX_CAT_HEAD = 30
const TAX_CAT_FIRST = TAX_CAT_HEAD + 1
const TAX_CAT_LAST = TAX_CAT_FIRST + T2125.length - 1
const TAX_CAT_RANGE = `${q(SH.tax)}!$A$${TAX_CAT_FIRST}:$A$${TAX_CAT_LAST}`

// EI parameter cells (right-hand block of the EI sheet)
const EI = { B: '$R$4', wie: '$R$5', cap: '$R$6', cpp: '$R$7', A: '$R$8', thr: '$R$9', check: '$R$10', done2: '$R$11', ahead2: '$R$12', avg: '$R$13', decision: '$R$14' }
const EI_REF = (k) => `${q(SH.ei)}!${EI[k]}`

// Break-even cells used elsewhere
const BE = { signedByDeadline: '$B$34', beApplied: '$B$32' }
const BE_REF = (k) => `${q(SH.be)}!${BE[k]}`

// ---------------------------------------------------------------------------
// Sheet builders
// ---------------------------------------------------------------------------

function buildSettings(ws) {
  ws.properties.tabColor = { argb: 'FFC00000' }
  ;[34, 34, 22, 9, 72, 48, 12, 44].forEach((w, i) => (ws.getColumn(i + 1).width = w))
  titleRow(
    ws,
    '설정 Settings — 노란 칸만 고치세요 (edit the yellow cells only)',
    6,
    '노란 칸 = 입력 · 회색 칸 = 자동 계산 또는 config에서 온 값 · "가정"과 "추정"은 근거 자료가 없는 값입니다 (decision memo §5.1). 모든 시장 가격은 검색 요약(snippet)이므로 직접 확인하세요. 세무·법률 자문이 아닙니다.',
  )
  const head = ['항목', 'Item', '값 Value', '단위', '근거·상태 Basis / status', '출처 Source']
  head.forEach((h, i) => styleHeader(ws.getCell(3, i + 1), false))
  head.forEach((h, i) => (ws.getCell(3, i + 1).value = h))
  ws.views = [{ state: 'frozen', ySplit: 3, topLeftCell: 'A4', activeCell: 'C5' }]

  for (const e of SETTINGS) {
    if (e.section) {
      sectionRow(ws, e.row, e.section, 6)
      continue
    }
    const r = e.row
    ws.getCell(r, 1).value = e.ko
    ws.getCell(r, 2).value = e.en
    ws.getCell(r, 1).font = font()
    ws.getCell(r, 2).font = font({ color: { argb: COLOR.grey } })
    const c = ws.getCell(r, 3)
    const v = typeof e.v === 'function' ? e.v() : e.v
    c.value = v === '' ? null : v
    if (e.kind === 'calc' || e.kind === 'info') styleCalc(c, e.fmt)
    else styleInput(c, e.fmt)
    if (e.list) ws.dataValidations.add(`C${r}`, listDV(e.list))
    ws.getCell(r, 4).value = e.unit ?? ''
    ws.getCell(r, 4).font = font({ color: { argb: COLOR.grey } })
    const b = ws.getCell(r, 5)
    b.value = e.basis ?? ''
    b.font = font({ size: 9 })
    b.alignment = { wrapText: true, vertical: 'top' }
    if (e.url) {
      const u = ws.getCell(r, 6)
      u.value = e.url.startsWith('http') ? { text: e.url, hyperlink: e.url } : e.url
      u.font = font({ size: 9, color: { argb: 'FF0563C1' }, underline: e.url.startsWith('http') })
    }
    ws.getRow(r).height = fitHeight(e.basis, 72)
  }

  // Service table
  sectionRow(ws, SVC_HEAD - 1, '서비스 코드 Service codes — 견적·작업 시트의 "서비스" 목록. 직접비는 위 비용 가정에서 옵니다', 6)
  ;['코드 Code', '한국어', 'English', '직접비 %', '직접비 $/건', '근거'].forEach((h, i) => {
    const c = ws.getCell(SVC_HEAD, i + 1)
    c.value = h
    styleHeader(c, i >= 3)
  })
  SERVICES.forEach((s, i) => {
    const r = SVC_FIRST + i
    ws.getCell(r, 1).value = s.code
    ws.getCell(r, 1).font = font({ bold: true })
    ws.getCell(r, 2).value = s.ko
    ws.getCell(r, 3).value = s.en
    ws.getCell(r, 4).value = s.pct ? f(S(s.pct)) : 0
    ws.getCell(r, 5).value = s.fixed ? f(S(s.fixed)) : 0
    styleCalc(ws.getCell(r, 4), FMT.pct)
    styleCalc(ws.getCell(r, 5), FMT.money0)
    ws.getCell(r, 6).value = s.basis
    ws.getCell(r, 6).font = font({ size: 9 })
    ;[2, 3].forEach((k) => (ws.getCell(r, k).font = font()))
  })

  // Weekly targets
  sectionRow(ws, WK_HEAD - 1, '주별 완료 목표 Weekly completed-job targets (memo §7, section 5 기본) — 11월 이후는 추정', 8)
  ;['시작 From', '끝 To', '구간', 'B1 완료/주', 'B1 문 (memo)', 'B2 완료/주', 'B2 문 (memo)', '근거'].forEach((h, i) => {
    const c = ws.getCell(WK_HEAD, i + 1)
    c.value = h
    styleHeader(c)
  })
  WEEKS.forEach((w, i) => {
    const r = WK_FIRST + i
    const put = (col, val, fmt) => {
      const c = ws.getCell(r, col)
      c.value = typeof val === 'string' && /^ROUND\(/.test(val) ? f(val) : val === '' ? null : val
      styleCalc(c, fmt)
    }
    put(1, w.from, FMT.date)
    put(2, w.to, FMT.date)
    put(3, w.label)
    put(4, w.b1, FMT.num2)
    put(5, w.b1d, FMT.int)
    put(6, w.b2, FMT.num2)
    put(7, w.b2d, FMT.int)
    ws.getCell(r, 8).value = w.basis
    ws.getCell(r, 8).font = font({ size: 9 })
  })

  // Price reference (read-only copy of config/prices.ts)
  let r = WK_LAST + 3
  sectionRow(ws, r - 1, `가격표 참고 Price book — config/prices.ts (${CITY}). 사이트 가격과 반드시 같아야 합니다. 여기서 고치지 말고 config/prices.ts를 고친 뒤 다시 빌드하세요`, 6)
  ;['청소 Cleaning', '포함 욕실', '일반 Standard', '딥 Deep', '입주·이사 Move-out', '비고'].forEach((h, i) => {
    const c = ws.getCell(r, i + 1)
    c.value = h
    styleHeader(c, true)
  })
  r += 1
  for (const t of TIERS) {
    ws.getCell(r, 1).value = `침실 ${t.bedrooms}개 / ${t.bedrooms} BR`
    ws.getCell(r, 2).value = t.includedBaths
    ;[t.standard, t.deep, t.moveOut].forEach((p, k) => {
      ws.getCell(r, 3 + k).value = p
      styleCalc(ws.getCell(r, 3 + k), FMT.money0)
    })
    ws.getCell(r, 6).value = '세전, 시작가 (low end). 현장 확인 후 확정'
    ws.getCell(r, 6).font = font({ size: 9 })
    r += 1
  }
  const priceLine = (label, value, fmt, note) => {
    ws.getCell(r, 1).value = label
    const c = ws.getCell(r, 3)
    c.value = value === '' || value === null || value === undefined ? null : value
    styleCalc(c, fmt)
    ws.getCell(r, 6).value = note ?? ''
    ws.getCell(r, 6).font = font({ size: 9 })
    r += 1
  }
  priceLine('추가 욕실 / Extra bathroom', BOOK.cleaning.extraBathroom, FMT.money0, '운영 선택 (owner choice)')
  for (const a of BOOK.cleaning.addOns) priceLine(`${a.ko} / ${a.en}`, a.price, FMT.money0, '운영 선택 (owner choice)')
  priceLine('24시간 내·주말·공휴일 할증 / Rush premium', BOOK.cleaning.rushPremiumPct / 100, FMT.pct, 'F18: 10–20% 범위의 중간')
  priceLine('견적 범위 상단 / Range uplift', BOOK.rangeUpliftPct / 100, FMT.pct, '상단 = 하단 × (1 + 이 비율), 현장 확인')
  if (GUT) {
    priceLine('홈통 단층 / Gutters 1 storey', GUT.byStoreys[1], FMT.money0)
    priceLine('홈통 2층 / Gutters 2 storeys', GUT.byStoreys[2], FMT.money0)
    priceLine('홈통 3층 / Gutters 3 storeys', GUT.byStoreys[3], FMT.money0, '기본 거절 (NEXT_PUBLIC_GUTTER_MAX_STOREYS=2). 두 번째 사람이 있을 때만 — 광고하지 않음 (체크리스트 04, 11번)')
    priceLine('배수관(다운스파우트) 청소 / Downspout flush', GUT.downspoutFlush, FMT.money0)
  } else priceLine('홈통 / Gutters', '', null, '이 도시는 홈통 서비스 없음')
  if (SNOW) {
    const unit = SNOW.mode === 'monthly' ? '월 가격 / per month' : '시즌 가격 / per season'
    priceLine(`제설 1열 진입로 (${unit})`, SNOW.driveway.single, FMT.money0)
    priceLine(`제설 2열 진입로 (${unit})`, SNOW.driveway.double, FMT.money0)
    priceLine(`제설 대형 진입로 (${unit})`, SNOW.driveway.large, FMT.money0)
    priceLine('현관 보도·계단 / Walkway & steps', SNOW.walkwayAndSteps, FMT.money0, '운영 선택 (add-on 가격 못 찾음)')
    priceLine('제빙 살포 / Salting', SNOW.salting, FMT.money0, '운영 선택 (add-on 가격 못 찾음)')
    priceLine('11월 1회 방문 / November per visit', SNOW.perVisit, FMT.money0, '계약서에서 선택한 경우만, 11/30까지. 12/1 첫 분할금과 함께 청구')
    priceLine('분할 횟수 / Instalments', SNOW.instalments, FMT.int, '현장 확정 시즌 요금 ÷ 4: 12/1, 1/1, 2/1, 3/1 — 12/1 전 결제 없음')
  } else priceLine('제설 / Snow', '', null, '이 도시는 제설 서비스 없음')

  r += 1
  sectionRow(ws, r, '가격 출처 Price sources (config/prices.ts) — snippet = 검색 요약만 봄, 직접 확인 필요', 6)
  r += 1
  const sources = [
    ...BOOK.cleaning.sources,
    ...(GUT ? GUT.sources : []),
    ...(SNOW ? SNOW.sources : []),
    ...BOOK.cityNotes,
  ]
  for (const s of sources) {
    ws.getCell(r, 1).value = s.label
    ws.getCell(r, 1).alignment = { wrapText: true, vertical: 'top' }
    ws.getCell(r, 1).font = font({ size: 9 })
    ws.getCell(r, 4).value = s.status
    ws.getCell(r, 4).font = font({ size: 9, color: { argb: COLOR.grey } })
    ws.getCell(r, 5).value = s.note
    ws.getCell(r, 5).font = font({ size: 9 })
    ws.getCell(r, 5).alignment = { wrapText: true, vertical: 'top' }
    if (s.url) {
      ws.getCell(r, 6).value = { text: s.url, hyperlink: s.url }
      ws.getCell(r, 6).font = font({ size: 9, color: { argb: 'FF0563C1' }, underline: true })
    }
    ws.getRow(r).height = Math.max(fitHeight(s.label, 34), fitHeight(s.note, 72))
    r += 1
  }
}

function buildDataSheet(ws, spec) {
  ws.properties.tabColor = { argb: spec.tab }
  const last = FIRST + spec.rows - 1
  spec.cols.forEach((c, i) => {
    const col = ws.getColumn(i + 1)
    col.width = c.w
    col.font = font()
    if (c.fmt) col.numFmt = c.fmt
  })
  spec.cols.forEach((c, i) => {
    const h = ws.getCell(1, i + 1)
    h.value = `${c.ko}\n${c.en}`
    styleHeader(h, !!c.f)
    if (c.note) h.note = c.note
    const ex = ws.getCell(2, i + 1)
    if (c.f) ex.value = '(자동)'
    else if (c.key === 'notes') ex.value = EX_NOTE
    else ex.value = c.ex?.[0] === '' || c.ex?.[0] === undefined ? null : c.ex[0]
    ex.font = font({ italic: true, color: { argb: COLOR.grey } })
    ex.fill = fill(COLOR.example)
    if (c.fmt) ex.numFmt = c.fmt
  })
  ws.getRow(1).height = 32
  ws.views = [{ state: 'frozen', ySplit: 2, topLeftCell: `A${FIRST}`, activeCell: `A${FIRST}` }]

  spec.cols.forEach((c, i) => {
    const L = colLetter(i + 1)
    const range = `${L}${FIRST}:${L}${last}`
    if (c.list) ws.dataValidations.add(range, listDV(c.list, `허용 / allowed: ${c.list}`))
    if (c.listRange) ws.dataValidations.add(range, listDV(TAX_CAT_RANGE, '세금 시트의 T2125 목록에서 고르세요'))
    if (c.dv) ws.dataValidations.add(range, c.dv)
    if (c.f) {
      for (let r = FIRST; r <= last; r++) {
        const cell = ws.getCell(r, i + 1)
        cell.value = f(c.f(r))
        cell.fill = fill(COLOR.calc)
        if (c.fmt) cell.numFmt = c.fmt
      }
    }
  })
}

function buildDoorsLegend(ws) {
  const rows = [
    ['코드', '뜻', '할 일'],
    ['NA', '부재 No answer', '문고리 광고지를 두고 나중에 다시 (시도 # +1)'],
    ['NI', '관심 없음 Not interested', '끝. 다시 두드리지 않기'],
    ['Q', '견적 요청 Quote requested', '견적 시트에 한 줄 (출처 DOOR)'],
    ['B', '바로 예약 Booked', `견적 시트에 WON + 방문 계약 Y (${ONTARIO ? '10일 취소권 안내, F32' : `취소권 규칙 ${NOT_VERIFIED_PROV}`})`],
    ['CB', '다시 연락 Call back', '후속 시트에 한 줄'],
    ['NS', '방문판매 금지 표시 No soliciting', '두드리지 않음. 시도 수에서 빠짐'],
  ]
  ws.getColumn(9).width = 7
  ws.getColumn(10).width = 26
  ws.getColumn(11).width = 46
  rows.forEach((row, i) => {
    row.forEach((v, k) => {
      const c = ws.getCell(1 + i, 9 + k)
      c.value = v
      if (i === 0) styleHeader(c, true)
      else {
        c.font = font({ size: 9, bold: k === 0 })
        c.border = BORDER
        c.alignment = { wrapText: true, vertical: 'top' }
      }
    })
  })
}

// ----- Dashboard -----

const DOOR_ATTEMPT_CODES = ['NA', 'NI', 'Q', 'B', 'CB']
const DOOR_ANSWER_CODES = ['NI', 'Q', 'B', 'CB']
const DOOR_FINAL_CODES = ['NI', 'Q', 'B', 'NS']

function buildDashboard(ws) {
  ws.properties.tabColor = { argb: 'FF548235' }
  ;[40, 14, 30, 12, 12, 12, 22, 28, 64].forEach((w, i) => (ws.getColumn(i + 1).width = w))
  ws.mergeCells('A1:I1')
  ws.getCell('A1').value = f(`"지표 Dashboard — 기준일 "&${ymd(ASOF)}`)
  ws.getCell('A1').font = font({ bold: true, size: 14, color: { argb: COLOR.head } })
  ws.getRow(1).height = 24
  ws.mergeCells('A2:I2')
  ws.getCell('A2').value =
    '모든 칸이 자동 계산입니다. 기준일은 설정 시트에서 바꿉니다. 비율·목표는 가정(memo A8–A10)으로 시작해 시도 30회부터 측정값으로 바뀝니다. 모든 결과는 추정이며 소득 보장이 아닙니다.'
  styleNote(ws.getCell('A2'))
  ws.getRow(2).height = 30
  ws.views = [{ state: 'frozen', ySplit: 2 }]

  const DD = R('doors', 'date')
  const DO = R('doors', 'outcome')
  const DC = R('doors', 'cluster')
  const QID = R('quotes', 'id')
  const QDATE = R('quotes', 'date')
  const QSRC = R('quotes', 'source')
  const QSVC = R('quotes', 'service')
  const QSTAT = R('quotes', 'status')
  const QWON = R('quotes', 'won')
  const QSCHED = R('quotes', 'sched')
  const JDATE = R('jobs', 'date')
  const JSRC = R('jobs', 'source')
  const JNET = R('jobs', 'net')
  const JPAID = R('jobs', 'paid')
  const JBAL = R('jobs', 'balance')
  const FSTAT = R('followups', 'status')
  void QID

  const countCodes = (codes, extra = '') => codes.map((c) => `COUNTIFS(${DO},"${c}"${extra})`).join('+')
  const attemptsUpTo = (d) => countCodes(DOOR_ATTEMPT_CODES, `,${DD},"<="&${d}`)
  const runrate = (d) => `SUMIFS(${JNET},${JDATE},">="&(${d}-6),${JDATE},"<="&${d})`

  let r = 4
  const line = (label, formula, fmt, note, bold = false) => {
    ws.getCell(r, 1).value = label
    ws.getCell(r, 1).font = font({ bold })
    const c = ws.getCell(r, 2)
    c.value = f(formula)
    styleCalc(c, fmt, bold)
    c.alignment = { horizontal: 'left' }
    ws.mergeCells(r, 2, r, 3)
    ws.mergeCells(r, 4, r, 9)
    ws.getCell(r, 4).value = note ?? ''
    styleNote(ws.getCell(r, 4), false)
    ws.getCell(r, 4).font = font({ size: 9, color: { argb: COLOR.grey } })
    const ref = `$B$${r}`
    r += 1
    return ref
  }

  sectionRow(ws, r++, '1. 문 두드리기 퍼널 (누적) Door funnel (전체 기록)', 9)
  const att = line('총 시도 Attempts', countCodes(DOOR_ATTEMPT_CODES), FMT.int, 'NA+NI+Q+B+CB. 재방문도 1회 (memo §7). NS는 제외.')
  const ans = line('응답 Answered', countCodes(DOOR_ANSWER_CODES), FMT.int, 'NI+Q+B+CB')
  const qreq = line('문에서 견적 요청 Quote requests at door', countCodes(['Q', 'B']), FMT.int, 'Q+B')
  line('방문판매 금지 표시 NS', countCodes(['NS']), FMT.int, '두드리지 않은 집')
  const dq = line('견적 시트: 문 출처 견적 Door quotes', `COUNTIFS(${QSRC},"DOOR")`, FMT.int, 'Q·B마다 견적 시트에 한 줄씩 넣어야 맞습니다')
  const dwon = line('문 출처 계약 Door closes (WON)', `COUNTIFS(${QSRC},"DOOR",${QSTAT},"WON")`, FMT.int)
  const djobs = line('문 출처 완료 작업 Door jobs completed', `COUNTIFS(${JSRC},"DOOR")`, FMT.int)
  line('전체 완료 작업 All completed jobs', `COUNT(${JDATE})`, FMT.int)

  r += 1
  sectionRow(ws, r++, '2. 전환율 Rates — 사용값 = 시도가 최소 기준 이상이고 측정값이 0보다 크면 측정값, 아니면 가정', 9)
  ;['지표', '측정 Measured', '표본 n', '가정 Assumed', '사용 Used', '설명'].forEach((h, i) => {
    const c = ws.getCell(r, i + 1)
    c.value = h
    styleHeader(c, true)
  })
  ws.mergeCells(r, 6, r, 9)
  r += 1
  const minA = S('min_attempts')
  const rateRow = (label, measured, n, assumed, used, note) => {
    ws.getCell(r, 1).value = label
    ws.getCell(r, 1).font = font()
    const cells = [measured, n, assumed, used]
    const fmts = [FMT.pct, FMT.int, FMT.pct, FMT.pct]
    cells.forEach((v, k) => {
      const c = ws.getCell(r, 2 + k)
      c.value = v === null ? null : f(v)
      styleCalc(c, fmts[k], k === 3)
    })
    ws.mergeCells(r, 6, r, 9)
    ws.getCell(r, 6).value = note
    ws.getCell(r, 6).font = font({ size: 9, color: { argb: COLOR.grey } })
    const row = r
    r += 1
    return row
  }
  const pickRule = (row) => `IF(AND(${att}>=${minA},$B$${row}>0),$B$${row},$D$${row})`
  const rA = r
  rateRow('응답률 Answer %', `IFERROR(${ans}/${att},0)`, att, S('ans_rate'), pickRule(rA), '응답 ÷ 시도 (A8 가정 35%)')
  const rQ = r
  rateRow('견적률 Quote %', `IFERROR(${qreq}/${ans},0)`, ans, S('quote_rate'), pickRule(rQ), '문에서 견적 요청 ÷ 응답 (A9 가정 10%)')
  const rC = r
  rateRow('계약률 Close %', `IFERROR(${dwon}/${dq},0)`, dq, S('close_rate'), pickRule(rC), '문 출처 WON ÷ 문 출처 견적 (진행 중 포함 — 보수적). 견적 10건 미만이면 흔들림이 큽니다 (A10 가정 40%)')
  const rJ = r
  rateRow('문→계약 Door→close %', `IFERROR(${dwon}/${att},0)`, att, `$D$${rA}*$D$${rQ}*$D$${rC}`, `$E$${rA}*$E$${rQ}*$E$${rC}`, '사용값 = 응답률 × 견적률 × 계약률 (가정이면 1.4%)')
  const rP = r
  rateRow('계약 1건당 문 Doors per close', `IFERROR(${att}/${dwon},0)`, dwon, `IFERROR(1/$D$${rJ},0)`, `IFERROR(1/$E$${rJ},0)`, '가정이면 약 71.4문 (memo 5.1)')
  ;[rP].forEach((row) => [2, 4, 5].forEach((k) => (ws.getCell(row, k).numFmt = FMT.num1)))
  const rJobs = r
  rateRow('완료 1건당 문 Doors per completed job', `IFERROR(${att}/${djobs},0)`, djobs, null, null, '문 출처 완료 작업 기준')
  ;[2].forEach((k) => (ws.getCell(rJobs, k).numFmt = FMT.num1))
  ws.getCell(r, 1).value = '측정값 사용 여부'
  ws.getCell(r, 1).font = font()
  ws.getCell(r, 2).value = f(`IF(${att}>=${minA},"측정값 사용 (시도 "&${att}&"회)","가정 사용 — 시도 "&${att}&"/"&${minA})`)
  ws.mergeCells(r, 2, r, 5)
  styleCalc(ws.getCell(r, 2))
  r += 2

  sectionRow(ws, r++, '3. 다음 주 문 목표 Next-week door target (memo §7) — 필요 문 수 = 필요 계약 ÷ (응답률 × 견적률 × 계약률)', 9)
  line('시나리오 Scenario', S('scenario'), null, '설정 시트')
  const closes = line('다음 주 필요 계약 수 Closes needed', S('closes_needed'), FMT.num2, '그다음 주 완료 목표 (설정 시트 주별 목표표 또는 직접 입력)')
  const target = line(
    '다음 주 문 목표 Door target next week',
    `IF(${closes}="","설정에서 입력 필요",ROUNDUP(IFERROR(${closes}/$E$${rJ},0),0))`,
    FMT.int,
    '재방문 포함 시도 수. 광고·B2B에서 계약이 오면 더 적어도 됩니다 (memo §7: 상한값).',
    true,
  )
  line('예상 노크 시간 (시간) Door hours', `IFERROR(ROUND(${target}*${S('door_min')}/60,1),0)`, FMT.num1, '가정 A11: 1회 2분. 작업 있는 날은 최대 40문 (memo §7).')
  const clus = line('현재 클러스터 Active cluster', S('active_cluster'), FMT.int)
  const size = line(
    '클러스터 가구 수 Homes in cluster',
    `IFERROR(INDEX(${q(SH.settings)}!$C$${SROW.cluster1}:$C$${SROW.cluster3},${clus}),0)`,
    FMT.int,
    '설정 시트',
  )
  const finals = line(
    '최종 결과가 난 집 Homes with a final outcome',
    `${DOOR_FINAL_CODES.map((c) => `COUNTIFS(${DO},"${c}",${DC},${clus})`).join('+')}+IF(${clus}=1,${DOOR_FINAL_CODES.map((c) => `COUNTIFS(${DO},"${c}",${DC},"")`).join('+')},0)`,
    FMT.int,
    'NI+Q+B+NS (클러스터 칸이 비면 1로 계산). NA·CB는 아직 끝나지 않은 집.',
  )
  const left = line('남은 가구 Homes left', `${size}-${finals}`, FMT.int, '클러스터 가구 수 − 최종 결과가 난 집', true)
  line(
    '클러스터 #2 필요? Open cluster #2?',
    `IF(ISNUMBER(${target}),IF(${left}<2*${target},"클러스터 #2 열기 — 남은 가구 < 2 × 문 목표","OK — 현재 클러스터 유지"),"-")`,
    null,
    'memo §7: 남은 가구 < 2 × 필요 문 수이면 클러스터 #2',
    true,
  )
  r += 1

  sectionRow(ws, r++, '4. 수입 Run-rate — 최근 7일 완료 작업의 순이익 (설비·연 보험료 제외, memo §8)', 9)
  const rr = line('최근 7일 순이익 Trailing-7-day net', runrate(ASOF), FMT.money, '작업 시트: 완료일이 기준일−6 ~ 기준일인 작업의 순이익 합', true)
  line('최근 7일 완료 건수 Jobs (7 days)', `COUNTIFS(${JDATE},">="&(${ASOF}-6),${JDATE},"<="&${ASOF})`, FMT.int)
  line('월 환산 Monthly pace (×4.33, 추정)', `${rr}*4.33`, FMT.money0, '추정: 한 달 ≈ 4.33주. 소득 보장 아님.')
  line(
    '이번 달 순이익 Month-to-date net',
    `SUMIFS(${JNET},${JDATE},">="&DATE(YEAR(${ASOF}),MONTH(${ASOF}),1),${JDATE},"<="&${ASOF})`,
    FMT.money,
    '월 고정비(가정 A7)는 빼지 않은 값',
  )
  line('미수금 합계 Unpaid balances', `SUMIF(${JBAL},">0")`, FMT.money, '작업 시트 미수금 > 0 합계')
  line('진행 중 견적 Open quotes', `COUNTIF(${QSTAT},"OPEN")`, FMT.int)
  line('지난 후속 연락 Overdue follow-ups', `COUNTIF(${FSTAT},"지남 OVERDUE")`, FMT.int)
  line('EI Path A / B 판단', EI_REF('decision'), null, 'EI 주간신고 시트 (memo 5.4). 판단은 Service Canada.')
  r += 1

  // Kill criteria
  sectionRow(ws, r++, '5. 중단 기준 Kill criteria (memo §8) — PASS 통과 · FAIL/ACTION 조치 · PENDING 아직 날짜 전', 9)
  ;['점검 Check', '날짜', '신호 Signal', '측정 D', '측정 E', '측정 F', '기준 Threshold', '결과 Result', '조치 Action'].forEach((h, i) => {
    const c = ws.getCell(r, i + 1)
    c.value = h
    styleHeader(c, true)
  })
  r += 1
  const killFirst = r
  const pend = (B) => `${ASOF}<${B}`
  const kills = [
    {
      check: 'Day 7',
      date: S('d7'),
      signal: '시도(D) ≥ 기준인데 견적 요청(E) 0건',
      D: (B) => attemptsUpTo(B),
      E: (B) => `COUNTIFS(${QDATE},"<="&${B})`,
      thr: `"시도 ≥"&${S('k_d7_doors')}&", 견적 0"`,
      res: (B, D, E) => `IF(${pend(B)},"대기 PENDING",IF(AND(${D}>=${S('k_d7_doors')},${E}=0),"조치 ACTION","통과 PASS"))`,
      act: '중단 아님. 스크립트·제안·거리를 바꾸고, 노크 시간 절반을 한인 커뮤니티·부동산 채널로 돌리기.',
    },
    {
      check: 'Day 10',
      date: S('d10'),
      signal: '청소 CGL 보험 가입(D)',
      D: () => S('cgl_bound'),
      thr: '"YES"',
      res: (B) => `IF(${S('cgl_bound')}="YES","통과 PASS",IF(${pend(B)},"대기 PENDING","실패 FAIL"))`,
      act: '직접 고객 받지 않기. 플랫폼만 하다가 순이익 $500이 모이면 다시 시도.',
    },
    {
      check: '관문 G1 마감',
      date: S('g1_stop'),
      signal: '관문 G1 5개 조건 모두 충족(D)',
      D: () => S('g1'),
      thr: '"YES"',
      res: (B) => `IF(${S('g1')}="YES","통과 PASS",IF(${pend(B)},"대기 PENDING","실패 FAIL"))`,
      act: '2026년 홈통 청소 접기. 제설은 관문 S로 따로 결정.',
    },
    {
      check: 'Day 14',
      date: S('d14'),
      signal: '유료 완료(D) 0건, 예약(E) 기준 미만, 시도(F) ≥ 기준',
      D: (B) => `COUNTIFS(${JDATE},"<="&${B},${JPAID},">0")`,
      E: (B) => `COUNTIFS(${QSTAT},"WON",${QWON},"<="&${B})`,
      F: (B) => attemptsUpTo(B),
      thr: `"완료 0, 예약 <"&${S('k_d14_booked')}&", 시도 ≥"&${S('k_d14_doors')}`,
      res: (B, D, E, F) =>
        `IF(${pend(B)},"대기 PENDING",IF(AND(${D}=0,${E}<${S('k_d14_booked')},${F}>=${S('k_d14_doors')}),"실패 FAIL → Plan C","통과 PASS"))`,
      act: 'Plan C: EI Path A(자격이 있으면) + 플랫폼 + 전일제 구직.',
    },
    {
      check: 'Day 14',
      date: S('d14'),
      signal: '플랫폼 승인(D)',
      D: () => S('platform_ok'),
      thr: '"YES"',
      res: (B) => `IF(${S('platform_ok')}="YES","통과 PASS",IF(${pend(B)},"대기 PENDING","실패 FAIL"))`,
      act: '모든 예측에서 플랫폼 시간 빼기. 빨리 승인될 거라 기대하고 다른 곳에 재신청하지 않기.',
    },
    {
      check: 'Day 21 (B1)',
      date: S('d21'),
      signal: '완료(D) 기준 미만 또는 7일 run-rate(E) 기준 미만',
      D: (B) => `COUNTIFS(${JDATE},"<="&${B})`,
      E: (B) => runrate(B),
      thr: `"완료 ≥"&${S('k_d21_completed')}&", run-rate ≥ $"&${S('k_d21_runrate')}`,
      res: (B, D, E) =>
        `IF(${pend(B)},"대기 PENDING",IF(OR(${D}<${S('k_d21_completed')},${E}<${S('k_d21_runrate')}),"실패 FAIL → Plan C","통과 PASS"))`,
      act: 'Plan C.',
      fmtE: FMT.money,
    },
    {
      check: 'Day 21 (B2)',
      date: S('d21'),
      signal: '10/19–11/30 날짜 잡힌 홈통 예약(D) 기준 미만',
      D: (B) => `COUNTIFS(${QSVC},"GUT",${QSTAT},"WON",${QSCHED},">="&${S('gut_from')},${QSCHED},"<="&${S('gut_to')},${QWON},"<="&${B})`,
      thr: `"≥"&${S('k_d21_gutter')}`,
      res: (B, D) => `IF(${S('g1')}<>"YES","해당 없음 N/A",IF(${pend(B)},"대기 PENDING",IF(${D}<${S('k_d21_gutter')},"실패 FAIL → 홈통 접기","통과 PASS")))`,
      act: '홈통 접기. 사다리는 이미 샀을 때만 매몰비용.',
    },
    {
      check: 'Day 21 (B2)',
      date: S('d21'),
      signal: '문→계약률(D). E = 기본 B2 11월에 필요한 비율',
      D: (B) => `IFERROR(COUNTIFS(${QSRC},"DOOR",${QSTAT},"WON",${QWON},"<="&${B})/(${attemptsUpTo(B)}),0)`,
      E: () => S('k_b2_doorjob'),
      thr: `"≥ "&TEXT(${S('k_d21_doorjob')},"0.0%")`,
      res: (B, D) => `IF(${S('g1')}<>"YES","해당 없음 N/A",IF(${pend(B)},"대기 PENDING",IF(${D}<${S('k_d21_doorjob')},"조치 ACTION → 보수 시나리오","통과 PASS")))`,
      act: '기본 B2 11월은 불가능(≥1.8% 필요, memo 5.3). 보수 시나리오 줄로 계획.',
      fmtD: FMT.pct,
      fmtE: FMT.pct,
    },
    {
      check: 'Day 28',
      date: S('d28'),
      signal: '7일 run-rate(D) 기준 미만',
      D: (B) => runrate(B),
      thr: `"≥ $"&${S('k_d28_runrate')}&"/주"`,
      res: (B, D) => `IF(${pend(B)},"대기 PENDING",IF(${D}<${S('k_d28_runrate')},"실패 FAIL → Plan C","통과 PASS"))`,
      act: 'Plan C.',
      fmtD: FMT.money,
    },
    {
      check: 'Day 30',
      date: S('d30'),
      signal: '7일 run-rate(D) ≥ Path B 전환선(E, EI 시트)',
      D: (B) => runrate(B),
      E: () => EI_REF('thr'),
      thr: `"≥ $"&ROUND(${EI_REF('thr')},0)&"/주"`,
      res: (B, D, E) => `IF(${pend(B)},"대기 PENDING",IF(${D}>=${E},"Path B (11월)","Path A 유지"))`,
      act: 'Path B = 사업 전념, 그 주 EI 없음 (F3). 모든 금액 신고. 판단은 Service Canada.',
      fmtD: FMT.money,
      fmtE: FMT.money,
    },
    {
      check: '제설 11/20',
      date: S('snow_deadline'),
      signal: '11/20까지 서명한 전체 제설 계약(모든 지역 합산, D) < 최소 건수(손익분기, E)',
      D: () => BE_REF('signedByDeadline'),
      E: () => BE_REF('beApplied'),
      thr: '"최소 건수(손익분기) 이상"',
      res: (B, D, E) =>
        `IF(AND(${D}=0,${S('gate_s')}<>"YES"),"해당 없음 N/A",IF(${D}>=${E},"통과 PASS — 계약 유효",IF(${ASOF}<=${B},"대기 PENDING — "&MAX(0,${E}-${D})&"건 더 필요","무효 VOID")))`,
      act: '미달이면 모든 계약 무효, 고객이 낼 돈 없음 (받은 돈도 없음). 보험·제설기 사지 않기.',
    },
    {
      check: '매일 Any day',
      date: ASOF,
      signal: '현재 현금(D) < 최소 현금선(E)',
      D: () => `IF(${S('cash_now')}="","",${S('cash_now')})`,
      E: () => `IF(${S('runway_floor')}="","",${S('runway_floor')})`,
      thr: '"설정 시트"',
      res: (B, D, E) => `IF(OR(${D}="",${E}=""),"입력 필요 (설정)",IF(${D}<${E},"실패 FAIL — 구매 중단","통과 PASS"))`,
      act: '모든 설비 구매 중단. 플랫폼 + 구직만.',
      fmtD: FMT.money0,
      fmtE: FMT.money0,
    },
  ]
  for (const k of kills) {
    const B = `$B$${r}`
    const D = `$D$${r}`
    const E = `$E$${r}`
    const F = `$F$${r}`
    ws.getCell(r, 1).value = k.check
    ws.getCell(r, 1).font = font({ bold: true })
    ws.getCell(r, 2).value = f(k.date)
    styleCalc(ws.getCell(r, 2), FMT.date)
    ws.getCell(r, 3).value = k.signal
    ws.getCell(r, 3).font = font({ size: 9 })
    ws.getCell(r, 3).alignment = { wrapText: true, vertical: 'top' }
    ;[
      [4, k.D, k.fmtD ?? FMT.int],
      [5, k.E, k.fmtE ?? FMT.int],
      [6, k.F, FMT.int],
    ].forEach(([col, fn, fmt]) => {
      const c = ws.getCell(r, col)
      c.value = fn ? f(fn(B)) : null
      styleCalc(c, fmt)
    })
    ws.getCell(r, 7).value = f(k.thr)
    styleCalc(ws.getCell(r, 7))
    ws.getCell(r, 7).font = font({ size: 9 })
    ws.getCell(r, 8).value = f(k.res(B, D, E, F))
    styleCalc(ws.getCell(r, 8), null, true)
    ws.getCell(r, 9).value = k.act
    ws.getCell(r, 9).font = font({ size: 9 })
    ws.getCell(r, 9).alignment = { wrapText: true, vertical: 'top' }
    ws.getRow(r).height = Math.max(fitHeight(k.signal, 30), fitHeight(k.act, 64))
    r += 1
  }
  const killRef = `H${killFirst}:H${r - 1}`
  const cf = (text, bg, fg) => ({
    type: 'expression',
    formulae: [`NOT(ISERROR(SEARCH("${text}",H${killFirst})))`],
    style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: bg } }, font: { color: { argb: fg }, bold: true } },
  })
  ws.addConditionalFormatting({
    ref: killRef,
    rules: [
      cf('FAIL', 'FFFFC7CE', 'FF9C0006'),
      cf('VOID', 'FFFFC7CE', 'FF9C0006'),
      cf('ACTION', 'FFFFEB9C', 'FF9C5700'),
      cf('입력 필요', 'FFFFEB9C', 'FF9C5700'),
      cf('PASS', 'FFC6EFCE', 'FF006100'),
      cf('Path B', 'FFC6EFCE', 'FF006100'),
    ],
  })
  r += 1

  // DAILY line
  sectionRow(ws, r++, '6. DAILY 이메일 제목 — 기준일 하루치 숫자. 아래 제목 줄을 그대로 복사해 본인에게 보내세요 (memo §10 item 11)', 9)
  const dday = line('날짜 Date', ASOF, FMT.date)
  const dDoors = line('doors (시도, NS 제외)', countCodes(DOOR_ATTEMPT_CODES, `,${DD},${dday}`), FMT.int)
  const dAns = line('answers (응답)', countCodes(DOOR_ANSWER_CODES, `,${DD},${dday}`), FMT.int)
  const dQ = line('quotes (새 견적 요청, 모든 출처)', `COUNTIFS(${QDATE},${dday})`, FMT.int)
  const dC = line('closes (그날 계약 성사)', `COUNTIFS(${QWON},${dday},${QSTAT},"WON")`, FMT.int)
  const dJ = line('completed (그날 완료한 작업)', `COUNTIFS(${JDATE},${dday})`, FMT.int)
  const dN = line('net (그날 완료 작업 순이익, 달러 반올림)', `ROUND(SUMIFS(${JNET},${JDATE},${dday}),0)`, FMT.int)
  ws.getCell(r, 1).value = '이메일 제목 Subject'
  ws.getCell(r, 1).font = font({ bold: true })
  ws.mergeCells(r, 2, r, 9)
  const subj = ws.getCell(r, 2)
  subj.value = f(
    `"DAILY "&${ymd(dday)}&" doors="&${dDoors}&" answers="&${dAns}&" quotes="&${dQ}&" closes="&${dC}&" completed="&${dJ}&" net="&${dN}`,
  )
  styleCalc(subj, null, true)
  subj.font = font({ bold: true, size: 12 })
  ws.getRow(r).height = 22
}

// ----- EI weekly -----

function buildEI(ws) {
  ws.properties.tabColor = { argb: 'FF7030A0' }
  ;[12, 12, 12, 12, 12, 8, 12, 12, 12, 12, 12, 13, 9, 12, 26, 2, 34, 14, 40].forEach((w, i) => (ws.getColumn(i + 1).width = w))
  titleRow(
    ws,
    'EI 주간신고 — 추정 계산 (최종 판단은 Service Canada)',
    15,
    '순수입 = 총수입 − 운영비 (EI Regs s.35(10)(c)); 수입은 일한 주에 배분 (s.36(6)); 모든 수입 신고, 신고 안 한 수입은 환수 (F4). 사업이 "경미한 정도(minor extent)"를 넘으면 그 주는 EI 없음 (s.30, F3). 총수입은 작업 시트, 운영비는 지출 시트에서 자동으로 옵니다. 법률 자문 아님.',
  )
  const heads = [
    ['주 시작 (일)\nWeek start (Sun)', false, '일요일 시작 주 (EI Act s.2(1) "week" 정의)'],
    ['주 끝 (토)\nWeek end', true],
    ['총수입\nGross', true, '작업 시트: 완료일이 이 주인 작업 금액 합'],
    ['운영비\nOperating exp.', true, '지출 시트: 날짜가 이 주인 지출 합. 연 보험료 같은 큰 지출을 어느 주에 넣을지는 Service Canada에 확인.'],
    ['순수입\nNet = 총수입 − 운영비', true, 'EI Regs s.35(10)(c)'],
    ['경로\nPath', false, 'A = EI + 작은 부업 · B = 사업 전념 (그 주 EI 없음) · - = EI 없음/청구 전. 기본값은 자동, 직접 바꿔도 됩니다.'],
    ['EI 공제 추정\nEst. deduction', true, '순수입의 50% (주당 보험가입소득의 90%까지) + 초과분 100% (EI Act s.19(2),(3), F4)'],
    ['EI 수령 추정\nEst. EI paid', true, 'Path A일 때 B − 공제 (0 미만이면 0)'],
    ['Path A 합계\nEI + 순수입', true],
    ['CPP 뺀 합계\nAfter CPP', true, 'EI + 순수입 × (1 − 11.9%) (memo 5.4)'],
    ['Path B 비교\n(EI 없음, CPP 뺀)', true, '같은 순수입을 EI 없이 받았을 때'],
    ['이 주 기준 전환선\nSwitch line', true, '(B − 0.5×순수입 + 0.881×순수입) ÷ 0.881 — 사업만 해서 이보다 벌어야 이 주의 Path A보다 낫습니다 (memo 5.4). 순수입이 90% 한도를 넘으면 맞지 않습니다.'],
    ['신고함?\nDeclared', false],
    ['신고일\nDeclared on', false],
    ['메모\nNotes', false],
  ]
  heads.forEach(([h, calc, note], i) => {
    const c = ws.getCell(3, i + 1)
    c.value = h
    styleHeader(c, calc)
    if (note) c.note = note
  })
  ws.getRow(3).height = 44
  ws.views = [{ state: 'frozen', ySplit: 3, xSplit: 1, topLeftCell: 'B4', activeCell: 'F4' }]

  const JDATE = R('jobs', 'date')
  const JPRICE = R('jobs', 'price')
  const XDATE = R('expenses', 'date')
  const XAMT = R('expenses', 'amount')
  const ded = S('ei_ded_rate')
  const WEEKS_N = 31
  const firstSunday = utc(2026, 9, 27)
  for (let i = 0; i < WEEKS_N; i++) {
    const r = 4 + i
    const a = ws.getCell(r, 1)
    a.value = new Date(firstSunday.getTime() + i * 7 * 86400000)
    styleInput(a, FMT.date)
    const set = (col, formula, fmt, input = false) => {
      const c = ws.getCell(r, col)
      c.value = f(formula)
      if (input) styleInput(c, fmt)
      else styleCalc(c, fmt)
    }
    set(2, `$A${r}+6`, FMT.date)
    set(3, `SUMIFS(${JPRICE},${JDATE},">="&$A${r},${JDATE},"<="&$B${r})`, FMT.money)
    set(4, `SUMIFS(${XAMT},${XDATE},">="&$A${r},${XDATE},"<="&$B${r})`, FMT.money)
    set(5, `$C${r}-$D${r}`, FMT.money)
    set(6, `IF(OR(${S('ei_eligible')}="NO",$A${r}<${S('ei_claim_start')}),"-","A")`, null, true)
    set(7, `IF($E${r}<=0,0,${ded}*MIN($E${r},${EI.cap})+MAX(0,$E${r}-${EI.cap}))`, FMT.money)
    set(8, `IF($F${r}="A",MAX(0,${EI.B}-$G${r}),0)`, FMT.money)
    set(9, `$H${r}+$E${r}`, FMT.money)
    set(10, `$H${r}+$E${r}-MAX(0,$E${r})*${EI.cpp}`, FMT.money)
    set(11, `$E${r}-MAX(0,$E${r})*${EI.cpp}`, FMT.money)
    set(12, `IFERROR((${EI.B}-${ded}*$E${r}+(1-${EI.cpp})*$E${r})/(1-${EI.cpp}),"")`, FMT.money)
    ;[13, 14, 15].forEach((col) => styleInput(ws.getCell(r, col), col === 14 ? FMT.date : null))
  }
  const lastRow = 4 + WEEKS_N - 1
  ws.dataValidations.add(`F4:F${lastRow}`, listDV('A,B,-'))
  ws.dataValidations.add(`M4:M${lastRow}`, listDV('Y,N'))

  // Parameter block
  const P = [
    ['항목 Item', '값', '근거'],
    ['주간 EI 수령액 B', S('ei_B'), '설정 시트 (예시 = 2026 최대 $729: 2차 출처 + 법 조항 공식, F5)', FMT.money0],
    ['주당 보험가입소득', S('ei_wie'), '설정 시트', FMT.money0],
    ['50% 구간 한도 (90%)', `${S('ei_wie')}*${S('ei_cap_pct')}`, 'F4', FMT.money],
    ['CPP 비율', S('cpp_rate'), 'F9', FMT.pct],
    ['Path A 계획 순수입 A', S('pathA_net'), 'memo 5.4 예시 $400', FMT.money0],
    ['Path B 전환선 (주)', `IFERROR((${EI.B}-${ded}*${EI.A}+(1-${EI.cpp})*${EI.A})/(1-${EI.cpp}),0)`, 'memo 5.4: (B − 0.5A + 0.881A) ÷ 0.881. 최대 EI면 약 $1,000', FMT.money],
    ['공식 적용 확인', `IF(${EI.A}>${EI.cap},"A가 90% 한도 초과 — 전환선 재계산 필요","OK")`, 'A가 50% 구간 안에 있어야 공식이 맞습니다'],
    ['지난 2주 완료 순이익', `SUMIFS(${R('jobs', 'net')},${JDATE},">="&(${ASOF}-13),${JDATE},"<="&${ASOF})`, '작업 시트 (기준일 포함 14일)', FMT.money],
    ['앞으로 2주 예약 순이익', `SUMIFS(${R('quotes', 'est_net')},${R('quotes', 'status')},"WON",${R('quotes', 'service')},"<>SNOW",${R('quotes', 'sched')},">"&${ASOF},${R('quotes', 'sched')},"<="&(${ASOF}+14))`, '견적 시트: WON + 예정일이 앞으로 14일 (추정 순이익). 제설 시즌 계약(SNOW)은 제외: 견적 금액이 12–3월에 나눠 버는 시즌 총액이라서입니다. 할부는 작업 시트에 회차마다 한 줄씩(12/1, 1/1, 2/1, 3/1) 넣으면 “지난 2주 완료”에 잡힙니다.', FMT.money],
    ['주당 평균 (4주)', `IFERROR((${EI.done2}+${EI.ahead2})/4,0)`, '해석(추정): (지난 2주 완료 + 앞으로 2주 예약) ÷ 4주 (memo 5.4 규칙 3)', FMT.money],
    ['판단', `IF(${S('ei_eligible')}="NO","EI 없음 — Path B (사업 전념)",IF(${EI.avg}>=${EI.thr},"Path B 전환 검토 (주 $"&ROUND(${EI.thr},0)&" 이상)","Path A 유지"))`, '10월 기본값은 Path A (memo 5.4). Service Canada에 "minor extent" 여부를 먼저 전화로 물어보세요.'],
    ['EI 신청 마감', S('ei_deadline'), 'F1 (Pilot 24)', FMT.date],
    ['EI 자격', S('ei_eligible'), '설정 시트'],
  ]
  P.forEach(([label, formula, note, fmt], i) => {
    const r = 3 + i
    const a = ws.getCell(r, 17)
    const b = ws.getCell(r, 18)
    const c = ws.getCell(r, 19)
    if (i === 0) {
      ;[a, b, c].forEach((cell, k) => {
        cell.value = [label, formula, note][k]
        styleHeader(cell, true)
      })
      return
    }
    a.value = label
    a.font = font({ bold: i === 11 })
    b.value = f(formula)
    styleCalc(b, fmt, i === 6 || i === 11)
    c.value = note
    c.font = font({ size: 9, color: { argb: COLOR.grey } })
    c.alignment = { wrapText: true, vertical: 'top' }
    ws.getRow(r).height = Math.max(15, fitHeight(note, 40))
  })
  const expect = { B: 4, wie: 5, cap: 6, cpp: 7, A: 8, thr: 9, check: 10, done2: 11, ahead2: 12, avg: 13, decision: 14 }
  for (const [k, row] of Object.entries(expect)) if (EI[k] !== `$R$${row}`) throw new Error(`EI param ${k} misplaced`)
}

// ----- Tax -----

function buildTax(ws) {
  ws.properties.tabColor = { argb: 'FFBF8F00' }
  ;[40, 13, 13, 14, 14, 14, 30, 38, 13, 12, 12, 12, 14].forEach((w, i) => (ws.getColumn(i + 1).width = w))
  titleRow(
    ws,
    '세금 Tax — GST/HST 분기 점검, CPP 적립, T2125 분류 (세무 자문 아님)',
    13,
    '매출은 작업 시트의 완료일 기준, 지출은 지출 시트 기준입니다. 입금 시트와의 차이는 미수금·입금 시기 때문입니다. 소규모 사업자 기준 $30,000: 4분기 합계 테스트 + 단일 분기 테스트 (ETA s.148, F7). 경고선: 4분기 $25,000, 단일 분기 $20,000 (memo §10 item 15).',
  )
  const heads = [
    ['분기 Quarter', false],
    ['시작', false],
    ['끝', false],
    ['총매출\nGross (Jobs)', true],
    ['과세매출 (테스트)\nTaxable (test)', true],
    ['4분기 합계\nRolling 4Q', true],
    ['단일 분기 경고\nSingle-quarter', true],
    ['4분기 경고\nRolling flag', true],
    ['입금 합계\nPayments', true],
    ['차이\nDiff', true],
    ['지출\nExpenses', true],
    ['순이익\nNet', true],
    ['CPP 적립 11.9%\nSet aside', true],
  ]
  heads.forEach(([h, calc], i) => {
    const c = ws.getCell(4, i + 1)
    c.value = h
    styleHeader(c, calc)
  })
  ws.getRow(4).height = 32
  ws.views = [{ state: 'frozen', ySplit: 4 }]
  const JDATE = R('jobs', 'date')
  const JPRICE = R('jobs', 'price')
  const JSVC = R('jobs', 'service')
  const PDATE = R('payments', 'date')
  const PAMT = R('payments', 'amount')
  const XDATE = R('expenses', 'date')
  const XAMT = R('expenses', 'amount')
  const quarters = []
  for (let y = 2026, qn = 3; quarters.length < 8; ) {
    quarters.push({ y, qn })
    qn += 1
    if (qn > 4) {
      qn = 1
      y += 1
    }
  }
  quarters.forEach(({ y, qn }, i) => {
    const r = 5 + i
    ws.getCell(r, 1).value = `${y} Q${qn}`
    ws.getCell(r, 1).font = font({ bold: true })
    const start = utc(y, (qn - 1) * 3 + 1, 1)
    const end = new Date(Date.UTC(y, qn * 3, 0))
    ws.getCell(r, 2).value = start
    ws.getCell(r, 3).value = end
    styleCalc(ws.getCell(r, 2), FMT.date)
    styleCalc(ws.getCell(r, 3), FMT.date)
    const between = (dateR) => `${dateR},">="&$B${r},${dateR},"<="&$C${r}`
    const set = (col, formula, fmt, bold = false) => {
      const c = ws.getCell(r, col)
      c.value = f(formula)
      styleCalc(c, fmt, bold)
    }
    set(4, `SUMIFS(${JPRICE},${between(JDATE)})`, FMT.money0)
    set(5, `$D${r}-IF(${S('incl_platform')}="NO",SUMIFS(${JPRICE},${JSVC},"PLAT",${between(JDATE)}),0)`, FMT.money0)
    set(6, `SUM($E$${Math.max(5, r - 3)}:$E${r})`, FMT.money0, true)
    set(7, `IF($E${r}>${S('gst_threshold')},"기준 이상 — 단일 분기 테스트: 등록 확인",IF($E${r}>=${S('warn_quarter')},"경고: 단일 분기 경고선 이상",""))`)
    set(8, `IF($F${r}>${S('gst_threshold')},"기준 초과 — 등록 준비 (분기+다음 달까지 소규모 지위, F7)",IF($F${r}>=${S('warn_rolling')},"경고: 4분기 합계 경고선 이상",""))`)
    set(9, `SUMIFS(${PAMT},${between(PDATE)})`, FMT.money0)
    set(10, `$D${r}-$I${r}`, FMT.money0)
    set(11, `SUMIFS(${XAMT},${between(XDATE)})`, FMT.money0)
    set(12, `$D${r}-$K${r}`, FMT.money0)
    set(13, `MAX(0,$L${r})*${S('cpp_rate')}`, FMT.money0)
  })
  const flagCf = (col) => ({
    ref: `${col}5:${col}12`,
    rules: [
      { type: 'expression', formulae: [`NOT(ISERROR(SEARCH("기준",${col}5)))`], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFFC7CE' } }, font: { color: { argb: 'FF9C0006' }, bold: true } } },
      { type: 'expression', formulae: [`NOT(ISERROR(SEARCH("경고",${col}5)))`], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFFEB9C' } }, font: { color: { argb: 'FF9C5700' } } } },
    ],
  })
  ws.addConditionalFormatting(flagCf('G'))
  ws.addConditionalFormatting(flagCf('H'))
  const note = ws.getCell(13, 1)
  ws.mergeCells(13, 1, 13, 13)
  note.value =
    '4분기 합계: 첫 분기들은 그 전 분기가 없으므로 있는 분기만 더합니다. 하나의 분기가 $30,000을 넘으면 그 공급부터 등록 대상일 수 있음 (단일 분기 테스트) — 확인 필요. 등록 전에는 인보이스에 세금을 넣지 않습니다.'
  styleNote(note)
  ws.getRow(13).height = 30

  // Annual summary
  sectionRow(ws, 15, '연도별 요약 Annual summary', 8)
  ;['연도 Year', '총매출', '지출', '순이익', 'CPP 적립 (11.9% × 순이익)', 'CPP 추정 (기본공제 반영)', '주행 km', '비고'].forEach((h, i) => {
    const c = ws.getCell(16, i + 1)
    c.value = h
    styleHeader(c, i > 0)
  })
  const MDATE = R('mileage', 'date')
  const MKM = R('mileage', 'km')
  ;[2026, 2027].forEach((y, i) => {
    const r = 17 + i
    ws.getCell(r, 1).value = y
    ws.getCell(r, 1).font = font({ bold: true })
    const yr = (dateR) => `${dateR},">="&DATE($A${r},1,1),${dateR},"<="&DATE($A${r},12,31)`
    const set = (col, formula, fmt) => {
      const c = ws.getCell(r, col)
      c.value = f(formula)
      styleCalc(c, fmt)
    }
    set(2, `SUMIFS(${JPRICE},${yr(JDATE)})`, FMT.money0)
    set(3, `SUMIFS(${XAMT},${yr(XDATE)})`, FMT.money0)
    set(4, `$B${r}-$C${r}`, FMT.money0)
    set(5, `MAX(0,$D${r})*${S('cpp_rate')}`, FMT.money0)
    set(6, `MAX(0,$D${r}-${S('cpp_exempt')})*${S('cpp_rate')}`, FMT.money0)
    set(7, `SUMIFS(${MKM},${yr(MDATE)})`, FMT.num1)
    ws.getCell(r, 8).value = i === 0 ? '적립은 보수적인 E열 권장 (memo 5.4는 기본공제를 무시)' : ''
    ws.getCell(r, 8).font = font({ size: 9, color: { argb: COLOR.grey } })
  })

  // Rules and deadlines
  sectionRow(ws, 20, '마감·규칙 Deadlines & rules (memo §6)', 8)
  const rules = [
    ['소득세: T1 + T2125. 2026년분은 2027-06-15까지 신고, 2027-04-30까지 납부 (memo §6).', U.ita],
    ['분납(instalments): 올해 또는 지난 2년 각각의 순 세금이 $3,000 이하면 필요 없음 (ITA s.156.1(1),(2)(b), F10). 본인 해당 여부는 추정 — 확인 필요.', U.ita],
    ['CPP: 자영업 9.9% + 2.0% = 11.9%, 기본공제 $3,500 초과분 (F9). 적립은 순이익 전체의 11.9%로 보수적으로.', U.cpp],
    [`GST/HST: ${TAX_BASIS}. 자발적 등록은 1년간 취소 불가 (ETA s.242(2), F8) → B2C는 기준 전까지 미등록 유지 (memo §6).`, U.eta],
    ['플랫폼(TaskRabbit·Jiffy) 수입이 본인 과세매출인지 확인 안 됨 (memo 5.5) — 설정 시트 스위치로 조정.', U.memo],
    ['소득세율·소득세 적립액은 연구 범위 밖이라 이 시트에 없습니다. 회계사 또는 CRA에 확인.', ''],
  ]
  rules.forEach(([t, url], i) => {
    const r = 21 + i
    ws.mergeCells(r, 1, r, 7)
    ws.getCell(r, 1).value = t
    ws.getCell(r, 1).font = font({ size: 9 })
    ws.getCell(r, 1).alignment = { wrapText: true, vertical: 'top' }
    if (url) {
      ws.getCell(r, 8).value = url.startsWith('http') ? { text: url, hyperlink: url } : url
      ws.getCell(r, 8).font = font({ size: 9, color: { argb: 'FF0563C1' }, underline: url.startsWith('http') })
    }
    ws.getRow(r).height = 26
  })

  // T2125 categories
  sectionRow(ws, TAX_CAT_HEAD - 1, 'T2125 지출 분류 — 확인 필요: 연구 자료에 없는 목록입니다. 최신 CRA T2125 양식에서 줄 번호·이름을 확인하세요', 8)
  ;['분류 Category (지출 시트 목록)', '한국어', '예시·주의 (확인 필요)', '합계 (전체 기간)'].forEach((h, i) => {
    const c = ws.getCell(TAX_CAT_HEAD, i + 1)
    c.value = h
    styleHeader(c, i === 3)
  })
  T2125.forEach(([name, ko, ex], i) => {
    const r = TAX_CAT_FIRST + i
    ws.getCell(r, 1).value = name
    ws.getCell(r, 1).font = font()
    ws.getCell(r, 2).value = ko
    ws.getCell(r, 2).font = font()
    ws.getCell(r, 3).value = ex
    ws.getCell(r, 3).font = font({ size: 9, color: { argb: COLOR.grey } })
    const c = ws.getCell(r, 4)
    c.value = f(`SUMIFS(${XAMT},${R('expenses', 'cat')},$A${r})`)
    styleCalc(c, FMT.money0)
  })
}

// ----- Break-even -----

function buildBreakEven(ws) {
  ws.properties.tabColor = { argb: 'FFC55A11' }
  ;[40, 16, 16, 16, 60].forEach((w, i) => (ws.getColumn(i + 1).width = w))
  titleRow(
    ws,
    '손익분기 Break-even (memo 5.3) — 추정, 첫 시즌 기준',
    5,
    '기본·보수 열은 memo 5.3 가정입니다. 실제 열은 설정 시트의 실제 견적과 견적 시트에서 성사(WON)된 가격 평균을 씁니다 (없으면 기본값). 제설기는 다음 시즌에도 쓸 수 있습니다.',
  )
  ws.views = [{ state: 'frozen', ySplit: 2 }]
  const QSVC = R('quotes', 'service')
  const QSTAT = R('quotes', 'status')
  const QPRICE = R('quotes', 'price')
  const QSCHED = R('quotes', 'sched')
  const QWON = R('quotes', 'won')
  const head = (r) =>
    ['항목', '기본 Base', '보수 Conservative', '실제 Actual', '근거'].forEach((h, i) => {
      const c = ws.getCell(r, i + 1)
      c.value = h
      styleHeader(c, i > 0 && i < 4)
    })
  const row = (r, label, fb, fc, fd, fmt, note, bold = false) => {
    ws.getCell(r, 1).value = label
    ws.getCell(r, 1).font = font({ bold })
    ;[fb, fc, fd].forEach((fx, k) => {
      const c = ws.getCell(r, 2 + k)
      c.value = fx === null ? null : f(fx)
      styleCalc(c, fmt, bold)
    })
    ws.getCell(r, 5).value = note ?? ''
    ws.getCell(r, 5).font = font({ size: 9, color: { argb: COLOR.grey } })
    ws.getCell(r, 5).alignment = { wrapText: true, vertical: 'top' }
  }
  const one = (r, label, formula, fmt, note, bold = false) => {
    ws.getCell(r, 1).value = label
    ws.getCell(r, 1).font = font({ bold })
    const c = ws.getCell(r, 2)
    c.value = f(formula)
    styleCalc(c, fmt, bold)
    ws.mergeCells(r, 3, r, 5)
    ws.getCell(r, 3).value = note ?? ''
    ws.getCell(r, 3).font = font({ size: 9, color: { argb: COLOR.grey } })
  }

  sectionRow(ws, 4, 'A. 홈통 청소 Gutters — 관문 G1 통과 후에만. 날짜 잡힌 예약 5건 전에는 사다리 사지 않기', 5)
  head(5)
  row(6, '설비비 Setup', S('gut_setup'), S('gut_setup'), S('gut_setup'), FMT.money0, '가정 A5 (보험 제외)')
  row(7, '사다리·높이 보험 Ladder cover', S('gut_ins'), S('gut_ins'), `IF(${S('gut_ins_actual')}<>"",${S('gut_ins_actual')},${S('gut_ins')})`, FMT.money0, 'F27 하한 (SNIPPET). 실제 견적이 있으면 실제 열에 반영')
  row(8, '고정비 합계 Fixed', '$B$6+$B$7', '$C$6+$C$7', '$D$6+$D$7', FMT.money0)
  row(9, '작업당 가격 Ticket', S('gut_ticket_base'), S('gut_ticket_cons'), `IFERROR(AVERAGEIFS(${QPRICE},${QSVC},"GUT",${QSTAT},"WON"),${S('gut_ticket_base')})`, FMT.money0, '실제 = 성사된 홈통 견적 평균')
  row(10, '작업당 변동비 Variable', S('dc_gutter'), S('dc_gutter'), S('dc_gutter'), FMT.money0, '가정 A6')
  row(11, '작업당 기여이익 Contribution', '$B$9-$B$10', '$C$9-$C$10', '$D$9-$D$10', FMT.money0, 'memo: 기본 $205, 보수 $155')
  row(12, '손익분기 작업 수 Break-even jobs', 'ROUNDUP(IFERROR($B$8/$B$11,0),0)', 'ROUNDUP(IFERROR($C$8/$C$11,0),0)', 'ROUNDUP(IFERROR($D$8/$D$11,0),0)', FMT.int, 'memo: 기본 10건, 보수 13건', true)
  one(14, '성사된 홈통 작업 Signed (WON)', `COUNTIFS(${QSVC},"GUT",${QSTAT},"WON")`, FMT.int, '견적 시트')
  one(15, '날짜 잡힌 예약 Booked with dates', `COUNTIFS(${QSVC},"GUT",${QSTAT},"WON",${QSCHED},"<>")`, FMT.int, '관문 G1 조건 5의 기준')
  one(16, '완료된 홈통 작업 Completed', `COUNTIFS(${R('jobs', 'service')},"GUT")`, FMT.int, '작업 시트')
  one(17, '손익분기까지 남은 수 Remaining', 'MAX(0,$D$12-$B$14)', FMT.int, '실제 열 기준', true)
  one(18, '사다리 구매 규칙 Ladder rule', `IF($B$15>=${S('g1_min_booked')},"구매 가능 — 날짜 잡힌 예약 "&$B$15&"건","사다리 구매 금지 — 예약 "&$B$15&"/"&${S('g1_min_booked')})`, null, 'memo §2 관문 G1 조건 5', true)
  one(19, '관문 G1 상태', S('g1'), null, '설정 시트')

  sectionRow(ws, 21, 'B. 제설 Snow — 관문 S(서면 보험) 후에만. 12/1 전 결제 없음. 11/20까지 전체 제설 계약(모든 지역 합산)이 최소 건수(손익분기)에 이르지 않으면 모든 계약 무효', 5)
  head(22)
  row(23, '제설 보험 Snow cover', S('snow_cover_base'), S('snow_cover_cons'), `IF(${S('snow_cover_actual')}<>"",${S('snow_cover_actual')},${S('snow_cover_base')})`, FMT.money0, 'F29 (SNIPPET)')
  row(24, '제설기 Snowblower', S('blower_base'), S('blower_cons'), `IF(${S('blower_actual')}<>"",${S('blower_actual')},${S('blower_base')})`, FMT.money0, 'F30. 삽만 쓰면 0')
  row(25, '시즌 가격 Season price', S('snow_price_base'), S('snow_price_cons'), `IFERROR(AVERAGEIFS(${QPRICE},${QSVC},"SNOW",${QSTAT},"WON"),${S('snow_price_base')})`, FMT.money0, '실제 = 성사된 제설 계약(SNOW) 시즌 총액 평균')
  row(26, '직접비율 Direct cost %', S('dc_snow'), S('dc_snow'), S('dc_snow'), FMT.pct, '가정 A4')
  row(27, '계약당 기여이익 Contribution', '$B$25*(1-$B$26)', '$C$25*(1-$C$26)', '$D$25*(1-$D$26)', FMT.money0, 'memo: 기본 $425, 보수 $340')
  row(28, '손익분기 — 제설기 With blower', 'ROUNDUP(IFERROR(($B$23+$B$24)/$B$27,0),0)', 'ROUNDUP(IFERROR(($C$23+$C$24)/$C$27,0),0)', 'ROUNDUP(IFERROR(($D$23+$D$24)/$D$27,0),0)', FMT.int, 'memo: 기본 6, 보수 12', true)
  row(29, '손익분기 — 삽만 Shovel only', 'ROUNDUP(IFERROR($B$23/$B$27,0),0)', 'ROUNDUP(IFERROR($C$23/$C$27,0),0)', 'ROUNDUP(IFERROR($D$23/$D$27,0),0)', FMT.int, 'memo: 기본 3, 보수 6', true)
  one(31, '제설 방식 Method', S('snow_method'), null, '설정 시트')
  one(32, '적용 손익분기 (실제) Break-even used', 'IF($B$31="SHOVEL",$D$29,$D$28)', FMT.int, '실제 열 + 제설 방식', true)
  one(33, '서명한 제설 계약 Signed (WON)', `COUNTIFS(${QSVC},"SNOW",${QSTAT},"WON")`, FMT.int, '견적 시트 (서비스 SNOW)')
  one(34, '11/20까지 서명 Signed by deadline', `COUNTIFS(${QSVC},"SNOW",${QSTAT},"WON",${QWON},"<="&${S('snow_deadline')})`, FMT.int, '계약일 기준')
  one(35, '남은 수 Remaining', 'MAX(0,$B$32-$B$34)', FMT.int)
  one(
    36,
    '상태 Status',
    `IF($B$33=0,"아직 계약 없음",IF($B$34>=$B$32,"손익분기 달성 — 계약 유효",IF(${ASOF}<=${S('snow_deadline')},"진행 중 — "&$B$35&"건 더 필요 (11/20까지)","무효 VOID — 모든 계약 무효, 보험·제설기 사지 않기")))`,
    null,
    'memo §2, §8',
    true,
  )
  one(37, '삽 제설 한도 Shovel cap', `IF(AND($B$31="SHOVEL",$B$33>${S('shovel_cap')}),"한도 초과 — 삽 제설은 "&${S('shovel_cap')}&"곳까지 (가정)","OK")`, null, 'memo §9 (가정)')
  one(38, '서명한 시즌 총액 Signed season value', `SUMIFS(${QPRICE},${QSVC},"SNOW",${QSTAT},"WON")`, FMT.money0, '받은 돈 ≠ 번 돈: 서비스를 한 만큼만 번 것 (memo 5.3)')
  one(39, '월 분할 입금 예정 Per instalment (12/1–3/1)', `IFERROR($B$38/${S('snow_instalments')},0)`, FMT.money0, '시즌 총액 ÷ 4: 12/1, 1/1, 2/1, 3/1')
  ws.addConditionalFormatting({
    ref: 'B36',
    rules: [
      { type: 'expression', formulae: ['NOT(ISERROR(SEARCH("VOID",B36)))'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFFC7CE' } }, font: { color: { argb: 'FF9C0006' }, bold: true } } },
      { type: 'expression', formulae: ['NOT(ISERROR(SEARCH("달성",B36)))'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFC6EFCE' } }, font: { color: { argb: 'FF006100' }, bold: true } } },
    ],
  })
  if (BE.signedByDeadline !== '$B$34' || BE.beApplied !== '$B$32') throw new Error('Break-even refs moved')
}

// ----- Invoice -----

function buildInvoice(ws) {
  ws.properties.tabColor = { argb: 'FF00B050' }
  ;[30, 22, 14, 10, 20, 16, 2, 16].forEach((w, i) => (ws.getColumn(i + 1).width = w))
  const JID = R('jobs', 'id')
  const J = (col) => R('jobs', col)
  const hst = `${S('hst_reg')}="YES"`
  const put = (addr, value, opts = {}) => {
    const c = ws.getCell(addr)
    c.value = typeof value === 'string' && opts.formula !== false && opts.f ? f(value) : value
    c.font = font({ size: opts.size ?? 10, bold: !!opts.bold, color: opts.color ? { argb: opts.color } : undefined, italic: !!opts.italic })
    if (opts.fmt) c.numFmt = opts.fmt
    c.alignment = { vertical: 'middle', horizontal: opts.align, wrapText: !!opts.wrap }
    return c
  }
  const merge = (range) => ws.mergeCells(range)

  // hidden helpers (column H)
  const H = {
    idx: '$H$7', svc: '$H$8', door: '$H$9', quote: '$H$10', season: '$H$11', syear: '$H$12', snow: '$H$13',
  }
  put('H6', 'helper', { color: COLOR.grey })
  put('H7', `IFERROR(MATCH($B$6,${JID},0),0)`, { f: true })
  put('H8', `IF(${H.idx}=0,"",INDEX(${J('service')},${H.idx}))`, { f: true })
  put('H9', `IF(${H.idx}=0,"",INDEX(${J('door')},${H.idx}))`, { f: true })
  put('H10', `IF(${H.idx}=0,"",INDEX(${J('quote')},${H.idx}))`, { f: true })
  put('H11', `IF(${H.svc}<>"SNOW","",IFERROR(INDEX(${R('quotes', 'price')},MATCH(${H.quote},${R('quotes', 'id')},0)),INDEX(${J('price')},${H.idx})*${S('snow_instalments')}))`, { f: true })
  put('H12', `IF(ISNUMBER($B$7),IF(MONTH($B$7)>=7,YEAR($B$7),YEAR($B$7)-1),YEAR(${ASOF}))`, { f: true })
  put('H13', `${H.svc}="SNOW"`, { f: true })
  ws.getColumn(8).hidden = true

  // header
  merge('A1:D1')
  put('A1', S('brand_en'), { f: true, bold: true, size: 16, color: COLOR.head })
  merge('E1:F1')
  put('E1', `IF(AND(${H.idx}>0,$F$19>0,$F$20<=0),"영수증 RECEIPT","인보이스 INVOICE")`, { f: true, bold: true, size: 14, align: 'right', color: COLOR.head })
  merge('A2:F2')
  put('A2', S('brand_ko'), { f: true, size: 11 })
  merge('A3:F3')
  put('A3', `"주소 Address: "&${S('mailing')}`, { f: true })
  merge('A4:F4')
  put('A4', `"전화 Phone: "&${S('phone')}&"   ·   이메일 Email: "&${S('email')}&"   ·   웹 Web: "&${S('web')}`, { f: true })
  ws.getRow(1).height = 26

  // job + invoice info
  put('A6', '작업 ID Job ID (입력)', { bold: true })
  const id = ws.getCell('B6')
  styleInput(id)
  id.note = '작업 시트의 작업 ID를 입력하면 나머지가 자동으로 채워집니다.'
  put('C6', `IF($B$6="","← 작업 ID를 입력하세요",IF(${H.idx}=0,"작업 ID를 찾을 수 없음",""))`, { f: true, color: 'FFC00000', size: 9 })
  merge('C6:D6')
  put('E6', '인보이스 번호 Invoice #', { bold: true, align: 'right' })
  put('F6', `IF($B$6="","","INV-"&$B$6)`, { f: true, bold: true })
  put('A7', '발행일 Invoice date', { bold: true })
  const idate = ws.getCell('B7')
  idate.value = f('TODAY()')
  styleInput(idate, FMT.date)
  idate.note = '기본값은 오늘. 날짜를 입력하면 고정됩니다.'
  put('E7', '작업일 Service date', { bold: true, align: 'right' })
  put('F7', `IF(${H.idx}=0,"",INDEX(${J('date')},${H.idx}))`, { f: true, fmt: FMT.date })
  put('A8', '고객 Bill to', { bold: true })
  merge('B8:D8')
  put('B8', `IF(${H.idx}=0,"",INDEX(${J('name')},${H.idx}))`, { f: true })
  put('A9', '작업 주소 Service address', { bold: true })
  merge('B9:D9')
  put('B9', `IF(${H.idx}=0,"",INDEX(${J('address')},${H.idx}))`, { f: true })

  // lines
  merge('A11:C11')
  ;[
    ['A11', '내용 Description'],
    ['D11', '수량 Qty'],
    ['E11', '단가 Unit $'],
    ['F11', '금액 Amount $'],
  ].forEach(([a, t]) => {
    const c = ws.getCell(a)
    c.value = t
    styleHeader(c)
  })
  merge('A12:C12')
  put('A12', `IF(${H.idx}=0,"",IFERROR(VLOOKUP(${H.svc},${SVC},2,0)&" / "&VLOOKUP(${H.svc},${SVC},3,0),${H.svc}))`, { f: true })
  put('D12', `IF(${H.idx}=0,"",1)`, { f: true, align: 'center' })
  put('E12', `IF(${H.idx}=0,"",INDEX(${J('price')},${H.idx}))`, { f: true, fmt: FMT.money })
  put('F12', 'IF(OR($D$12="",$E$12=""),"",$D$12*$E$12)', { f: true, fmt: FMT.money })
  for (let r = 13; r <= 15; r++) {
    merge(`A${r}:C${r}`)
    styleInput(ws.getCell(`A${r}`))
    styleInput(ws.getCell(`D${r}`))
    styleInput(ws.getCell(`E${r}`), FMT.money)
    put(`F${r}`, `IF(OR($D$${r}="",$E$${r}=""),"",$D$${r}*$E$${r})`, { f: true, fmt: FMT.money })
  }
  ws.getCell('A13').note = '추가 항목 (예: 추가 욕실, 오븐 내부). 가격은 설정 시트 가격표와 같게.'
  for (let r = 12; r <= 15; r++) ['A', 'B', 'C', 'D', 'E', 'F'].forEach((col) => (ws.getCell(`${col}${r}`).border = BORDER))
  put('E16', '소계 Subtotal', { bold: true, align: 'right' })
  put('F16', 'SUM($F$12:$F$15)', { f: true, fmt: FMT.money, bold: true })
  merge('A17:D17')
  put('A17', `IF(${hst},"GST/HST 등록번호 Registration #: "&${S('hst_no')},"")`, { f: true, size: 9 })
  put('E17', `IF(${hst},${S('tax_label')},"")`, { f: true, align: 'right' })
  put('F17', `IF(${hst},ROUND($F$16*${S('tax_rate')},2),"")`, { f: true, fmt: FMT.money })
  put('E18', '합계 Total', { bold: true, align: 'right' })
  put('F18', `$F$16+IF(${hst},$F$17,0)`, { f: true, fmt: FMT.money, bold: true })
  put('E19', '입금 Paid', { align: 'right' })
  put('F19', `IF($B$6="",0,SUMIFS(${R('payments', 'amount')},${R('payments', 'job')},$B$6))`, { f: true, fmt: FMT.money })
  put('E20', '잔액 Balance due', { bold: true, align: 'right' })
  put('F20', '$F$18-$F$19', { f: true, fmt: FMT.money, bold: true })
  ;['F16', 'F18', 'F20'].forEach((a) => (ws.getCell(a).border = { top: thin, bottom: thin }))

  // payment instructions
  put('A22', '결제 방법 How to pay', { bold: true, color: COLOR.head })
  const longRow = (r, formula, opts = {}) => {
    merge(`A${r}:F${r}`)
    put(`A${r}`, formula, { f: true, wrap: true, size: opts.size ?? 9, bold: opts.bold, italic: opts.italic })
    ws.getRow(r).height = opts.height ?? 28
  }
  longRow(23, `"Interac e-Transfer: "&${S('etransfer')}&" — 메시지에 "&$F$6&" 번호를 적어 주세요. / Please put "&$F$6&" in the message."`)
  longRow(24, `"현금도 받습니다. / Cash is also accepted."&IF(${S('card_ok')}="YES"," 카드 결제 가능. / Card accepted.","")`, { height: 18 })
  longRow(25, `IF($F$18>${S('etr_limit')},${lit('금액이 $2,000를 넘으면 은행 한도 때문에 e-Transfer를 두 번 이상 나눠 보내셔야 할 수 있습니다. / Amounts over $2,000 may need to be sent as two or more e-Transfers because of bank limits.')},"")`)
  longRow(26, `IF(${hst},"",${lit('GST/HST 미등록 소규모 사업자로, 판매세를 부과하지 않았습니다. / Not registered for GST/HST (small supplier): no sales tax charged.')})`)

  // snow instalments
  longRow(28, `IF(${H.snow},"제설 시즌 계약 — 4회 분할 / Snow season contract — 4 instalments","")`, { size: 10, bold: true, height: 18 })
  put('A29', `IF(${H.snow},"시즌 요금(현장 확정) / Season price (confirmed on site)","")`, { f: true })
  put('F29', `IF(${H.snow},${H.season},"")`, { f: true, fmt: FMT.money, bold: true })
  const ord = ['1회차 / 1st', '2회차 / 2nd', '3회차 / 3rd', '4회차 / 4th']
  const dates = [`DATE(${H.syear},12,1)`, `DATE(${H.syear}+1,1,1)`, `DATE(${H.syear}+1,2,1)`, `DATE(${H.syear}+1,3,1)`]
  ord.forEach((label, i) => {
    const r = 30 + i
    put(`A${r}`, `IF(${H.snow},"${label}","")`, { f: true })
    put(`B${r}`, `IF(${H.snow},${dates[i]},"")`, { f: true, fmt: FMT.date })
    put(`F${r}`, `IF(${H.snow},ROUND(IFERROR(${H.season}/${S('snow_instalments')},0),2),"")`, { f: true, fmt: FMT.money })
  })
  longRow(34, `IF(${H.snow},"12월 1일 전에는 어떤 금액도 받지 않습니다. / No payment is taken before Dec 1.","")`, { height: 18 })
  longRow(35, `IF(${H.snow},${lit('11월 20일까지 전체 제설 계약(모든 지역 합산)이 최소 건수에 이르지 않으면 계약은 무효이고 내실 돈은 없습니다. / If the minimum number of snow contracts, all areas combined, is not signed by Nov 20, the contract is void and nothing is owed.')},"")`)
  longRow(
    36,
    `IF(${H.snow},${lit('시즌: 12월 1일–3월 31일. 11월 눈: 계약서에서 11월 옵션을 선택하신 경우에만, 계약 확정일부터 11월 30일까지 출동 기준 적설량 이상 내린 눈에 방문당 $')}&${S('snow_per_visit')}&${lit('를 적용하며, 12월 1일 첫 분할금과 함께 청구합니다. / Season: Dec 1 – Mar 31. November snow: only if you ticked this option in the contract, $')}&${S('snow_per_visit')}&${lit(' per visit for snowfall at or above the trigger depth between contract confirmation and Nov 30, billed with the Dec 1 first instalment.')},"")`,
    { height: 52 },
  )

  // Door-signed cancellation notice: Ontario wording only for Ontario builds (F32); elsewhere a
  // placeholder the owner must replace, because other provinces were not researched.
  const doorNotice = ONTARIO
    ? '온타리오 방문 계약: 집에서 서명하셨다면 계약서 사본을 받으신 다음 날부터 10일 안에 취소하실 수 있고, 취소 통지를 받은 다음 날부터 15일 안에 환불해 드립니다. / Ontario: if you signed this agreement at your home, you can cancel within 10 days after receiving a copy of the signed agreement, and we refund you within 15 days after receiving your cancellation notice. (ontario.ca — 법률 자문 아님 / not legal advice)'
    : `[${NOT_VERIFIED_PROV}] 방문 계약 취소권 안내: 이 주의 규칙은 조사하지 않았습니다. 보내기 전에 이 줄을 확인된 문구로 바꾸세요. / Door-to-door cancellation rules for this province were not researched. Replace this line before sending.`
  longRow(38, `IF(${H.door}="Y",${lit(doorNotice)},"")`, { height: 48 })
  longRow(40, '"감사합니다! / Thank you!"', { size: 10, bold: true, height: 18 })
  longRow(41, `${S('brand_en')}&" · "&${S('brand_ko')}&" · "&${S('mailing')}&" · "&${S('phone')}&" · "&${S('email')}`, { italic: true, height: 18 })

  ws.pageSetup = {
    paperSize: 1,
    orientation: 'portrait',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
    printArea: 'A1:F41',
    margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
  }
  ws.views = [{ state: 'normal', activeCell: 'B6', showGridLines: false }]
}

// ---------------------------------------------------------------------------
// Safety checks, CSV templates, write
// ---------------------------------------------------------------------------

async function existingWorkbookHasData() {
  if (!fs.existsSync(XLSX_PATH)) return false
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(XLSX_PATH)
  for (const spec of Object.values(SPECS)) {
    const ws = wb.getWorksheet(spec.sheet)
    if (!ws) continue
    const inputCols = spec.cols.map((c, i) => (c.f ? null : i + 1)).filter(Boolean)
    let found = false
    ws.eachRow((row, n) => {
      if (found || n < FIRST) return
      for (const c of inputCols) {
        const v = row.getCell(c).value
        if (v !== null && v !== undefined && v !== '' && !(typeof v === 'object' && 'formula' in v)) {
          found = true
          return
        }
      }
    })
    if (found) return spec.sheet
  }
  const ei = wb.getWorksheet(SH.ei)
  if (ei) {
    for (let r = 4; r <= 40; r++) for (const c of [13, 14, 15]) if (ei.getCell(r, c).value) return SH.ei
  }
  return false
}

const csvCell = (v) => {
  if (v === null || v === undefined) return ''
  const s = v instanceof Date ? iso(v) : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function writeCsv(name, header, rows) {
  const file = path.join(CSV_DIR, name)
  if (fs.existsSync(file) && !FORCE) {
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).slice(1).filter((l) => l.trim())
    if (lines.some((l) => !l.includes('EXAMPLE'))) {
      console.warn(`! Skipped ${path.relative(ROOT, file)}: it holds real rows (use --force to overwrite).`)
      return
    }
  }
  const text = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n') + '\n'
  fs.writeFileSync(file, text)
  console.log(`  wrote ${path.relative(ROOT, file)}`)
}

function writeCsvTemplates() {
  fs.mkdirSync(CSV_DIR, { recursive: true })
  for (const spec of Object.values(SPECS)) {
    if (!spec.csv) continue
    const inputs = spec.cols.filter((c) => !c.f)
    writeCsv(
      spec.csv,
      inputs.map((c) => c.csv),
      [0, 1].map((k) => inputs.map((c) => c.ex?.[k] ?? '')),
    )
  }
  // EI weekly declaration log: example numbers computed with the Settings defaults (B = 729, cap = 90% × 1,325)
  const B = 729
  const cap = 0.9 * 1325
  const eiRow = (start, gross, exp, declared, declaredOn) => {
    const net = gross - exp
    const deduction = net <= 0 ? 0 : 0.5 * Math.min(net, cap) + Math.max(0, net - cap)
    const end = new Date(start.getTime() + 6 * 86400000)
    return [start, end, gross, exp, net, 'A', deduction, Math.max(0, B - deduction), declared, declaredOn, 'EXAMPLE - fake row - delete (estimate only)']
  }
  writeCsv(
    'ei-weekly.csv',
    ['week_start', 'week_end', 'gross', 'operating_expenses', 'net', 'path', 'ei_deduction_est', 'ei_paid_est', 'declared', 'declared_on', 'notes'],
    // Examples start after the waiting week (benefit period from Sun 10/4, F2): waiting-week earnings follow
    // EI Act s.19(1) (deducted from the first 3 payable weeks), not the 50% rule used below.
    [eiRow(utc(2026, 10, 11), tier(2).deep, 40, 'Y', utc(2026, 10, 18)), eiRow(utc(2026, 10, 18), tier(2).deep + tier(1).standard, 60, 'N', '')],
  )
}

async function main() {
  const dataSheet = await existingWorkbookHasData()
  if (dataSheet && !FORCE) {
    console.error(
      `crm.xlsx already has data on "${dataSheet}". Not overwriting.\n` +
        'Keep working in your own copy, or run again with --force to replace it with an empty template.',
    )
    process.exit(1)
  }
  fs.mkdirSync(OUT_DIR, { recursive: true })

  const wb = new ExcelJS.Workbook()
  wb.creator = 'scripts/build-crm.mjs'
  wb.created = new Date()
  wb.calcProperties.fullCalcOnLoad = true

  const sheets = {}
  for (const key of ['settings', 'doors', 'quotes', 'jobs', 'payments', 'followups', 'dash', 'ei', 'tax', 'be', 'invoice', 'expenses', 'mileage']) {
    sheets[key] = wb.addWorksheet(SH[key])
  }
  buildSettings(sheets.settings)
  for (const k of ['doors', 'quotes', 'jobs', 'payments', 'followups', 'expenses', 'mileage']) buildDataSheet(sheets[k], SPECS[k])
  buildDoorsLegend(sheets.doors)
  buildDashboard(sheets.dash)
  buildEI(sheets.ei)
  buildTax(sheets.tax)
  buildBreakEven(sheets.be)
  buildInvoice(sheets.invoice)
  wb.views = [{ activeTab: 0, firstSheet: 0, visibility: 'visible' }]

  await wb.xlsx.writeFile(XLSX_PATH)
  console.log(`  wrote ${path.relative(ROOT, XLSX_PATH)} (${wb.worksheets.length} sheets, city ${CITY})`)
  writeCsvTemplates()
  const placeholders = ['mailing', 'phone', 'email', 'web'].filter((k) => /^\{.*\}$/.test(BIZ[k]))
  if (placeholders.length) console.log(`  note: ${placeholders.join(', ')} still show {PLACEHOLDER} — fill them in the Settings sheet.`)
}

await main()
