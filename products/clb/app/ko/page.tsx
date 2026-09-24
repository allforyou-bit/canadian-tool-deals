// /ko/ — Korean landing page (copy: content/landing.ts). The body is wrapped in lang="ko".
import type { Metadata } from 'next'
import { Landing } from '@/components/content/Landing'
import { LANDING_KO } from '@/content/landing'
import { PATHS } from '@/content/routes'
import { pageMetadata } from '@/content/seo'

export const metadata: Metadata = pageMetadata({
  path: PATHS.homeKo,
  title: LANDING_KO.meta.title,
  description: LANDING_KO.meta.description,
  lang: 'ko',
  brandFirst: true,
})

export default function KoreanHomePage() {
  return <Landing copy={LANDING_KO} />
}
