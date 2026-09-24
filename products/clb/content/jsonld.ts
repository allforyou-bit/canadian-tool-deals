// Structured data (schema.org JSON-LD) for the content pages. Rendered with components/content/JsonLd.tsx,
// which escapes "<" as the Next.js JSON-LD guide recommends
// (node_modules/next/dist/docs/01-app/02-guides/json-ld.md).
import type { Lang } from '../shared/api'
import { BRAND, SKUS } from '../shared/config'
import { LANDING } from './landing'
import { PRICING } from './pricing'
import { PATHS } from './routes'
import { absoluteUrl, SKU_ORDER } from './site'
import type { FaqItem } from './types'

export type JsonLdObject = Record<string, unknown>

/** Strip the inline markup used in content strings: [label](href) → label, **x** → x. */
export function plainText(rich: string): string {
  return rich.replace(/\[([^\]]+)\]\([^)\s]+\)/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1')
}

export function websiteJsonLd(lang: Lang): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: BRAND[lang],
    url: absoluteUrl(lang === 'ko' ? PATHS.homeKo : PATHS.home),
    inLanguage: lang,
    description: LANDING[lang].meta.description,
  }
}

/** One Product with an Offer per pass, priced in CAD from shared/config.ts SKUS. */
export function productJsonLd(lang: Lang): JsonLdObject {
  const copy = PRICING[lang]
  const url = absoluteUrl(copy.path)
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: copy.product.name,
    description: copy.product.description,
    brand: { '@type': 'Brand', name: BRAND[lang] },
    url,
    offers: SKU_ORDER.map((sku) => ({
      '@type': 'Offer',
      name: SKUS[sku][lang],
      price: (SKUS[sku].priceCents / 100).toFixed(2),
      priceCurrency: 'CAD',
      url,
      eligibleRegion: { '@type': 'Country', name: 'CA' },
    })),
  }
}

export function faqJsonLd(items: FaqItem[], lang: Lang): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    inLanguage: lang,
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: plainText(item.a) },
    })),
  }
}

/** JSON for a <script type="application/ld+json">, with "<" escaped so the payload cannot close the tag. */
export function serializeJsonLd(data: JsonLdObject): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
