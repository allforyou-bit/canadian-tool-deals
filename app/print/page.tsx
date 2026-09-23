import type { Metadata } from 'next'
import PrintIndex from '@/components/PrintIndex'

export const metadata: Metadata = { title: 'Printables', robots: { index: false, follow: false } }

export default function Page() {
  return <PrintIndex lang="en" />
}
