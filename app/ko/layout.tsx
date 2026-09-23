import type { Metadata } from 'next'
import { business } from '@/config/business'

// Korean pages share the English root layout (one <html>), so this nested layout only swaps the
// title template and default description to Korean.
export const metadata: Metadata = {
  title: {
    default: `${business.brand.ko} — ${business.cityName.ko} 집 청소`,
    template: `%s | ${business.brand.ko}`,
  },
  description: `${business.cityName.ko} 일반 청소·딥클린·입주·이사 청소 예상 견적을 바로 확인하세요. 대표가 직접 운영하며 한국어로 상담해 드려요.`,
}

export default function KoLayout({ children }: { children: React.ReactNode }) {
  return children
}
