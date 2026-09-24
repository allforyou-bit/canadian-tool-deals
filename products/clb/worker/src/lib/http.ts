import type { ApiError } from '../../../shared/api'

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }

export function json(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers)
  for (const [k, v] of Object.entries(JSON_HEADERS)) if (!headers.has(k)) headers.set(k, v)
  return new Response(JSON.stringify(body), { ...init, headers })
}

const STATUS: Record<ApiError['error'], number> = {
  bad_request: 400,
  unauthorized: 401,
  payment_required: 402,
  forbidden: 403,
  region_not_supported: 403,
  turnstile_failed: 403,
  not_found: 404,
  too_large: 413,
  rate_limited: 429,
  free_unavailable: 429,
  internal: 500,
  grading_paused: 503,
  checkout_unavailable: 503,
  at_capacity: 503,
}

export function error(code: ApiError['error'], message: string, extraHeaders?: HeadersInit): Response {
  const body: ApiError = { error: code, message }
  return json(body, { status: STATUS[code], headers: extraHeaders })
}

/**
 * Read the body up to maxBytes, counting bytes as they stream in, so a chunked upload without
 * Content-Length cannot make the Worker buffer more than the limit. Returns null when over the limit.
 */
export async function readBodyLimited(req: Request, maxBytes: number): Promise<Uint8Array | null> {
  const declared = Number(req.headers.get('content-length') ?? '0')
  if (declared > maxBytes) return null
  if (!req.body) return new Uint8Array(0)
  const reader = req.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }
  const out = new Uint8Array(total)
  let offset = 0
  for (const c of chunks) {
    out.set(c, offset)
    offset += c.byteLength
  }
  return out
}

/** Parse a JSON body with a size limit; returns null on invalid JSON or an oversized body. */
export async function readJson<T>(req: Request, maxBytes = 64 * 1024): Promise<T | null> {
  const bytes = await readBodyLimited(req, maxBytes)
  if (!bytes) return null
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as T
  } catch {
    return null
  }
}

/** Parse multipart/form-data with a byte limit; 'too_large' when over it, null when not valid form data. */
export async function readFormDataLimited(req: Request, maxBytes: number): Promise<FormData | 'too_large' | null> {
  const bytes = await readBodyLimited(req, maxBytes)
  if (!bytes) return 'too_large'
  try {
    return await new Response(bytes, { headers: { 'content-type': req.headers.get('content-type') ?? '' } }).formData()
  } catch {
    return null
  }
}

/** Read a raw text body (e.g. a signed webhook) with a byte limit; null when over it. */
export async function readTextLimited(req: Request, maxBytes: number): Promise<string | null> {
  const bytes = await readBodyLimited(req, maxBytes)
  return bytes ? new TextDecoder().decode(bytes) : null
}

export function getCookie(req: Request, name: string): string | null {
  const raw = req.headers.get('cookie')
  if (!raw) return null
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return decodeURIComponent(v.join('='))
  }
  return null
}

export function setCookie(name: string, value: string, opts: { maxAgeSeconds: number; httpOnly?: boolean }): string {
  return [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    `Max-Age=${opts.maxAgeSeconds}`,
    'Secure',
    'SameSite=Lax',
    opts.httpOnly === false ? '' : 'HttpOnly',
  ]
    .filter(Boolean)
    .join('; ')
}
