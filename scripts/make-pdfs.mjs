// Saves every printable page as a Letter-size PDF in business/print/.
// Usage: npm run build && npm run pdf   (PDF_ONLY=<regex> limits which files are written)
// Needs Playwright + Chromium: `npm i -D playwright && npx playwright install chromium`
// (or set PLAYWRIGHT_MODULE to the path of an existing playwright install).
import { createServer } from 'node:http'
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { extname, join, resolve } from 'node:path'

const ROOT = resolve('out')
const OUT = resolve('business/print')
if (!existsSync(ROOT)) {
  console.error('No ./out folder — run `npm run build` first.')
  process.exit(1)
}

const require = createRequire(import.meta.url)
let playwright
try {
  playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
} catch {
  console.error('Playwright is not installed. Run: npm i -D playwright && npx playwright install chromium')
  process.exit(1)
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.txt': 'text/plain', '.xml': 'application/xml' }
const server = createServer((req, res) => {
  let p = join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname))
  if (existsSync(p) && statSync(p).isDirectory()) p = join(p, 'index.html')
  if (!existsSync(p)) {
    res.writeHead(404)
    return res.end()
  }
  res.writeHead(200, { 'Content-Type': TYPES[extname(p)] || 'application/octet-stream' })
  createReadStream(p).pipe(res)
})
await new Promise((r) => server.listen(0, r))
const base = `http://127.0.0.1:${server.address().port}`

const JOBS = []
for (const lang of ['en', 'ko']) {
  const p = lang === 'ko' ? '/ko' : ''
  for (const c of ['c1', 'c2', 'c3']) {
    JOBS.push([`${p}/print/door-hanger/${c}/`, `door-hanger-${lang}-${c}.pdf`])
    JOBS.push([`${p}/print/flyer/${c}/`, `flyer-${lang}-${c}.pdf`])
  }
  JOBS.push([`${p}/print/price-sheet/`, `price-sheet-${lang}.pdf`])
  for (const s of ['cleaning', 'gutters', 'snow']) JOBS.push([`${p}/agreements/${s}/`, `agreement-${s}-${lang}.pdf`])
}

mkdirSync(OUT, { recursive: true })
const browser = await playwright.chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
const only = process.env.PDF_ONLY ? new RegExp(process.env.PDF_ONLY) : null
let n = 0
for (const [path, file] of JOBS) {
  if (only && !only.test(file)) continue
  // Pages for switched-off services are not built — skip them before navigating.
  if (!existsSync(join(ROOT, path, 'index.html'))) {
    console.log(`skip ${path} (not built — service switched off)`)
    continue
  }
  const page = await browser.newPage()
  const res = await page.goto(base + path, { waitUntil: 'networkidle' })
  if (!res || !res.ok()) throw new Error(`Failed to load ${path}: ${res ? res.status() : 'no response'}`)
  await page.emulateMedia({ media: 'print' })
  await page.pdf({ path: join(OUT, file), format: 'Letter', printBackground: true, preferCSSPageSize: true })
  await page.close()
  n++
}
await browser.close()
server.close()
console.log(`Saved ${n} PDFs to business/print/`)
