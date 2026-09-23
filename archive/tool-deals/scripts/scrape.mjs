/**
 * Daily price scraper — runs via GitHub Actions
 * Applies brand-store exclusivity logic
 * Saves results to public/cache/[slug].json
 */
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CACHE_DIR = join(__dirname, '../public/cache')
mkdirSync(CACHE_DIR, { recursive: true })

// ── Brand-store map (must stay in sync with lib/brands.ts) ───────────────────
const BRAND_STORE_MAP = {
  'milwaukee':         ['homedepot', 'amazon'],
  'm18':               ['homedepot', 'amazon'],
  'm12':               ['homedepot', 'amazon'],
  'milwaukee packout': ['homedepot', 'amazon'],
  'milwaukee fuel':    ['homedepot', 'amazon'],
  'mx fuel':           ['homedepot'],
  'ryobi':             ['homedepot', 'amazon'],
  'ridgid':            ['homedepot', 'amazon'],
  'husky':             ['homedepot'],
  'husqvarna':         ['homedepot', 'amazon'],
  'klein':             ['homedepot', 'amazon'],
  'klein tools':       ['homedepot', 'amazon'],
  'ego':               ['homedepot', 'amazon'],
  'mastercraft':       ['canadiantire'],
  'maximum':           ['canadiantire'],
  'jobmate':           ['canadiantire'],
  'yardworks':         ['canadiantire'],
  'motomaster':        ['canadiantire'],
  'powerfist':         ['princessauto'],
  'dewalt':            ['homedepot', 'rona', 'amazon', 'walmart'],
  'makita':            ['homedepot', 'rona', 'amazon', 'canadiantire'],
  'bosch':             ['homedepot', 'rona', 'amazon'],
  'stanley':           ['canadiantire', 'walmart', 'amazon', 'rona'],
  'craftsman':         ['canadiantire', 'amazon', 'walmart'],
  'gearwrench':        ['amazon', 'rona', 'princessauto', 'canadiantire'],
  'lincoln':           ['princessauto', 'amazon', 'canadiantire'],
  'lincoln electric':  ['princessauto', 'amazon'],
  'black+decker':      ['walmart', 'amazon', 'canadiantire'],
  'black decker':      ['walmart', 'amazon', 'canadiantire'],
  'fluke':             ['amazon'],
  'worx':              ['amazon', 'walmart'],
  'irwin':             ['homedepot', 'amazon', 'rona', 'canadiantire'],
  'metabo':            ['amazon', 'rona'],
  'channellock':       ['amazon', 'canadiantire'],
  'knipex':            ['amazon', 'rona'],
  'wera':              ['amazon', 'rona'],
  'snap-on':           ['amazon'],
  'hart':              ['walmart'],
  'greenworks':        ['homedepot', 'amazon'],
  'dremel':            ['homedepot', 'amazon', 'canadiantire'],
  'leatherman':        ['amazon', 'canadiantire'],
}

const ALL_STORES = ['walmart', 'homedepot', 'amazon', 'canadiantire', 'rona', 'princessauto']

const STORE_NAMES = {
  walmart:      'Walmart Canada',
  homedepot:    'Home Depot Canada',
  amazon:       'Amazon Canada',
  canadiantire: 'Canadian Tire',
  rona:         'RONA',
  princessauto: 'Princess Auto',
}

const STORE_SEARCH_URLS = {
  walmart:      q => `https://www.walmart.ca/search?q=${encodeURIComponent(q)}`,
  homedepot:    q => `https://www.homedepot.ca/search?q=${encodeURIComponent(q)}`,
  amazon:       q => `https://www.amazon.ca/s?k=${encodeURIComponent(q)}&i=tools&tag=canadiantool-20`,
  canadiantire: q => `https://www.canadiantire.ca/en/search-results.html?q=${encodeURIComponent(q)}`,
  rona:         q => `https://www.rona.ca/en/search?q=${encodeURIComponent(q)}`,
  princessauto: q => `https://www.princessauto.com/en/search#q=${encodeURIComponent(q)}`,
}

function getApplicableStores(query) {
  const q = query.toLowerCase()
  const sorted = Object.entries(BRAND_STORE_MAP).sort((a, b) => b[0].length - a[0].length)
  for (const [brand, stores] of sorted) {
    if (q.includes(brand)) return { brand, stores }
  }
  return null
}

function isRelevant(productName, query, brand = null) {
  if (!productName) return false
  const name = productName.toLowerCase()
  // If brand is known, require it to appear in the product name (prevents wrong brand showing)
  if (brand && !name.includes(brand.toLowerCase())) return false
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2)
  return words.some(w => name.includes(w))
}

// ── HTTP helper ───────────────────────────────────────────────────────────────
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-CA,en;q=0.9',
}

async function fetchWithTimeout(url, opts = {}, ms = 15000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal })
    clearTimeout(t)
    return res
  } catch (e) { clearTimeout(t); throw e }
}

// ── Scrapers ──────────────────────────────────────────────────────────────────
async function scrapeWalmart(query, brand = null) {
  try {
    const res = await fetchWithTimeout(`https://www.walmart.ca/search?q=${encodeURIComponent(query)}&c=0`, { headers: HEADERS })
    if (!res.ok) return []
    const html = await res.text()
    const results = []
    // Find each name occurrence, then look at surrounding context for price/url/image
    for (const m of html.matchAll(/"name":"([^"]{10,150})","checkStoreAvailabilityATC"/g)) {
      const name = m[1].replace(/\\u0026/g, '&')
      if (!isRelevant(name, query, brand)) continue
      // Look at surrounding ~3000 chars before and 1000 chars after for the other fields
      const start = Math.max(0, m.index - 3000)
      const end = Math.min(html.length, m.index + 1000)
      const ctx = html.slice(start, end)
      const priceMatch = [...ctx.matchAll(/"price":(\d+\.?\d*)/g)].find(p => {
        const v = parseFloat(p[1]); return v > 5 && v < 10000
      })
      const price = parseFloat(priceMatch?.[1] ?? '0')
      if (price < 5 || price > 10000) continue
      const urlMatches = [...ctx.matchAll(/"canonicalUrl":"(\/en\/ip\/[^"]+)"/g)]
      const urlMatch = urlMatches[urlMatches.length - 1] // closest one before the name
      const wasMatch = ctx.match(/"wasPrice":\{"price":(\d+\.?\d*)/)
      const was = wasMatch ? parseFloat(wasMatch[1]) : undefined
      const imgMatch = ctx.match(/"thumbnailUrl":"(https:\/\/i5\.walmartimages\.com\/[^"]+)"/)
      results.push({
        store: 'Walmart Canada', storeLogo: 'walmart', price,
        originalPrice: was,
        discount: was && was > price ? Math.round(((was - price) / was) * 100) : undefined,
        inStock: true,
        url: urlMatch ? `https://www.walmart.ca${urlMatch[1]}` : STORE_SEARCH_URLS.walmart(query),
        name, image: imgMatch?.[1],
        lastUpdated: new Date().toISOString(),
      })
      if (results.length >= 2) break
    }
    return results
  } catch { return [] }
}

async function scrapeHomeDepot(query, brand = null) {
  try {
    const res = await fetchWithTimeout(`https://www.homedepot.ca/search?q=${encodeURIComponent(query)}`,
      { headers: { ...HEADERS, 'Referer': 'https://www.google.ca/' } })
    if (!res.ok) return []
    const html = await res.text()
    const results = []
    for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      try {
        const d = JSON.parse(m[1])
        const items = Array.isArray(d) ? d : [d]
        for (const item of items) {
          if (item['@type'] !== 'Product') continue
          if (!isRelevant(item.name, query, brand)) continue
          const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers
          const price = parseFloat(offer?.price ?? '0')
          if (price > 5) results.push({
            store: 'Home Depot Canada', storeLogo: 'homedepot', price, inStock: true,
            url: item.url ?? STORE_SEARCH_URLS.homedepot(query),
            name: item.name ?? query, image: Array.isArray(item.image) ? item.image[0] : item.image,
            lastUpdated: new Date().toISOString(),
          })
        }
      } catch {}
      if (results.length >= 2) break
    }
    return results
  } catch { return [] }
}

async function scrapeRONA(query, brand = null) {
  try {
    const res = await fetchWithTimeout(`https://www.rona.ca/en/search?q=${encodeURIComponent(query)}&sz=5`, { headers: HEADERS })
    if (!res.ok) return []
    const html = await res.text()
    const results = []
    for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      try {
        const d = JSON.parse(m[1])
        const items = Array.isArray(d) ? d : [d]
        for (const item of items) {
          if (item['@type'] !== 'Product') continue
          if (!isRelevant(item.name, query, brand)) continue
          const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers
          const price = parseFloat(offer?.price ?? '0')
          if (price > 5) results.push({
            store: 'RONA', storeLogo: 'rona', price, inStock: true,
            url: item.url ?? STORE_SEARCH_URLS.rona(query),
            name: item.name ?? query, image: Array.isArray(item.image) ? item.image[0] : item.image,
            lastUpdated: new Date().toISOString(),
          })
        }
      } catch {}
      if (results.length >= 2) break
    }
    return results
  } catch { return [] }
}

async function scrapeAmazon(query, brand = null) {
  try {
    const res = await fetchWithTimeout(`https://www.amazon.ca/s?k=${encodeURIComponent(query)}&i=tools`, { headers: HEADERS })
    if (!res.ok) return []
    const html = await res.text()
    if (html.includes('captcha') || html.includes('/errors/validateCaptcha')) return []
    const results = []
    const blocks = [...html.matchAll(/data-asin="([A-Z0-9]{10})"([\s\S]{0,2000}?)"a-price-whole">(\d[\d,]*)<\/span>/g)]
    for (const block of blocks) {
      const asin = block[1]
      const context = block[2]
      const price = parseFloat(block[3].replace(/,/g, ''))
      if (!asin || price <= 0) continue
      const fraction = context.match(/"a-price-fraction">(\d+)<\/span>/)
      const fullPrice = fraction ? price + parseFloat(`0.${fraction[1]}`) : price
      const nameMatch = context.match(/alt="([^"]{10,150})"/)
      const productName = nameMatch?.[1]
      if (productName && !isRelevant(productName, query, brand)) continue
      const img = context.match(/src="(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+)"/)
      results.push({
        store: 'Amazon Canada', storeLogo: 'amazon', price: fullPrice, inStock: true,
        url: `https://www.amazon.ca/dp/${asin}?tag=canadiantool-20`,
        name: productName ?? query, image: img?.[1],
        lastUpdated: new Date().toISOString(),
      })
      if (results.length >= 2) break
    }
    return results
  } catch { return [] }
}

async function scrapeCanadianTire(query, brand = null) {
  try {
    const apiUrl = `https://api.canadiantire.ca/search/api/v0/product/en/?q=${encodeURIComponent(query)}&store=0144&lang=en&site=ct&format=json&numItems=5&fromPos=0`
    const res = await fetchWithTimeout(apiUrl, {
      headers: { ...HEADERS, 'Referer': 'https://www.canadiantire.ca/', 'Origin': 'https://www.canadiantire.ca' }
    })
    if (!res.ok) return []
    const data = await res.json()
    const items = data?.products ?? []
    const results = []
    for (const item of items) {
      const name = item?.Name ?? ''
      if (!isRelevant(name, query, brand)) continue
      const price = item?.Price ?? 0
      if (price <= 0) continue
      const originalPrice = item?.WasPrice
      results.push({
        store: 'Canadian Tire', storeLogo: 'canadiantire', price, inStock: true,
        originalPrice,
        discount: originalPrice && originalPrice > price ? Math.round(((originalPrice - price) / originalPrice) * 100) : undefined,
        url: `https://www.canadiantire.ca/en/pdp/${item?.Sku ?? ''}.html`,
        name, image: item?.Thumbnail,
        lastUpdated: new Date().toISOString(),
      })
      if (results.length >= 2) break
    }
    return results
  } catch { return [] }
}

async function scrapePrincessAuto(query, brand = null) {
  try {
    const res = await fetchWithTimeout(`https://www.princessauto.com/en/search#q=${encodeURIComponent(query)}`, { headers: HEADERS })
    if (!res.ok) return []
    const html = await res.text()
    const results = []
    for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      try {
        const d = JSON.parse(m[1])
        const items = Array.isArray(d) ? d : [d]
        for (const item of items) {
          if (item['@type'] !== 'Product') continue
          if (!isRelevant(item.name, query, brand)) continue
          const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers
          const price = parseFloat(offer?.price ?? '0')
          if (price > 5) results.push({
            store: 'Princess Auto', storeLogo: 'princessauto', price, inStock: true,
            url: item.url ?? STORE_SEARCH_URLS.princessauto(query),
            name: item.name ?? query,
            lastUpdated: new Date().toISOString(),
          })
        }
      } catch {}
      if (results.length >= 2) break
    }
    return results
  } catch { return [] }
}

// ── Build one query result ────────────────────────────────────────────────────
const SCRAPERS = {
  walmart: scrapeWalmart,
  homedepot: scrapeHomeDepot,
  amazon: scrapeAmazon,
  canadiantire: scrapeCanadianTire,
  rona: scrapeRONA,
  princessauto: scrapePrincessAuto,
}

async function scrapeQuery(query) {
  const brandInfo = getApplicableStores(query)
  const applicable = brandInfo?.stores ?? ALL_STORES

  // Only scrape stores in the applicable list, and only if we have a scraper for them
  const brand = brandInfo?.brand ?? null
  const scrapeJobs = applicable
    .filter(id => SCRAPERS[id])
    .map(id => SCRAPERS[id](query, brand).then(r => ({ id, results: r })).catch(() => ({ id, results: [] })))

  const settled = await Promise.all(scrapeJobs)
  const byStore = Object.fromEntries(settled.map(s => [s.id, s.results]))

  const prices = []
  for (const id of ALL_STORES) {
    const meta = { store: STORE_NAMES[id], storeLogo: id, lastUpdated: new Date().toISOString() }

    if (!applicable.includes(id)) {
      const brandLabel = brandInfo?.brand
        ? `${brandInfo.brand.charAt(0).toUpperCase() + brandInfo.brand.slice(1)} not sold at ${STORE_NAMES[id]}`
        : 'Not available at this store'
      prices.push({ ...meta, price: 0, inStock: false, url: STORE_SEARCH_URLS[id](query), name: brandLabel, notCarried: true })
      continue
    }

    const storeResults = byStore[id] ?? []
    if (storeResults.length > 0) {
      prices.push(storeResults[0])
    } else {
      // Carried but no scraper / scraping failed — leave as manual check
      prices.push({ ...meta, price: 0, inStock: true, url: STORE_SEARCH_URLS[id](query), name: `Search "${query}" on ${STORE_NAMES[id]}`, checkManually: true })
    }
  }

  const real   = prices.filter(p => !p.checkManually && !p.notCarried && p.price > 0).sort((a, b) => a.price - b.price)
  const manual = prices.filter(p => p.checkManually)
  const nc     = prices.filter(p => p.notCarried)

  return {
    query,
    brand: brandInfo?.brand ?? null,
    prices: [...real, ...manual, ...nc],
    fetchedAt: new Date().toISOString(),
  }
}

// ── Popular queries ───────────────────────────────────────────────────────────
const POPULAR_QUERIES = [
  // Milwaukee (HD + Amazon only)
  'Milwaukee M18 drill',
  'Milwaukee M18 circular saw',
  'Milwaukee M12',
  'Milwaukee M18 impact driver',
  'Milwaukee Packout',
  'Milwaukee M18 grinder',
  // DeWalt (HD, RONA, Amazon, Walmart)
  'DeWalt 20V drill',
  'DeWalt circular saw',
  'DeWalt table saw',
  'DeWalt impact driver',
  'DeWalt jigsaw',
  // Makita (HD, RONA, Amazon, CT)
  'Makita 18V drill',
  'Makita impact driver',
  'Makita circular saw',
  // Mastercraft (CT only)
  'Mastercraft drill',
  'Mastercraft socket set',
  'Mastercraft wrench set',
  // Maximum (CT only)
  'Maximum drill',
  'Maximum circular saw',
  // Ryobi (HD only)
  'Ryobi 18V drill',
  'Ryobi circular saw',
  // Husky (HD only)
  'Husky wrench set',
  'Husky socket set',
  'Husky tool set',
  // Stanley (CT, Walmart, Amazon, RONA)
  'Stanley screwdriver set',
  'Stanley hand tools',
  // Craftsman (CT, Amazon, Walmart)
  'Craftsman socket set',
  'Craftsman wrench',
  // GearWrench (Amazon, RONA, PA, CT)
  'GearWrench ratchet',
  'GearWrench socket set',
  // Bosch (HD, RONA, Amazon)
  'Bosch drill',
  'Bosch laser level',
  // Powerfist (PA only)
  'Powerfist air compressor',
  'Powerfist socket set',
  // Lincoln
  'Lincoln grease gun',
  'Lincoln electric welder',
  // Fluke
  'Fluke multimeter',
  // Jobmate (CT only)
  'Jobmate drill',
  'Jobmate socket set',
  // Hart (Walmart only)
  'Hart drill',
  'Hart impact driver',
  // Greenworks (HD, Amazon)
  'Greenworks lawn mower',
  'Greenworks 40V',
  // Dremel (HD, Amazon, CT)
  'Dremel rotary tool',
  'Dremel kit',
  // Leatherman (Amazon, CT)
  'Leatherman multi-tool',
  // Worx (Amazon, Walmart)
  'Worx drill',
  'Worx circular saw',
  // RIDGID (HD, Amazon)
  'RIDGID shop vac',
  'RIDGID wet dry vac',
  // EGO (HD, Amazon)
  'EGO lawn mower',
  'EGO 56V',
  // Klein (HD, Amazon)
  'Klein screwdriver set',
  'Klein pliers',
]

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

async function main() {
  console.log(`Starting scrape of ${POPULAR_QUERIES.length} queries with brand filtering...\n`)
  const index = []

  for (const query of POPULAR_QUERIES) {
    try {
      console.log(`Scraping: "${query}"`)
      const result = await scrapeQuery(query)
      const real = result.prices.filter(p => !p.checkManually && !p.notCarried)
      const nc   = result.prices.filter(p => p.notCarried)
      console.log(`  brand: ${result.brand ?? 'unknown'} | live: ${real.length} | not-carried: ${nc.length}`)

      const slug = slugify(query)
      writeFileSync(join(CACHE_DIR, `${slug}.json`), JSON.stringify(result, null, 2))

      index.push({
        query, slug,
        brand: result.brand,
        lowestPrice: real[0]?.price ?? null,
        lowestStore: real[0]?.store ?? null,
        discount: real[0]?.discount ?? null,
        priceCount: real.length,
        fetchedAt: result.fetchedAt,
      })

      await new Promise(r => setTimeout(r, 1200))
    } catch (e) {
      console.error(`  ERROR: ${e.message}`)
    }
  }

  writeFileSync(join(CACHE_DIR, 'index.json'), JSON.stringify(index, null, 2))
  console.log(`\nDone. index.json updated with ${index.length} entries.`)
}

main()
