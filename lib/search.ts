import { scrapeWalmartCA } from './scrapers/walmart'
import { scrapeHomeDepotCA } from './scrapers/homedepot'
import { scrapeAmazonCA } from './scrapers/amazon'
import { scrapeCanadianTire } from './scrapers/canadiantire'
import { scrapeRONA } from './scrapers/rona'
import { scrapePrincessAuto } from './scrapers/princessauto'
import { ToolPrice, ToolResult } from './types'

export async function searchAllStores(query: string): Promise<ToolResult[]> {
  // Run all scrapers in parallel
  const [walmart, homedepot, amazon, canadiantire, rona, princessauto] = await Promise.allSettled([
    scrapeWalmartCA(query),
    scrapeHomeDepotCA(query),
    scrapeAmazonCA(query),
    scrapeCanadianTire(query),
    scrapeRONA(query),
    scrapePrincessAuto(query),
  ])

  // Collect all prices from all stores for the top result
  const allPrices: ToolPrice[] = [
    ...(walmart.status === 'fulfilled' ? walmart.value.slice(0, 1) : []),
    ...(homedepot.status === 'fulfilled' ? homedepot.value.slice(0, 1) : []),
    ...(amazon.status === 'fulfilled' ? amazon.value.slice(0, 1) : []),
    ...(canadiantire.status === 'fulfilled' ? canadiantire.value.slice(0, 1) : []),
    ...(rona.status === 'fulfilled' ? rona.value.slice(0, 1) : []),
    ...(princessauto.status === 'fulfilled' ? princessauto.value.slice(0, 1) : []),
  ].filter(p => p.price > 0)

  if (allPrices.length === 0) return []

  const sorted = [...allPrices].sort((a, b) => a.price - b.price)
  const lowestPrice = sorted[0].price
  const lowestStore = sorted[0].store

  // Group as a single tool result (search-based, not exact match)
  const result: ToolResult = {
    name: query,
    brand: '',
    prices: sorted,
    lowestPrice,
    lowestStore,
  }

  return [result]
}

export async function searchByStore(query: string) {
  const [walmart, homedepot, amazon, canadiantire, rona, princessauto] = await Promise.allSettled([
    scrapeWalmartCA(query),
    scrapeHomeDepotCA(query),
    scrapeAmazonCA(query),
    scrapeCanadianTire(query),
    scrapeRONA(query),
    scrapePrincessAuto(query),
  ])

  return {
    walmart: walmart.status === 'fulfilled' ? walmart.value : [],
    homedepot: homedepot.status === 'fulfilled' ? homedepot.value : [],
    amazon: amazon.status === 'fulfilled' ? amazon.value : [],
    canadiantire: canadiantire.status === 'fulfilled' ? canadiantire.value : [],
    rona: rona.status === 'fulfilled' ? rona.value : [],
    princessauto: princessauto.status === 'fulfilled' ? princessauto.value : [],
  }
}
