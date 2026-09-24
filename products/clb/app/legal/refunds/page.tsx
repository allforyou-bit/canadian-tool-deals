// /legal/refunds/ — draft; the page carries an HTML comment saying it must be reviewed before launch
// (copy: content/legal/refunds.ts).
import type { Metadata } from 'next'
import { DocArticle } from '@/components/content/DocArticle'
import { REFUNDS } from '@/content/legal'
import { pageMetadata } from '@/content/seo'

export const metadata: Metadata = pageMetadata(REFUNDS)

export default function RefundPolicyPage() {
  return <DocArticle page={REFUNDS} draftComment={REFUNDS.draftComment} />
}
