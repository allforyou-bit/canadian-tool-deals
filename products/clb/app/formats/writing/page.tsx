// /formats/writing/ — the writing task types in detail (copy: content/formats.ts).
import type { Metadata } from 'next'
import { DocArticle } from '@/components/content/DocArticle'
import { FormatTasks } from '@/components/content/FormatTasks'
import { FORMATS_WRITING } from '@/content/formats'
import { pageMetadata } from '@/content/seo'

export const metadata: Metadata = pageMetadata(FORMATS_WRITING.page)

export default function WritingFormatsPage() {
  return (
    <DocArticle page={FORMATS_WRITING.page}>
      <FormatTasks tasks={FORMATS_WRITING.tasks} />
    </DocArticle>
  )
}
