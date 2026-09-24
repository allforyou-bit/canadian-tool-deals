// /help/privacy-and-your-data/ (copy: content/help.ts).
import type { Metadata } from 'next'
import { DocArticle } from '@/components/content/DocArticle'
import { HELP_PRIVACY } from '@/content/help'
import { pageMetadata } from '@/content/seo'

export const metadata: Metadata = pageMetadata(HELP_PRIVACY)

export default function PrivacyAndYourDataPage() {
  return <DocArticle page={HELP_PRIVACY} />
}
