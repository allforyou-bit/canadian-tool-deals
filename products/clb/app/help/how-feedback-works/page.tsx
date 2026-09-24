// /help/how-feedback-works/ (copy: content/help.ts).
import type { Metadata } from 'next'
import { DocArticle } from '@/components/content/DocArticle'
import { HELP_FEEDBACK } from '@/content/help'
import { pageMetadata } from '@/content/seo'

export const metadata: Metadata = pageMetadata(HELP_FEEDBACK)

export default function HowFeedbackWorksPage() {
  return <DocArticle page={HELP_FEEDBACK} />
}
