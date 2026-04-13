import { ToolPrice } from '../types'

const STORE = 'Home Depot Canada'
const STORE_LOGO = 'homedepot'

export async function scrapeHomeDepotCA(query: string): Promise<ToolPrice[]> {
  const url = `https://www.homedepot.ca/search?q=${encodeURIComponent(query)}`

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-CA,en;q=0.9',
        'Referer': 'https://www.homedepot.ca/',
      },
      next: { revalidate: 3600 },
    })

    if (!res.ok) return []

    const html = await res.text()

    // Home Depot embeds product data in JSON-LD or window.__STATE__
    const stateMatch = html.match(/window\.__STATE__\s*=\s*(\{[\s\S]+?\});?\s*<\/script>/)
    if (stateMatch) {
      try {
        const state = JSON.parse(stateMatch[1])
        const products = state?.search?.products ?? state?.products ?? []
        return products.slice(0, 5).map((item: any) => {
          const price = item?.pricing?.value ?? item?.price ?? 0
          const originalPrice = item?.pricing?.original
          const discount = originalPrice && price && originalPrice > price
            ? Math.round(((originalPrice - price) / originalPrice) * 100)
            : undefined
          return {
            store: STORE,
            storeLogo: STORE_LOGO,
            price,
            originalPrice,
            discount,
            inStock: item?.inventory?.status !== 'OUT_OF_STOCK',
            url: item?.url ? `https://www.homedepot.ca${item.url}` : `https://www.homedepot.ca/search?q=${encodeURIComponent(query)}`,
            name: item?.name ?? query,
            image: item?.images?.[0]?.url,
            lastUpdated: new Date().toISOString(),
          } satisfies ToolPrice
        }).filter((p: ToolPrice) => p.price > 0)
      } catch {
        // fall through to regex
      }
    }

    // Fallback: regex parse
    const prices = [...html.matchAll(/"value":(\d+\.?\d*)/g)].map(m => parseFloat(m[1])).filter(p => p > 5 && p < 10000)
    if (prices.length === 0) return []

    const names = [...html.matchAll(/"name":"([^"]{15,120})"/g)].map(m => m[1])

    return [{
      store: STORE,
      storeLogo: STORE_LOGO,
      price: prices[0],
      inStock: true,
      url: `https://www.homedepot.ca/search?q=${encodeURIComponent(query)}`,
      name: names[0] ?? query,
      lastUpdated: new Date().toISOString(),
    }]

  } catch {
    return []
  }
}
