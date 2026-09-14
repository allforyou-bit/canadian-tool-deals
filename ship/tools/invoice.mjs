#!/usr/bin/env node
/**
 * Invoice and receipt generator.
 *
 *   node ship/tools/invoice.mjs ship/sales/invoices/2026-001.json
 *   node ship/tools/invoice.mjs ship/sales/invoices/2026-001.json --receipt
 *   node ship/tools/invoice.mjs ... --out ./somewhere      (default: alongside the JSON)
 *   node ship/tools/invoice.mjs ... --html-only            (skip the PDF)
 *
 * Writes an HTML file and, unless --html-only, prints it to PDF through headless
 * Chrome over the DevTools Protocol. No dependencies: no PDF library, no template
 * engine, and nothing that needs to be kept up to date.
 *
 * The tax line is deliberately opt-in. Canada Revenue Agency treats a business
 * under CAD 30,000 of revenue over four consecutive calendar quarters as a small
 * supplier, which is not required to register for or charge GST/HST. Below that
 * line an invoice has no tax on it, and putting one there anyway is a mistake in
 * the customer's favour that you then owe to nobody. Set `tax` in the JSON only
 * once you have registered and have a business number to print.
 */

import { spawn } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, basename, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { esc, inline } from '../lib/html.mjs'
import { formatDate } from '../lib/legal.mjs'

const CHROME = process.env.CHROME_PATH
  || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/usr/bin/chromium', '/usr/bin/google-chrome']
    .find(p => existsSync(p))

const sleep = ms => new Promise(r => setTimeout(r, ms))

const money = n => `$${n.toFixed(2)}`

function required(doc, path) {
  const value = path.split('.').reduce((o, k) => (o == null ? o : o[k]), doc)
  if (value === undefined || value === null || value === '') {
    throw new Error(`missing required field: ${path}`)
  }
  return value
}

function validate(doc) {
  const problems = []
  for (const p of ['number', 'date', 'from.name', 'from.email', 'to.name', 'currency', 'payment.method']) {
    try { required(doc, p) } catch (e) { problems.push(e.message) }
  }
  if (!Array.isArray(doc.items) || !doc.items.length) problems.push('items: expected at least one line')
  else doc.items.forEach((it, i) => {
    if (!it.description) problems.push(`items[${i}].description: required`)
    if (typeof it.amount !== 'number' || !Number.isFinite(it.amount)) problems.push(`items[${i}].amount: expected a number`)
  })
  if (doc.tax && (typeof doc.tax.rate !== 'number' || !doc.tax.label)) {
    problems.push('tax: needs both a numeric rate (e.g. 0.13) and a label (e.g. "HST 13%")')
  }
  if (doc.tax && !doc.tax.number) {
    problems.push('tax.number: a GST/HST number must appear on an invoice that charges GST/HST')
  }
  for (const value of JSON.stringify(doc).matchAll(/REPLACE-[A-Z-]+/g)) {
    problems.push(`${value[0]} is still a placeholder`)
  }
  if (problems.length) {
    console.error('Invoice is not ready:')
    for (const p of problems) console.error(`  - ${p}`)
    process.exit(1)
  }
}

function render(doc, { receipt }) {
  const subtotal = doc.items.reduce((sum, it) => sum + it.amount, 0)
  const taxAmount = doc.tax ? subtotal * doc.tax.rate : 0
  const total = subtotal + taxAmount
  const title = receipt ? 'Receipt' : 'Invoice'
  const paidStamp = receipt
    ? `<p class="paid">Paid in full${doc.paidOn ? ` on ${esc(formatDate(doc.paidOn))}` : ''}. Thank you.</p>`
    : ''

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title} ${esc(doc.number)} — ${esc(doc.from.name)}</title>
<style>
  @page { size: letter; margin: 18mm 16mm; }
  /* The page margin only applies to print. Mirror it on screen so the HTML copy
     looks like the PDF when a client opens it in a browser. */
  @media screen { body { max-width: 216mm; margin: 0 auto; padding: 18mm 16mm; } }
  * { box-sizing: border-box; }
  body {
    margin: 0; color: #16181d; background: #fff;
    font: 400 10.5pt/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans KR", Arial, sans-serif;
  }
  h1 { font-size: 22pt; margin: 0 0 2pt; letter-spacing: -0.02em; }
  .muted { color: #6b7280; }
  .head { display: flex; justify-content: space-between; gap: 24pt; align-items: flex-start; margin-bottom: 26pt; }
  .num { text-align: right; font-size: 9.5pt; }
  .num b { display: block; font-size: 11pt; }
  .parties { display: flex; gap: 28pt; margin-bottom: 24pt; }
  .parties > div { flex: 1; }
  .label { font-size: 7.5pt; letter-spacing: 0.09em; text-transform: uppercase; color: #9aa0ab; margin-bottom: 4pt; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 4pt; }
  th { text-align: left; font-size: 7.5pt; letter-spacing: 0.09em; text-transform: uppercase; color: #9aa0ab; font-weight: 600; padding: 0 0 6pt; border-bottom: 1px solid #d9dce2; }
  td { padding: 9pt 0; border-bottom: 1px solid #eceef2; vertical-align: top; }
  th:last-child, td:last-child { text-align: right; white-space: nowrap; }
  .totals { width: 46%; margin-left: auto; margin-top: 10pt; }
  .totals tr td { border: 0; padding: 3pt 0; }
  .totals tr:last-child td { border-top: 1.5px solid #16181d; padding-top: 8pt; font-size: 13pt; font-weight: 650; }
  .pay { margin-top: 26pt; border: 1px solid #d9dce2; border-radius: 6pt; padding: 13pt 15pt; }
  .pay h2 { font-size: 10pt; margin: 0 0 6pt; letter-spacing: 0.02em; }
  .pay p { margin: 0 0 4pt; }
  .pay .big { font-size: 12pt; font-weight: 620; }
  .notes { margin-top: 20pt; font-size: 9pt; color: #4b5563; }
  .notes p { margin: 0 0 5pt; }
  .paid { margin-top: 18pt; padding: 9pt 13pt; border: 1.5px solid #15803d; color: #15803d; border-radius: 6pt; font-weight: 620; }
  .foot { margin-top: 26pt; padding-top: 10pt; border-top: 1px solid #eceef2; font-size: 8.5pt; color: #9aa0ab; }
</style>
</head>
<body>
<div class="head">
  <div>
    <h1>${title}</h1>
    <p class="muted" style="margin:0">${esc(doc.from.name)}</p>
  </div>
  <div class="num">
    <b>${esc(doc.number)}</b>
    <span class="muted">Issued ${esc(formatDate(doc.date))}</span><br>
    ${doc.due && !receipt ? `<span class="muted">Due ${esc(formatDate(doc.due))}</span>` : ''}
  </div>
</div>

<div class="parties">
  <div>
    <p class="label">From</p>
    <p style="margin:0">${esc(doc.from.name)}<br>
    ${doc.from.address ? `${esc(doc.from.address)}<br>` : ''}
    ${esc(doc.from.email)}${doc.from.phone ? `<br>${esc(doc.from.phone)}` : ''}</p>
  </div>
  <div>
    <p class="label">Billed to</p>
    <p style="margin:0">${esc(doc.to.name)}<br>
    ${doc.to.company ? `${esc(doc.to.company)}<br>` : ''}
    ${doc.to.email ? esc(doc.to.email) : ''}</p>
  </div>
</div>

<table>
  <thead><tr><th>Description</th><th>Amount</th></tr></thead>
  <tbody>
${doc.items.map(it => `    <tr><td>${inline(it.description)}${it.detail ? `<br><span class="muted">${inline(it.detail)}</span>` : ''}</td><td>${money(it.amount)}</td></tr>`).join('\n')}
  </tbody>
</table>

<table class="totals">
  <tr><td class="muted">Subtotal</td><td>${money(subtotal)}</td></tr>
${doc.tax ? `  <tr><td class="muted">${esc(doc.tax.label)}</td><td>${money(taxAmount)}</td></tr>` : ''}
  <tr><td>Total ${esc(doc.currency)}</td><td>${money(total)}</td></tr>
</table>

${paidStamp}

${receipt ? '' : `<div class="pay">
  <h2>How to pay</h2>
  <p class="big">${esc(doc.payment.method)}</p>
  ${doc.payment.address ? `<p>To: <b>${esc(doc.payment.address)}</b></p>` : ''}
  ${doc.payment.reference ? `<p class="muted">Reference: ${esc(doc.payment.reference)}</p>` : ''}
  ${doc.payment.note ? `<p class="muted">${inline(doc.payment.note)}</p>` : ''}
</div>`}

<div class="notes">
${doc.tax ? `  <p>${esc(doc.tax.label)} charged. GST/HST number ${esc(doc.tax.number)}.</p>`
          : '  <p>No GST/HST is charged on this invoice. The supplier is a small supplier under the Canada Revenue Agency threshold and is not registered for GST/HST.</p>'}
${(doc.notes ?? []).map(n => `  <p>${inline(n)}</p>`).join('\n')}
</div>

<p class="foot">${esc(doc.from.name)} · ${esc(doc.from.email)}${doc.reference ? ` · ${esc(doc.reference)}` : ''}</p>
</body>
</html>
`
}

async function toPdf(htmlPath, pdfPath) {
  if (!CHROME) {
    console.error('No Chrome found for PDF output. Set CHROME_PATH, or pass --html-only.')
    process.exit(1)
  }
  const port = 9400 + (process.pid % 400)
  const chrome = spawn(CHROME, [
    '--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    `--remote-debugging-port=${port}`, 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'ignore'] })

  try {
    let wsUrl = null
    for (let i = 0; i < 80 && !wsUrl; i++) {
      try {
        const r = await fetch(`http://127.0.0.1:${port}/json/version`)
        if (r.ok) wsUrl = (await r.json()).webSocketDebuggerUrl
      } catch { /* still starting */ }
      if (!wsUrl) await sleep(250)
    }
    if (!wsUrl) throw new Error('Chrome never opened a debugging port')

    const ws = new WebSocket(wsUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('could not attach to Chrome')) })

    let id = 0
    const pending = new Map()
    let sessionId = null
    ws.onmessage = e => {
      const m = JSON.parse(e.data)
      const settle = pending.get(m.id)
      if (settle) { pending.delete(m.id); settle(m) }
    }
    const send = (method, params = {}, useSession = true) => {
      const msgId = ++id
      const msg = { id: msgId, method, params }
      if (useSession && sessionId) msg.sessionId = sessionId
      ws.send(JSON.stringify(msg))
      return new Promise((res, rej) => pending.set(msgId, m => (m.error ? rej(new Error(`${method}: ${m.error.message}`)) : res(m.result))))
    }

    const { targetId } = await send('Target.createTarget', { url: 'about:blank' }, false)
    const attached = await send('Target.attachToTarget', { targetId, flatten: true }, false)
    sessionId = attached.sessionId
    await send('Page.enable')
    await send('Page.navigate', { url: pathToFileURL(htmlPath).href })
    await sleep(700)
    const { data } = await send('Page.printToPDF', {
      printBackground: true,
      preferCSSPageSize: true,
    })
    writeFileSync(pdfPath, Buffer.from(data, 'base64'))
    ws.close()
  } finally {
    chrome.kill()
  }
}

async function main() {
  const args = process.argv.slice(2)
  const receipt = args.includes('--receipt')
  const htmlOnly = args.includes('--html-only')
  const outIdx = args.indexOf('--out')
  const files = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--out')

  if (!files.length) {
    console.error('Usage: node ship/tools/invoice.mjs <invoice.json> [--receipt] [--html-only] [--out dir]')
    process.exit(1)
  }

  for (const file of files) {
    const path = resolve(file)
    const doc = JSON.parse(readFileSync(path, 'utf8'))
    validate(doc)

    const outDir = outIdx !== -1 ? resolve(args[outIdx + 1]) : dirname(path)
    mkdirSync(outDir, { recursive: true })
    const stem = `${receipt ? 'receipt' : 'invoice'}-${doc.number}`.replace(/[^A-Za-z0-9._-]/g, '-')
    const htmlPath = join(outDir, `${stem}.html`)
    const pdfPath = join(outDir, `${stem}.pdf`)

    writeFileSync(htmlPath, render(doc, { receipt }))
    const total = doc.items.reduce((s, it) => s + it.amount, 0) * (doc.tax ? 1 + doc.tax.rate : 1)
    console.log(`${basename(htmlPath)}  ${doc.currency} ${money(total)}  ->  ${htmlPath}`)

    if (!htmlOnly) {
      await toPdf(htmlPath, pdfPath)
      console.log(`${basename(pdfPath)}  ->  ${pdfPath}`)
    }
  }
}

await main()
