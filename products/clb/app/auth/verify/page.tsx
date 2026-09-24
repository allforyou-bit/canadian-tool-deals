import type { Metadata } from 'next'
import { VerifyClient } from './VerifyClient'

export const metadata: Metadata = {
  title: 'Signing in',
  robots: { index: false, follow: false },
}

export default function VerifyPage() {
  return (
    <div className="mx-auto max-w-lg">
      <VerifyClient />
    </div>
  )
}
