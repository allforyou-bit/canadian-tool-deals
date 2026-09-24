// First-party funnel analytics (memo B8). Client events only; signup/checkout_start/purchase/refund are
// written server-side by auth and billing. No personal data: the path loses its query and hash, and
// only allow-listed campaign parameters with a restricted character set are kept.
import type { EventName, EventRequest } from '../../shared/api'
import { isRecord } from './auth'
import type { Ctx } from './env'
import { error, json, readJson } from './lib/http'
import { dayKey } from './lib/time'

const CLIENT_EVENTS: readonly EventName[] = ['landing', 'sample_start', 'sample_done']
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid'] as const
/** No "@", "/", "?", "=" or "%": an email address or URL cannot be smuggled into a campaign value. */
const UTM_VALUE_RE = /^[A-Za-z0-9._~ -]{1,200}$/
const MAX_PATH_CHARS = 200
/** location.pathname is percent-encoded, so a real path is printable ASCII without spaces. */
const PATH_RE = /^\/[\x21-\x7e]*$/
const MAX_EVENTS_PER_DEVICE_PER_DAY = 200
/** The device cookie is client-controlled (dropping it gives a fresh one), so the IP prefix caps too (decision 8). */
const MAX_EVENTS_PER_IP_PER_DAY = 300
const TWO_DAYS_SECONDS = 2 * 86_400

function isClientEvent(v: unknown): v is EventName {
  return typeof v === 'string' && (CLIENT_EVENTS as readonly string[]).includes(v)
}

/** Path without query or hash, or null when it is not a plausible site path. */
export function cleanPath(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const path = v.split(/[?#]/, 1)[0] ?? ''
  return path.length <= MAX_PATH_CHARS && PATH_RE.test(path) ? path : null
}

/** Allow-listed campaign parameters only; anything else is dropped silently. */
export function cleanUtm(v: unknown): Record<string, string> | null {
  if (!isRecord(v)) return null
  const out: Record<string, string> = {}
  for (const k of UTM_KEYS) {
    const value = v[k]
    if (typeof value === 'string' && UTM_VALUE_RE.test(value)) out[k] = value
  }
  return Object.keys(out).length > 0 ? out : null
}

/** POST /api/events */
export async function track(req: Request, ctx: Ctx): Promise<Response> {
  const { env, now } = ctx
  const body = await readJson<Partial<EventRequest>>(req, 4 * 1024)
  if (!isRecord(body)) return error('bad_request', 'Invalid request')
  if (!isClientEvent(body.name)) return error('bad_request', 'Unknown event')
  const path = cleanPath(body.path)
  if (!path) return error('bad_request', 'Invalid path')
  const utm = cleanUtm(body.utm)

  // Daily budgets per device and per IP prefix. Over either limit the event is dropped quietly (the
  // client has nothing to fix). KV allows one write per second per key [cloudflare-docs
  // kv/platform/limits.mdx, 2026-09-24], so a failed counter write must not lose the event.
  const day = dayKey(now)
  const deviceKey = `ev:${ctx.deviceHash}:${day}`
  const ipKey = `ev:ip:${ctx.ipHash}:${day}`
  const [deviceRaw, ipRaw] = await Promise.all([env.FLAGS.get(deviceKey), env.FLAGS.get(ipKey)])
  const deviceN = Number(deviceRaw) || 0
  const ipN = Number(ipRaw) || 0
  if (deviceN >= MAX_EVENTS_PER_DEVICE_PER_DAY || ipN >= MAX_EVENTS_PER_IP_PER_DAY) return json({ ok: true })
  const writes = await Promise.allSettled([
    env.FLAGS.put(deviceKey, String(deviceN + 1), { expirationTtl: TWO_DAYS_SECONDS }),
    env.FLAGS.put(ipKey, String(ipN + 1), { expirationTtl: TWO_DAYS_SECONDS }),
  ])
  if (writes.some((w) => w.status === 'rejected')) console.warn('event counter write failed')

  await env.DB.prepare('INSERT INTO events (name, path, utm_json, day, created_at) VALUES (?1, ?2, ?3, ?4, ?5)')
    .bind(body.name, path, utm ? JSON.stringify(utm) : null, day, now.toISOString())
    .run()
  return json({ ok: true })
}
