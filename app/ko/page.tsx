import type { Metadata } from 'next'
import HomePage from '@/components/HomePage'
import { business } from '@/config/business'

export const metadata: Metadata = {
  title: { absolute: `${business.brand.ko} — ${business.cityName.ko} 집 청소` },
  description: `${business.cityName.ko} 일반 청소·딥클린·입주·이사 청소 예상 견적을 바로 확인하세요. 대표가 직접 운영하며 한국어로 상담해 드려요.`,
  alternates: { canonical: '/ko/', languages: { en: '/', ko: '/ko/', 'x-default': '/' } },
}

export default function Page() {
  return <HomePage lang="ko" />
}
