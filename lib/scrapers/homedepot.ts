import { ToolPrice } from '../types'

const STORE = 'Home Depot Canada'
const STORE_LOGO = '/logos/homedepot.svg'

export async function scrapeHomeDepotCA(query: string): Promise<ToolPrice[]> {
  const url = `https://www.homedepot.ca/api/productsSearch/v2?q=${encodeURIComponent(query)}&lang=en&storeId=7143&pageSize=5`

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-CA',
        'Referer': 'https://www.homedepot.ca/',
      },
      next: { revalidate: 3600 },
    })

    if (!res.ok) return []

    const data = await res.json()
    const products = data?.products ?? []

    return products.slice(0, 5).map((item: any) => {
      const price = item?.prices?.value ?? 0
      const originalPrice = item?.prices?.originalValue
      const discount = originalPrice && price && originalPrice > price
        ? Math.round(((originalPrice - price) / originalPrice) * 100)
        : undefined

      return {
        store: STORE,
        storeLogo: STORE_LOGO,
        price,
        originalPrice,
        discount,
        inStock: item?.inventory?.available !== false,
        url: `https://www.homedepot.ca${item?.url ?? ''}`,
        lastUpdated: new Date().toISOString(),
      } satisfies ToolPrice
    }).filter((p: ToolPrice) => p.price > 0)

  } catch {
    return []
  }
}
