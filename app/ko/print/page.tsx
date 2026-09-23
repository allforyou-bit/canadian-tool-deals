import type { Metadata } from 'next'
import PrintIndex from '@/components/PrintIndex'

export const metadata: Metadata = { title: '인쇄물', robots: { index: false, follow: false } }

export default function Page() {
  return <PrintIndex lang="ko" />
}
