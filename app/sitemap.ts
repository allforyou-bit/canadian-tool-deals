import type { MetadataRoute } from 'next'
import { business } from '@/config/business'

export const dynamic = 'force-static'

const PATHS = ['/', '/quote/', '/privacy/', '/agreements/cleaning/']

export default function sitemap(): MetadataRoute.Sitemap {
  const services = ['gutters', 'snow'].filter((s) => business.services[s as 'gutters' | 'snow']).map((s) => `/agreements/${s}/`)
  // One <url> per language version, each listing every alternate (itself included).
  return [...PATHS, ...services].flatMap((path) => {
    const languages = { en: `${business.siteUrl}${path}`, ko: `${business.siteUrl}/ko${path}` }
    return [
      { url: languages.en, alternates: { languages } },
      { url: languages.ko, alternates: { languages } },
    ]
  })
}
