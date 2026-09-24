'use client'

import Link from 'next/link'
import { useMe } from '../lib/hooks'
import { t } from '../lib/i18n'

/** "Account" when signed in, otherwise "Sign in" (the default while /api/me loads). */
export function AccountNavLink(props: { className?: string }) {
  const state = useMe()
  const signedIn = state.status === 'ready' && state.me.signedIn
  return signedIn ? (
    <Link href="/account/" className={props.className}>
      {t('en', 'nav.account')}
    </Link>
  ) : (
    <Link href="/login/" className={props.className}>
      {t('en', 'nav.signIn')}
    </Link>
  )
}
