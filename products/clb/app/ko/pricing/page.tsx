// /ko/pricing/ — Korean pricing page (copy: content/pricing.ts). The body is wrapped in lang="ko".
import type { Metadata } from 'next'
import { PricingView } from '@/components/content/PricingView'
import { PRICING_KO } from '@/content/pricing'
import { pageMetadata } from '@/content/seo'

export const metadata: Metadata = pageMetadata({
  path: PRICING_KO.path,
  title: PRICING_KO.meta.title,
  description: PRICING_KO.meta.description,
  lang: 'ko',
})

export default function KoreanPricingPage() {
  return <PricingView copy={PRICING_KO} />
}
