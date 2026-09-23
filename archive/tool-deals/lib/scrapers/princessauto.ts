import { ToolPrice } from '../types'

const STORE = 'Princess Auto'
const STORE_LOGO = 'princessauto'

export async function scrapePrincessAuto(query: string): Promise<ToolPrice[]> {
  const url = `https://www.princessauto.com/en/search#q=${encodeURIComponent(query)}&t=All`

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-CA,en;q=0.9',
      },
      next: { revalidate: 3600 },
    })

    if (!res.ok) return princessFallback(query)

    const html = await res.text()

    // Try JSON-LD
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
          const price = parseFloat(offer?.price ?? '0')
          if (price <= 0) continue
          results.push({
            store: STORE,
            storeLogo: STORE_LOGO,
            price,
            inStock: offer?.availability?.includes('InStock') ?? true,
            url: item.url ?? `https://www.princessauto.com/en/search#q=${encodeURIComponent(query)}`,
            name: item.name ?? query,
            image: item.image?.[0] ?? item.image,
            lastUpdated: new Date().toISOString(),
          })
        }
      } catch {
        continue
      }
    }

    return results.length > 0 ? results : princessFallback(query)

  } catch {
    return princessFallback(query)
  }
}

function princessFallback(query: string): ToolPrice[] {
  return [{
    store: 'Princess Auto',
    storeLogo: 'princessauto',
    price: 0,
    inStock: true,
    url: `https://www.princessauto.com/en/search#q=${encodeURIComponent(query)}`,
    name: `Search "${query}" on Princess Auto`,
    checkManually: true,
    lastUpdated: new Date().toISOString(),
  }]
}
