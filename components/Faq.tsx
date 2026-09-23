import { business } from '@/config/business'
import { FAQ } from '@/content/faq'
import type { FaqItem } from '@/content/types'
import type { Lang } from '@/lib/i18n'

export function visibleFaq(): FaqItem[] {
  return FAQ.filter((item) => {
    if (item.service && !business.services[item.service]) return false
    if (item.when === 'insured' && !business.insured) return false
    if (item.when === 'notInsured' && business.insured) return false
    return true
  })
}

export default function Faq({ lang }: { lang: Lang }) {
  return (
    <div className="divide-y divide-line rounded-2xl border border-line bg-white">
      {visibleFaq().map((item) => (
        <details key={item.id} className="group p-4 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
            <span>{item.q[lang]}</span>
            <span className="text-brand transition group-open:rotate-45" aria-hidden="true">
              +
            </span>
          </summary>
          <div className="mt-2 space-y-2 text-sm text-foreground/80">
            {item.a[lang].split(/\n\s*\n/).map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        </details>
      ))}
    </div>
  )
}
