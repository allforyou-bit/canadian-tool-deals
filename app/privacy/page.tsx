import type { Metadata } from 'next'
import PrivacyPage from '@/components/PrivacyPage'

export const metadata: Metadata = {
  title: 'Privacy notice',
  alternates: { canonical: '/privacy/', languages: { en: '/privacy/', ko: '/ko/privacy/', 'x-default': '/privacy/' } },
}

export default function Page() {
  return <PrivacyPage lang="en" />
}
