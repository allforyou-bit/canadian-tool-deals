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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-CA">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  )
}
