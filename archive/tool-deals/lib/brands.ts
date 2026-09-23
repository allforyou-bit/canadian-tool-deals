/**
 * Canadian tool brand → store availability map
 * Based on actual Canadian retail exclusivity and distribution
 *
 * Store IDs: walmart | homedepot | amazon | canadiantire | rona | princessauto
 */

export const BRAND_STORE_MAP: Record<string, string[]> = {

  // ── Home Depot Canada exclusives / primary ────────────────────────────────

  // Milwaukee — Home Depot CA exclusive (TTi brand)
  'milwaukee': ['homedepot', 'amazon'],
  'm18': ['homedepot', 'amazon'],
  'm12': ['homedepot', 'amazon'],
  'milwaukee packout': ['homedepot', 'amazon'],

  // Ryobi — Home Depot CA exclusive (TTi brand, same parent as Milwaukee)
  'ryobi': ['homedepot', 'amazon'],
  'ryobi one+': ['homedepot', 'amazon'],

  // RIDGID — Home Depot CA exclusive (TTi brand)
  'ridgid': ['homedepot', 'amazon'],

  // Husky — Home Depot CA exclusive house brand (hand tools)
  'husky': ['homedepot'],

  // Husqvarna — Home Depot CA, Amazon
  'husqvarna': ['homedepot', 'amazon'],

  // Klein Tools — Home Depot CA, Amazon
  'klein': ['homedepot', 'amazon'],
  'klein tools': ['homedepot', 'amazon'],

  // ── Canadian Tire exclusives / primary ────────────────────────────────────

  // Mastercraft — Canadian Tire exclusive house brand
  'mastercraft': ['canadiantire'],

  // Maximum — Canadian Tire exclusive (CT's premium power tool brand)
  'maximum': ['canadiantire'],

  // Jobmate — Canadian Tire exclusive (CT's entry-level house brand)
  'jobmate': ['canadiantire'],

  // Yardworks — Canadian Tire exclusive (outdoor/garden)
  'yardworks': ['canadiantire'],

  // Motomaster — Canadian Tire exclusive (automotive)
  'motomaster': ['canadiantire'],

  // ── Princess Auto exclusives / primary ───────────────────────────────────

  // Powerfist — Princess Auto exclusive house brand
  'powerfist': ['princessauto'],

  // Lincoln (welding + lubrication tools) — Princess Auto, Amazon
  'lincoln': ['princessauto', 'amazon', 'canadiantire'],
  'lincoln electric': ['princessauto', 'amazon'],
  'lincoln industrial': ['princessauto', 'amazon', 'walmart'],

  // ── Multi-store brands ────────────────────────────────────────────────────

  // DeWalt — Home Depot CA, RONA, Amazon (limited at Walmart)
  'dewalt': ['homedepot', 'rona', 'amazon', 'walmart'],

  // Makita — Home Depot CA, RONA, Amazon, Canadian Tire (limited)
  'makita': ['homedepot', 'rona', 'amazon', 'canadiantire'],

  // Bosch — Home Depot CA, RONA, Amazon
  'bosch': ['homedepot', 'rona', 'amazon'],

  // Stanley — Canadian Tire, Walmart, Amazon, RONA
  'stanley': ['canadiantire', 'walmart', 'amazon', 'rona'],
  'stanley fatmax': ['canadiantire', 'walmart', 'amazon', 'rona'],

  // Craftsman — Canadian Tire (main CA license), Amazon, Walmart
  'craftsman': ['canadiantire', 'amazon', 'walmart'],

  // GearWrench — Amazon CA, RONA, Princess Auto, Canadian Tire (limited)
  'gearwrench': ['amazon', 'rona', 'princessauto', 'canadiantire'],

  // Fluke — Amazon CA, specialty distributors only
  'fluke': ['amazon'],

  // Black+Decker — Walmart, Amazon, Canadian Tire
  'black+decker': ['walmart', 'amazon', 'canadiantire'],
  'black decker': ['walmart', 'amazon', 'canadiantire'],
  'black & decker': ['walmart', 'amazon', 'canadiantire'],

  // Worx — Amazon CA, Walmart
  'worx': ['amazon', 'walmart'],

  // Irwin — Amazon, Home Depot CA, RONA, Canadian Tire
  'irwin': ['homedepot', 'amazon', 'rona', 'canadiantire'],

  // Dewalt Tough System (storage) — same as dewalt
  'tough system': ['homedepot', 'rona', 'amazon'],

  // Milwaukee FUEL — HD exclusive
  'milwaukee fuel': ['homedepot', 'amazon'],

  // Ego (battery outdoor tools) — Home Depot CA, Amazon
  'ego': ['homedepot', 'amazon'],
  'ego power+': ['homedepot', 'amazon'],

  // Metabo HPT (formerly Hitachi) — Amazon, RONA
  'metabo': ['amazon', 'rona'],
  'hitachi': ['amazon', 'rona'],

  // Snap-on — specialty/Amazon (not at big box)
  'snap-on': ['amazon'],
  'snapon': ['amazon'],

  // Channellock — Amazon, Canadian Tire
  'channellock': ['amazon', 'canadiantire'],

  // Knipex — Amazon, RONA
  'knipex': ['amazon', 'rona'],

  // Wera — Amazon, RONA, specialty
  'wera': ['amazon', 'rona'],

  // Milwaukee MX FUEL — Home Depot CA
  'mx fuel': ['homedepot'],

  // Hart — Walmart Canada exclusive house brand
  'hart': ['walmart'],

  // Greenworks — Home Depot CA, Amazon
  'greenworks': ['homedepot', 'amazon'],

  // Dremel — Home Depot CA, Amazon, Canadian Tire
  'dremel': ['homedepot', 'amazon', 'canadiantire'],

  // Leatherman — Amazon, Canadian Tire
  'leatherman': ['amazon', 'canadiantire'],

  // Gerber — Amazon, Canadian Tire
  'gerber': ['amazon', 'canadiantire'],
}

// All store IDs
export const ALL_STORES = ['walmart', 'homedepot', 'amazon', 'canadiantire', 'rona', 'princessauto']

export const STORE_NAMES: Record<string, string> = {
  walmart:      'Walmart Canada',
  homedepot:    'Home Depot Canada',
  amazon:       'Amazon Canada',
  canadiantire: 'Canadian Tire',
  rona:         'RONA',
  princessauto: 'Princess Auto',
}

export const STORE_URLS: Record<string, (q: string) => string> = {
  walmart:      q => `https://www.walmart.ca/search?q=${q}`,
  homedepot:    q => `https://www.homedepot.ca/search?q=${q}`,
  amazon:       q => `https://www.amazon.ca/s?k=${q}&i=tools&tag=canadiantool-20`,
  canadiantire: q => `https://www.canadiantire.ca/en/search-results.html?q=${q}`,
  rona:         q => `https://www.rona.ca/en/search?q=${q}`,
  princessauto: q => `https://www.princessauto.com/en/search#q=${q}`,
}

/**
 * Detect brand from query and return which stores carry it.
 * Returns null if brand unknown → search all stores.
 */
export function getApplicableStores(query: string): { brand: string; stores: string[] } | null {
  const q = query.toLowerCase()
  // Longer brand names first to avoid partial matches
  const sorted = Object.entries(BRAND_STORE_MAP).sort((a, b) => b[0].length - a[0].length)
  for (const [brand, stores] of sorted) {
    if (q.includes(brand)) return { brand, stores }
  }
  return null
}

/**
 * Verify a scraped product name is relevant to the query.
 * When brand is known, requires the brand name to appear in the product name.
 */
export function isRelevant(productName: string | undefined, query: string, brand?: string | null): boolean {
  if (!productName) return false
  const name = productName.toLowerCase()
  if (brand && !name.includes(brand.toLowerCase())) return false
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2)
  return words.some(w => name.includes(w))
}
