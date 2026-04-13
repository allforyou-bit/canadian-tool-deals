import { ToolPrice } from '../types'

const STORE = 'Canadian Tire'
const STORE_LOGO = '/logos/canadiantire.svg'

export async function scrapeCanadianTire(query: string): Promise<ToolPrice[]> {
  const url = `https://api.canadiantire.ca/search/api/v0/product/en/?q=${encodeURIComponent(query)}&store=0144&lang=en&site=ct&format=json&radius=100&marketingContentFlag=false&sortby=relevance&numItems=5&fromPos=0`

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-CA',
        'Referer': 'https://www.canadiantire.ca/',
        'Origin': 'https://www.canadiantire.ca',
      },
      next: { revalidate: 3600 },
    })

    if (!res.ok) return []

    const data = await res.json()
    const items = data?.products ?? []

    return items.slice(0, 5).map((item: any) => {
      const price = item?.Price ?? 0
      const originalPrice = item?.WasPrice
      const discount = originalPrice && price && originalPrice > price
        ? Math.round(((originalPrice - price) / originalPrice) * 100)
        : undefined

      const code = item?.Sku ?? item?.Code ?? ''

      return {
        store: STORE,
        storeLogo: STORE_LOGO,
        price,
        originalPrice,
        discount,
        inStock: item?.OnlineSellable !== false,
        url: `https://www.canadiantire.ca/en/${code}.html`,
        lastUpdated: new Date().toISOString(),
      } satisfies ToolPrice
    }).filter((p: ToolPrice) => p.price > 0)

  } catch {
    return []
  }
}
