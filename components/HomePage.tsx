import Faq from '@/components/Faq'
import QuoteTool from '@/components/QuoteTool'
import { SetupBanner, SiteFooter, SiteHeader } from '@/components/SiteChrome'
import { business } from '@/config/business'
import { COPY } from '@/content/copy'
import type { ServiceKey } from '@/content/types'
import { DICT, type Lang } from '@/lib/i18n'
import { contactLinks, quoteToolProps } from '@/lib/site'

const SECTION = {
  en: { how: 'How it works', why: 'Why book with us', faq: 'Questions', services: 'Services' },
  ko: { how: '이용 방법', why: '저희를 선택하는 이유', faq: '자주 묻는 질문', services: '서비스' },
}

export default function HomePage({ lang }: { lang: Lang }) {
  const c = COPY[lang]
  const d = DICT[lang]
  const s = SECTION[lang]
  const links = contactLinks()
  const services = (['cleaning', 'gutters', 'snow'] as ServiceKey[]).filter((k) => business.services[k])

  return (
    <div lang={lang}>
      <SetupBanner lang={lang} />
      <SiteHeader lang={lang} path="/" />
      <main>
        {/* hero */}
        <section className="bg-gradient-to-b from-brand-soft to-white">
          <div className="mx-auto max-w-6xl px-4 pb-12 pt-10 sm:pt-16">
            <p className="text-sm font-semibold text-brand-dark">
              {business.brand[lang]}
              {business.serviceArea[lang] ? ` · ${business.serviceArea[lang]}` : ` · ${business.cityName[lang]}`}
            </p>
            <h1 className="mt-2 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">{c.heroTitle}</h1>
            <p className="mt-4 max-w-2xl text-lg text-foreground/80">{c.heroSubtitle}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="#quote" className="rounded-lg bg-brand px-5 py-3 font-semibold text-white shadow-sm hover:bg-brand-dark">
                {c.heroCta}
              </a>
              {links.tel && (
                <a href={links.tel} className="rounded-lg border border-brand bg-white px-5 py-3 font-semibold text-brand-dark hover:bg-brand-soft">
                  {c.secondaryCta}
                </a>
              )}
            </div>
            {business.insured && <p className="mt-4 text-sm text-muted">{d.insuredLine}</p>}
          </div>
        </section>

        {/* how it works */}
        <section className="mx-auto max-w-6xl px-4 py-10">
          <h2 className="text-2xl font-bold">{s.how}</h2>
          <ol className="mt-5 grid gap-4 sm:grid-cols-3">
            {c.howItWorks.map((step, i) => (
              <li key={i} className="rounded-2xl border border-line bg-white p-5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand font-bold text-white">{i + 1}</span>
                <h3 className="mt-3 font-bold">{step.title}</h3>
                <p className="mt-1 text-sm text-foreground/75">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* services */}
        <section id="services" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-10">
          <h2 className="text-2xl font-bold">{s.services}</h2>
          <p className="mt-2 max-w-2xl text-foreground/75">{c.servicesIntro}</p>
          <div className={`mt-5 grid gap-4 ${services.length > 1 ? 'sm:grid-cols-2 lg:grid-cols-3' : 'max-w-xl'}`}>
            {services.map((k) => (
              <article key={k} className="rounded-2xl border border-line bg-white p-5">
                <h3 className="text-lg font-bold">{c.services[k].title}</h3>
                <p className="mt-2 text-sm text-foreground/75">{c.services[k].body}</p>
                <ul className="mt-3 space-y-1 text-sm">
                  {c.services[k].includes.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="text-brand" aria-hidden="true">
                        ✓
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        {/* quote */}
        <section id="quote" className="scroll-mt-20 bg-gray-50 py-12">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-2xl font-bold">{c.quoteTitle}</h2>
            <p className="mt-2 max-w-2xl text-foreground/75">{c.quoteIntro}</p>
            <div className="mt-6">
              <QuoteTool {...quoteToolProps(lang)} headingLevel={3} />
            </div>
          </div>
        </section>

        {/* why us */}
        <section className="mx-auto max-w-6xl px-4 py-10">
          <h2 className="text-2xl font-bold">{s.why}</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {c.whyUs.map((w, i) => (
              <div key={i} className="rounded-2xl bg-brand-soft p-5">
                <h3 className="font-bold text-brand-dark">{w.title}</h3>
                <p className="mt-1 text-sm text-foreground/80">{w.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* area */}
        <section id="area" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-6">
          <h2 className="text-2xl font-bold">{c.areaTitle}</h2>
          <p className="mt-2 text-foreground/80">
            {business.serviceArea[lang] ? `${business.serviceArea[lang]} — ` : ''}
            {business.cityName[lang]}
          </p>
        </section>

        {/* faq */}
        <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-10">
          <h2 className="mb-4 text-2xl font-bold">{s.faq}</h2>
          <Faq lang={lang} />
        </section>

        {/* contact */}
        <section id="contact" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-10">
          <div className="rounded-2xl bg-brand p-6 text-white sm:p-8">
            <h2 className="text-2xl font-bold">{c.contactTitle}</h2>
            <p className="mt-2 max-w-2xl text-white/90">{c.contactBody}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              {links.tel && (
                <a className="rounded-lg bg-white px-4 py-2.5 font-semibold text-brand-dark" href={links.tel}>
                  {d.call} {links.phoneDisplay}
                </a>
              )}
              {links.sms && (
                <a className="rounded-lg border border-white/70 px-4 py-2.5 font-semibold" href={links.sms}>
                  {d.text}
                </a>
              )}
              {links.mail && (
                <a className="rounded-lg border border-white/70 px-4 py-2.5 font-semibold" href={links.mail}>
                  {d.email}
                </a>
              )}
              <a className="rounded-lg border border-white/70 px-4 py-2.5 font-semibold" href="#quote">
                {c.heroCta}
              </a>
            </div>
          </div>
          <p className="mt-4 text-xs text-muted">{c.footerNote}</p>
        </section>
      </main>
      <SiteFooter lang={lang} />
    </div>
  )
}
