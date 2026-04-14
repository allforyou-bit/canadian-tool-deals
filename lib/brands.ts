export const BRAND_STORE_MAP: Record<string, string[]> = {
  'milwaukee': ['homedepot', 'amazon'],
  'm18': ['homedepot', 'amazon'],
  'm12': ['homedepot', 'amazon'],
  'dewalt': ['homedepot', 'rona', 'amazon', 'walmart'],
  'makita': ['homedepot', 'rona', 'amazon', 'canadiantire'],
  'ridgid': ['homedepot', 'amazon'],
  'ryobi': ['homedepot', 'amazon'],
  'bosch': ['homedepot', 'rona', 'amazon'],
  'mastercraft': ['canadiantire'],
  'husky': ['homedepot'],
  'husqvarna': ['homedepot', 'amazon'],
  'stanley': ['walmart', 'amazon', 'canadiantire'],
  'klein': ['homedepot', 'amazon'],
  'fluke': ['amazon'],
  'craftsman': ['canadiantire', 'amazon', 'walmart'],
  'black+decker': ['walmart', 'amazon', 'canadiantire'],
  'worx': ['amazon', 'walmart'],
  'powerfist': ['princessauto'],
  'yardworks': ['canadiantire'],
  'motomaster': ['canadiantire'],
}

export const ALL_STORES = ['walmart', 'homedepot', 'amazon', 'canadiantire', 'rona', 'princessauto']

export const STORE_NAMES: Record<string, string> = {
  walmart: 'Walmart Canada',
  homedepot: 'Home Depot Canada',
  amazon: 'Amazon Canada',
  canadiantire: 'Canadian Tire',
  rona: 'RONA',
  princessauto: 'Princess Auto',
}

export function getApplicableStores(query: string): { brand: string; stores: string[] } | null {
  const q = query.toLowerCase()
  for (const [brand, stores] of Object.entries(BRAND_STORE_MAP)) {
    if (q.includes(brand)) return { brand, stores }
  }
  return null
}

export function isRelevant(productName: string | undefined, query: string): boolean {
  if (!productName) return false
  const name = productName.toLowerCase()
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2)
  return words.some(w => name.includes(w))
}
