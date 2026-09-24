// /pricing/ — passes, free tasks, fair use and refunds (copy: content/pricing.ts).
import type { Metadata } from 'next'
import { PricingView } from '@/components/content/PricingView'
import { PRICING_EN } from '@/content/pricing'
import { pageMetadata } from '@/content/seo'

export const metadata: Metadata = pageMetadata({
  path: PRICING_EN.path,
  title: PRICING_EN.meta.title,
  description: PRICING_EN.meta.description,
})

export default function PricingPage() {
  return <PricingView copy={PRICING_EN} />
}
