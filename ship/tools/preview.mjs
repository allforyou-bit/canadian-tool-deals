#!/usr/bin/env node
/**
 * Screenshot a built page, and check it for horizontal overflow while doing it.
 *
 *   node ship/tools/preview.mjs                     every built site
 *   node ship/tools/preview.mjs acme-co             one site
 *   node ship/tools/preview.mjs --check             no images, overflow check only
 *   node ship/tools/preview.mjs --out ./somewhere   where the PNGs go
 *
 * Drives headless Chrome over the DevTools Protocol directly. Node 22 ships a
 * global WebSocket, so this needs no dependencies — which matters because the
 * whole generator is dependency-free and adding Playwright for screenshots would
 * be a 200 MB install to take three pictures.
 *
 * Two reasons this exists:
 *  - "works on a phone" is a claim made on the landing page, so it gets verified
 *    on every build rather than eyeballed once.
 *  - a client who is about to pay wants to see the page, and a PNG travels
 *    through email and a phone better than a URL does.
 */

import { spawn } from 'node:child_process'
import { readdirSync, existsSync, mkdirSync, writeFileSync, statSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const DIST = resolve(HERE, '..', 'dist')

/** Where the browser lives in this environment; override with CHROME_PATH. */
const CHROME = process.env.CHROME_PATH
  || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/usr/bin/chromium', '/usr/bin/google-chrome']
    .find(p => existsSync(p))

const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844, mobile: true, dark: false },
  { name: 'desktop', width: 1280, height: 900, mobile: false, dark: false },
  { name: 'desktop-dark', width: 1280, height: 900, mobile: false, dark: true },
]

const sleep = ms => new Promise(r => setTimeout(r, ms))

class CDP {
  constructor(ws) {
    this.ws = ws
    this.id = 0
    this.pending = new Map()
    this.sessionId = null
    ws.onmessage = e => {
      const m = JSON.parse(e.data)
      const settle = this.pending.get(m.id)
      if (settle) {
        this.pending.delete(m.id)
        settle(m)
      }
    }
  }

  send(method, params = {}, { session = true } = {}) {
    const id = ++this.id
    const msg = { id, method, params }
    if (session && this.sessionId) msg.sessionId = this.sessionId
    this.ws.send(JSON.stringify(msg))
    return new Promise((res, rej) => {
      this.pending.set(id, m => (m.error ? rej(new Error(`${method}: ${m.error.message}`)) : res(m.result)))
    })
  }
}

async function debuggerUrl(port) {
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`)
      if (r.ok) return (await r.json()).webSocketDebuggerUrl
    } catch {
      // Chrome is still starting; the next poll is the retry.
    }
    await sleep(250)
  }
  throw new Error(`Chrome never opened a debugging port on ${port}`)
}

/** Elements sticking out past the viewport, ignoring deliberately off-screen ones. */
const OVERFLOW_PROBE = `(() => {
  const de = document.documentElement
  const out = []
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect()
    if (r.width === 0 && r.height === 0) continue
    if (r.left < -500) continue            // skip links and other off-canvas helpers
    if (r.right > de.clientWidth + 1) {
      out.push({
        tag: el.tagName.toLowerCase(),
        cls: typeof el.className === 'string' ? el.className.slice(0, 40) : '',
        right: Math.round(r.right),
        text: (el.textContent || '').trim().slice(0, 40),
      })
    }
  }
  return { viewport: de.clientWidth, scrollWidth: de.scrollWidth, overflowing: out.slice(0, 6) }
})()`

function sitesToShoot(only) {
  if (!existsSync(DIST)) {
    console.error(`No build found at ${DIST}. Run: node ship/build.mjs`)
    process.exit(1)
  }
  const sites = []
  if (existsSync(join(DIST, 'index.html'))) sites.push({ slug: '_site', file: join(DIST, 'index.html') })
  for (const entry of readdirSync(DIST)) {
    const dir = join(DIST, entry)
    if (!statSync(dir).isDirectory()) continue
    const file = join(dir, 'index.html')
    if (existsSync(file)) sites.push({ slug: entry, file })
  }
  return only.length ? sites.filter(s => only.includes(s.slug)) : sites
}

async function main() {
  const args = process.argv.slice(2)
  const checkOnly = args.includes('--check')
  const outIdx = args.indexOf('--out')
  const outDir = outIdx !== -1 ? resolve(args[outIdx + 1]) : join(DIST, '_preview')
  const only = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--out')

  if (!CHROME) {
    console.error('No Chrome or Chromium found. Set CHROME_PATH to a browser binary.')
    process.exit(1)
  }

  const sites = sitesToShoot(only)
  if (!sites.length) {
    console.error(`Nothing to preview${only.length ? ` for ${only.join(', ')}` : ''}.`)
    process.exit(1)
  }

  const port = 9222 + (process.pid % 500)
  const chrome = spawn(CHROME, [
    '--headless', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
    '--disable-dev-shm-usage', `--remote-debugging-port=${port}`, 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'ignore'] })

  let failures = 0
  try {
    const ws = new WebSocket(await debuggerUrl(port))
    await new Promise((res, rej) => {
      ws.onopen = res
      ws.onerror = () => rej(new Error('could not attach to Chrome'))
    })
    const cdp = new CDP(ws)
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' }, { session: false })
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true }, { session: false })
    cdp.sessionId = sessionId
    await cdp.send('Page.enable')
    await cdp.send('Runtime.enable')

    if (!checkOnly) mkdirSync(outDir, { recursive: true })

    for (const site of sites) {
      for (const vp of VIEWPORTS) {
        await cdp.send('Emulation.setDeviceMetricsOverride', {
          width: vp.width, height: vp.height, deviceScaleFactor: 1, mobile: vp.mobile,
        })
        await cdp.send('Emulation.setEmulatedMedia', {
          features: [{ name: 'prefers-color-scheme', value: vp.dark ? 'dark' : 'light' }],
        })
        await cdp.send('Page.navigate', { url: pathToFileURL(site.file).href })
        await sleep(600)

        const { result } = await cdp.send('Runtime.evaluate', { expression: OVERFLOW_PROBE, returnByValue: true })
        const { viewport, scrollWidth, overflowing } = result.value
        const overflows = scrollWidth > viewport + 1

        let note = ''
        if (!checkOnly) {
          const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
          const name = `${site.slug}-${vp.name}.png`
          const buf = Buffer.from(shot.data, 'base64')
          writeFileSync(join(outDir, name), buf)
          note = ` -> ${name} (${(buf.length / 1024).toFixed(0)} kB)`
        }

        if (overflows) {
          failures++
          console.error(`FAIL ${site.slug} ${vp.name}: scrollWidth ${scrollWidth} > viewport ${viewport}`)
          for (const o of overflowing) {
            console.error(`       <${o.tag}${o.cls ? ` class="${o.cls}"` : ''}> right=${o.right} :: ${JSON.stringify(o.text)}`)
          }
        } else {
          console.log(`ok   ${site.slug} ${vp.name.padEnd(13)} ${String(vp.width).padStart(4)}px${note}`)
        }
      }
    }

    ws.close()
  } finally {
    chrome.kill()
  }

  if (failures) {
    console.error(`\n${failures} viewport${failures === 1 ? '' : 's'} overflow horizontally.`)
    process.exit(1)
  }
  console.log(`\nAll viewports clean${checkOnly ? '' : ` — images in ${outDir}`}`)
}

await main()
