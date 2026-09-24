// Pricing page body for /pricing/ and /ko/pricing/ (copy: content/pricing.ts). Each pass card and its
// checkout flow is <BuyPass> from frontend-app (CONTRACT §6).
import { BuyPass } from '../BuyPass'
import { productJsonLd } from '../../content/jsonld'
import type { PricingCopy } from '../../content/pricing'
import { SKU_ORDER } from '../../content/site'
import { cls, tone } from '../ui'
import { Blocks } from './Blocks'
import { JsonLd } from './JsonLd'
import { Rich } from './Rich'

export function PricingView({ copy }: { copy: PricingCopy }) {
  return (
    <div lang={copy.lang} className="sm:py-4">
      <header className="max-w-3xl">
        <h1 className={cls.h1}>{copy.title}</h1>
        <p className="mt-4 text-lg leading-8 text-slate-700">{copy.intro}</p>
        <ul className="mt-5 flex flex-wrap gap-2">
          {copy.facts.map((fact, i) => (
            <li key={i} className="rounded-full border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-900">
              {fact}
            </li>
          ))}
        </ul>
      </header>

      <section aria-labelledby="passes-heading" className="mt-10">
        <h2 id="passes-heading" className="sr-only">
          {copy.passesHeading}
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {SKU_ORDER.map((sku) => (
            <BuyPass key={sku} sku={sku} lang={copy.lang} />
          ))}
        </div>
      </section>

      <section aria-labelledby="free-heading" className={`${tone.success} mt-8 max-w-3xl text-base`}>
        <h2 id="free-heading" className="font-semibold">
          {copy.free.heading}
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {copy.free.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
        <p className="mt-2 text-sm">{copy.free.note}</p>
      </section>

      <div className="mt-12 max-w-3xl space-y-10">
        {copy.sections.map((s) => (
          <section key={s.id} id={s.id} aria-labelledby={`${s.id}-heading`} className="scroll-mt-24 space-y-4">
            <h2 id={`${s.id}-heading`} className={cls.h2}>
              {s.heading}
            </h2>
            <Blocks blocks={s.blocks} />
          </section>
        ))}
        <p className="border-t border-slate-200 pt-6 text-slate-800">
          <Rich text={copy.help} />
        </p>
      </div>

      <JsonLd data={productJsonLd(copy.lang)} />
    </div>
  )
}
