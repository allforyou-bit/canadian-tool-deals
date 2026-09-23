import type { Metadata } from 'next'
import QuotePage from '@/components/QuotePage'

export const metadata: Metadata = {
  title: '바로 견적',
  alternates: { canonical: '/ko/quote/', languages: { en: '/quote/', ko: '/ko/quote/', 'x-default': '/quote/' } },
}

export default function Page() {
  return <QuotePage lang="ko" />
}
