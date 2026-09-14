/**
 * Brief validation.
 *
 * Hand-rolled rather than pulled from npm so the generator keeps zero
 * dependencies. Errors carry the full field path, because the whole point of a
 * fixed-scope 48-hour build is that a typo surfaces in the build, not in a
 * client's inbox.
 */

import { ACCENTS } from './css.mjs'

const SECTION_TYPES = ['features', 'steps', 'quote', 'pricing', 'faq', 'text', 'final']
const MODES = ['live', 'proposal']

class Check {
  constructor() {
    this.errors = []
    this.warnings = []
  }

  err(path, message) {
    this.errors.push(`${path}: ${message}`)
    return false
  }

  warn(path, message) {
    this.warnings.push(`${path}: ${message}`)
  }

  /** Require a non-empty string. */
  str(obj, key, path, { required = true, max = 0 } = {}) {
    const value = obj?.[key]
    if (value === undefined || value === null || value === '') {
      return required ? this.err(`${path}.${key}`, 'required, expected a non-empty string') : true
    }
    if (typeof value !== 'string') return this.err(`${path}.${key}`, `expected a string, got ${typeof value}`)
    if (max && value.length > max) this.warn(`${path}.${key}`, `${value.length} characters is long for this field (guide: ${max})`)
    return true
  }

  /** Require an array of non-empty strings. */
  strArray(obj, key, path, { required = true, min = 1 } = {}) {
    const value = obj?.[key]
    if (value === undefined) return required ? this.err(`${path}.${key}`, 'required, expected an array of strings') : true
    if (!Array.isArray(value)) return this.err(`${path}.${key}`, `expected an array, got ${typeof value}`)
    if (value.length < min) return this.err(`${path}.${key}`, `expected at least ${min} entr${min === 1 ? 'y' : 'ies'}, got ${value.length}`)
    value.forEach((v, i) => {
      if (typeof v !== 'string' || !v.trim()) this.err(`${path}.${key}[${i}]`, 'expected a non-empty string')
    })
    return true
  }

  oneOf(obj, key, path, allowed, { required = true } = {}) {
    const value = obj?.[key]
    if (value === undefined) return required ? this.err(`${path}.${key}`, `required, expected one of: ${allowed.join(', ')}`) : true
    if (!allowed.includes(value)) return this.err(`${path}.${key}`, `expected one of: ${allowed.join(', ')} — got ${JSON.stringify(value)}`)
    return true
  }

  obj(parent, key, path, { required = true } = {}) {
    const value = parent?.[key]
    if (value === undefined) {
      if (required) this.err(`${path}.${key}`, 'required, expected an object')
      return null
    }
    // `typeof null === 'object'`, so null has to be rejected explicitly or a
    // `"meta": null` validates clean and then throws inside the renderer.
    if (value === null) {
      this.err(`${path}.${key}`, 'expected an object, got null')
      return null
    }
    if (typeof value !== 'object' || Array.isArray(value)) {
      this.err(`${path}.${key}`, `expected an object, got ${Array.isArray(value) ? 'array' : typeof value}`)
      return null
    }
    return value
  }

  /** A call-to-action: label plus an href we are willing to emit. */
  cta(parent, key, path, { required = false } = {}) {
    const value = parent?.[key]
    if (value === undefined) {
      if (required) this.err(`${path}.${key}`, 'required, expected { label, href }')
      return
    }
    const cta = this.obj(parent, key, path)
    if (!cta) return
    this.str(cta, 'label', `${path}.${key}`, { max: 40 })
    if (cta.href !== undefined) this.href(cta, 'href', `${path}.${key}`)
  }

  /**
   * Only http(s), mailto, tel, in-page and site-root hrefs are emitted.
   *
   * A brief is hand-written, but it is also pasted from a client's email, and a
   * scheme outside this set has no legitimate use on one of these pages.
   */
  href(obj, key, path) {
    const value = obj?.[key]
    if (typeof value !== 'string' || !value.trim()) return this.err(`${path}.${key}`, 'expected a non-empty string')
    if (!/^(https?:\/\/|mailto:|tel:|#|\/)/i.test(value)) {
      return this.err(`${path}.${key}`, `must start with http://, https://, mailto:, tel:, # or / — got ${JSON.stringify(value.slice(0, 40))}`)
    }
    return true
  }

  /** ISO date, so the legal pages carry a real "last updated". */
  isoDate(obj, key, path, { required = true } = {}) {
    const value = obj?.[key]
    if (value === undefined) return required ? this.err(`${path}.${key}`, 'required, expected YYYY-MM-DD') : true
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return this.err(`${path}.${key}`, `expected YYYY-MM-DD, got ${JSON.stringify(value)}`)
    }
    const [y, m, d] = value.split('-').map(Number)
    const probe = new Date(Date.UTC(y, m - 1, d))
    if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) {
      return this.err(`${path}.${key}`, `${value} is not a real calendar date`)
    }
    return true
  }

  unknown(obj, path, allowed) {
    for (const key of Object.keys(obj ?? {})) {
      if (!allowed.includes(key)) this.warn(`${path}.${key}`, 'unrecognised field, it will be ignored')
    }
  }
}

function checkSection(c, s, path) {
  if (typeof s !== 'object' || s === null || Array.isArray(s)) {
    c.err(path, 'expected an object')
    return
  }
  if (!c.oneOf(s, 'type', path, SECTION_TYPES)) return

  c.str(s, 'id', path, { required: false })
  c.str(s, 'eyebrow', path, { required: false, max: 40 })
  c.str(s, 'heading', path, { required: s.type !== 'quote', max: 90 })
  c.str(s, 'intro', path, { required: false, max: 320 })

  switch (s.type) {
    case 'features':
    case 'steps': {
      const items = s.items
      if (!Array.isArray(items) || items.length < 1) {
        c.err(`${path}.items`, 'expected an array with at least 1 entry')
        break
      }
      items.forEach((item, i) => {
        const ip = `${path}.items[${i}]`
        if (typeof item !== 'object' || item === null) { c.err(ip, 'expected an object'); return }
        c.str(item, 'title', ip, { max: 70 })
        c.str(item, 'body', ip, { max: 260 })
        c.unknown(item, ip, ['title', 'body'])
      })
      c.unknown(s, path, ['type', 'id', 'eyebrow', 'heading', 'intro', 'items', 'sunk'])
      break
    }
    case 'quote': {
      c.str(s, 'text', path, { max: 320 })
      c.str(s, 'attribution', path, { max: 120 })
      c.unknown(s, path, ['type', 'id', 'eyebrow', 'heading', 'intro', 'text', 'attribution', 'sunk'])
      break
    }
    case 'pricing': {
      const tiers = s.tiers
      if (!Array.isArray(tiers) || tiers.length < 1) {
        c.err(`${path}.tiers`, 'expected an array with at least 1 entry')
        break
      }
      tiers.forEach((t, i) => {
        const tp = `${path}.tiers[${i}]`
        if (typeof t !== 'object' || t === null) { c.err(tp, 'expected an object'); return }
        c.str(t, 'name', tp, { max: 40 })
        c.str(t, 'amount', tp, { max: 24 })
        c.str(t, 'unit', tp, { required: false, max: 32 })
        c.str(t, 'desc', tp, { required: false, max: 200 })
        c.str(t, 'tag', tp, { required: false, max: 24 })
        c.strArray(t, 'includes', tp, { required: false })
        c.cta(t, 'cta', tp)
        c.str(t, 'fine', tp, { required: false, max: 120 })
        if (t.featured !== undefined && typeof t.featured !== 'boolean') c.err(`${tp}.featured`, 'expected true or false')
        c.unknown(t, tp, ['name', 'amount', 'unit', 'desc', 'tag', 'includes', 'cta', 'fine', 'featured'])
      })
      c.unknown(s, path, ['type', 'id', 'eyebrow', 'heading', 'intro', 'tiers', 'sunk'])
      break
    }
    case 'faq': {
      const items = s.items
      if (!Array.isArray(items) || items.length < 1) {
        c.err(`${path}.items`, 'expected an array with at least 1 entry')
        break
      }
      items.forEach((item, i) => {
        const ip = `${path}.items[${i}]`
        if (typeof item !== 'object' || item === null) { c.err(ip, 'expected an object'); return }
        c.str(item, 'q', ip, { max: 140 })
        c.str(item, 'a', ip, { max: 700 })
        c.unknown(item, ip, ['q', 'a'])
      })
      c.unknown(s, path, ['type', 'id', 'eyebrow', 'heading', 'intro', 'items', 'sunk'])
      break
    }
    case 'text': {
      if (s.body === undefined) c.err(`${path}.body`, 'required, expected a string or an array of strings')
      else if (Array.isArray(s.body)) c.strArray(s, 'body', path)
      else c.str(s, 'body', path)
      c.unknown(s, path, ['type', 'id', 'eyebrow', 'heading', 'intro', 'body', 'sunk'])
      break
    }
    case 'final': {
      c.cta(s, 'primaryCta', path)
      c.cta(s, 'secondaryCta', path)
      const pairs = s.pairs
      if (pairs !== undefined) {
        if (!Array.isArray(pairs)) c.err(`${path}.pairs`, 'expected an array')
        else pairs.forEach((p, i) => {
          const pp = `${path}.pairs[${i}]`
          if (typeof p !== 'object' || p === null) { c.err(pp, 'expected an object'); return }
          c.str(p, 'label', pp, { max: 40 })
          c.str(p, 'value', pp, { max: 120 })
          c.unknown(p, pp, ['label', 'value'])
        })
      }
      c.unknown(s, path, ['type', 'id', 'eyebrow', 'heading', 'intro', 'primaryCta', 'secondaryCta', 'pairs', 'sunk'])
      break
    }
  }
}

/**
 * Walk every string in the brief looking for un-replaced placeholders.
 *
 * The operator's own legal name cannot be guessed, so the shipped briefs carry
 * `REPLACE-...` tokens instead. This turns "I forgot to set my name" from a thing
 * a client notices into a thing the build says on every run.
 */
function checkPlaceholders(c, value, path) {
  if (typeof value === 'string') {
    if (value.includes('REPLACE-')) c.warn(path, `still contains a placeholder (${JSON.stringify(value.slice(0, 48))})`)
    return
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => checkPlaceholders(c, v, `${path}[${i}]`))
    return
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) checkPlaceholders(c, v, `${path}.${k}`)
  }
}

/**
 * Validate one brief.
 *
 * Returns `{ errors, warnings }`. Errors block the build; warnings are printed
 * and the build continues.
 */
export function validateBrief(brief, label = 'brief') {
  const c = new Check()

  if (typeof brief !== 'object' || brief === null || Array.isArray(brief)) {
    c.err(label, 'expected a JSON object at the top level')
    return { errors: c.errors, warnings: c.warnings }
  }

  c.str(brief, 'slug', label)
  if (typeof brief.slug === 'string' && !/^[a-z0-9][a-z0-9-]*$/.test(brief.slug)) {
    c.err(`${label}.slug`, 'expected lowercase letters, digits and hyphens only')
  }
  c.oneOf(brief, 'mode', label, MODES)

  const meta = c.obj(brief, 'meta', label)
  if (meta) {
    c.str(meta, 'businessName', `${label}.meta`, { max: 70 })
    c.str(meta, 'tagline', `${label}.meta`, { max: 120 })
    c.str(meta, 'description', `${label}.meta`, { max: 170 })
    c.str(meta, 'title', `${label}.meta`, { required: false, max: 65 })
    c.str(meta, 'monogram', `${label}.meta`, { required: false, max: 2 })
    c.str(meta, 'locale', `${label}.meta`, { required: false })
    // Not the permissive href() check: meta.url is resolved with `new URL()` to
    // build the canonical tag and the sitemap, so a relative value throws mid-build.
    if (meta.url !== undefined) {
      if (typeof meta.url !== 'string' || !/^https?:\/\/[^\s]+$/i.test(meta.url)) {
        c.err(`${label}.meta.url`, `expected an absolute http(s) URL, got ${JSON.stringify(meta.url)}`)
      }
    }
    c.oneOf(meta, 'accent', `${label}.meta`, Object.keys(ACCENTS), { required: false })
    c.unknown(meta, `${label}.meta`, ['businessName', 'tagline', 'description', 'title', 'monogram', 'locale', 'url', 'accent'])
  }

  if (brief.mode === 'proposal') {
    const p = c.obj(brief, 'proposal', label)
    if (p) {
      c.str(p, 'preparedFor', `${label}.proposal`, { max: 160 })
      c.str(p, 'preparedBy', `${label}.proposal`, { max: 70 })
      c.str(p, 'contact', `${label}.proposal`, { max: 90 })
      c.unknown(p, `${label}.proposal`, ['preparedFor', 'preparedBy', 'contact'])
    }
  } else if (brief.proposal !== undefined) {
    c.warn(`${label}.proposal`, 'only used when mode is "proposal"; it will be ignored')
  }

  const hero = c.obj(brief, 'hero', label)
  if (hero) {
    c.str(hero, 'eyebrow', `${label}.hero`, { required: false, max: 40 })
    c.str(hero, 'headline', `${label}.hero`, { max: 90 })
    c.str(hero, 'sub', `${label}.hero`, { max: 260 })
    c.cta(hero, 'primaryCta', `${label}.hero`)
    c.cta(hero, 'secondaryCta', `${label}.hero`)
    c.str(hero, 'note', `${label}.hero`, { required: false, max: 160 })
    c.strArray(hero, 'trust', `${label}.hero`, { required: false })
    c.unknown(hero, `${label}.hero`, ['eyebrow', 'headline', 'sub', 'primaryCta', 'secondaryCta', 'note', 'trust'])
  }

  const nav = brief.nav
  if (nav !== undefined) {
    if (!Array.isArray(nav)) c.err(`${label}.nav`, 'expected an array')
    else nav.forEach((item, i) => {
      const ip = `${label}.nav[${i}]`
      if (typeof item !== 'object' || item === null) { c.err(ip, 'expected an object'); return }
      c.str(item, 'label', ip, { max: 24 })
      c.href(item, 'href', ip)
      c.unknown(item, ip, ['label', 'href'])
    })
  }

  if (!Array.isArray(brief.sections) || brief.sections.length < 1) {
    c.err(`${label}.sections`, 'expected an array with at least 1 section')
  } else {
    brief.sections.forEach((s, i) => checkSection(c, s, `${label}.sections[${i}]`))
  }

  const contact = c.obj(brief, 'contact', label, { required: false })
  if (contact) {
    c.str(contact, 'email', `${label}.contact`, { required: false })
    c.str(contact, 'phone', `${label}.contact`, { required: false })
    c.str(contact, 'address', `${label}.contact`, { required: false })
    c.str(contact, 'hours', `${label}.contact`, { required: false })
    c.unknown(contact, `${label}.contact`, ['email', 'phone', 'address', 'hours'])
  }

  const legal = c.obj(brief, 'legal', label)
  if (legal) {
    c.str(legal, 'operator', `${label}.legal`, { max: 90 })
    c.str(legal, 'jurisdiction', `${label}.legal`, { max: 70 })
    c.str(legal, 'contactEmail', `${label}.legal`)
    c.isoDate(legal, 'effective', `${label}.legal`)
    c.strArray(legal, 'collects', `${label}.legal`, { required: false })
    c.str(legal, 'refund', `${label}.legal`, { required: false, max: 600 })
    c.str(legal, 'deliverable', `${label}.legal`, { required: false, max: 400 })
    c.unknown(legal, `${label}.legal`, ['operator', 'jurisdiction', 'contactEmail', 'effective', 'collects', 'refund', 'deliverable'])
  }

  const footer = c.obj(brief, 'footer', label, { required: false })
  if (footer) {
    c.str(footer, 'note', `${label}.footer`, { required: false, max: 200 })
    c.unknown(footer, `${label}.footer`, ['note'])
  }

  c.unknown(brief, label, ['slug', 'mode', 'meta', 'proposal', 'hero', 'nav', 'sections', 'contact', 'legal', 'footer'])
  checkPlaceholders(c, brief, label)

  return { errors: c.errors, warnings: c.warnings }
}

export { SECTION_TYPES, MODES }
