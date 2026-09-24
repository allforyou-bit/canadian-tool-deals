#!/usr/bin/env node
// Runs one of the TypeScript ops scripts with plain Node, without npm scripts or a TS runtime:
// esbuild (already in node_modules as a wrangler/vitest dependency) bundles a tiny entry that
// imports the script's exported `main(args)` and exits with the code it returns.
//
// Usage (from products/clb):  node scripts/run.mjs scripts/content-lint.ts [args...]
//
// npm packages stay external (resolved from products/clb/node_modules at run time); the bundle
// is written to products/clb/.cache/ (gitignored).
//
// SIGINT/SIGTERM (a cancelled Actions run, Ctrl-C) are passed on to the script, so a script that
// handles them (the eval scripts cancel their Message Batch) gets the chance to clean up.
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const [entryArg, ...args] = process.argv.slice(2)
if (!entryArg) {
  console.error('usage: node scripts/run.mjs <script.ts> [args...]')
  process.exit(2)
}
const entry = resolve(entryArg)
if (!existsSync(entry)) {
  console.error(`run.mjs: ${entryArg} not found`)
  process.exit(2)
}

const esbuild = join(projectDir, 'node_modules', '.bin', 'esbuild')
if (!existsSync(esbuild)) {
  console.error('run.mjs: node_modules/.bin/esbuild is missing — run `npm ci` in products/clb first')
  process.exit(2)
}

const cacheDir = join(projectDir, '.cache')
mkdirSync(cacheDir, { recursive: true })
const name = relative(projectDir, entry).replace(/\.ts$/, '').replace(/[^A-Za-z0-9_-]+/g, '_')
const outfile = join(cacheDir, `${name}.mjs`)

// The entry imports the script by absolute path and hands it the remaining CLI args.
const stdin = `import { main } from ${JSON.stringify(entry)}\nprocess.exitCode = await main(process.argv.slice(2))\n`
const build = spawnSync(
  esbuild,
  [
    '--bundle',
    '--platform=node',
    '--format=esm',
    '--target=node22',
    '--packages=external',
    '--log-level=warning',
    `--sourcefile=${basename(entry)}.entry.ts`,
    `--outfile=${outfile}`,
  ],
  { input: stdin, stdio: ['pipe', 'inherit', 'inherit'], cwd: projectDir },
)
if (build.status !== 0) {
  console.error(`run.mjs: esbuild failed for ${entryArg}`)
  process.exit(build.status ?? 1)
}

const child = spawn(process.execPath, ['--enable-source-maps', outfile, ...args], { stdio: 'inherit' })
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    if (child.exitCode === null) child.kill(sig)
  })
}
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 128 + (signal === 'SIGINT' ? 2 : 15) : 1)))
child.on('error', (e) => {
  console.error(`run.mjs: could not start the script: ${e.message}`)
  process.exit(1)
})
