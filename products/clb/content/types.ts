// Shapes for the static product pages (landing, pricing, formats, help, legal). All visible copy lives in
// content/*.ts as plain strings so content.test.ts can lint every one of them with findClaims().
import type { Lang } from '../shared/api'

/**
 * A string that may contain two kinds of inline markup, rendered by components/content/Rich.tsx:
 *   [label](/path/)  → a link (internal paths use next/link; mailto: and https: use <a>)
 *   **text**         → bold
 */
export type Rich = string

export type Block =
  | Rich
  | { ul: Rich[] }
  | { ol: Rich[] }
  | { note: Rich; tone?: 'info' | 'warn' }
  | { dl: { term: Rich; detail: Rich }[] }

export interface DocSection {
  /** anchor id, e.g. "retention" → /legal/privacy/#retention */
  id: string
  heading: string
  blocks: Block[]
}

export interface DocLink {
  label: string
  href: string
}

/** A product-documentation or legal page (English only in this window). */
export interface DocPage {
  path: string
  lang: Lang
  /** <h1> and the first part of <title> */
  title: string
  /** meta description (the visible lead is `intro`) */
  description: string
  /** ISO date shown as "Last reviewed: …" (help/formats) or "Last updated: …" (legal) */
  lastReviewed: string
  lastReviewedLabel: 'Last reviewed' | 'Last updated'
  intro: Block[]
  sections: DocSection[]
  related?: DocLink[]
}

/** Legal pages also carry an owner-review note that is rendered only as an HTML comment. */
export interface LegalPage extends DocPage {
  draftComment: string
}

export interface FaqItem {
  q: string
  a: Rich
}

/** Small fixed labels used by the page components (kept here so the content lint covers them). */
export const DOC_LABELS = {
  onThisPage: 'On this page',
  related: 'Related pages',
} as const
