/**
 * Scraper script — runs via GitHub Actions daily
 * Saves results to public/cache/[slug].json
 * Vercel serves these static JSON files with no timeout issues
 */
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CACHE_DIR = join(__dirname, '../public/cache')
mkdirSync(CACHE_DIR, { recursive: true })

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-CA,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
}

const POPULAR_QUERIES = [
  'Milwaukee M18 drill',
  'DeWalt 20V circular saw',
  'Makita impact driver',
  'RIDGID shop vac',
  'Milwaukee Packout',
  'DeWalt table saw',
  'Bosch laser level',
  'Milwaukee M12',
  'DeWalt cordless drill',
  'Makita cordless',
  'Milwaukee grinder',
  'DeWalt jigsaw',
  'RIDGID pipe wrench',
  'Klein tools',
  'Fluke multimeter',
]

async function fetchWithTimeout(url, opts = {}, timeoutMs = 15000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal })
    clearTimeout(timer)
    return res
  } catch (e) {
    clearTimeout(timer)
    throw e
  }
}

async function scrapeWalmart(query) {
  try {
    const url = `https://www.walmart.ca/search?q=${encodeURIComponent(query)}&c=0`
    const res = await fetchWithTimeout(url, { headers: HEADERS })
    if (!res.ok) return []
    const html = await res.text()
    const prices = [...html.matchAll(/"price":(\d+\.?\d*)/g)].map(m => parseFloat(m[1])).filter(p => p > 5 && p < 10000)
    // Extract product names specifically (name field followed by checkStoreAvailabilityATC or brand)
    const productNameRegex = /"name":"([^"]{10,150})","checkStoreAvailabilityATC"/g
    const names = [...html.matchAll(productNameRegex)].map(m => m[1].replace(/\\u0026/g, '&').replace(/\\"/g, '"'))
    const urls = [...html.matchAll(/"canonicalUrl":"(\/en\/ip\/[^"]+)"/g)].map(m => m[1])
    const wasPrices = [...html.matchAll(/"wasPrice":\{"price":(\d+\.?\d*)/g)].map(m => parseFloat(m[1]))
    const images = [...html.matchAll(/"thumbnailUrl":"(https:\/\/i5\.walmartimages\.com\/[^"]+)"/g)].map(m => m[1])
    return prices.slice(0, 3).map((price, i) => ({
      store: 'Walmart Canada', storeLogo: 'walmart', price,
      originalPrice: wasPrices[i],
      discount: wasPrices[i] && wasPrices[i] > price ? Math.round(((wasPrices[i] - price) / wasPrices[i]) * 100) : undefined,
      inStock: true,
      url: urls[i] ? `https://www.walmart.ca${urls[i]}` : `https://www.walmart.ca/search?q=${encodeURIComponent(query)}`,
      name: names[i] ?? query,
      image: images[i],
      lastUpdated: new Date().toISOString(),
    }))
  } catch { return [] }
}

async function scrapeHomeDepot(query) {
  try {
    const url = `https://www.homedepot.ca/search?q=${encodeURIComponent(query)}`
    const res = await fetchWithTimeout(url, { headers: { ...HEADERS, 'Referer': 'https://www.google.ca/' } })
    if (!res.ok) return []
    const html = await res.text()
    const results = []

    // Try JSON-LD first
    for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      try {
        const d = JSON.parse(m[1])
        const items = Array.isArray(d) ? d : [d]
        for (const item of items) {
          if (item['@type'] !== 'Product') continue
          const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers
          const price = parseFloat(offer?.price ?? '0')
          if (price > 5) results.push({
            store: 'Home Depot Canada', storeLogo: 'homedepot', price, inStock: true,
            url: item.url ?? `https://www.homedepot.ca/search?q=${encodeURIComponent(query)}`,
            name: item.name ?? query, image: Array.isArray(item.image) ? item.image[0] : item.image,
            lastUpdated: new Date().toISOString(),
          })
        }
      } catch {}
      if (results.length >= 3) break
    }
    if (results.length > 0) return results

    // Fallback: look for price patterns in embedded JS
    const priceMatches = [...html.matchAll(/"regularPrice":(\d+\.?\d*)/g)].map(m => parseFloat(m[1])).filter(p => p > 5 && p < 10000)
    const nameMatches = [...html.matchAll(/"productLabel":"([^"]{10,120})"/g)].map(m => m[1])
    const urlMatches = [...html.matchAll(/"canonicalUrl":"(\/[^"]+)"/g)].map(m => m[1])
    if (priceMatches.length > 0) {
      return priceMatches.slice(0,3).map((price, i) => ({
        store: 'Home Depot Canada', storeLogo: 'homedepot', price, inStock: true,
        url: urlMatches[i] ? `https://www.homedepot.ca${urlMatches[i]}` : `https://www.homedepot.ca/search?q=${encodeURIComponent(query)}`,
        name: nameMatches[i] ?? query,
        lastUpdated: new Date().toISOString(),
      }))
    }
    return []
  } catch { return [] }
}

async function scrapeRONA(query) {
  try {
    const url = `https://www.rona.ca/en/search?q=${encodeURIComponent(query)}&sz=5`
    const res = await fetchWithTimeout(url, { headers: HEADERS })
    if (!res.ok) return []
    const html = await res.text()
    const results = []
    for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      try {
        const d = JSON.parse(m[1])
        const items = Array.isArray(d) ? d : [d]
        for (const item of items) {
          if (item['@type'] !== 'Product') continue
          const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers
          const price = parseFloat(offer?.price ?? '0')
          if (price > 5) results.push({
            store: 'RONA', storeLogo: 'rona', price, inStock: true,
            url: item.url ?? `https://www.rona.ca/en/search?q=${encodeURIComponent(query)}`,
            name: item.name ?? query, image: item.image?.[0] ?? item.image,
            lastUpdated: new Date().toISOString(),
          })
        }
      } catch {}
      if (results.length >= 3) break
    }
    return results
  } catch { return [] }
}

function storeSearchFallback(store, storeLogo, query, url) {
  return [{
    store, storeLogo, price: 0, inStock: true,
    url, name: `Search "${query}" on ${store}`,
    checkManually: true, lastUpdated: new Date().toISOString(),
  }]
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

async function scrapeQuery(query) {
  console.log(`\nScraping: "${query}"`)
  const [walmart, homedepot, rona] = await Promise.allSettled([
    scrapeWalmart(query),
    scrapeHomeDepot(query),
    scrapeRONA(query),
  ])

  const prices = [
    ...(walmart.status === 'fulfilled' && walmart.value.length ? walmart.value.slice(0,1) : storeSearchFallback('Walmart Canada', 'walmart', query, `https://www.walmart.ca/search?q=${encodeURIComponent(query)}`)),
    ...(homedepot.status === 'fulfilled' && homedepot.value.length ? homedepot.value.slice(0,1) : storeSearchFallback('Home Depot Canada', 'homedepot', query, `https://www.homedepot.ca/search?q=${encodeURIComponent(query)}`)),
    ...storeSearchFallback('Amazon Canada', 'amazon', query, `https://www.amazon.ca/s?k=${encodeURIComponent(query)}&i=tools&tag=canadiantool-20`),
    ...storeSearchFallback('Canadian Tire', 'canadiantire', query, `https://www.canadiantire.ca/en/search-results.html?q=${encodeURIComponent(query)}`),
    ...(rona.status === 'fulfilled' && rona.value.length ? rona.value.slice(0,1) : storeSearchFallback('RONA', 'rona', query, `https://www.rona.ca/en/search?q=${encodeURIComponent(query)}`)),
    ...storeSearchFallback('Princess Auto', 'princessauto', query, `https://www.princessauto.com/en/search#q=${encodeURIComponent(query)}`),
  ]

  const realPrices = prices.filter(p => !p.checkManually)
  const manualPrices = prices.filter(p => p.checkManually)
  realPrices.sort((a, b) => a.price - b.price)

  const result = { query, prices: [...realPrices, ...manualPrices], fetchedAt: new Date().toISOString() }

  const slug = slugify(query)
  writeFileSync(join(CACHE_DIR, `${slug}.json`), JSON.stringify(result, null, 2))
  console.log(`  ✓ Saved ${slug}.json — ${realPrices.length} live prices, ${manualPrices.length} manual`)
  return result
}

// Build index of all cached queries
async function buildIndex(results) {
  const index = results.map(r => ({
    query: r.query,
    slug: slugify(r.query),
    lowestPrice: r.prices.filter(p => !p.checkManually)[0]?.price ?? null,
    lowestStore: r.prices.filter(p => !p.checkManually)[0]?.store ?? null,
    priceCount: r.prices.filter(p => !p.checkManually).length,
    fetchedAt: r.fetchedAt,
  }))
  writeFileSync(join(CACHE_DIR, 'index.json'), JSON.stringify(index, null, 2))
  console.log('\n✓ index.json saved')
}

async function main() {
  console.log('Starting scrape...')
  const results = []
  for (const q of POPULAR_QUERIES) {
    try {
      const r = await scrapeQuery(q)
      results.push(r)
      // Small delay between requests
      await new Promise(r => setTimeout(r, 1500))
    } catch (e) {
      console.error(`  ✗ Failed: ${e.message}`)
    }
  }
  await buildIndex(results)
  console.log('\nDone.')
}

main()
