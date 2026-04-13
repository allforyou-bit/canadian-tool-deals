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
  lastUpdated: string
}

export interface SearchResponse {
  query: string
  prices: ToolPrice[]
  fetchedAt: string
}
