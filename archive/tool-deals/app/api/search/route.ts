import { NextRequest, NextResponse } from 'next/server'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { getApplicableStores, ALL_STORES, STORE_NAMES, STORE_URLS } from '@/lib/brands'

export const runtime = 'nodejs'

function slugify(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function buildFallbackResponse(query: string) {
  const q = encodeURIComponent(query)
  const brandInfo = getApplicableStores(query)
  const applicable = brandInfo?.stores ?? ALL_STORES

  const prices = ALL_STORES.map(id => {
    const name = STORE_NAMES[id]
    const url = STORE_URLS[id](q)
    if (!applicable.includes(id)) {
      return { store: name, storeLogo: id, price: 0, inStock: false, url, name: `${brandInfo?.brand ? `${brandInfo.brand} not sold at ${name}` : 'Not available'}`, notCarried: true, lastUpdated: new Date().toISOString() }
    }
    return { store: name, storeLogo: id, price: 0, inStock: true, url, name: `Search "${query}" on ${name}`, checkManually: true, lastUpdated: new Date().toISOString() }
  })

  return { query, brand: brandInfo?.brand ?? null, cached: false, prices, fetchedAt: new Date().toISOString() }
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
