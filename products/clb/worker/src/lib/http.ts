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
}

export function error(code: ApiError['error'], message: string, extraHeaders?: HeadersInit): Response {
  const body: ApiError = { error: code, message }
  return json(body, { status: STATUS[code], headers: extraHeaders })
}

/** Parse a JSON body with a size limit; returns null on invalid JSON. */
export async function readJson<T>(req: Request, maxBytes = 64 * 1024): Promise<T | null> {
  const len = Number(req.headers.get('content-length') ?? '0')
  if (len > maxBytes) return null
  const text = await req.text()
  if (text.length > maxBytes) return null
  try {
    return JSON.parse(text) as T
  } catch {
    return null
  }
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
