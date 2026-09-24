// /legal/not-affiliated/ — draft; the page carries an HTML comment saying it must be reviewed before launch
// (copy: content/legal/not-affiliated.ts).
import type { Metadata } from 'next'
import { DocArticle } from '@/components/content/DocArticle'
import { NOT_AFFILIATED_PAGE } from '@/content/legal'
import { pageMetadata } from '@/content/seo'

export const metadata: Metadata = pageMetadata(NOT_AFFILIATED_PAGE)

export default function NotAffiliatedPage() {
  return <DocArticle page={NOT_AFFILIATED_PAGE} draftComment={NOT_AFFILIATED_PAGE.draftComment} />
}
