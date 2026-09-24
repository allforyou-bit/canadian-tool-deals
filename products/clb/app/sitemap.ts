// /sitemap.xml, generated at build time. With output: 'export' a metadata route must be static:
// `dynamic = 'force-static'` (next/dist/server/route-modules/app-route/module.js rejects it otherwise), the
// same pattern the repo-root site uses. Lists the content pages and the practice pages; EN/KO pairs carry
// hreflang alternates. /unsubscribe/ (frontend-app) is left out on purpose: it only works from the signed
// link in an email and is a noindex page, so it has no place in a sitemap.
import type { MetadataRoute } from 'next'
import { CONTENT_ROUTES, LANG_PAIRS, PRACTICE_ROUTES } from '@/content/routes'
import { absoluteUrl, LAST_REVIEWED } from '@/content/site'

export const dynamic = 'force-static'

export default function sitemap(): MetadataRoute.Sitemap {
  return [...CONTENT_ROUTES, ...PRACTICE_ROUTES].map((path) => {
    const pair = LANG_PAIRS.find((p) => p.en === path || p.ko === path)
    return {
      url: absoluteUrl(path),
      lastModified: LAST_REVIEWED,
      ...(pair ? { alternates: { languages: { en: absoluteUrl(pair.en), ko: absoluteUrl(pair.ko) } } } : {}),
    }
  })
}
