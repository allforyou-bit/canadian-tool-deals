/**
 * Canadian tool brand → store availability map
 * Store IDs: walmart | homedepot | amazon | canadiantire | rona | princessauto
 */

export const BRAND_STORE_MAP = {

  // ── Home Depot Canada exclusives ──────────────────────────────────────────
  'milwaukee':        ['homedepot', 'amazon'],
  'm18':              ['homedepot', 'amazon'],
  'm12':              ['homedepot', 'amazon'],
  'milwaukee packout':['homedepot', 'amazon'],
  'milwaukee fuel':   ['homedepot', 'amazon'],
  'mx fuel':          ['homedepot'],
  'ryobi':            ['homedepot', 'amazon'],
  'ryobi one+':       ['homedepot', 'amazon'],
  'ridgid':           ['homedepot', 'amazon'],
  'husky':            ['homedepot'],                          // HD house brand (hand tools)
  'husqvarna':        ['homedepot', 'amazon'],
  'klein':            ['homedepot', 'amazon'],
  'klein tools':      ['homedepot', 'amazon'],
  'ego':              ['homedepot', 'amazon'],
  'ego power+':       ['homedepot', 'amazon'],

  // ── Canadian Tire exclusives ──────────────────────────────────────────────
  'mastercraft':      ['canadiantire'],                       // CT house brand
  'maximum':          ['canadiantire'],                       // CT premium power tool brand
  'jobmate':          ['canadiantire'],                       // CT entry-level house brand
  'yardworks':        ['canadiantire'],
  'motomaster':       ['canadiantire'],

  // ── Princess Auto exclusives ──────────────────────────────────────────────
  'powerfist':        ['princessauto'],                       // PA house brand

  // ── Multi-store brands ────────────────────────────────────────────────────
  'dewalt':           ['homedepot', 'rona', 'amazon', 'walmart'],
  'tough system':     ['homedepot', 'rona', 'amazon'],
  'makita':           ['homedepot', 'rona', 'amazon', 'canadiantire'],
  'bosch':            ['homedepot', 'rona', 'amazon'],
  'stanley':          ['canadiantire', 'walmart', 'amazon', 'rona'],
  'stanley fatmax':   ['canadiantire', 'walmart', 'amazon', 'rona'],
  'craftsman':        ['canadiantire', 'amazon', 'walmart'],
  'gearwrench':       ['amazon', 'rona', 'princessauto', 'canadiantire'],
  'lincoln':          ['princessauto', 'amazon', 'canadiantire'],
  'lincoln electric': ['princessauto', 'amazon'],
  'lincoln industrial':['princessauto', 'amazon', 'walmart'],
  'black+decker':     ['walmart', 'amazon', 'canadiantire'],
  'black decker':     ['walmart', 'amazon', 'canadiantire'],
  'black & decker':   ['walmart', 'amazon', 'canadiantire'],
  'fluke':            ['amazon'],
  'worx':             ['amazon', 'walmart'],
  'irwin':            ['homedepot', 'amazon', 'rona', 'canadiantire'],
  'metabo':           ['amazon', 'rona'],
  'hitachi':          ['amazon', 'rona'],
  'snap-on':          ['amazon'],
  'channellock':      ['amazon', 'canadiantire'],
  'knipex':           ['amazon', 'rona'],
  'wera':             ['amazon', 'rona'],

  // ── Walmart Canada exclusives ─────────────────────────────────────────────
  'hart':             ['walmart'],                             // Walmart CA house brand

  // ── Other notable brands ──────────────────────────────────────────────────
  'greenworks':       ['homedepot', 'amazon'],
  'dremel':           ['homedepot', 'amazon', 'canadiantire'],
  'leatherman':       ['amazon', 'canadiantire'],
}

export const ALL_STORES = ['walmart', 'homedepot', 'amazon', 'canadiantire', 'rona', 'princessauto']

export const STORE_NAMES = {
  walmart:      'Walmart Canada',
  homedepot:    'Home Depot Canada',
  amazon:       'Amazon Canada',
  canadiantire: 'Canadian Tire',
  rona:         'RONA',
  princessauto: 'Princess Auto',
}

export const STORE_URLS = {
  walmart:      q => `https://www.walmart.ca/search?q=${encodeURIComponent(q)}`,
  homedepot:    q => `https://www.homedepot.ca/search?q=${encodeURIComponent(q)}`,
  amazon:       q => `https://www.amazon.ca/s?k=${encodeURIComponent(q)}&i=tools&tag=canadiantool-20`,
  canadiantire: q => `https://www.canadiantire.ca/en/search-results.html?q=${encodeURIComponent(q)}`,
  rona:         q => `https://www.rona.ca/en/search?q=${encodeURIComponent(q)}`,
  princessauto: q => `https://www.princessauto.com/en/search#q=${encodeURIComponent(q)}`,
}

/**
 * Detect brand from query (longest match first to avoid partial matches)
 */
export function getApplicableStores(query) {
  const q = query.toLowerCase()
  const sorted = Object.entries(BRAND_STORE_MAP).sort((a, b) => b[0].length - a[0].length)
  for (const [brand, stores] of sorted) {
    if (q.includes(brand)) return { brand, stores }
  }
  return null
}

/**
 * Verify scraped product is actually relevant to the search query.
 * When brand is known, requires brand name in product title (prevents wrong brand).
 */
export function isRelevant(productName, query, brand = null) {
  if (!productName) return false
  const name = productName.toLowerCase()
  if (brand && !name.includes(brand.toLowerCase())) return false
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2)
  return words.some(w => name.includes(w))
}
