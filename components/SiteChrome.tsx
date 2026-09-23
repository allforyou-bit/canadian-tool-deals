import Link from 'next/link'
import { business } from '@/config/business'
import { DICT, prefix, type Lang } from '@/lib/i18n'
import { contactLinks, setupMissing } from '@/lib/site'

export function SetupBanner({ lang }: { lang: Lang }) {
  const missing = setupMissing()
  if (missing.length === 0) return null
  return (
    <div className="no-print border-b border-[var(--warn-line)] bg-[var(--warn-bg)] px-4 py-2 text-center text-xs text-amber-900">
      {DICT[lang].setupBanner} <code className="font-mono">{missing.join(', ')}</code>
    </div>
  )
}

/** switches between the English page and its Korean twin */
function otherLangHref(lang: Lang, path: string) {
  return lang === 'ko' ? path || '/' : `/ko${path}`
}

export function SiteHeader({ lang, path = '/' }: { lang: Lang; path?: string }) {
  const d = DICT[lang]
  const c = contactLinks()
  const p = prefix(lang)
  return (
    <header className="no-print sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link href={`${p}/`} className="text-lg font-extrabold tracking-tight text-brand-dark">
          {business.brand[lang]}
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <Link href={`${p}/#services`} className="hidden rounded-md px-2 py-1 hover:bg-brand-soft sm:inline">
            {d.nav.services}
          </Link>
          <Link href={`${p}/#faq`} className="hidden rounded-md px-2 py-1 hover:bg-brand-soft sm:inline">
            {d.nav.faq}
          </Link>
          <Link href={otherLangHref(lang, path === '/' ? '/' : path)} className="rounded-md border border-line px-2 py-1 hover:bg-brand-soft" hrefLang={lang === 'ko' ? 'en' : 'ko'}>
            {d.otherLang}
          </Link>
          {c.tel && (
            <a href={c.tel} className="rounded-md bg-brand px-3 py-1.5 font-semibold text-white hover:bg-brand-dark">
              {d.call}
            </a>
          )}
        </nav>
      </div>
    </header>
  )
}

export function SiteFooter({ lang }: { lang: Lang }) {
  const d = DICT[lang]
  const c = contactLinks()
  const p = prefix(lang)
  return (
    <footer className="no-print mt-16 border-t border-line bg-gray-50">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 text-sm text-muted sm:grid-cols-3">
        <div>
          <p className="font-bold text-foreground">{business.brand[lang]}</p>
          {business.serviceArea[lang] && <p className="mt-1">{business.serviceArea[lang]}</p>}
          <p className="mt-1">{business.cityName[lang]}</p>
          {business.contact.mailingAddress && <p className="mt-1">{business.contact.mailingAddress}</p>}
        </div>
        <div className="space-y-1">
          {c.phoneDisplay && (
            <p>
              <a className="hover:underline" href={c.tel}>
                {c.phoneDisplay}
              </a>
            </p>
          )}
          {c.email && (
            <p>
              <a className="hover:underline" href={c.mail}>
                {c.email}
              </a>
            </p>
          )}
          {business.insured && <p>{d.insuredLine}</p>}
        </div>
        <div className="space-y-1">
          <p>
            <Link className="hover:underline" href={`${p}/privacy/`}>
              {d.footer.privacy}
            </Link>
          </p>
          <p>
            <Link className="hover:underline" href={`${p}/agreements/cleaning/`}>
              {d.footer.agreements}
            </Link>
          </p>
          <p>
            <Link className="hover:underline" href={`${p}/print/price-sheet/`}>
              {d.footer.prices}
            </Link>
          </p>
          <p className="pt-2 text-xs">{d.footer.rights}</p>
        </div>
      </div>
    </footer>
  )
}
