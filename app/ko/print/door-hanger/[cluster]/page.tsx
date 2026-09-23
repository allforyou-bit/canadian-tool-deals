import type { Metadata } from 'next'
import PrintFrame from '@/components/PrintFrame'
import { DoorHangerSheet } from '@/components/Printables'
import { CLUSTERS, type Cluster } from '@/lib/site'

export const metadata: Metadata = { title: '문고리 전단', robots: { index: false, follow: false } }
export const dynamicParams = false
export function generateStaticParams() {
  return CLUSTERS.map((cluster) => ({ cluster }))
}

export default async function Page({ params }: { params: Promise<{ cluster: string }> }) {
  const { cluster } = await params
  return (
    <PrintFrame lang="ko" back="/ko/print/">
      <DoorHangerSheet lang="ko" cluster={cluster as Cluster} />
    </PrintFrame>
  )
}
