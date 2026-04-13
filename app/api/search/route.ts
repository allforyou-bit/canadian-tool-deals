import { NextRequest, NextResponse } from 'next/server'
import { searchAllStores } from '@/lib/search'

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q')?.trim()

  if (!query || query.length < 2) {
    return NextResponse.json({ error: 'Query too short' }, { status: 400 })
  }

  try {
    const results = await searchAllStores(query)
    return NextResponse.json({ query, results, fetchedAt: new Date().toISOString() })
  } catch (err) {
    console.error('Search error:', err)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
