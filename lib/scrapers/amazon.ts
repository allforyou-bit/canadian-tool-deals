import { ToolPrice } from '../types'

const STORE = 'Amazon Canada'
const STORE_LOGO = '/logos/amazon.svg'
const AFFILIATE_TAG = 'canadiantool-20'

export async function scrapeAmazonCA(query: string): Promise<ToolPrice[]> {
  const searchUrl = `https://www.amazon.ca/s?k=${encodeURIComponent(query)}&i=tools`

  try {
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-CA,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
      },
      next: { revalidate: 3600 },
    })

    if (!res.ok) return []

    const html = await res.text()

    // Parse price blocks from Amazon search HTML
    const results: ToolPrice[] = []
    const itemRegex = /data-asin="([A-Z0-9]{10})"[\s\S]*?<span class="a-price-whole">([0-9,]+)<\/span>[\s\S]*?class="a-size-medium a-color-base a-text-normal">([^<]+)<\/span>/g
    let match

    while ((match = itemRegex.exec(html)) !== null && results.length < 5) {
      const asin = match[1]
      const priceStr = match[2].replace(',', '')
      const name = match[3].trim()
      const price = parseFloat(priceStr)

      if (asin && price > 0) {
        results.push({
          store: STORE,
          storeLogo: STORE_LOGO,
          price,
          inStock: true,
          url: `https://www.amazon.ca/dp/${asin}?tag=${AFFILIATE_TAG}`,
          lastUpdated: new Date().toISOString(),
        })
      }
    }

    return results

  } catch {
    return []
  }
}
