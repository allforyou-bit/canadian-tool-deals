// /formats/speaking/ — the speaking task types in detail (copy: content/formats.ts).
import type { Metadata } from 'next'
import { DocArticle } from '@/components/content/DocArticle'
import { FormatTasks } from '@/components/content/FormatTasks'
import { FORMATS_SPEAKING } from '@/content/formats'
import { pageMetadata } from '@/content/seo'

export const metadata: Metadata = pageMetadata(FORMATS_SPEAKING.page)

export default function SpeakingFormatsPage() {
  return (
    <DocArticle page={FORMATS_SPEAKING.page}>
      <FormatTasks tasks={FORMATS_SPEAKING.tasks} />
    </DocArticle>
  )
}
