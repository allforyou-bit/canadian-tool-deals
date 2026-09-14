/** PROBE 3 - read only. */
const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const H={'User-Agent':UA,'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8','Accept-Language':'en-CA,en;q=0.9'}
async function get(u,h=H,ms=20000){const c=new AbortController();const t=setTimeout(()=>c.abort(),ms)
 try{const r=await fetch(u,{headers:h,signal:c.signal,redirect:'follow'});const b=await r.text();clearTimeout(t)
  return{status:r.status,url:r.url,body:b,ct:r.headers.get('content-type')||'',server:r.headers.get('server')||''}}catch(e){clearTimeout(t);return{err:String(e&&e.message||e)}}}
const one=s=>String(s).replace(/\s+/g,' ').trim()
const text=b=>b.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&[a-z]+;/g,' ').replace(/\s+/g,' ')
async function grep(label,url,re,n=8,pad=300){
  const r=await get(url); if(r.err){console.log(`[${label}] ${url}\n  ERR ${r.err}\n`);return}
  const t=text(r.body); const outs=[]; let m; re.lastIndex=0
  while((m=re.exec(t))&&outs.length<n){outs.push(t.slice(Math.max(0,m.index-pad),m.index+pad));re.lastIndex=m.index+pad}
  console.log(`[${label}] ${url}\n  HTTP ${r.status} textLen=${t.length}`)
  outs.forEach(o=>console.log(`  » ${o}`)); if(!outs.length)console.log(`  NO MATCH`); console.log('')
}
console.log('=== A: CHROME WEB STORE FEE AMOUNT (hunt primary source) ===\n')
for (const u of [
 'https://developer.chrome.com/docs/webstore/i18n',
 'https://developer.chrome.com/docs/webstore/cws-dashboard-account',
 'https://developer.chrome.com/docs/webstore/publish',
 'https://support.google.com/chrome_webstore/contact/dev_account_fee',
 'https://groups.google.com/a/chromium.org/g/chromium-extensions',
]) await grep('CWSfee', u, /registration fee|\$\s?5|US\$5|one-time fee|5\.00/gi, 6)

console.log('\n=== B: MV3 FETCH CREDENTIALS / COOKIES (spec + chrome docs) ===\n')
await grep('MDN fetch credentials','https://developer.mozilla.org/en-US/docs/Web/API/RequestInit',/credentials/gi,5)
await grep('Chrome xhr docs','https://developer.chrome.com/docs/extensions/develop/concepts/network-requests',/cookie|credentials|CORS|host permission/gi,8)
await grep('Chrome CORS docs','https://developer.chrome.com/docs/extensions/reference/manifest/host-permissions',/cookie|cross-origin|fetch/gi,6)
await grep('Chrome policies single purpose','https://developer.chrome.com/docs/webstore/program-policies/single-purpose',/single purpose|narrow|breadth/gi,6)
await grep('Chrome policies quality','https://developer.chrome.com/docs/webstore/program-policies/quality-guidelines',/functional|minimum|placeholder/gi,5)

console.log('\n=== C: CANADIAN TIRE API HOSTS (is any live?) ===\n')
for (const u of [
 'https://api.canadiantire.ca/search/api/v0/product/en/?q=drill&store=0144&lang=en&site=ct&format=json&numItems=3&fromPos=0',
 'https://apim.canadiantire.ca/v1/search/v2/search?store=0144&q=drill&lang=en_CA&baseStoreId=CTR&count=3',
 'https://apim.canadiantire.ca/v1/search/search?store=0144&q=drill&lang=en_CA&baseStoreId=CTR&count=3',
 'https://www.canadiantire.ca/',
]) { const r=await get(u); if(r.err){console.log(`[${u}]\n  ERR ${r.err}`);continue}
  console.log(`[${u}]\n  HTTP ${r.status} ct=${one(r.ct)} server=${one(r.server)} len=${r.body.length} HEAD ${one(r.body.slice(0,220))}`) }

console.log('\n=== D: HOME DEPOT CA - total blackhole check ===\n')
for (const u of ['https://www.homedepot.ca/','https://www.homedepot.ca/robots.txt','https://api.homedepot.ca/','https://www.homedepot.ca/en/home.html'])
 { const r=await get(u,H,12000); console.log(`[${u}] ${r.err?('ERR '+r.err):('HTTP '+r.status+' len='+r.body.length+' server='+one(r.server))}`) }

console.log('\n=== E: BEST BUY CA - robots /api check + PDP JSON-LD + price fields on sale item ===\n')
{ const r=await get('https://www.bestbuy.ca/robots.txt')
  if(!r.err) console.log('robots mentions /api ? ' + /\/api/i.test(r.body) + '  | full body:\n' + r.body) }
{ const r=await get('https://www.bestbuy.ca/api/v2/json/search?categoryid=&query=dewalt&lang=en-CA&page=1&pageSize=5&sortBy=price&sortDir=asc')
  if(r.err) console.log('search ERR '+r.err)
  else { try{const j=JSON.parse(r.body); console.log('HTTP '+r.status+' total='+j.total)
    for(const p of (j.products||[]).slice(0,5)) console.log('  '+JSON.stringify({sku:p.sku,name:(p.name||'').slice(0,60),regularPrice:p.regularPrice,salePrice:p.salePrice,isOnSale:p.isOnSale,hasPromotion:p.hasPromotion,saleEndDate:p.saleEndDate,url:p.productUrl}))
    const first=(j.products||[])[0]
    if(first){ const pdp=await get('https://www.bestbuy.ca'+first.productUrl)
      if(!pdp.err){ const ld=[...pdp.body.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1])
        let price=null,name=null; for(const b of ld){try{const j2=JSON.parse(b);const s=JSON.stringify(j2);if(/"Product"/.test(s)){const pm=s.match(/"price"\s*:\s*"?([\d.]+)"?/);const nm=s.match(/"name"\s*:\s*"([^"]{5,80})"/);price=pm&&pm[1];name=nm&&nm[1];break}}catch{}}
        console.log(`  PDP HTTP ${pdp.status} len=${pdp.body.length} ldBlocks=${ld.length} jsonldName=${name} jsonldPrice=${price}`) } } }
   catch(e){console.log('parse fail '+e.message+' HEAD '+r.body.slice(0,200))} } }
console.log('\n=== F: RFD feed sample items (deal titles+prices?) ===\n')
{ const r=await get('https://forums.redflagdeals.com/feed/forum/9',{...H,Accept:'application/atom+xml,*/*'})
  if(!r.err){ const titles=[...r.body.matchAll(/<title[^>]*>([\s\S]*?)<\/title>/g)].map(m=>one(m[1])).slice(0,10)
   console.log('HTTP '+r.status+' first titles:'); titles.forEach(t=>console.log('  - '+t)) } }
console.log('\n=== PROBE3 END ===')
