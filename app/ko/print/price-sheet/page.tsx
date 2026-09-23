import type { Metadata } from 'next'
import PrintFrame from '@/components/PrintFrame'
import { PriceSheet } from '@/components/Printables'

export const metadata: Metadata = { title: '가격표', robots: { index: false, follow: true } }

export default function Page() {
  return (
    <PrintFrame lang="ko" back="/ko/">
      <PriceSheet lang="ko" />
    </PrintFrame>
  )
}
