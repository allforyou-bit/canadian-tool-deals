import { ToolPrice } from '../types'

const STORE = 'Walmart Canada'
const STORE_LOGO = '/logos/walmart.svg'

export async function scrapeWalmartCA(query: string): Promise<ToolPrice[]> {
  const url = `https://www.walmart.ca/api/product-page/search-by-url?url=/search&experience=whiteGTA&q=${encodeURIComponent(query)}&c=0`

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-CA',
      },
      next: { revalidate: 3600 },
    })

    if (!res.ok) return []

    const data = await res.json()
    const items = data?.items?.[0]?.tempo?.content?.shelfResponseDetails?.shelfData?.items ?? []

    return items.slice(0, 5).map((item: any) => {
      const price = item?.priceInfo?.currentPrice?.price ?? 0
      const originalPrice = item?.priceInfo?.wasPrice?.price
      const discount = originalPrice && price
        ? Math.round(((originalPrice - price) / originalPrice) * 100)
        : undefined

      return {
        store: STORE,
        storeLogo: STORE_LOGO,
        price,
        originalPrice,
        discount,
        inStock: item?.availabilityStatus !== 'OUT_OF_STOCK',
        url: `https://www.walmart.ca${item?.productUrl ?? ''}`,
        lastUpdated: new Date().toISOString(),
      } satisfies ToolPrice
    }).filter((p: ToolPrice) => p.price > 0)

  } catch {
    return []
  }
}
