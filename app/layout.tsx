import type { Metadata, Viewport } from 'next'
import { business } from '@/config/business'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL(business.siteUrl),
  title: {
    default: `${business.brand.en} — Home cleaning in ${business.cityName.en}`,
    template: `%s | ${business.brand.en}`,
  },
  description: `Instant price estimates for standard, deep and move-in/move-out cleaning in ${business.cityName.en}. Local, owner-operated. English and Korean.`,
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0f766e',
}

// One root layout serves both languages, and a static export cannot read the path on the server,
// so the Korean pages (/ko/...) set the document language here, before the page paints, and again
// after client-side navigation (the EN/KO switch uses next/link, which keeps this layout mounted).
// The exported HTML still says en-CA; the full fix is two root layouts via route groups.
const SET_LANG = `(function(){var d=document.documentElement;function s(){d.lang=/^\\/ko(\\/|$)/.test(location.pathname)?'ko':'en-CA'}s();['pushState','replaceState'].forEach(function(m){var o=history[m];history[m]=function(){var r=o.apply(this,arguments);s();return r}});addEventListener('popstate',s)})()`

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-CA" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SET_LANG }} />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  )
}
