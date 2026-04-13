import { ToolPrice } from '../types'

const STORE = 'Walmart Canada'
const STORE_LOGO = 'walmart'

export async function scrapeWalmartCA(query: string): Promise<ToolPrice[]> {
  const url = `https://www.walmart.ca/search?q=${encodeURIComponent(query)}&c=0`

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-CA,en;q=0.9',
      },
      next: { revalidate: 3600 },
    })

    if (!res.ok) return []

    const html = await res.text()

    // Extract prices, names, urls from embedded JSON
    const prices = [...html.matchAll(/"price":(\d+\.?\d*)/g)].map(m => parseFloat(m[1])).filter(p => p > 5 && p < 10000)
    const names = [...html.matchAll(/"name":"([^"]{15,120})"/g)].map(m => m[1])
    const urls = [...html.matchAll(/"canonicalUrl":"(\/[^"]+)"/g)].map(m => m[1])
    const images = [...html.matchAll(/"thumbnailUrl":"([^"]+)"/g)].map(m => m[1])
    const wasPrices = [...html.matchAll(/"wasPrice":\{"price":(\d+\.?\d*)/g)].map(m => parseFloat(m[1]))

    const results: ToolPrice[] = []
    for (let i = 0; i < Math.min(prices.length, 5); i++) {
      const price = prices[i]
      const originalPrice = wasPrices[i]
      const discount = originalPrice && originalPrice > price
        ? Math.round(((originalPrice - price) / originalPrice) * 100)
        : undefined

      results.push({
        store: STORE,
        storeLogo: STORE_LOGO,
        price,
        originalPrice,
        discount,
        inStock: true,
        url: urls[i] ? `https://www.walmart.ca${urls[i]}` : `https://www.walmart.ca/search?q=${encodeURIComponent(query)}`,
        name: names[i] ?? query,
        image: images[i],
        lastUpdated: new Date().toISOString(),
      })
    }

    return results

  } catch {
    return []
  }
}
