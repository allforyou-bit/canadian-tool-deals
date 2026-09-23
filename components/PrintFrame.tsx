import Link from 'next/link'
import type { Lang } from '@/lib/i18n'

const BACK = { en: 'Back', ko: '뒤로' }

const HELP = {
  en: 'Print on Letter paper at 100% scale (turn off "fit to page"). Cut along the dashed lines.',
  ko: '레터(Letter) 용지, 배율 100%로 인쇄하세요("페이지에 맞추기" 해제). 점선을 따라 자르면 됩니다.',
}

export default function PrintFrame({ lang, children, back }: { lang: Lang; children: React.ReactNode; back: string }) {
  return (
    <div className="print-canvas" lang={lang}>
      <div className="no-print mx-auto mb-2 flex max-w-[8.5in] items-center justify-between gap-4 px-2 text-sm">
        <Link href={back} className="shrink-0 underline">
          <span aria-hidden="true">←</span> {BACK[lang]}
        </Link>
        <p className="text-muted">{HELP[lang]}</p>
      </div>
      {children}
    </div>
  )
}
