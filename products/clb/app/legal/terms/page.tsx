// /legal/terms/ — draft; the page carries an HTML comment saying it must be reviewed before launch
// (copy: content/legal/terms.ts).
import type { Metadata } from 'next'
import { DocArticle } from '@/components/content/DocArticle'
import { TERMS } from '@/content/legal'
import { pageMetadata } from '@/content/seo'

export const metadata: Metadata = pageMetadata(TERMS)

export default function TermsPage() {
  return <DocArticle page={TERMS} draftComment={TERMS.draftComment} />
}
