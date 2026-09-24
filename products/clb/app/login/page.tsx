import type { Metadata } from 'next'
import { LoginForm } from './LoginForm'

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in with a one-time email link. No password needed.',
  robots: { index: false, follow: true },
}

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-lg">
      <LoginForm />
    </div>
  )
}
