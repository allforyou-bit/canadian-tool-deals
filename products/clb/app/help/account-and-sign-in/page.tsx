// /help/account-and-sign-in/ (copy: content/help.ts).
import type { Metadata } from 'next'
import { DocArticle } from '@/components/content/DocArticle'
import { HELP_ACCOUNT } from '@/content/help'
import { pageMetadata } from '@/content/seo'

export const metadata: Metadata = pageMetadata(HELP_ACCOUNT)

export default function AccountAndSignInPage() {
  return <DocArticle page={HELP_ACCOUNT} />
}
