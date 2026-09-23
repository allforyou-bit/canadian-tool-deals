import Link from 'next/link'
import { business } from '@/config/business'
import type { Agreement } from '@/content/types'
import { prefix, type Lang } from '@/lib/i18n'

const UI = {
  en: { print: 'Print or save as PDF from your browser.', others: 'Other agreements', parties: 'Service provider', governs: '' },
  ko: { print: '브라우저에서 인쇄하거나 PDF로 저장하세요.', others: '다른 약관', parties: '서비스 제공자', governs: '영문본이 우선하며, 한국어는 이해를 돕기 위한 번역입니다.' },
}

export default function AgreementView({ lang, agreement, all }: { lang: Lang; agreement: Agreement; all: Agreement[] }) {
  const p = prefix(lang)
  const contact = [business.contact.mailingAddress, business.contact.email].filter(Boolean).join(' · ')
  return (
    <article className="sheet prose-legal p-[0.6in] text-[13px] leading-relaxed" lang={lang}>
      <p className="no-print mb-4 text-xs text-muted">
        {UI[lang].print} {UI[lang].others}:{' '}
        {all
          .filter((a) => a.service !== agreement.service)
          .map((a) => (
            <Link key={a.service} className="mr-2 underline" href={`${p}/agreements/${a.service}/`}>
              {a.title[lang]}
            </Link>
          ))}
      </p>
      <h1 className="text-2xl font-extrabold">{agreement.title[lang]}</h1>
      <p className="mt-1 text-xs font-semibold text-amber-800">{agreement.notice[lang]}</p>
      {UI[lang].governs && <p className="text-xs text-muted">{UI[lang].governs}</p>}
      <p className="mt-3 text-sm">
        <strong>{UI[lang].parties}:</strong> {business.brand[lang]}
        {contact ? ` — ${contact}` : ''}
      </p>
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
