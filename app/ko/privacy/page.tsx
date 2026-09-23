import type { Metadata } from 'next'
import PrivacyPage from '@/components/PrivacyPage'

export const metadata: Metadata = {
  title: '개인정보 안내',
  alternates: { canonical: '/ko/privacy/', languages: { en: '/privacy/', ko: '/ko/privacy/' } },
}

export default function Page() {
  return <PrivacyPage lang="ko" />
}
