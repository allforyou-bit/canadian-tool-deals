import { ToolPrice } from '../types'

const STORE = 'Amazon Canada'
const STORE_LOGO = 'amazon'
const AFFILIATE_TAG = 'canadiantool-20'

export async function scrapeAmazonCA(query: string): Promise<ToolPrice[]> {
  const searchUrl = `https://www.amazon.ca/s?k=${encodeURIComponent(query)}&i=tools`

  try {
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-CA,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
      },
      next: { revalidate: 3600 },
    })

    if (!res.ok) return amazonFallback(query)

    const html = await res.text()

    // Check for bot block
    if (html.includes('robot') && html.includes('captcha')) return amazonFallback(query)

    const results: ToolPrice[] = []

    // Amazon structured price pattern: data-asin + price-whole
    const asinBlocks = [...html.matchAll(/data-asin="([A-Z0-9]{10})"([\s\S]{0,3000}?)"a-price-whole">(\d[\d,]*)<\/span>/g)]

    for (const block of asinBlocks.slice(0, 5)) {
      const asin = block[1]
      const context = block[2]
      const priceStr = block[3].replace(/,/g, '')
      const price = parseFloat(priceStr)

      if (!asin || price <= 0) continue

      // Try to extract fraction
      const fractionMatch = context.match(/"a-price-fraction">(\d+)<\/span>/)
      const fullPrice = fractionMatch ? price + parseFloat(`0.${fractionMatch[1]}`) : price

      // Try to extract name
      const nameMatch = context.match(/alt="([^"]{10,150})"/)
      const name = nameMatch?.[1] ?? query

      // Extract image
      const imgMatch = context.match(/src="(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+)"/)
      const image = imgMatch?.[1]

      results.push({
        store: STORE,
        storeLogo: STORE_LOGO,
        price: fullPrice,
        inStock: true,
        url: `https://www.amazon.ca/dp/${asin}?tag=${AFFILIATE_TAG}`,
        name,
        image,
        lastUpdated: new Date().toISOString(),
      })
    }

    return results.length > 0 ? results : amazonFallback(query)

  } catch {
    return amazonFallback(query)
  }
}

function amazonFallback(query: string): ToolPrice[] {
  return [{
    store: 'Amazon Canada',
    storeLogo: 'amazon',
    price: 0,
    inStock: true,
    url: `https://www.amazon.ca/s?k=${encodeURIComponent(query)}&i=tools&tag=canadiantool-20`,
    name: `Search "${query}" on Amazon Canada`,
    checkManually: true,
    lastUpdated: new Date().toISOString(),
  }]
}
