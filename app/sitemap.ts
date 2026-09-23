import type { MetadataRoute } from 'next'
import { business } from '@/config/business'

export const dynamic = 'force-static'

const PATHS = ['/', '/quote/', '/privacy/', '/agreements/cleaning/']

export default function sitemap(): MetadataRoute.Sitemap {
  const services = ['gutters', 'snow'].filter((s) => business.services[s as 'gutters' | 'snow']).map((s) => `/agreements/${s}/`)
  return [...PATHS, ...services].map((path) => ({
    url: `${business.siteUrl}${path}`,
    alternates: { languages: { en: `${business.siteUrl}${path}`, ko: `${business.siteUrl}/ko${path}` } },
  }))
}
