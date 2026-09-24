import Link from 'next/link'
import { BRAND } from '../shared/config'
import { t } from '../lib/i18n'
import { AccountNavLink } from './AccountNavLink'

const navLink = 'rounded px-1 py-2 text-slate-800 underline-offset-4 hover:text-red-800 hover:underline focus-visible:outline-2 focus-visible:outline-red-700'

/** Site header: brand and main navigation (the account link updates after /api/me). */
export function SiteHeader() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-2">
        <Link href="/" className="flex items-center gap-2 py-2 text-lg font-bold text-slate-950">
          <span aria-hidden="true" className="inline-block size-3 rotate-45 rounded-sm bg-red-700" />
          {BRAND.en}
        </Link>
        <nav aria-label={t('en', 'nav.label')}>
          <ul className="flex flex-wrap items-center gap-x-4 text-base">
            <li>
              <Link href="/practice/" className={navLink}>
                {t('en', 'nav.practice')}
              </Link>
            </li>
            <li>
              <Link href="/pricing/" className={navLink}>
                {t('en', 'nav.pricing')}
              </Link>
            </li>
            <li>
              <Link href="/help/" className={navLink}>
                {t('en', 'nav.help')}
              </Link>
            </li>
            <li>
              <AccountNavLink className={navLink} />
            </li>
            <li>
              <Link href="/ko/" className={navLink} lang="ko" hrefLang="ko">
                {t('en', 'nav.korean')}
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  )
}
