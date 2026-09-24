// Questions and answers, plus matching FAQPage structured data.
import type { Lang } from '../../shared/api'
import { faqJsonLd } from '../../content/jsonld'
import type { FaqItem } from '../../content/types'
import { cls } from '../ui'
import { JsonLd } from './JsonLd'
import { Rich } from './Rich'

export function Faq(props: { id: string; heading: string; items: FaqItem[]; lang: Lang }) {
  const { id, heading, items, lang } = props
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-24">
      <h2 id={`${id}-heading`} className={cls.h2}>
        {heading}
      </h2>
      <div className="mt-6 divide-y divide-slate-200 border-y border-slate-200">
        {items.map((item, i) => (
          <div key={i} className="py-5">
            <h3 className="text-base font-semibold text-slate-950">{item.q}</h3>
            <p className="mt-2 leading-7 text-slate-800">
              <Rich text={item.a} />
            </p>
          </div>
        ))}
      </div>
      <JsonLd data={faqJsonLd(items, lang)} />
    </section>
  )
}
