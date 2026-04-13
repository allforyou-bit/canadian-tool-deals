import { scrapeWalmartCA } from './scrapers/walmart'
import { scrapeHomeDepotCA } from './scrapers/homedepot'
import { scrapeAmazonCA } from './scrapers/amazon'
import { scrapeCanadianTire } from './scrapers/canadiantire'
import { scrapeRONA } from './scrapers/rona'
import { scrapePrincessAuto } from './scrapers/princessauto'
import { ToolPrice, SearchResponse } from './types'

export async function searchAllStores(query: string): Promise<SearchResponse> {
  const [walmart, homedepot, amazon, canadiantire, rona, princessauto] = await Promise.allSettled([
    scrapeWalmartCA(query),
    scrapeHomeDepotCA(query),
    scrapeAmazonCA(query),
    scrapeCanadianTire(query),
    scrapeRONA(query),
    scrapePrincessAuto(query),
  ])

  // Take best result (lowest price) per store
  const allPrices: ToolPrice[] = [
    ...(walmart.status === 'fulfilled' ? walmart.value.slice(0, 1) : []),
    ...(homedepot.status === 'fulfilled' ? homedepot.value.slice(0, 1) : []),
    ...(amazon.status === 'fulfilled' ? amazon.value.slice(0, 1) : []),
    ...(canadiantire.status === 'fulfilled' ? canadiantire.value.slice(0, 1) : []),
    ...(rona.status === 'fulfilled' ? rona.value.slice(0, 1) : []),
    ...(princessauto.status === 'fulfilled' ? princessauto.value.slice(0, 1) : []),
  ]

  // Sort: real prices first (lowest to highest), then manual-check links
  const sorted = allPrices.sort((a, b) => {
    if (a.checkManually && !b.checkManually) return 1
    if (!a.checkManually && b.checkManually) return -1
    return a.price - b.price
  })

  return {
    query,
    prices: sorted,
    fetchedAt: new Date().toISOString(),
  }
}
