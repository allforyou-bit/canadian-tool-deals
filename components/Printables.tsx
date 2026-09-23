import QRCode from 'qrcode'
import { business, priceBook } from '@/config/business'
import { money, prefix, type Lang } from '@/lib/i18n'
import { CLEANING_TYPE_LABEL, DRIVEWAY_LABEL } from '@/lib/quote'
import { absolute, contactLinks, setupMissing, type Cluster } from '@/lib/site'

// Print-ready sheets rendered at physical size. Open the page, then Print → "Letter", scale 100%,
// margins "None" or "Default" (the sheets already leave a safe margin). `npm run pdf` saves them as PDFs.

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

/** "from" prices shown on printed material — always derived from the live price book */
export function offerLines(lang: Lang): string[] {
  const c = priceBook.cleaning
  const from = lang === 'ko' ? (x: string) => `${x}부터` : (x: string) => `from ${x}`
  const lines = [
    `${CLEANING_TYPE_LABEL.deep[lang]} — ${from(money(cheapest(c.tiers.map((t) => t.deep))))}`,
    `${CLEANING_TYPE_LABEL.moveOut[lang]} — ${from(money(cheapest(c.tiers.map((t) => t.moveOut))))}`,
    `${CLEANING_TYPE_LABEL.standard[lang]} — ${from(money(cheapest(c.tiers.map((t) => t.standard))))}`,
  ]
  if (business.services.gutters && priceBook.gutters) {
    const g = cheapest(Object.values(priceBook.gutters.byStoreys))
    lines.push(lang === 'ko' ? `홈통 청소 — ${from(money(g))}` : `Gutter cleaning — ${from(money(g))}`)
  }
  if (business.services.snow && priceBook.snow) {
    const s = priceBook.snow
    const p = s.driveway.single
    lines.push(
      s.mode === 'season'
        ? lang === 'ko'
          ? `겨울 제설 시즌 계약 — ${from(money(p))} (4회 분할, 12월 1일 전 결제 없음)`
          : `Winter snow season — ${from(money(p))} (4 payments, nothing before Dec 1)`
        : lang === 'ko'
          ? `겨울 제설 — 월 ${from(money(p))}`
          : `Winter snow clearing — ${from(`${money(p)}/month`)}`,
    )
  }
  return lines
}

const TEXT = {
  en: {
    headline: 'Home cleaning, priced upfront',
    sub: 'Local and owner-operated. Get your price in 30 seconds.',
    missed: 'Sorry we missed you!',
    scan: 'Scan for your instant estimate',
    or: 'or call / text',
    fine: 'Estimates are confirmed when we see your home. No obligation.',
    web: 'Online',
    steps: ['Scan the code or call for a price range', 'We confirm the price and book a time', 'Pay by e-Transfer or cash when the job is done'],
    visited: 'We stopped by on ______ at ______',
    language: '한국어 상담 가능 · Korean-speaking owner',
  },
  ko: {
    headline: '청소 가격, 먼저 알려드립니다',
    sub: '동네 사장이 직접 운영합니다. 30초면 예상 가격을 확인하세요.',
    missed: '방문했지만 안 계셔서 남기고 갑니다!',
    scan: 'QR을 찍으면 바로 견적',
    or: '또는 전화·문자',
    fine: '최종 금액은 집을 확인한 뒤 확정합니다. 문의는 부담 없이 하세요.',
    web: '웹사이트',
    steps: ['QR 또는 전화로 예상 가격 확인', '가격 확정 후 방문 시간 예약', '작업이 끝나면 e-Transfer 또는 현금 결제'],
    visited: '______월 ______일 ______시에 방문했습니다',
    language: '한국어로 편하게 상담하세요',
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

export async function DoorHangerSheet({ lang, cluster }: { lang: Lang; cluster: Cluster }) {
  const svg = await qrSvg(quoteUrl(lang, cluster))
  const T = TEXT[lang]
  const hanger = (
    <div className="relative flex h-[10.2in] w-[3.95in] flex-col items-center border border-dashed border-gray-300 px-4 pb-4 pt-3">
      {/* hole + slit guide */}
      <div className="flex h-[1.9in] w-full flex-col items-center">
        <div className="h-[1.35in] w-[1.35in] rounded-full border-2 border-dashed border-gray-400" />
        <div className="h-[0.45in] border-l-2 border-dashed border-gray-400" />
      </div>
      <p className="text-center text-sm font-semibold text-gray-700">{T.missed}</p>
      <p className="mt-2 text-center text-lg font-extrabold text-[#115e59]">{business.brand[lang]}</p>
      <h2 className="mt-1 text-center text-[22px] font-extrabold leading-tight">{T.headline}</h2>
      <p className="mt-1 text-center text-xs text-gray-700">{T.sub}</p>
      <ul className="mt-3 w-full space-y-1 text-[13px] font-semibold">
        {offerLines(lang).map((l) => (
          <li key={l} className="rounded bg-[#e6f4f1] px-2 py-1">
            {l}
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-col items-center">
        <div className="h-[1.25in] w-[1.25in]" dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="mt-1 text-xs font-semibold">{T.scan}</p>
      </div>
      <div className="mt-2">
        <Contact lang={lang} />
      </div>
      <p className="mt-3 rounded-full border border-[#0f766e] px-3 py-0.5 text-center text-[11px] font-semibold text-[#115e59]">{T.language}</p>
      <div className="mt-3 w-full">
        <Steps lang={lang} />
      </div>
      <p className="mt-4 w-full text-center text-[11px] text-gray-700">{T.visited}</p>
      <p className="mt-auto text-center text-[9px] leading-snug text-gray-600">
        {T.fine}
        {business.serviceArea[lang] ? ` · ${business.serviceArea[lang]}` : ''}
      </p>
    </div>
  )
  return (
    <div className="sheet relative flex items-start justify-center gap-[0.2in] p-[0.2in]" lang={lang}>
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
    <div className="flex h-[5.1in] w-[8in] gap-5 border border-dashed border-gray-300 p-5">
      <div className="flex flex-1 flex-col">
        <p className="text-lg font-extrabold text-[#115e59]">{business.brand[lang]}</p>
        <h2 className="mt-1 text-3xl font-extrabold leading-tight">{T.headline}</h2>
        <p className="mt-1 text-sm text-gray-700">{T.sub}</p>
        <ul className="mt-3 space-y-1.5 text-[15px] font-semibold">
          {offerLines(lang).map((l) => (
            <li key={l} className="rounded bg-[#e6f4f1] px-2 py-1">
              {l}
            </li>
          ))}
        </ul>
        <div className="mt-3">
          <Steps lang={lang} size="md" />
        </div>
        <p className="mt-2 text-[12px] font-semibold text-[#115e59]">{T.language}</p>
        <p className="mt-auto text-[10px] text-gray-600">
          {T.fine}
          {business.serviceArea[lang] ? ` · ${business.serviceArea[lang]}` : ''}
        </p>
      </div>
      <div className="flex w-[2.3in] flex-col items-center justify-center">
        <div className="h-[1.8in] w-[1.8in]" dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="mt-2 text-center text-sm font-semibold">{T.scan}</p>
        <div className="mt-3">
          <Contact lang={lang} />
        </div>
      </div>
    </div>
  )
  return (
    <div className="sheet relative flex flex-col items-center gap-[0.2in] p-[0.25in]" lang={lang}>
      <SampleMark />
      {flyer}
      {flyer}
    </div>
  )
}

export function PriceSheet({ lang }: { lang: Lang }) {
  const b = priceBook
  const c = b.cleaning
  const ko = lang === 'ko'
  const H = ko
    ? { title: '가격표', cleaning: '청소(정액)', beds: '침실', baths: '포함 욕실', extra: '추가 욕실 1개당', addons: '추가 항목', rush: '24시간 내·주말·공휴일', gutters: '홈통 청소', storeys: ['단층', '2층', '3층'], downspout: '배수관 뚫기', snow: '제설', perVisit: '11월(시즌 전) 1회', walk: '현관 보도·계단', salt: '제빙 살포' }
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
          <p className="mt-1">
            {ko
              ? '12월 1일·1월 1일·2월 1일·3월 1일 4회 분할 청구. 12월 1일 전에는 결제 없음. 11월 20일까지 동네 최소 계약 수에 못 미치면 계약 무효, 비용 없음.'
              : 'Billed in 4 instalments: Dec 1, Jan 1, Feb 1, Mar 1. Nothing is charged before Dec 1. If we have not signed our neighbourhood minimum by Nov 20, the contract is void and nothing is owed.'}
          </p>
        </>
      )}

      <div className="mt-6 space-y-1 border-t border-gray-300 pt-3 text-[12px] text-gray-700">
        <p>
          {ko
            ? `표시 가격은 예상 가격이며, 집을 확인한 뒤 확정합니다(작업량이 많으면 최대 ${b.rangeUpliftPct}% 추가).`
            : `Prices are estimates confirmed on site (heavier jobs up to ${b.rangeUpliftPct}% more).`}
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
