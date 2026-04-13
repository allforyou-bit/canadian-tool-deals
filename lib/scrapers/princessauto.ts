import { ToolPrice } from '../types'

const STORE = 'Princess Auto'
const STORE_LOGO = '/logos/princessauto.svg'

export async function scrapePrincessAuto(query: string): Promise<ToolPrice[]> {
  const url = `https://www.princessauto.com/api/2/products?q=${encodeURIComponent(query)}&page=1&per_page=5&sort=relevance`

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-CA',
        'Referer': 'https://www.princessauto.com/',
      },
      next: { revalidate: 3600 },
    })

    if (!res.ok) return []

    const data = await res.json()
    const items = data?.products ?? data?.items ?? []

    return items.slice(0, 5).map((item: any) => {
      const price = item?.price ?? item?.salePrice ?? 0
      const originalPrice = item?.regularPrice ?? item?.compareAtPrice
      const discount = originalPrice && price && originalPrice > price
        ? Math.round(((originalPrice - price) / originalPrice) * 100)
        : undefined

      return {
        store: STORE,
        storeLogo: STORE_LOGO,
        price,
        originalPrice,
        discount,
        inStock: item?.available !== false,
        url: item?.url
          ? `https://www.princessauto.com${item.url}`
          : `https://www.princessauto.com/en/search#q=${encodeURIComponent(query)}`,
        lastUpdated: new Date().toISOString(),
      } satisfies ToolPrice
    }).filter((p: ToolPrice) => p.price > 0)

  } catch {
    return []
  }
}
