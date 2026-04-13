import { ToolPrice } from '../types'

const STORE = 'Canadian Tire'
const STORE_LOGO = 'canadiantire'

export async function scrapeCanadianTire(query: string): Promise<ToolPrice[]> {
  // Canadian Tire prices are JS-rendered — return a search link card
  // so users can click through and check prices directly
  return [{
    store: STORE,
    storeLogo: STORE_LOGO,
    price: 0,
    inStock: true,
    url: `https://www.canadiantire.ca/en/search-results.html?q=${encodeURIComponent(query)}`,
    name: `Search "${query}" on Canadian Tire`,
    checkManually: true,
    lastUpdated: new Date().toISOString(),
  }]
}
