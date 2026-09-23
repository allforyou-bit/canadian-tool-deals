import { MetadataRoute } from 'next'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://canadian-tool-deals.vercel.app'
  const indexPath = join(process.cwd(), 'public', 'cache', 'index.json')

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
  ]

  if (!existsSync(indexPath)) return staticRoutes

  try {
    const index = JSON.parse(readFileSync(indexPath, 'utf-8'))
    const queryRoutes: MetadataRoute.Sitemap = index.map((entry: { query: string; fetchedAt?: string }) => ({
      url: `${base}/?q=${encodeURIComponent(entry.query)}`,
      lastModified: entry.fetchedAt ? new Date(entry.fetchedAt) : new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    }))
    return [...staticRoutes, ...queryRoutes]
  } catch {
    return staticRoutes
  }
}
