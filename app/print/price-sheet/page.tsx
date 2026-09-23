import type { Metadata } from 'next'
import PrintFrame from '@/components/PrintFrame'
import { PriceSheet } from '@/components/Printables'

export const metadata: Metadata = { title: 'Price list', robots: { index: false, follow: true } }

export default function Page() {
  return (
    <PrintFrame lang="en" back="/">
      <PriceSheet lang="en" />
    </PrintFrame>
  )
}
