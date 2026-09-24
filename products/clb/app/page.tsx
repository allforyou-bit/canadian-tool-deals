// / — English landing page (copy: content/landing.ts). Header, footer and banner come from app/layout.tsx.
import type { Metadata } from 'next'
import { JsonLd } from '@/components/content/JsonLd'
import { Landing } from '@/components/content/Landing'
import { websiteJsonLd } from '@/content/jsonld'
import { LANDING_EN } from '@/content/landing'
import { PATHS } from '@/content/routes'
import { pageMetadata } from '@/content/seo'

export const metadata: Metadata = pageMetadata({
  path: PATHS.home,
  title: LANDING_EN.meta.title,
  description: LANDING_EN.meta.description,
  brandFirst: true,
})

export default function HomePage() {
  return (
    <>
      <JsonLd data={websiteJsonLd('en')} />
      <Landing copy={LANDING_EN} />
    </>
  )
}
