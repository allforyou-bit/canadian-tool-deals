import Link from 'next/link'
import { business, formatPhone } from '@/config/business'
import { fillAgreement } from '@/content/agreements'
import type { Agreement } from '@/content/types'
import { prefix, type Lang } from '@/lib/i18n'

// The agreement templates follow Ontario consumer rules (direct-agreement cancellation, HTA s.181).
// Other provinces were not researched, so outside Ontario the page shows only this notice.
const NOT_ADAPTED = {
  en: 'This agreement template was written for Ontario and has not been adapted to the consumer rules of this province (not researched). It must not be used here until a lawyer or insurer has adapted it.',
  ko: '이 계약서 양식은 온타리오 기준으로 작성되었고, 이 주(州)의 소비자 규정에 맞게 고치지 않았습니다(조사하지 않음). 변호사나 보험사가 고치기 전에는 여기서 사용할 수 없습니다.',
}

export const agreementsAvailable = () => business.tax.province === 'ON'

const UI = {
  en: { print: 'Print or save as PDF from your browser.', others: 'Other agreements' },
  ko: { print: '브라우저에서 인쇄하거나 PDF로 저장하세요.', others: '다른 계약서' },
}

export default function AgreementView({ lang, agreement: template, all }: { lang: Lang; agreement: Agreement; all: Agreement[] }) {
  const p = prefix(lang)
  const values = {
    brand: business.brand,
    mailingAddress: business.contact.mailingAddress,
    phone: business.contact.phone ? formatPhone(business.contact.phone) : '',
    email: business.contact.email,
  }
  const agreement = fillAgreement(template, values)
  if (!agreementsAvailable()) {
    return (
      <article className="sheet prose-legal p-[0.6in] text-[13px] leading-relaxed" lang={lang}>
        <h1 className="text-2xl font-extrabold">{agreement.title[lang]}</h1>
        <p className="mt-4 font-semibold text-amber-800">{NOT_ADAPTED[lang]}</p>
      </article>
    )
  }
  return (
    <article className="sheet prose-legal p-[0.6in] text-[13px] leading-relaxed" lang={lang}>
      <p className="no-print mb-4 text-xs text-muted">
        {UI[lang].print} {UI[lang].others}:{' '}
        {all
          // link only services switched on in config/business.ts (gutters need Gate G1, snow needs Gate S)
          .filter((a) => a.service !== agreement.service && business.services[a.service])
          .map((a) => fillAgreement(a, values))
          .map((a) => (
            <Link key={a.service} className="mr-2 underline" href={`${p}/agreements/${a.service}/`}>
              {a.title[lang]}
            </Link>
          ))}
      </p>
      <h1 className="text-2xl font-extrabold">{agreement.title[lang]}</h1>
      <p className="mt-1 text-xs font-semibold text-amber-800">{agreement.notice[lang]}</p>
      {agreement.sections.map((s, i) => (
        <section key={i} className="avoid-break mt-4">
          <h2 className="text-base font-bold">
            {i + 1}. {s.heading[lang]}
          </h2>
          {s.clauses.map((c, j) => (
            <p key={j}>
              {i + 1}.{j + 1} {c[lang]}
            </p>
          ))}
        </section>
      ))}
      <section className="avoid-break mt-8 grid grid-cols-2 gap-x-8 gap-y-6">
        {agreement.signatureFields.map((f, i) => (
          <div key={i}>
            <div className="h-8 border-b border-gray-500" />
            <p className="mt-1 text-xs text-gray-600">{f[lang]}</p>
          </div>
        ))}
      </section>
    </article>
  )
}
