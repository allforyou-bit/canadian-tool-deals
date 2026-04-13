import { ToolPrice } from '../types'

const STORE = 'RONA'
const STORE_LOGO = 'rona'

export async function scrapeRONA(query: string): Promise<ToolPrice[]> {
  const url = `https://www.rona.ca/en/search?q=${encodeURIComponent(query)}&sz=5`

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-CA,en;q=0.9',
      },
      next: { revalidate: 3600 },
    })

    if (!res.ok) return ronaFallback(query)

    const html = await res.text()

    // RONA uses JSON-LD structured data
    const results: ToolPrice[] = []
    const jsonLdMatches = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]

    for (const match of jsonLdMatches) {
      if (results.length >= 5) break
      try {
        const data = JSON.parse(match[1])
        const items = Array.isArray(data) ? data : [data]
        for (const item of items) {
          if (item['@type'] !== 'Product') continue
          const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers
          if (!offer) continue
          const price = parseFloat(offer.price ?? '0')
          if (price <= 0) continue
          results.push({
            store: STORE,
            storeLogo: STORE_LOGO,
            price,
            inStock: offer.availability?.includes('InStock') ?? true,
            url: item.url ?? `https://www.rona.ca/en/search?q=${encodeURIComponent(query)}`,
            name: item.name ?? query,
            image: item.image?.[0] ?? item.image,
            lastUpdated: new Date().toISOString(),
          })
        }
      } catch {
        continue
      }
    }

    // Fallback: regex
    if (results.length === 0) {
      const prices = [...html.matchAll(/"price"\s*:\s*"(\d+\.?\d*)"/g)].map(m => parseFloat(m[1])).filter(p => p > 5 && p < 10000)
      const names = [...html.matchAll(/"name"\s*:\s*"([^"]{10,120})"/g)].map(m => m[1])
      if (prices.length > 0) {
        results.push({
          store: STORE,
          storeLogo: STORE_LOGO,
          price: prices[0],
          inStock: true,
          url: `https://www.rona.ca/en/search?q=${encodeURIComponent(query)}`,
          name: names[0] ?? query,
          lastUpdated: new Date().toISOString(),
        })
      }
    }

    return results.length > 0 ? results : ronaFallback(query)

  } catch {
    return ronaFallback(query)
  }
}

function ronaFallback(query: string): ToolPrice[] {
  return [{
    store: 'RONA',
    storeLogo: 'rona',
    price: 0,
    inStock: true,
    url: `https://www.rona.ca/en/search?q=${encodeURIComponent(query)}`,
    name: `Search "${query}" on RONA`,
    checkManually: true,
    lastUpdated: new Date().toISOString(),
  }]
}
