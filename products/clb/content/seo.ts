// Page metadata for the content pages (title, description, canonical, hreflang, Open Graph). URLs are
// absolute (content/site.ts SITE_URL), so the pages do not depend on a metadataBase in the root layout.
// Metadata fields: node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-metadata.md.
import type { Metadata } from 'next'
import type { Lang } from '../shared/api'
import { BRAND } from '../shared/config'
import { LANG_PAIRS } from './routes'
import { absoluteUrl } from './site'

export interface PageMetaInput {
  path: string
  title: string
  description: string
  lang?: Lang
  /** true for the landing pages, whose title already leads with the brand */
  brandFirst?: boolean
}

export function pageMetadata({ path, title, description, lang = 'en', brandFirst = false }: PageMetaInput): Metadata {
  const fullTitle = brandFirst ? title : `${title} | ${BRAND[lang]}`
  const url = absoluteUrl(path)
  const pair = LANG_PAIRS.find((p) => p.en === path || p.ko === path)
  return {
    // absolute: the root layout's title template (if any) must not add the brand a second time
    title: { absolute: fullTitle },
    description,
    alternates: {
      canonical: url,
      ...(pair
        ? { languages: { en: absoluteUrl(pair.en), ko: absoluteUrl(pair.ko), 'x-default': absoluteUrl(pair.en) } }
        : {}),
    },
    openGraph: {
      type: 'website',
      url,
      title: fullTitle,
      description,
      siteName: BRAND[lang],
      locale: lang === 'ko' ? 'ko_KR' : 'en_CA',
    },
  }
}
