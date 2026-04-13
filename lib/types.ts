export interface ToolPrice {
  store: string
  storeLogo: string
  price: number
  originalPrice?: number
  discount?: number
  inStock: boolean
  url: string
  lastUpdated: string
}

export interface ToolResult {
  name: string
  brand: string
  image?: string
  prices: ToolPrice[]
  lowestPrice: number
  lowestStore: string
}

export interface SearchResult {
  query: string
  results: ToolResult[]
  fetchedAt: string
}
