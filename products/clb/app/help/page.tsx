// /help/ — help centre index (copy: content/help.ts).
import type { Metadata } from 'next'
import { DocArticle } from '@/components/content/DocArticle'
import { HELP_INDEX } from '@/content/help'
import { pageMetadata } from '@/content/seo'

export const metadata: Metadata = pageMetadata(HELP_INDEX)

export default function HelpPage() {
  return <DocArticle page={HELP_INDEX} />
}
