import Link from 'next/link'
import { BRAND, NOT_AFFILIATED } from '../shared/config'
import { t, type UiKey } from '../lib/i18n'

const LINKS: { href: string; key: UiKey }[] = [
  { href: '/legal/privacy/', key: 'footer.privacy' },
  { href: '/legal/terms/', key: 'footer.terms' },
  { href: '/legal/refunds/', key: 'footer.refunds' },
  { href: '/legal/ai-disclosure/', key: 'footer.ai' },
  { href: '/legal/not-affiliated/', key: 'footer.notAffiliated' },
  { href: '/help/', key: 'footer.help' },
  { href: '/status/', key: 'footer.status' },
]

/** Footer on every page: the not-affiliated statement (EN, with KO below) and the legal links. */
export function SiteFooter() {
  return (
    <footer className="mt-12 border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-8">
        <p className="text-sm text-slate-700">{NOT_AFFILIATED.en}</p>
        <p lang="ko" className="text-xs text-slate-600">
          {NOT_AFFILIATED.ko}
        </p>
        <nav aria-label={t('en', 'footer.links')}>
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} prefetch={false} className="text-slate-700 underline underline-offset-2 hover:text-red-800">
                  {t('en', l.key)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <p className="text-xs text-slate-500">
          {BRAND.en} · <span lang="ko">{BRAND.ko}</span>
        </p>
      </div>
    </footer>
  )
}
