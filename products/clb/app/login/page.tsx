import type { Metadata } from 'next'
import { LoginForm } from './LoginForm'

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in with your Google account. There is no new password to remember.',
  robots: { index: false, follow: true },
}

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-lg">
      <LoginForm />
    </div>
  )
}
