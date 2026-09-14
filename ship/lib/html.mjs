/**
 * HTML escaping and small render helpers.
 *
 * Every value that reaches the output passes through `esc` or `attr`. Brief files
 * are hand-written, but they carry a client's copy, and a stray `<` or `&` in a
 * business name should never be able to break the page or inject markup.
 */

const HTML_ENTITIES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

/** Escape text for use in element content. */
export function esc(value) {
  if (value === null || value === undefined) return ''
  return String(value).replace(/[&<>"']/g, c => HTML_ENTITIES[c])
}

/** Escape text for use inside a double-quoted attribute. */
export function attr(value) {
  return esc(value)
}

/**
 * Escape a string for embedding in a JSON-LD <script> block.
 *
 * JSON.stringify handles quoting; the `<` replacement stops a value containing
 * `</script>` from terminating the block early.
 */
export function jsonLd(obj) {
  return JSON.stringify(obj, null, 2).replace(/</g, '\\u003c')
}

/** Join class names, dropping falsy entries. */
export function cx(...names) {
  return names.filter(Boolean).join(' ')
}

/** Render `items` with `fn`, dropping empty results. Returns a single string. */
export function each(items, fn) {
  if (!Array.isArray(items)) return ''
  return items.map(fn).filter(Boolean).join('\n')
}

/** Wrap `body` in an element only when `body` is non-empty. */
export function section(id, body) {
  if (!body || !body.trim()) return ''
  return `<section id="${attr(id)}">\n${body}\n</section>`
}

/**
 * Turn a heading into a URL-safe id/slug.
 *
 * Keeps ASCII alphanumerics and collapses everything else to a single hyphen, so
 * non-Latin headings degrade to a short hash-free stub rather than an empty id.
 */
export function slugify(value) {
  const base = String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return base || 'section'
}

/**
 * Minimal inline markdown: **bold**, *italic*, `code`, and [text](url).
 *
 * Applied AFTER escaping, so the input is already safe. Link hrefs may not contain
 * parentheses and must start with http(s), mailto, tel, `#` or `/`; anything else is
 * left as literal text rather than half-rewritten, which keeps `javascript:` out.
 */
export function inline(value) {
  let out = esc(value)
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>')
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  out = out.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
  out = out.replace(/\[([^\]]+)\]\(([^()\s]+)\)/g, (match, text, href) => {
    if (!/^(https?:\/\/|mailto:|tel:|#|\/)/i.test(href)) return text
    const external = /^https?:\/\//i.test(href)
    const rel = external ? ' target="_blank" rel="noopener noreferrer"' : ''
    return `<a href="${attr(href)}"${rel}>${text}</a>`
  })
  return out
}

/** Render a paragraph list from an array of strings, or a single string. */
export function paragraphs(value) {
  const list = Array.isArray(value) ? value : value ? [value] : []
  return each(list, p => (p && String(p).trim() ? `<p>${inline(p)}</p>` : ''))
}
