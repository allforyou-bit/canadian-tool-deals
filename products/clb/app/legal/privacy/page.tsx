// /legal/privacy/ — draft; the page carries an HTML comment saying it must be reviewed before launch
// (copy: content/legal/privacy.ts).
import type { Metadata } from 'next'
import { DocArticle } from '@/components/content/DocArticle'
import { PRIVACY } from '@/content/legal'
import { pageMetadata } from '@/content/seo'

export const metadata: Metadata = pageMetadata(PRIVACY)

export default function PrivacyPolicyPage() {
  return <DocArticle page={PRIVACY} draftComment={PRIVACY.draftComment} />
}
