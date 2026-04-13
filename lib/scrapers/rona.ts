import { ToolPrice } from '../types'

const STORE = 'RONA'
const STORE_LOGO = '/logos/rona.svg'

export async function scrapeRONA(query: string): Promise<ToolPrice[]> {
  const url = `https://www.rona.ca/en/search?q=${encodeURIComponent(query)}&sz=5`

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-CA',
      },
      next: { revalidate: 3600 },
    })

    if (!res.ok) return []

    const html = await res.text()
    const results: ToolPrice[] = []

    // RONA uses structured data in JSON-LD
    const jsonLdRegex = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g
    let match

    while ((match = jsonLdRegex.exec(html)) !== null && results.length < 5) {
      try {
        const data = JSON.parse(match[1])
        if (data['@type'] === 'Product' && data.offers) {
          const offer = Array.isArray(data.offers) ? data.offers[0] : data.offers
          const price = parseFloat(offer?.price ?? '0')
          if (price > 0) {
            results.push({
              store: STORE,
              storeLogo: STORE_LOGO,
              price,
              inStock: offer?.availability?.includes('InStock') ?? true,
              url: data.url ?? `https://www.rona.ca/en/search?q=${encodeURIComponent(query)}`,
              lastUpdated: new Date().toISOString(),
            })
          }
        }
      } catch {
        // skip malformed JSON
      }
    }

    return results

  } catch {
    return []
  }
}
