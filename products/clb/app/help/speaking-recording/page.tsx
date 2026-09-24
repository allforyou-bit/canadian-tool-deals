// /help/speaking-recording/ (copy: content/help.ts).
import type { Metadata } from 'next'
import { DocArticle } from '@/components/content/DocArticle'
import { HELP_RECORDING } from '@/content/help'
import { pageMetadata } from '@/content/seo'

export const metadata: Metadata = pageMetadata(HELP_RECORDING)

export default function SpeakingRecordingPage() {
  return <DocArticle page={HELP_RECORDING} />
}
