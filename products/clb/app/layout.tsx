import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { LandingTracker } from '../components/LandingTracker'
import { SiteBanner } from '../components/SiteBanner'
import { SiteFooter } from '../components/SiteFooter'
import { SiteHeader } from '../components/SiteHeader'
import { PUBLIC_ENV } from '../lib/env'
import { t } from '../lib/i18n'
import { BRAND } from '../shared/config'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: PUBLIC_ENV.siteUrl ? new URL(PUBLIC_ENV.siteUrl) : null,
  title: { default: BRAND.en, template: `%s | ${BRAND.en}` },
  description:
    'Timed English writing and speaking practice with AI feedback on content, organisation, vocabulary and grammar. For adults in Canada, outside Quebec.',
  applicationName: BRAND.en,
  icons: { icon: { url: '/favicon.svg', type: 'image/svg+xml' } },
}

export const viewport: Viewport = {
  themeColor: '#b91c1c',
}

/** Root layout: header, owner banner, page body, footer (with the not-affiliated line) on every page. */
export default function RootLayout({ children }: { children: ReactNode }) {
  const beaconToken = PUBLIC_ENV.cfBeaconToken
  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col bg-slate-50 font-sans text-slate-900 antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-red-800 focus:shadow"
        >
          {t('en', 'skip')}
        </a>
        <SiteHeader />
        <SiteBanner />
        <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
          {children}
        </main>
        <SiteFooter />
        <LandingTracker />
        {beaconToken && (
          // Cloudflare Web Analytics manual snippet (cloudflare-docs web-analytics/faq.mdx)
          <script
            type="module"
            src="https://static.cloudflareinsights.com/beacon.min.js"
            data-cf-beacon={JSON.stringify({ token: beaconToken })}
          />
        )}
      </body>
    </html>
  )
}
