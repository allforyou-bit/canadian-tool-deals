import type { Metadata } from 'next'
import QuotePage from '@/components/QuotePage'

export const metadata: Metadata = {
  title: 'Instant estimate',
  alternates: { canonical: '/quote/', languages: { en: '/quote/', ko: '/ko/quote/' } },
}

export default function Page() {
  return <QuotePage lang="en" />
}
