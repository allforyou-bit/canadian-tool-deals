import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import AgreementView from '@/components/AgreementView'
import PrintFrame from '@/components/PrintFrame'
import { business } from '@/config/business'
import { AGREEMENTS } from '@/content/agreements'

// Publish an agreement only for a service that is switched on in config/business.ts
// (content/agreements.ts header; gutters need Gate G1, snow needs Gate S).
const ACTIVE = AGREEMENTS.filter((a) => business.services[a.service])

export const dynamicParams = false
export function generateStaticParams() {
  return ACTIVE.map((a) => ({ service: a.service }))
}

export async function generateMetadata({ params }: { params: Promise<{ service: string }> }): Promise<Metadata> {
  const { service } = await params
  const a = ACTIVE.find((x) => x.service === service)
  return {
    title: a ? { absolute: a.title.ko.replace('{BRAND}', business.brand.ko) } : '계약서',
    alternates: { canonical: '/ko/agreements/' + service + '/', languages: { en: '/agreements/' + service + '/', ko: '/ko/agreements/' + service + '/' } },
  }
}

export default async function Page({ params }: { params: Promise<{ service: string }> }) {
  const { service } = await params
  const agreement = ACTIVE.find((a) => a.service === service)
  if (!agreement) notFound()
  return (
    <PrintFrame lang="ko" back="/ko/">
      <AgreementView lang="ko" agreement={agreement} all={ACTIVE} />
    </PrintFrame>
  )
}
