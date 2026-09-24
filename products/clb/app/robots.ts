// /robots.txt, generated at build time (static: see the note in app/sitemap.ts). Only the API is excluded;
// account and checkout pages are left crawlable so any noindex meta on them can be seen.
import type { MetadataRoute } from 'next'
import { absoluteUrl } from '@/content/site'

export const dynamic = 'force-static'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: '/api/' },
    sitemap: absoluteUrl('/sitemap.xml'),
  }
}
