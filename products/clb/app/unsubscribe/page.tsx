import type { Metadata } from 'next'
import { UnsubscribeClient } from './UnsubscribeClient'

export const metadata: Metadata = {
  title: 'Unsubscribe',
  description: 'Stop marketing emails. No sign-in needed.',
  robots: { index: false, follow: false },
}

export default function UnsubscribePage() {
  return (
    <div className="mx-auto max-w-lg">
      <UnsubscribeClient />
    </div>
  )
}
