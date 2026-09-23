import QuoteTool from '@/components/QuoteTool'
import { SetupBanner, SiteFooter, SiteHeader } from '@/components/SiteChrome'
import { business } from '@/config/business'
import type { Lang } from '@/lib/i18n'
import { quoteToolProps } from '@/lib/site'

const TITLE = {
  en: { h1: 'Instant estimate', intro: 'Choose your options to see a price range. We confirm the final price when we see your home.' },
  ko: { h1: '바로 견적', intro: '항목을 고르면 예상 가격 범위가 바로 나와요. 최종 금액은 집을 확인한 뒤 확정해요.' },
}

export default function QuotePage({ lang }: { lang: Lang }) {
  return (
    <div lang={lang}>
      <SetupBanner lang={lang} />
      <SiteHeader lang={lang} path="/quote/" />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-3xl font-extrabold tracking-tight">{TITLE[lang].h1}</h1>
        <p className="mt-2 max-w-2xl text-muted">
          {TITLE[lang].intro} {business.serviceArea[lang] ? `(${business.serviceArea[lang]})` : ''}
        </p>
        <div className="mt-6">
          <QuoteTool {...quoteToolProps(lang)} />
        </div>
      </main>
      <SiteFooter lang={lang} />
    </div>
  )
}
