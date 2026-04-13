import { NextRequest, NextResponse } from 'next/server'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

export const runtime = 'nodejs'

function slugify(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function storeFallback(store: string, logo: string, query: string, url: string) {
  return { store, storeLogo: logo, price: 0, inStock: true, url, name: `Search "${query}" on ${store}`, checkManually: true, lastUpdated: new Date().toISOString() }
}

function buildFallbackResponse(query: string) {
  const q = encodeURIComponent(query)
  return {
    query,
    cached: false,
    prices: [
      storeFallback('Walmart Canada', 'walmart', query, `https://www.walmart.ca/search?q=${q}`),
      storeFallback('Home Depot Canada', 'homedepot', query, `https://www.homedepot.ca/search?q=${q}`),
      storeFallback('Amazon Canada', 'amazon', query, `https://www.amazon.ca/s?k=${q}&i=tools&tag=canadiantool-20`),
      storeFallback('Canadian Tire', 'canadiantire', query, `https://www.canadiantire.ca/en/search-results.html?q=${q}`),
      storeFallback('RONA', 'rona', query, `https://www.rona.ca/en/search?q=${q}`),
      storeFallback('Princess Auto', 'princessauto', query, `https://www.princessauto.com/en/search#q=${q}`),
    ],
    fetchedAt: new Date().toISOString(),
  }
}

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q')?.trim()
  if (!query || query.length < 2) {
    return NextResponse.json({ error: 'Query too short' }, { status: 400 })
  }

  // Check cache first
  const slug = slugify(query)
  const cachePath = join(process.cwd(), 'public', 'cache', `${slug}.json`)

  if (existsSync(cachePath)) {
    try {
      const cached = JSON.parse(readFileSync(cachePath, 'utf-8'))
      return NextResponse.json({ ...cached, cached: true }, {
        headers: { 'Cache-Control': 'public, s-maxage=3600' }
      })
    } catch {}
  }

  // No cache — return search links immediately (no timeout risk)
  return NextResponse.json(buildFallbackResponse(query), {
    headers: { 'Cache-Control': 'public, s-maxage=300' }
  })
}
