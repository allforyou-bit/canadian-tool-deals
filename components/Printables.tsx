import QRCode from 'qrcode'
import { business, priceBook } from '@/config/business'
import { money, prefix, type Lang } from '@/lib/i18n'
import { CLEANING_TYPE_LABEL, DRIVEWAY_LABEL } from '@/lib/quote'
import { absolute, contactLinks, setupMissing, type Cluster } from '@/lib/site'

// Print-ready sheets rendered at physical size. Open the page, then Print → "Letter", scale 100%,
// margins "Default". Each door-hanger and flyer sheet fits inside the 7.7 × 10.2 in box that
// app/globals.css (@page letter, margin 0.4in) leaves, so it prints on one page. `npm run pdf` saves them as PDFs.
// The PDFs in business/print/ are SAMPLES with a watermark until the owner's settings are filled in;
// real prints come from /print/ (or /ko/print/) on the deployed site.

async function qrSvg(url: string): Promise<string> {
  return QRCode.toString(url, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#111111', light: '#ffffff' } })
}

function quoteUrl(lang: Lang, cluster: Cluster) {
  return absolute(`${prefix(lang)}/quote/?src=${cluster}`)
}

const cheapest = (xs: number[]) => Math.min(...xs)

/** Printed across every sheet while contact details / site URL are missing, so a sample with a dead QR code never gets printed by mistake. */
function SampleMark() {
  if (setupMissing().length === 0) return null
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center overflow-hidden">
      <p className="rotate-[-35deg] whitespace-nowrap text-[64px] font-black tracking-widest text-red-600/25">SAMPLE · 샘플 · 설정 입력 전</p>
    </div>
  )
}

/**
 * "from" prices shown on printed material — always derived from the live price book.
 * At most 3 offers (memo section 10 item 6), using the slot table in
 * business/marketing/05-door-hanger-and-flyer-text.md section 2: cleaning lines merge when
 * gutters or snow take a slot.
 */
export function offerLines(lang: Lang): string[] {
  const c = priceBook.cleaning
  const from = lang === 'ko' ? (x: string) => `${x}부터` : (x: string) => `from ${x}`
  const price = (t: 'standard' | 'deep' | 'moveOut') => from(money(cheapest(c.tiers.map((x) => x[t]))))
  const own = (t: 'standard' | 'deep' | 'moveOut') => `${CLEANING_TYPE_LABEL[t][lang]} — ${price(t)}`
  const short = (t: 'standard' | 'deep' | 'moveOut') => `${CLEANING_TYPE_LABEL[t][lang]} ${price(t)}`
  const extras: string[] = []
  if (business.services.gutters && priceBook.gutters) {
    const g = cheapest(Object.values(priceBook.gutters.byStoreys))
    extras.push(lang === 'ko' ? `홈통 청소 — ${from(money(g))}` : `Gutter cleaning — ${from(money(g))}`)
  }
  if (business.services.snow && priceBook.snow) {
    const s = priceBook.snow
    const p = s.driveway.single
    extras.push(
      s.mode === 'season'
        ? lang === 'ko'
          ? `겨울 제설 시즌 계약 — ${from(money(p))} (${s.instalments}회 분할, 12월 1일 전 결제 없음)`
          : `Winter snow season — ${from(money(p))} (${s.instalments} payments, nothing before Dec 1)`
        : lang === 'ko'
          ? `겨울 제설 — 월 ${from(money(p))}`
          : `Winter snow clearing — ${from(`${money(p)}/month`)}`,
    )
  }
  const cleaning =
    extras.length === 0
      ? [own('deep'), own('moveOut'), own('standard')]
      : extras.length === 1
        ? [`${short('standard')} · ${short('deep')}`, own('moveOut')]
        : [`${short('standard')} · ${short('deep')} · ${short('moveOut')}`]
  return [...cleaning, ...extras]
}

const TEXT = {
  en: {
    headline: 'Home cleaning, priced upfront',
    sub: 'Local, owner-operated. Instant estimate online.',
    missed: 'Sorry we missed you!',
    scan: 'Scan for your instant estimate',
    or: 'or call / text',
    fine: 'Estimates are confirmed when we see your home. No obligation.',
    web: 'Online',
    steps: ['Scan the code or call for a price range', 'We confirm the price from photos or on site, and book a time', 'Pay by e-Transfer or cash when the job is done'],
    visited: 'We stopped by on ______ at ______',
    language: '한국어 상담 가능 · Korean-speaking owner',
    ontario:
      'Ontario: if you sign an agreement with us at your home, you may cancel within 10 days after you receive a copy of the signed agreement. We refund within 15 days after we receive your cancellation notice.',
    snowFine: (perVisit: string) =>
      `Snow: season Dec 1 – Mar 31. Void, with nothing owed, if we have not signed our minimum number of snow contracts (all areas combined) by Nov 20. Snow is never pushed onto the road. November snow (only if ticked in your contract; from confirmation to Nov 30): ${perVisit} per visit, billed with the Dec 1 instalment.`,
    guttersFine: 'Gutters: no windows, no pressure washing.',
  },
  ko: {
    headline: '청소 가격, 먼저 알려드립니다',
    sub: '가까운 동네 업체로, 대표가 직접 운영합니다. 온라인에서 바로 예상 가격을 확인하실 수 있습니다.',
    missed: '방문했지만 안 계셔서 남기고 갑니다!',
    scan: 'QR을 찍으면 바로 견적',
    or: '또는 전화·문자',
    fine: '최종 금액은 집을 확인한 뒤 확정합니다. 문의는 부담 없이 하세요.',
    web: '웹사이트',
    steps: ['QR 또는 전화로 예상 가격 확인', '사진이나 현장 확인 후 가격 확정·방문 예약', '작업이 끝나면 e-Transfer 또는 현금 결제'],
    visited: '______월 ______일 ______시에 방문했습니다',
    language: '한국어로 편하게 상담하세요',
    ontario:
      '온타리오주: 댁에서 저희와 계약서에 서명하신 경우, 계약서 사본을 받으신 후 10일 이내에 취소하실 수 있고, 취소 통지를 받은 후 15일 이내에 환불해 드립니다.',
    snowFine: (perVisit: string) =>
      `제설: 시즌은 12월 1일 – 3월 31일입니다. 11월 20일까지 전체 제설 계약(모든 지역 합산)이 최소 건수에 이르지 않으면 계약은 무효이고 내실 돈은 없습니다. 눈은 도로로 밀어내지 않습니다. 11월 눈(계약서에서 선택한 경우에만, 계약 확정 후 11월 30일까지): 1회 ${perVisit}, 12월 1일 첫 분할금과 함께 청구.`,
    guttersFine: '홈통: 창문 청소와 고압 세척은 하지 않습니다.',
  },
}

function Steps({ lang, size = 'sm' }: { lang: Lang; size?: 'sm' | 'md' }) {
  return (
    <ol className={`w-full space-y-1 ${size === 'md' ? 'text-[13px]' : 'text-[11.5px]'}`}>
      {TEXT[lang].steps.map((s, i) => (
        <li key={s} className="flex gap-2">
          <span className="flex h-[1.35em] w-[1.35em] shrink-0 items-center justify-center rounded-full bg-[#0f766e] text-[0.8em] font-bold text-white">{i + 1}</span>
          <span>{s}</span>
        </li>
      ))}
    </ol>
  )
}

function Contact({ lang }: { lang: Lang }) {
  const c = contactLinks()
  return (
    <div className="text-center">
      <p className="text-xs uppercase tracking-wide text-gray-600">{TEXT[lang].or}</p>
      <p className="text-2xl font-extrabold tracking-tight">{c.phoneDisplay || '(___) ___-____'}</p>
      <p className="text-xs text-gray-600">
        {TEXT[lang].web}: {business.siteUrl.replace(/^https?:\/\//, '')}
      </p>
    </div>
  )
}

/**
 * Fine print for door hangers and flyers (business/marketing/05-door-hanger-and-flyer-text.md, 3.6).
 * - Ontario: cancel a home-signed agreement within 10 days after receiving a copy of the signed
 *   agreement, refund within 15 days after the cancellation notice (memo F32,
 *   https://www.ontario.ca/page/your-rights-when-signing-or-cancelling-contract, snippet). Not legal advice.
 * - Snow: season Dec 1 – Mar 31, void unless the Nov 20 minimum (all snow contracts, all areas
 *   combined) is signed, never onto the road, November visits only if ticked in the contract, from
 *   confirmation to Nov 30, billed with the Dec 1 instalment (memo sections 0 and 3; content/agreements.ts).
 * - Gutters: gutters only, no windows or pressure washing (memo section 2 Track B).
 */
function fineLines(lang: Lang): string[] {
  const T = TEXT[lang]
  const lines = [business.serviceArea[lang] ? `${T.fine} · ${business.serviceArea[lang]}` : T.fine]
  if (business.tax.province === 'ON') lines.push(T.ontario)
  if (business.services.snow && priceBook.snow) lines.push(T.snowFine(money(priceBook.snow.perVisit)))
  if (business.services.gutters && priceBook.gutters) lines.push(T.guttersFine)
  return lines
}

function FinePrint({ lang, className }: { lang: Lang; className: string }) {
  return (
    <div className={className}>
      {fineLines(lang).map((l) => (
        <p key={l}>{l}</p>
      ))}
    </div>
  )
}

export async function DoorHangerSheet({ lang, cluster }: { lang: Lang; cluster: Cluster }) {
  const svg = await qrSvg(quoteUrl(lang, cluster))
  const T = TEXT[lang]
  const hanger = (
    <div className="relative flex h-[10.1in] w-[3.7in] flex-col items-center border border-dashed border-gray-300 px-4 pb-3 pt-3">
      {/* hole + slit guide */}
      <div className="flex h-[1.75in] w-full flex-col items-center">
        <div className="h-[1.3in] w-[1.3in] rounded-full border-2 border-dashed border-gray-400" />
        <div className="h-[0.45in] border-l-2 border-dashed border-gray-400" />
      </div>
      <p className="text-center text-sm font-semibold text-gray-700">{T.missed}</p>
      <p className="mt-1 text-center text-lg font-extrabold text-[#115e59]">{business.brand[lang]}</p>
      <h2 className="mt-1 text-center text-[22px] font-extrabold leading-tight">{T.headline}</h2>
      <p className="mt-1 text-center text-xs text-gray-700">{T.sub}</p>
      <ul className="mt-2 w-full space-y-1 text-[13px] font-semibold">
        {offerLines(lang).map((l) => (
          <li key={l} className="rounded bg-[#e6f4f1] px-2 py-1">
            {l}
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-col items-center">
        <div className="h-[1.15in] w-[1.15in]" dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="mt-1 text-xs font-semibold">{T.scan}</p>
      </div>
      <div className="mt-2">
        <Contact lang={lang} />
      </div>
      <p className="mt-2 rounded-full border border-[#0f766e] px-3 py-0.5 text-center text-[11px] font-semibold text-[#115e59]">{T.language}</p>
      <div className="mt-2 w-full">
        <Steps lang={lang} />
      </div>
      <p className="mt-3 w-full text-center text-[11px] text-gray-700">{T.visited}</p>
      <FinePrint lang={lang} className="mt-auto w-full space-y-0.5 pt-1.5 text-center text-[9px] leading-snug text-gray-600" />
    </div>
  )
  // 2 × 3.7in + 0.2in gap = 7.6in wide, 10.1in tall: inside the 7.7 × 10.2in printable box.
  // On screen the 0.4in padding stands in for the @page margin.
  return (
    <div className="sheet relative flex items-start justify-center gap-[0.2in] p-[0.4in] print:p-0" lang={lang}>
      <SampleMark />
      {hanger}
      {hanger}
    </div>
  )
}

export async function FlyerSheet({ lang, cluster }: { lang: Lang; cluster: Cluster }) {
  const svg = await qrSvg(quoteUrl(lang, cluster))
  const T = TEXT[lang]
  const flyer = (
    <div className="flex h-[4.9in] w-[7.5in] flex-col border border-dashed border-gray-300 p-5">
      <div className="flex min-h-0 flex-1 gap-5">
        <div className="flex flex-1 flex-col">
          <p className="text-lg font-extrabold text-[#115e59]">{business.brand[lang]}</p>
          <h2 className="mt-1 text-2xl font-extrabold leading-tight">{T.headline}</h2>
          <p className="mt-1 text-sm text-gray-700">{T.sub}</p>
          <ul className="mt-3 space-y-1 text-[14px] font-semibold">
            {offerLines(lang).map((l) => (
              <li key={l} className="rounded bg-[#e6f4f1] px-2 py-1">
                {l}
              </li>
            ))}
          </ul>
          <div className="mt-3">
            <Steps lang={lang} />
          </div>
        </div>
        <div className="flex w-[2.3in] flex-col items-center justify-center">
          <div className="h-[1.6in] w-[1.6in]" dangerouslySetInnerHTML={{ __html: svg }} />
          <p className="mt-2 text-center text-sm font-semibold">{T.scan}</p>
          <div className="mt-2">
            <Contact lang={lang} />
          </div>
          <p className="mt-2 text-center text-[12px] font-semibold text-[#115e59]">{T.language}</p>
        </div>
      </div>
      <FinePrint lang={lang} className="mt-2 space-y-0.5 text-[9px] leading-snug text-gray-600" />
    </div>
  )
  // 7.5in wide; 2 × 4.9in + 0.2in gap = 10in tall: inside the 7.7 × 10.2in printable box.
  // On screen the 0.4in padding stands in for the @page margin.
  return (
    <div className="sheet relative flex flex-col items-center gap-[0.2in] p-[0.4in] print:p-0" lang={lang}>
      <SampleMark />
      {flyer}
      {flyer}
    </div>
  )
}

// Snow billing dates (memo section 0 item 2 and section 6); the count comes from priceBook.snow.instalments.
const SNOW_BILL_DATES = { en: ['Dec 1', 'Jan 1', 'Feb 1', 'Mar 1'], ko: ['12월 1일', '1월 1일', '2월 1일', '3월 1일'] }

function snowBillingLine(lang: Lang, n: number): string {
  const d = SNOW_BILL_DATES[lang]
  const listed = n >= 1 && n <= d.length
  if (lang === 'ko') {
    return `${listed ? `현장에서 확정한 시즌 요금을 ${n}회로 나눠 ${d.slice(0, n).join('·')}에 청구합니다` : `현장에서 확정한 시즌 요금을 12월 1일부터 매달 ${n}회로 나눠 청구합니다`}. 12월 1일 전에는 결제하지 않습니다. 11월 방문은 계약서에서 선택한 경우에만 하며 12월 1일 첫 분할금과 함께 청구합니다. 11월 20일까지 전체 제설 계약(모든 지역 합산)이 최소 건수에 이르지 않으면 계약은 무효이고 내실 돈은 없습니다.`
  }
  return `${listed ? `Billed in ${n} instalments (season price confirmed on site ÷ ${n}): ${d.slice(0, n).join(', ')}` : `Billed in ${n} monthly instalments starting Dec 1 (season price confirmed on site ÷ ${n})`}. Nothing is charged before Dec 1. November visits, only if ticked in the contract, are billed with the Dec 1 instalment. If we have not signed our minimum number of snow contracts (all areas combined) by Nov 20, the contract is void and nothing is owed.`
}

export function PriceSheet({ lang }: { lang: Lang }) {
  const b = priceBook
  const c = b.cleaning
  const ko = lang === 'ko'
  const H = ko
    ? { title: '가격표', cleaning: '청소(정액)', beds: '침실', baths: '포함 욕실', extra: '추가 욕실 1개당', addons: '추가 항목', rush: '24시간 내·주말·공휴일', gutters: '홈통 청소', storeys: ['단층', '2층', '3층'], downspout: '배수관(다운스파우트) 청소', snow: '제설', perVisit: '11월(시즌 전) 1회', walk: '현관 보도·계단', salt: '제빙 살포' }
    : { title: 'Price list', cleaning: 'Cleaning (flat rate)', beds: 'Bedrooms', baths: 'Baths incl.', extra: 'Each extra bathroom', addons: 'Add-ons', rush: 'Within 24 h / weekend / holiday', gutters: 'Gutter cleaning', storeys: ['Bungalow', '2 storeys', '3 storeys'], downspout: 'Downspout flush', snow: 'Snow clearing', perVisit: 'November visit (before season)', walk: 'Walkway & steps', salt: 'Salting' }
  const unit = b.snow?.mode === 'monthly' ? (ko ? '/월' : '/month') : ko ? '/시즌' : '/season'
  return (
    <div className="sheet relative p-[0.5in] text-[13px]" lang={lang}>
      <SampleMark />
      <div className="flex items-baseline justify-between border-b-2 border-[#0f766e] pb-2">
        <h1 className="text-2xl font-extrabold">
          {business.brand[lang]} — {H.title}
        </h1>
        <p className="text-sm text-gray-600">{business.cityName[lang]}</p>
      </div>

      <h2 className="mt-5 text-lg font-bold">{H.cleaning}</h2>
      <table className="mt-2 w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-gray-300">
            <th className="py-1">{H.beds}</th>
            <th className="py-1">{H.baths}</th>
            <th className="py-1">{CLEANING_TYPE_LABEL.standard[lang]}</th>
            <th className="py-1">{CLEANING_TYPE_LABEL.deep[lang]}</th>
            <th className="py-1">{CLEANING_TYPE_LABEL.moveOut[lang]}</th>
          </tr>
        </thead>
        <tbody>
          {c.tiers.map((t) => (
            <tr key={t.bedrooms} className="border-b border-gray-100">
              <td className="py-1">{t.bedrooms === 5 ? '5+' : t.bedrooms}</td>
              <td className="py-1">{t.includedBaths}</td>
              <td className="py-1 tabular-nums">{money(t.standard)}</td>
              <td className="py-1 tabular-nums">{money(t.deep)}</td>
              <td className="py-1 tabular-nums">{money(t.moveOut)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2">
        {H.extra}: {money(c.extraBathroom)} · {H.addons}: {c.addOns.map((a) => `${a[lang]} ${money(a.price)}`).join(', ')} · {H.rush}: +{c.rushPremiumPct}%
      </p>

      {business.services.gutters && b.gutters && (
        <>
          <h2 className="mt-5 text-lg font-bold">{H.gutters}</h2>
          <p className="mt-1">
            {([1, 2, 3] as const).filter((n) => n <= business.gutterMaxStoreys).map((n) => `${H.storeys[n - 1]} ${money(b.gutters!.byStoreys[n])}`).join(' · ')} · {H.downspout} +{money(b.gutters.downspoutFlush)}
          </p>
        </>
      )}

      {business.services.snow && b.snow && (
        <>
          <h2 className="mt-5 text-lg font-bold">{H.snow}</h2>
          <p className="mt-1">
            {(['single', 'double', 'large'] as const).map((s) => `${DRIVEWAY_LABEL[s][lang]} ${money(b.snow!.driveway[s])}${unit}`).join(' · ')}
          </p>
          <p className="mt-1">
            {H.walk} +{money(b.snow.walkwayAndSteps)}
            {unit} · {H.salt} +{money(b.snow.salting)}
            {unit} · {H.perVisit} {money(b.snow.perVisit)}
          </p>
          <p className="mt-1">{snowBillingLine(lang, b.snow.instalments)}</p>
        </>
      )}

      <div className="mt-6 space-y-1 border-t border-gray-300 pt-3 text-[12px] text-gray-700">
        <p>
          {/* matches lib/quote.ts: high end = low × (1 + rangeUpliftPct/100), rounded up to the next $5 */}
          {ko
            ? `표시 가격은 예상 가격이며, 집을 확인한 뒤 확정합니다(작업량이 많으면 최대 ${b.rangeUpliftPct}% 추가, 5달러 단위로 올림).`
            : `Prices are estimates confirmed on site (heavier jobs up to ${b.rangeUpliftPct}% more, rounded up to the next $5).`}
        </p>
        <p>
          {business.salesTaxRegistered
            ? ko
              ? `${business.tax.label} 별도.`
              : `Plus ${business.tax.label}.`
            : ko
              ? '현재 GST/HST 등록 사업자가 아니어서 세금이 붙지 않습니다.'
              : 'We are not currently registered for GST/HST, so no sales tax is added.'}
        </p>
        <p>
          {ko
            ? '결제: 작업 완료 후 e-Transfer 또는 현금. 은행 한도를 넘는 금액은 나눠서 보내셔도 됩니다.'
            : 'Payment: e-Transfer or cash when the job is done. Amounts above your bank’s e-Transfer limit can be split.'}
        </p>
        <p>{[contactLinks().phoneDisplay, business.contact.email, business.siteUrl.replace(/^https?:\/\//, '')].filter(Boolean).join(' · ')}</p>
      </div>
    </div>
  )
}
