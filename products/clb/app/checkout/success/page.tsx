import type { Metadata } from 'next'
import { SuccessClient } from './SuccessClient'

export const metadata: Metadata = {
  title: 'Thank you',
  robots: { index: false, follow: false },
}

export default function CheckoutSuccessPage() {
  return (
    <div className="mx-auto max-w-lg">
      <SuccessClient />
    </div>
  )
}
