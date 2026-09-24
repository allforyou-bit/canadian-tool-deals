// /legal/ai-disclosure/ — draft; the page carries an HTML comment saying it must be reviewed before launch
// (copy: content/legal/ai-disclosure.ts).
import type { Metadata } from 'next'
import { DocArticle } from '@/components/content/DocArticle'
import { AI_DISCLOSURE_PAGE } from '@/content/legal'
import { pageMetadata } from '@/content/seo'

export const metadata: Metadata = pageMetadata(AI_DISCLOSURE_PAGE)

export default function AiDisclosurePage() {
  return <DocArticle page={AI_DISCLOSURE_PAGE} draftComment={AI_DISCLOSURE_PAGE.draftComment} />
}
