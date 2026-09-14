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

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, basename, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { esc, inline } from '../lib/html.mjs'
import { formatDate } from '../lib/legal.mjs'
import { withPage, findChrome } from '../lib/chrome.mjs'
import { loadOperator, applyOperator } from '../lib/operator.mjs'

const money = n => `$${n.toFixed(2)}`

/**
 * The money, computed once.
 *
 * Both the rendered document and the console line read from here. Computing the
 * total two different ways (`subtotal * (1 + rate)` in one place, `subtotal +
 * subtotal * rate` in the other) puts them a cent apart on some amounts, and a
 * client-facing invoice that disagrees with itself is not a rounding curiosity.
 */
function totals(doc) {
  const subtotal = doc.items.reduce((sum, it) => sum + it.amount, 0)
  const tax = doc.tax ? Math.round(subtotal * doc.tax.rate * 100) / 100 : 0
  return { subtotal, tax, total: Math.round((subtotal + tax) * 100) / 100 }
}

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
  // formatDate() indexes a month array, so a non-ISO date silently renders as
  // "Issued undefined undefined NaN" on a document that goes to a client.
  for (const field of ['date', 'due', 'paidOn']) {
    const value = doc[field]
    if (value === undefined) continue
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      problems.push(`${field}: expected YYYY-MM-DD, got ${JSON.stringify(value)}`)
      continue
    }
    const [y, m, d] = value.split('-').map(Number)
    const probe = new Date(Date.UTC(y, m - 1, d))
    if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) {
      problems.push(`${field}: ${value} is not a real calendar date`)
    }
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
  const { subtotal, tax: taxAmount, total } = totals(doc)
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
  await withPage(async page => {
    await page.goto(pathToFileURL(htmlPath).href)
    writeFileSync(pdfPath, await page.pdf())
  }, { settle: 700 })
}

async function main() {
  const args = process.argv.slice(2)
  const receipt = args.includes('--receipt')
  const htmlOnly = args.includes('--html-only')
  const outIdx = args.indexOf('--out')
  if (outIdx !== -1 && !args[outIdx + 1]) {
    console.error('--out needs a directory')
    process.exit(1)
  }
  const files = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--out')

  if (!files.length) {
    console.error('Usage: node ship/tools/invoice.mjs <invoice.json> [--receipt] [--html-only] [--out dir]')
    process.exit(1)
  }

  if (!htmlOnly && !findChrome()) {
    console.error('No Chrome found for PDF output. Set CHROME_PATH, or pass --html-only.')
    process.exit(1)
  }

  for (const file of files) {
    const path = resolve(file)
    // Same substitution the briefs get, so the invoice carries the operator's
    // legal name from the one place it is written down.
    const doc = applyOperator(JSON.parse(readFileSync(path, 'utf8')), loadOperator())
    validate(doc)

    const outDir = outIdx !== -1 ? resolve(args[outIdx + 1]) : dirname(path)
    mkdirSync(outDir, { recursive: true })
    const stem = `${receipt ? 'receipt' : 'invoice'}-${doc.number}`.replace(/[^A-Za-z0-9._-]/g, '-')
    const htmlPath = join(outDir, `${stem}.html`)
    const pdfPath = join(outDir, `${stem}.pdf`)

    writeFileSync(htmlPath, render(doc, { receipt }))
    console.log(`${basename(htmlPath)}  ${doc.currency} ${money(totals(doc).total)}  ->  ${htmlPath}`)

    if (!htmlOnly) {
      await toPdf(htmlPath, pdfPath)
      console.log(`${basename(pdfPath)}  ->  ${pdfPath}`)
    }
  }
}

await main()
