/**
 * The operator's own details, read once and substituted into every brief.
 *
 * Without this the legal name lives in five files, and updating four of them is
 * a placeholder shipped to a client. One file, one edit, and the build fails the
 * same way everywhere if it is missed.
 */

import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const CONFIG = join(dirname(fileURLToPath(import.meta.url)), '..', 'operator.json')

let cached = null

export function loadOperator() {
  if (cached) return cached
  if (!existsSync(CONFIG)) {
    throw new Error(`No operator config at ${CONFIG}`)
  }
  try {
    cached = JSON.parse(readFileSync(CONFIG, 'utf8'))
  } catch (e) {
    throw new Error(`ship/operator.json is not valid JSON — ${e.message}`)
  }
  return cached
}

/**
 * Replace `{{operator.key}}` in every string of a parsed brief.
 *
 * An unknown key is left in place rather than blanked: a visible
 * `{{operator.typo}}` on the page is a bug you notice, an empty string is one you
 * ship.
 */
export function applyOperator(value, operator, unknown = new Set()) {
  if (typeof value === 'string') {
    return value.replace(/\{\{operator\.([A-Za-z0-9_]+)\}\}/g, (match, key) => {
      if (Object.hasOwn(operator, key) && typeof operator[key] === 'string') return operator[key]
      unknown.add(key)
      return match
    })
  }
  if (Array.isArray(value)) return value.map(v => applyOperator(v, operator, unknown))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, applyOperator(v, operator, unknown)]))
  }
  return value
}
