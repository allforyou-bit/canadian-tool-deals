/**
 * Background service worker
 * Runs in browser context → no IP blocking from stores
 */

import { BRAND_STORE_MAP, ALL_STORES, STORE_NAMES, getApplicableStores, isRelevant } from './brands.js'

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml',
  'Accept-Language': 'en-CA,en;q=0.9',
}

// ── Scrapers ──────────────────────────────────────────────────────────────────

async function scrapeWalmart(query, brand = null) {
  try {
    const res = await fetch(`https://www.walmart.ca/search?q=${encodeURIComponent(query)}&c=0`, { headers: HEADERS })
    if (!res.ok) return []
    const html = await res.text()
    const results = []
    // Find each name occurrence, then look at surrounding context for price/url/image
    for (const m of html.matchAll(/"name":"([^"]{10,150})","checkStoreAvailabilityATC"/g)) {
      const name = m[1].replace(/\\u0026/g, '&')
      if (!isRelevant(name, query, brand)) continue
      const start = Math.max(0, m.index - 3000)
      const end = Math.min(html.length, m.index + 1000)
      const ctx = html.slice(start, end)
      const priceMatch = [...ctx.matchAll(/"price":(\d+\.?\d*)/g)].find(p => {
        const v = parseFloat(p[1]); return v > 5 && v < 10000
      })
      const price = parseFloat(priceMatch?.[1] ?? '0')
      if (price < 5 || price > 10000) continue
      const urlMatches = [...ctx.matchAll(/"canonicalUrl":"(\/en\/ip\/[^"]+)"/g)]
      const urlMatch = urlMatches[urlMatches.length - 1]
      const wasMatch = ctx.match(/"wasPrice":\{"price":(\d+\.?\d*)/)
      const was = wasMatch ? parseFloat(wasMatch[1]) : undefined
      const imgMatch = ctx.match(/"thumbnailUrl":"(https:\/\/i5\.walmartimages\.com\/[^"]+)"/)
      results.push({
        store: 'Walmart Canada', storeLogo: 'walmart', price,
        originalPrice: was,
        discount: was && was > price ? Math.round(((was - price) / was) * 100) : undefined,
        inStock: true,
        url: urlMatch ? `https://www.walmart.ca${urlMatch[1]}` : `https://www.walmart.ca/search?q=${encodeURIComponent(query)}`,
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
    const res = await fetch(`https://www.homedepot.ca/search?q=${encodeURIComponent(query)}`, {
      headers: { ...HEADERS, 'Referer': 'https://www.google.ca/' }
    })
    if (!res.ok) return []
    const html = await res.text()
    const results = []

    // JSON-LD structured data
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
            url: item.url ?? `https://www.homedepot.ca/search?q=${encodeURIComponent(query)}`,
            name: item.name ?? query,
            image: Array.isArray(item.image) ? item.image[0] : item.image,
            lastUpdated: new Date().toISOString(),
          })
        }
      } catch {}
      if (results.length >= 2) break
    }

    // Regex fallback
    if (results.length === 0) {
      const priceMatch = html.match(/"regularPrice":(\d+\.?\d*)/)
      const nameMatch = html.match(/"productLabel":"([^"]{10,120})"/)
      const urlMatch = html.match(/"canonicalUrl":"(\/[^"]+)"/)
      if (priceMatch && nameMatch && isRelevant(nameMatch[1], query, brand)) {
        results.push({
          store: 'Home Depot Canada', storeLogo: 'homedepot',
          price: parseFloat(priceMatch[1]), inStock: true,
          url: urlMatch ? `https://www.homedepot.ca${urlMatch[1]}` : `https://www.homedepot.ca/search?q=${encodeURIComponent(query)}`,
          name: nameMatch[1],
          lastUpdated: new Date().toISOString(),
        })
      }
    }
    return results
  } catch { return [] }
}

async function scrapeAmazon(query, brand = null) {
  try {
    const res = await fetch(`https://www.amazon.ca/s?k=${encodeURIComponent(query)}&i=tools`, { headers: HEADERS })
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
      const name = context.match(/alt="([^"]{10,150})"/)
      const productName = name?.[1]
      if (productName && !isRelevant(productName, query, brand)) continue
      const img = context.match(/src="(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+)"/)
      results.push({
        store: 'Amazon Canada', storeLogo: 'amazon', price: fullPrice, inStock: true,
        url: `https://www.amazon.ca/dp/${asin}?tag=canadiantool-20`,
        name: productName ?? query,
        image: img?.[1],
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
    const res = await fetch(apiUrl, {
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
        name,
        image: item?.Thumbnail,
        lastUpdated: new Date().toISOString(),
      })
      if (results.length >= 2) break
    }
    return results
  } catch { return [] }
}

async function scrapeRONA(query, brand = null) {
  try {
    const res = await fetch(`https://www.rona.ca/en/search?q=${encodeURIComponent(query)}&sz=5`, { headers: HEADERS })
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
            url: item.url ?? `https://www.rona.ca/en/search?q=${encodeURIComponent(query)}`,
            name: item.name ?? query,
            image: Array.isArray(item.image) ? item.image[0] : item.image,
            lastUpdated: new Date().toISOString(),
          })
        }
      } catch {}
      if (results.length >= 2) break
    }
    return results
  } catch { return [] }
}

async function scrapePrincessAuto(query, brand = null) {
  try {
    const res = await fetch(`https://www.princessauto.com/en/search#q=${encodeURIComponent(query)}`, { headers: HEADERS })
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
            url: item.url ?? `https://www.princessauto.com/en/search#q=${encodeURIComponent(query)}`,
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

// ── Main search ───────────────────────────────────────────────────────────────

const SCRAPER_MAP = {
  walmart: scrapeWalmart,
  homedepot: scrapeHomeDepot,
  amazon: scrapeAmazon,
  canadiantire: scrapeCanadianTire,
  rona: scrapeRONA,
  princessauto: scrapePrincessAuto,
}

const STORE_META = {
  walmart:      { name: 'Walmart Canada',    url: (q) => `https://www.walmart.ca/search?q=${encodeURIComponent(q)}` },
  homedepot:    { name: 'Home Depot Canada', url: (q) => `https://www.homedepot.ca/search?q=${encodeURIComponent(q)}` },
  amazon:       { name: 'Amazon Canada',     url: (q) => `https://www.amazon.ca/s?k=${encodeURIComponent(q)}&i=tools&tag=canadiantool-20` },
  canadiantire: { name: 'Canadian Tire',     url: (q) => `https://www.canadiantire.ca/en/search-results.html?q=${encodeURIComponent(q)}` },
  rona:         { name: 'RONA',              url: (q) => `https://www.rona.ca/en/search?q=${encodeURIComponent(q)}` },
  princessauto: { name: 'Princess Auto',     url: (q) => `https://www.princessauto.com/en/search#q=${encodeURIComponent(q)}` },
}

async function searchAllStores(query) {
  const brandInfo = getApplicableStores(query)
  const applicableStores = brandInfo?.stores ?? ALL_STORES
  const brand = brandInfo?.brand ?? null

  // Run scrapers only for stores that carry this brand, pass brand for strict filtering
  const scrapeResults = await Promise.allSettled(
    applicableStores.map(id => SCRAPER_MAP[id](query, brand).then(r => ({ id, results: r })))
  )

  const prices = []

  for (const storeId of ALL_STORES) {
    const storeName = STORE_NAMES[storeId]
    const storeUrl = STORE_META[storeId].url(query)

    if (!applicableStores.includes(storeId)) {
      // Brand not carried here
      prices.push({
        store: storeName, storeLogo: storeId,
        price: 0, inStock: false,
        url: storeUrl,
        name: brand ? `${brand.charAt(0).toUpperCase() + brand.slice(1)} not sold at ${storeName}` : 'Not available',
        notCarried: true,
        lastUpdated: new Date().toISOString(),
      })
      continue
    }

    // Find results for this store
    const settled = scrapeResults.find(r => r.status === 'fulfilled' && r.value.id === storeId)
    const storeResults = settled?.value?.results ?? []

    if (storeResults.length > 0) {
      prices.push({ ...storeResults[0] })
    } else {
      // Carried but not found / scraping failed
      prices.push({
        store: storeName, storeLogo: storeId,
        price: 0, inStock: true,
        url: storeUrl,
        name: `Search "${query}" on ${storeName}`,
        checkManually: true,
        lastUpdated: new Date().toISOString(),
      })
    }
  }

  // Sort: real prices first (lowest→highest), then manual, then not carried
  const real = prices.filter(p => !p.checkManually && !p.notCarried && p.price > 0).sort((a, b) => a.price - b.price)
  const manual = prices.filter(p => p.checkManually)
  const notCarried = prices.filter(p => p.notCarried)

  return {
    query,
    brand: brandInfo?.brand ?? null,
    prices: [...real, ...manual, ...notCarried],
    fetchedAt: new Date().toISOString(),
    source: 'extension',
  }
}

// ── Message handling ──────────────────────────────────────────────────────────

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (message.type === 'SEARCH') {
    searchAllStores(message.query).then(sendResponse)
    return true
  }
  if (message.type === 'PING') {
    sendResponse({ status: 'ok', version: '1.0.0' })
  }
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SEARCH') {
    searchAllStores(message.query).then(sendResponse)
    return true
  }
})
