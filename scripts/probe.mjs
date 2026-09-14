/** PROBE 2 - read only. */
const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const H={'User-Agent':UA,'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8','Accept-Language':'en-CA,en;q=0.9'}
async function get(u,h=H,ms=30000){const c=new AbortController();const t=setTimeout(()=>c.abort(),ms)
 try{const r=await fetch(u,{headers:h,signal:c.signal,redirect:'follow'});const b=await r.text();clearTimeout(t)
  return{status:r.status,url:r.url,body:b,ct:r.headers.get('content-type')||''}}catch(e){clearTimeout(t);return{err:String(e&&e.message||e)}}}
const one=s=>String(s).replace(/\s+/g,' ').trim()
const text=b=>b.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&[a-z]+;/g,' ').replace(/\s+/g,' ')
async function grep(label,url,re,n=10,pad=260){
  const r=await get(url); if(r.err){console.log(`[${label}] ${url}\n  ERR ${r.err}\n`);return}
  const t=text(r.body); const outs=[]; let m; re.lastIndex=0
  while((m=re.exec(t))&&outs.length<n){outs.push(t.slice(Math.max(0,m.index-pad),m.index+pad+120));re.lastIndex=m.index+pad}
  console.log(`[${label}] ${url}\n  HTTP ${r.status} len=${r.body.length} textLen=${t.length}`)
  outs.forEach(o=>console.log(`  » ${o}`)); if(!outs.length)console.log(`  NO MATCH. HEAD: ${t.slice(0,500)}`)
  console.log('')
}

console.log('=== A: CHROME WEB STORE FEE (exact amount) ===\n')
await grep('CWS register','https://developer.chrome.com/docs/webstore/register',/fee|US\$|\$\d|payment/gi,12)
await grep('CWS dev agreement','https://developer.chrome.com/docs/webstore/terms',/fee|US\$|\$\d/gi,8)
await grep('Google support fee','https://support.google.com/chrome_webstore/answer/1050673',/fee|US\$|\$\d/gi,8)

console.log('\n=== B: AMAZON CREATORS API (PA-API replacement) ===\n')
for (const u of [
 'https://affiliate-program.amazon.com/creatorsapi/docs/en-us/migrating-to-creatorsapi-from-paapi',
 'https://affiliate-program.amazon.com/creatorsapi/docs/en-us/',
 'https://affiliate-program.amazon.com/creatorsapi/docs/en-us/getting-started',
 'https://affiliate-program.amazon.com/creatorsapi/docs/en-us/onboarding',
 'https://webservices.amazon.com/paapi5/documentation/troubleshooting/api-rates.html',
]) await grep('CreatorsAPI', u, /qualif\w*|eligib\w*|sales|marketplace|amazon\.ca|Canada|deprecat\w*|rate limit|TPD|TPS|free|cost|requirement/gi, 12)

console.log('\n=== C: BEST BUY CANADA JSON ENDPOINT - full field dump ===\n')
{
 const r=await get('https://www.bestbuy.ca/api/v2/json/search?query=milwaukee%20m18%20drill&lang=en-CA&page=1&pageSize=3')
 if(r.err) console.log('ERR '+r.err)
 else { console.log(`HTTP ${r.status} ct=${r.ct} len=${r.body.length}`)
  try{const j=JSON.parse(r.body); console.log('total='+j.total+' keys='+Object.keys(j).join(','))
   const p=j.products&&j.products[0]; if(p){console.log('PRODUCT KEYS: '+Object.keys(p).join(','))
    console.log('PRODUCT SAMPLE: '+JSON.stringify({sku:p.sku,name:p.name,regularPrice:p.regularPrice,salePrice:p.salePrice,saving:p.saving,isOnSale:p.isOnSale,productUrl:p.productUrl,availability:p.availability,brandName:p.brandName}).slice(0,900))}
  }catch(e){console.log('JSON parse fail: '+e.message+' HEAD '+r.body.slice(0,300))}}
}
await grep('BestBuy.ca terms','https://www.bestbuy.ca/en-ca/help/legal/terms-and-conditions/blt0e5b6e0ba0ea0a68',/scrap\w*|spider|robot|crawl\w*|data.mining|automated|extract/gi,10)
await grep('BestBuy.ca terms2','https://www.bestbuy.ca/en-ca/about/terms-and-conditions-of-use/blt1d2f1e0f2e0a0a00',/scrap\w*|spider|robot|crawl\w*|automated/gi,6)

console.log('\n=== D: LIVE VERCEL SITE ===\n')
for (const u of [
 'https://canadian-tool-deals.vercel.app/',
 'https://canadian-tool-deals.vercel.app/api/debug',
 'https://canadian-tool-deals.vercel.app/api/search?q=Milwaukee%20M18%20drill',
 'https://canadian-tool-deals.vercel.app/api/search?q=zzqq%20unknown%20widget',
 'https://canadian-tool-deals.vercel.app/sitemap.xml',
 'https://canadian-tool-deals.vercel.app/og-image.png',
]) { const r=await get(u,H,45000)
  if(r.err){console.log(`[${u}] ERR ${r.err}\n`);continue}
  console.log(`[${u}] HTTP ${r.status} len=${r.body.length} ct=${one(r.ct)}`)
  console.log(`  BODY: ${one(r.body.slice(0,900))}\n`) }

console.log('\n=== E: SITEMAP->PDP JSON-LD (corrected URLs) ===\n')
const PDPSM=[['PrincessAuto','https://www.princessauto.com/en/categories-sitemap.xml',/princessauto\.com\/en\//],
 ['BestBuy','https://www.bestbuy.ca/sitemap_index.xml',/\/product\//],
 ['Walmart','https://www.walmart.ca/sitemap-product-1p-en.xml',/\/ip\//]]
for(const [n,sm,re] of PDPSM){
 const r=await get(sm); if(r.err){console.log(`[${n}] sitemap ERR ${r.err}`);continue}
 console.log(`[${n}] sitemap HTTP ${r.status} len=${r.body.length} ct=${one(r.ct)} HEAD ${one(r.body.slice(0,200))}`)
 let locs=[...r.body.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map(m=>m[1])
 let pdp=locs.find(u=>re.test(u)&&!/\.xml/.test(u))
 if(!pdp){ const sub=locs.find(u=>/\.xml/.test(u)); if(sub){const r2=await get(sub); if(!r2.err){const l2=[...r2.body.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map(m=>m[1]); pdp=l2.find(u=>re.test(u)); console.log(`  sub=${sub} HTTP ${r2.status} locs=${l2.length}`)}}}
 if(!pdp){console.log(`  no PDP found (locs=${locs.length})\n`);continue}
 const p=await get(pdp); if(p.err){console.log(`  PDP ${pdp} ERR ${p.err}\n`);continue}
 const ld=[...p.body.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1])
 let price=null; for(const b of ld){try{const s=JSON.stringify(JSON.parse(b)); if(/"Product"/.test(s)){const pm=s.match(/"price"\s*:\s*"?([\d.]+)"?/); if(pm){price=pm[1];break}}}catch{}}
 console.log(`  PDP ${pdp}\n  HTTP ${p.status} len=${p.body.length} ldBlocks=${ld.length} jsonldPrice=${price??'NONE'} challenge=${/captcha|Access Denied|Reference #\d|Verify Your Identity|Just a moment/i.test(p.body)}\n`)
}

console.log('\n=== F: FEEDS (corrected) + amazon robots /s rule ===\n')
for(const u of ['https://forums.redflagdeals.com/external.php?type=RSS2&forumids=9',
 'https://forums.redflagdeals.com/feed/forum/9',
 'https://www.redflagdeals.com/deals/feed',
 'https://www.reddit.com/r/canadiandeals/new.rss?limit=3',
 'https://www.reddit.com/r/tools/.rss?limit=3']){
 const r=await get(u,{...H,Accept:'application/rss+xml,application/xml,text/xml,*/*'})
 if(r.err){console.log(`[${u}] ERR ${r.err}`);continue}
 console.log(`[${u}] HTTP ${r.status} len=${r.body.length} ct=${one(r.ct)} items=${(r.body.match(/<item[ >]|<entry[ >]/g)||[]).length} HEAD ${one(r.body.slice(0,200))}`)
}
{const r=await get('https://www.amazon.ca/robots.txt')
 if(!r.err){const rel=r.body.split('\n').filter(l=>/\/s\?|\/s$|\/s\/|\/dp|\/gp\/product|Crawl-delay|Sitemap/i.test(l))
  console.log(`\n[amazon.ca robots.txt] HTTP ${r.status} relevant lines:\n  ${rel.join('\n  ')}`)}}
console.log('\n=== PROBE2 END ===')
