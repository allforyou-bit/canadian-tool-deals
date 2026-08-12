import type { Metadata, Viewport } from 'next'
import { BudgetNav } from './BudgetNav'

export const metadata: Metadata = {
  title: '가계부',
  description: '문자 붙여넣기와 카드 명세서 CSV로 자동 정리되는 가계부. 데이터는 내 휴대폰에만 저장됩니다.',
  robots: { index: false, follow: false },
  manifest: '/budget.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: '가계부' },
  icons: { icon: '/budget-icon.svg', apple: '/budget-icon.svg' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#ffffff',
}

export default function BudgetLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-gray-50">
      <main className="mx-auto w-full max-w-xl px-4 pt-5 pb-28">{children}</main>
      <BudgetNav />
    </div>
  )
}
