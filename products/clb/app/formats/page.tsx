// /formats/ — overview of the 10 practice task types (copy: content/formats.ts).
import type { Metadata } from 'next'
import { DocArticle } from '@/components/content/DocArticle'
import { FORMATS_INDEX } from '@/content/formats'
import { pageMetadata } from '@/content/seo'

export const metadata: Metadata = pageMetadata(FORMATS_INDEX)

export default function FormatsPage() {
  return <DocArticle page={FORMATS_INDEX} />
}
