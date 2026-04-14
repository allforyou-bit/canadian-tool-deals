export interface ToolPrice {
  store: string
  storeLogo: string
  price: number
  originalPrice?: number
  discount?: number
  inStock: boolean
  url: string
  name?: string
  image?: string
  checkManually?: boolean
  notCarried?: boolean
  lastUpdated: string
}

export interface SearchResponse {
  query: string
  brand?: string | null
  cached?: boolean
  prices: ToolPrice[]
  fetchedAt: string
  source?: string
}
