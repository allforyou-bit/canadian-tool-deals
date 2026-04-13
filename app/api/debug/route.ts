import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function GET(req: NextRequest) {
  const results: Record<string, any> = {}

  const stores = [
    { name: 'walmart', url: 'https://www.walmart.ca/search?q=milwaukee+drill&c=0' },
    { name: 'homedepot', url: 'https://www.homedepot.ca/search?q=milwaukee+drill' },
    { name: 'amazon', url: 'https://www.amazon.ca/s?k=milwaukee+drill&i=tools' },
    { name: 'rona', url: 'https://www.rona.ca/en/search?q=milwaukee+drill&sz=5' },
  ]

  for (const store of stores) {
    try {
      const res = await fetch(store.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-CA,en;q=0.9',
        },
      })
      const text = await res.text()
      const prices = [...text.matchAll(/"price":(\d+\.?\d*)/g)].map(m => parseFloat(m[1])).filter(p => p > 5 && p < 10000)
      results[store.name] = {
        status: res.status,
        bodyLen: text.length,
        prices: prices.slice(0, 3),
        blocked: text.includes('captcha') || text.includes('robot') || res.status === 403,
      }
    } catch (e: any) {
      results[store.name] = { error: e.message }
    }
  }

  return NextResponse.json(results)
}
