import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import AgreementView from '@/components/AgreementView'
import PrintFrame from '@/components/PrintFrame'
import { AGREEMENTS } from '@/content/agreements'

export const dynamicParams = false
export function generateStaticParams() {
  return AGREEMENTS.map((a) => ({ service: a.service }))
}

export async function generateMetadata({ params }: { params: Promise<{ service: string }> }): Promise<Metadata> {
  const { service } = await params
  const a = AGREEMENTS.find((x) => x.service === service)
  return {
    title: a ? a.title.en : 'Agreement',
    alternates: { canonical: '/agreements/' + service + '/', languages: { en: '/agreements/' + service + '/', ko: '/ko/agreements/' + service + '/' } },
  }
}

export default async function Page({ params }: { params: Promise<{ service: string }> }) {
  const { service } = await params
  const agreement = AGREEMENTS.find((a) => a.service === service)
  if (!agreement) notFound()
  return (
    <PrintFrame lang="en" back="/">
      <AgreementView lang="en" agreement={agreement} all={AGREEMENTS} />
    </PrintFrame>
  )
}
