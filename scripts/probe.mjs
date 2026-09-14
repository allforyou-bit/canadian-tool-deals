/** DIAGNOSTIC PROBE - read only, writes nothing. */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const H = { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'Accept-Language': 'en-CA,en;q=0.9' }
const CHALLENGE = [
  ['perimeterx', /px-captcha|_pxhd|PerimeterX|px-cloud|pxAppId/i],
  ['akamai', /Reference #\d|akamai|You don.t have permission to access/i],
  ['cloudflare', /cf-chl|__cf_bm|Attention Required|Cloudflare Ray ID/i],
  ['captcha', /captcha/i],
  ['denied', /Access Denied|has been denied|Pardon Our Interruption|are you a robot|Robot Check/i],
  ['imperva', /incident_id|_Incapsula_|visid_incap/i],
]
async function get(url, headers = H, ms = 25000) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms)
  try {
    const res = await fetch(url, { headers, signal: c.signal, redirect: 'follow' })
    const body = await res.text(); clearTimeout(t)
    return { status: res.status, url: res.url, body, ct: res.headers.get('content-type')||'', server: res.headers.get('server')||'' }
  } catch (e) { clearTimeout(t); return { err: String(e && e.message || e) } }
}
const one = s => String(s).replace(/\s+/g,' ').trim()

const TARGETS = [
  ['CT search page',      'https://www.canadiantire.ca/en/search-results.html?q=mastercraft%20drill'],
  ['CT internal API',     'https://api.canadiantire.ca/search/api/v0/product/en/?q=mastercraft%20drill&store=0144&lang=en&site=ct&format=json&numItems=5&fromPos=0'],
  ['HomeDepot search',    'https://www.homedepot.ca/search?q=milwaukee%20drill'],
  ['Amazon.ca search',    'https://www.amazon.ca/s?k=milwaukee%20drill&i=tools'],
  ['Walmart.ca search',   'https://www.walmart.ca/search?q=hart%20drill&c=0'],
  ['RONA search',         'https://www.rona.ca/en/search?q=dewalt%20drill&sz=5'],
  ['PrincessAuto search', 'https://www.princessauto.com/en/search'],
  ['BestBuy.ca search',   'https://www.bestbuy.ca/en-ca/search?search=milwaukee%20drill'],
  ['BestBuy open API .ca','https://api.bestbuy.ca/api/v2/json/search?query=drill'],
  ['BestBuy.ca web API',  'https://www.bestbuy.ca/api/v2/json/search?query=milwaukee%20drill&lang=en-CA'],
]
console.log('=== PHASE 1: RETAILER ENDPOINTS ===\n')
for (const [label, url] of TARGETS) {
  const r = await get(url)
  if (r.err) { console.log(`[${label}] NETWORK ERROR: ${r.err}\n`); continue }
  const hits = CHALLENGE.filter(([, re]) => re.test(r.body)).map(([n]) => n)
  console.log(`[${label}] HTTP ${r.status} len=${r.body.length} ct=${one(r.ct)} server=${one(r.server)}`)
  console.log(`  finalURL=${r.url}`)
  console.log(`  challenge=${hits.length?hits.join('|'):'NONE'}  jsonld=${(r.body.match(/application\/ld\+json/gi)||[]).length} jsonldProduct=${/"@type"\s*:\s*"Product"/.test(r.body)}`)
  console.log(`  sel: a-price-whole=${(r.body.match(/a-price-whole/g)||[]).length} data-asin=${(r.body.match(/data-asin="[A-Z0-9]{10}"/g)||[]).length} checkStoreAvailabilityATC=${(r.body.match(/checkStoreAvailabilityATC/g)||[]).length} canonicalUrl=${(r.body.match(/"canonicalUrl"/g)||[]).length} __STATE__=${/window\.__STATE__/.test(r.body)} "price":=${(r.body.match(/"price"\s*:/g)||[]).length} "products":=${(r.body.match(/"products"\s*:/g)||[]).length}`)
  console.log(`  HEAD: ${one(r.body.slice(0,350))}`)
  if (/json/i.test(r.ct)) console.log(`  JSONHEAD: ${one(r.body.slice(0,900))}`)
  console.log('')
}

console.log('\n=== PHASE 2: ROBOTS.TXT ===\n')
for (const u of ['https://www.canadiantire.ca/robots.txt','https://www.homedepot.ca/robots.txt','https://www.amazon.ca/robots.txt','https://www.walmart.ca/robots.txt','https://www.rona.ca/robots.txt','https://www.princessauto.com/robots.txt','https://www.bestbuy.ca/robots.txt']) {
  const r = await get(u)
  if (r.err) { console.log(`[${u}] ERR ${r.err}\n`); continue }
  const lines = r.body.split('\n')
  const star = []
  let inStar = false
  for (const L of lines) {
    if (/^\s*user-agent:/i.test(L)) inStar = /user-agent:\s*\*/i.test(L)
    if (inStar) star.push(L.trim())
  }
  console.log(`[${u}] HTTP ${r.status} len=${r.body.length}`)
  console.log(`  UA:* block (first 60 lines): ${star.slice(0,60).join(' | ')}`)
  console.log(`  Sitemap lines: ${lines.filter(l=>/^\s*sitemap:/i.test(l)).slice(0,8).join(' | ')}`)
  console.log('')
}

console.log('\n=== PHASE 3: SITEMAPS / STRUCTURED DATA ON A PDP ===\n')
for (const u of ['https://www.homedepot.ca/sitemap.xml','https://www.canadiantire.ca/sitemap.xml','https://www.rona.ca/sitemap.xml','https://www.princessauto.com/sitemap.xml','https://www.bestbuy.ca/sitemap.xml','https://www.walmart.ca/sitemap.xml']) {
  const r = await get(u)
  if (r.err) { console.log(`[${u}] ERR ${r.err}`); continue }
  console.log(`[${u}] HTTP ${r.status} len=${r.body.length} ct=${one(r.ct)} HEAD: ${one(r.body.slice(0,300))}`)
}

console.log('\n=== PHASE 4: DEAL FEEDS (free, no-auth) ===\n')
for (const u of [
  'https://forums.redflagdeals.com/feed/forum/hot-deals-72',
  'https://www.redflagdeals.com/deals/feed/',
  'https://www.reddit.com/r/CanadianDealsAndCoupons/new.rss?limit=5',
  'https://www.reddit.com/r/bapcsalescanada/new.rss?limit=5',
  'https://www.reddit.com/r/Tools/new.rss?limit=5',
  'https://www.smartcanucks.ca/feed/',
]) {
  const r = await get(u, { ...H, 'Accept': 'application/rss+xml,application/xml,text/xml,*/*' })
  if (r.err) { console.log(`[${u}] ERR ${r.err}\n`); continue }
  console.log(`[${u}] HTTP ${r.status} len=${r.body.length} ct=${one(r.ct)}`)
  console.log(`  items=${(r.body.match(/<item[ >]|<entry[ >]/g)||[]).length}  HEAD: ${one(r.body.slice(0,300))}`)
  console.log('')
}

console.log('\n=== PHASE 5: PRIMARY DOCS (fee/eligibility/policy verification) ===\n')
const DOCS = [
  ['PAAPI rates', 'https://webservices.amazon.com/paapi5/documentation/troubleshooting/api-rates.html', /qualif|sales|TPD|TPS|8640|revenue|30 days/gi],
  ['PAAPI onboarding', 'https://webservices.amazon.com/paapi5/documentation/register-for-pa-api.html', /qualif|sales|eligib|three|revenue/gi],
  ['Associates Canada', 'https://associates.amazon.ca/help/operating/agreement', /qualif|180|sales/gi],
  ['Chrome register fee', 'https://developer.chrome.com/docs/webstore/register', /\$\s?\d+|registration fee|one-time|non-refundable/gi],
  ['Chrome review time', 'https://developer.chrome.com/docs/webstore/review-process', /review|business day|hours|24|weeks/gi],
  ['Chrome program policy', 'https://developer.chrome.com/docs/webstore/program-policies', /single purpose|Single Purpose/gi],
  ['BestBuy US dev', 'https://developer.bestbuy.com/', /Canada|canadian|US only|United States/gi],
  ['Walmart CA terms', 'https://www.walmart.ca/en/help/article/terms-of-use/', /scrap|robot|spider|automated|crawl|data mining/gi],
  ['HomeDepot CA terms', 'https://www.homedepot.ca/en/home/customer-support/terms-of-use.html', /scrap|robot|spider|automated|crawl|data mining/gi],
  ['CT terms', 'https://www.canadiantire.ca/en/customer-service/terms-conditions.html', /scrap|robot|spider|automated|crawl|data mining/gi],
]
for (const [label, url, re] of DOCS) {
  const r = await get(url)
  if (r.err) { console.log(`[${label}] ${url}\n  ERR ${r.err}\n`); continue }
  const txt = r.body.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ')
  const outs = []
  let m; re.lastIndex = 0
  while ((m = re.exec(txt)) && outs.length < 14) {
    outs.push('…' + txt.slice(Math.max(0, m.index-170), m.index + 200) + '…')
    re.lastIndex = m.index + 200
  }
  console.log(`[${label}] ${url}\n  HTTP ${r.status} len=${r.body.length} textLen=${txt.length}`)
  outs.forEach(o => console.log(`  MATCH: ${o}`))
  if (!outs.length) console.log(`  NO MATCHES. TEXT HEAD: ${txt.slice(0,400)}`)
  console.log('')
}
console.log('=== PROBE END ===')
