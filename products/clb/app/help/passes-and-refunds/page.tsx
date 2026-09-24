// /help/passes-and-refunds/ (copy: content/help.ts).
import type { Metadata } from 'next'
import { DocArticle } from '@/components/content/DocArticle'
import { HELP_PASSES } from '@/content/help'
import { pageMetadata } from '@/content/seo'

export const metadata: Metadata = pageMetadata(HELP_PASSES)

export default function PassesAndRefundsPage() {
  return <DocArticle page={HELP_PASSES} />
}
