import Link from 'next/link'
import { prefix, type Lang } from '@/lib/i18n'
import { CLUSTERS } from '@/lib/site'

const T = {
  en: {
    h1: 'Printables',
    intro: 'Each neighbourhood cluster gets its own QR code (c1, c2, c3) so you can see which streets bring requests.',
    hanger: 'Door hangers (2 per Letter sheet)',
    flyer: 'Half-page flyers (2 per Letter sheet)',
    price: 'Price list (1 Letter page)',
    agreements: 'Service agreements',
  },
  ko: {
    h1: '인쇄물',
    intro: '동네(클러스터)마다 QR 코드가 다릅니다(c1, c2, c3). 어느 거리에서 문의가 오는지 알 수 있습니다.',
    hanger: '문고리 전단(레터 1장에 2개)',
    flyer: '반쪽 전단(레터 1장에 2개)',
    price: '가격표(레터 1장)',
    agreements: '서비스 약관',
  },
}

export default function PrintIndex({ lang }: { lang: Lang }) {
  const p = prefix(lang)
  const t = T[lang]
  return (
    <main className="mx-auto max-w-2xl px-4 py-10" lang={lang}>
      <h1 className="text-3xl font-extrabold">{t.h1}</h1>
      <p className="mt-2 text-muted">{t.intro}</p>
      <h2 className="mt-6 font-bold">{t.hanger}</h2>
      <ul className="mt-1 flex gap-3">
        {CLUSTERS.map((c) => (
          <li key={c}>
            <Link className="underline" href={`${p}/print/door-hanger/${c}/`}>
              {c}
            </Link>
          </li>
        ))}
      </ul>
      <h2 className="mt-4 font-bold">{t.flyer}</h2>
      <ul className="mt-1 flex gap-3">
        {CLUSTERS.map((c) => (
          <li key={c}>
            <Link className="underline" href={`${p}/print/flyer/${c}/`}>
              {c}
            </Link>
          </li>
        ))}
      </ul>
      <h2 className="mt-4 font-bold">
        <Link className="underline" href={`${p}/print/price-sheet/`}>
          {t.price}
        </Link>
      </h2>
      <h2 className="mt-4 font-bold">{t.agreements}</h2>
      <ul className="mt-1 flex gap-3">
        {['cleaning', 'gutters', 'snow'].map((s) => (
          <li key={s}>
            <Link className="underline" href={`${p}/agreements/${s}/`}>
              {s}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
