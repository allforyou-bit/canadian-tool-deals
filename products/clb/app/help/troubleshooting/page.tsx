// /help/troubleshooting/ (copy: content/help.ts).
import type { Metadata } from 'next'
import { DocArticle } from '@/components/content/DocArticle'
import { HELP_TROUBLESHOOTING } from '@/content/help'
import { pageMetadata } from '@/content/seo'

export const metadata: Metadata = pageMetadata(HELP_TROUBLESHOOTING)

export default function TroubleshootingPage() {
  return <DocArticle page={HELP_TROUBLESHOOTING} />
}
