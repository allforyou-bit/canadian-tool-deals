import PrivacyNotice from '@/components/PrivacyNotice'
import { SetupBanner, SiteFooter, SiteHeader } from '@/components/SiteChrome'
import type { Lang } from '@/lib/i18n'

export default function PrivacyPage({ lang }: { lang: Lang }) {
  return (
    <div lang={lang}>
      <SetupBanner lang={lang} />
      <SiteHeader lang={lang} path="/privacy/" />
      <main>
        <PrivacyNotice lang={lang} />
      </main>
      <SiteFooter lang={lang} />
    </div>
  )
}
