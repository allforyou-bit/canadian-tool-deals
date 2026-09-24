import type { Metadata } from 'next'
import Link from 'next/link'
import { cls } from '../../../components/ui'
import { t } from '../../../lib/i18n'

export const metadata: Metadata = {
  title: 'Payment cancelled',
  robots: { index: false, follow: false },
}

export default function CheckoutCancelPage() {
  return (
    <section className={`${cls.card} mx-auto max-w-lg space-y-4`} aria-labelledby="cancel-title">
      <h1 id="cancel-title" className={cls.h1}>
        {t('en', 'c.cancelTitle')}
      </h1>
      <p className="text-slate-800">{t('en', 'c.cancelBody')}</p>
      <p lang="ko" className="text-sm text-slate-700">
        {t('ko', 'c.cancelTitle')}. {t('ko', 'c.cancelBody')}
      </p>
      <div className="flex flex-wrap gap-3">
        <Link href="/pricing/" className={`${cls.btn} ${cls.primary}`}>
          {t('en', 'common.seePricing')}
        </Link>
        <Link href="/practice/" className={`${cls.btn} ${cls.secondary}`}>
          {t('en', 'nav.practice')}
        </Link>
      </div>
    </section>
  )
}
