/**
 * A tiny headless-Chrome driver over the DevTools Protocol.
 *
 * Node 22 ships a global WebSocket, so this needs no dependencies. That matters:
 * the generator is dependency-free on purpose, and pulling in a browser-automation
 * library to take screenshots and print PDFs would be a large install for three
 * small jobs.
 *
 * Usage:
 *
 *   await withPage(async page => {
 *     await page.goto('file:///...')
 *     const value = await page.evaluate('document.title')
 *   })
 */

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createServer } from 'node:net'

const CANDIDATES = [
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
]

/** The browser binary, or null. `CHROME_PATH` wins when set. */
export function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH
  return CANDIDATES.find(p => existsSync(p)) ?? null
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

/** Ask the OS for a free TCP port, then give it straight back. */
function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      server.close(err => (err ? reject(err) : resolve(port)))
    })
  })
}

class Connection {
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
    return new Promise((resolve, reject) => {
      this.pending.set(id, m => (m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolve(m.result)))
    })
  }
}

async function debuggerUrl(port) {
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`)
      if (r.ok) return (await r.json()).webSocketDebuggerUrl
    } catch {
      // Chrome is still starting. The next poll is the retry.
    }
    await sleep(250)
  }
  throw new Error(`Chrome never opened a debugging port on ${port}`)
}

/**
 * Launch Chrome, hand a page to `fn`, then always shut the browser down.
 *
 * `settle` is how long to wait after a navigation before reading the page. These
 * pages have no scripts and no external requests, so a short wait is genuinely
 * enough rather than optimistic.
 */
export async function withPage(fn, { settle = 600 } = {}) {
  const chrome = findChrome()
  if (!chrome) {
    throw new Error('No Chrome or Chromium found. Set CHROME_PATH to a browser binary.')
  }

  // Bind an ephemeral port, note which one the OS gave us, release it, and hand
  // that number to Chrome. Deriving the port from the pid is cheaper but can
  // collide with a stale browser from an earlier run, and attaching to the wrong
  // Chrome fails in a thoroughly confusing way.
  const port = await freePort()
  const proc = spawn(chrome, [
    '--headless', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
    '--disable-dev-shm-usage', `--remote-debugging-port=${port}`, 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'ignore'] })

  try {
    const ws = new WebSocket(await debuggerUrl(port))
    await new Promise((resolve, reject) => {
      ws.onopen = resolve
      ws.onerror = () => reject(new Error('could not attach to Chrome'))
    })

    const cdp = new Connection(ws)
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' }, { session: false })
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true }, { session: false })
    cdp.sessionId = sessionId
    await cdp.send('Page.enable')
    await cdp.send('Runtime.enable')

    const page = {
      send: cdp.send.bind(cdp),

      async goto(url) {
        await cdp.send('Page.navigate', { url })
        await sleep(settle)
      },

      async evaluate(expression) {
        const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', { expression, returnByValue: true })
        // Without this a probe that throws comes back as a destructuring
        // TypeError three frames away, or worse, as a quietly passing check.
        if (exceptionDetails) {
          const text = exceptionDetails.exception?.description || exceptionDetails.text
          throw new Error(`page threw during evaluate: ${text}`)
        }
        return result.value
      },

      async viewport({ width, height = 900, mobile = false }) {
        await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile })
      },

      async colorScheme(value) {
        await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value }] })
      },

      async screenshot({ fullPage = true } = {}) {
        const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: fullPage })
        return Buffer.from(data, 'base64')
      },

      async pdf() {
        const { data } = await cdp.send('Page.printToPDF', { printBackground: true, preferCSSPageSize: true })
        return Buffer.from(data, 'base64')
      },
    }

    try {
      return await fn(page)
    } finally {
      ws.close()
    }
  } finally {
    proc.kill()
  }
}
