#!/usr/bin/env node
/**
 * Serve the build over HTTP and check every internal link actually resolves.
 *
 *   node ship/tools/links.mjs
 *   node ship/tools/links.mjs --port 8788
 *
 * Checking links against the filesystem gets root-absolute hrefs wrong: `/ko/` is
 * relative to the deployed site root, not to the directory the file sits in. The
 * only way to check them honestly is to serve the output the way a host would and
 * ask for the URL.
 *
 * Also checks in-page anchors resolve to an element that exists, since a `#price`
 * pointing at nothing is a dead link a status code will never catch.
 */

import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join, resolve, extname, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { withPage } from '../lib/chrome.mjs'

const DIST = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist')

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
}

/** Static server that behaves like a host: directories serve index.html. */
function serve(root) {
  return new Promise(resolvePort => {
    const server = createServer(async (req, res) => {
      try {
        const url = new URL(req.url, 'http://localhost')
        let path = decodeURIComponent(url.pathname)
        // Reject traversal outright rather than relying on resolve() alone.
        if (path.includes('..')) {
          res.writeHead(400).end('bad path')
          return
        }
        let file = join(root, path)
        if (existsSync(file) && (await stat(file)).isDirectory()) file = join(file, 'index.html')
        if (!existsSync(file)) {
          res.writeHead(404).end('not found')
          return
        }
        res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' })
        res.end(await readFile(file))
      } catch {
        res.writeHead(500).end('error')
      }
    })
    server.listen(0, '127.0.0.1', () => resolvePort({ server, port: server.address().port }))
  })
}

function htmlFiles(dir, base = dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) out.push(...htmlFiles(p, base))
    else if (entry.endsWith('.html')) out.push('/' + p.slice(base.length + 1).replace(/\\/g, '/'))
  }
  return out
}

const PROBE = `(() => {
  const ids = new Set([...document.querySelectorAll('[id]')].map(e => e.id))
  return {
    ids: [...ids],
    links: [...document.querySelectorAll('a[href]')]
      .map(a => ({ raw: a.getAttribute('href'), resolved: a.href })),
  }
})()`

if (!existsSync(DIST)) {
  console.error(`No build at ${DIST}. Run: node ship/build.mjs`)
  process.exit(1)
}

const pages = htmlFiles(DIST)
const { server, port } = await serve(DIST)
const origin = `http://127.0.0.1:${port}`

let checked = 0
const failures = []

try {
  await withPage(async page => {
    for (const path of pages) {
      await page.goto(`${origin}${path}`)
      const { ids, links } = await page.evaluate(PROBE)

      for (const link of links) {
        const { raw, resolved } = link
        if (/^(mailto:|tel:)/i.test(raw)) continue

        if (raw.startsWith('#')) {
          checked++
          const id = raw.slice(1)
          if (!ids.includes(id)) failures.push(`${path}: anchor ${raw} has no matching element`)
          continue
        }

        // Absolute links to somewhere else are not ours to verify.
        if (/^https?:/i.test(raw) && !resolved.startsWith(origin)) continue

        checked++
        const target = new URL(resolved)
        const res = await fetch(target.href, { redirect: 'manual' })
        if (res.status !== 200) {
          failures.push(`${path}: ${raw} -> HTTP ${res.status}`)
        } else if (target.hash && target.pathname !== path) {
          // A cross-page anchor: confirm the id exists on the page it lands on.
          const body = await res.text()
          const id = target.hash.slice(1)
          if (!new RegExp(`id="${id}"`).test(body)) {
            failures.push(`${path}: ${raw} resolves but ${target.pathname} has no id="${id}"`)
          }
        }
      }
    }
  }, { settle: 350 })
} finally {
  server.close()
}

if (failures.length) {
  for (const f of failures) console.error(`FAIL ${f}`)
  console.error(`\n${failures.length} of ${checked} links broken across ${pages.length} pages.`)
  process.exit(1)
}
console.log(`All ${checked} links resolve across ${pages.length} pages, served over HTTP.`)
