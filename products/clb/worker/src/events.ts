// First-party funnel analytics (memo B8). Client events only; signup/checkout_start/purchase/refund are
// written server-side by auth and billing. No personal data: the path loses its query and hash, and
// only allow-listed campaign parameters with a restricted character set are kept. practice_start and
// practice_done come from the free practice mode (memo §7.2 Z9: no AI, nothing uploaded, no content).
import type { EventName, EventRequest } from '../../shared/api'
import { isRecord } from './auth'
import type { Ctx } from './env'
import { error, json, readJson } from './lib/http'
import { dayKey } from './lib/time'

const CLIENT_EVENTS: readonly EventName[] = ['landing', 'sample_start', 'sample_done', 'practice_start', 'practice_done']
/** No gclid: there are no ads (memo §7.2 Z1), so a Google click id has no purpose here (PIPEDA 4.4). */
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const
/** No "@", "/", "?", "=" or "%": an email address or URL cannot be smuggled into a campaign value. */
const UTM_VALUE_RE = /^[A-Za-z0-9._~ -]{1,200}$/
const MAX_PATH_CHARS = 200
/** location.pathname is percent-encoded, so a real path is printable ASCII without spaces. */
const PATH_RE = /^\/[\x21-\x7e]*$/
const MAX_EVENTS_PER_DEVICE_PER_DAY = 200
/** The device cookie is client-controlled (dropping it gives a fresh one), so the IP prefix caps too (decision 8). */
const MAX_EVENTS_PER_IP_PER_DAY = 300
/**
 * D1 free_usage kinds for the daily event budgets (key_hash = the salted device or IP-prefix hash, day =
 * YYYY-MM-DD). They moved from KV, whose free plan allows only 1,000 writes a day (memo §7.2 Z2); the
 * daily cron deletes old rows.
 */
export const EVENT_USAGE_KINDS = { device: 'ev_device', ip: 'ev_ip' } as const

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
  // client has nothing to fix). One D1 batch (a single transaction) counts the request under both keys
  // and stores the event only while both counts are within their budgets, so parallel requests cannot
  // overshoot. Counts keep rising past the budget; only the comparison matters.
  const day = dayKey(now)
  const bump = (keyHash: string, kind: string) =>
    env.DB.prepare(
      `INSERT INTO free_usage (key_hash, kind, day, count) VALUES (?1, ?2, ?3, 1)
       ON CONFLICT (key_hash, kind, day) DO UPDATE SET count = count + 1`,
    ).bind(keyHash, kind, day)
  await env.DB.batch([
    bump(ctx.deviceHash, EVENT_USAGE_KINDS.device),
    bump(ctx.ipHash, EVENT_USAGE_KINDS.ip),
    env.DB.prepare(
      `INSERT INTO events (name, path, utm_json, day, created_at)
       SELECT ?1, ?2, ?3, ?4, ?5
        WHERE (SELECT count FROM free_usage WHERE key_hash = ?6 AND kind = ?7 AND day = ?4) <= ?8
          AND (SELECT count FROM free_usage WHERE key_hash = ?9 AND kind = ?10 AND day = ?4) <= ?11`,
    ).bind(
      body.name,
      path,
      utm ? JSON.stringify(utm) : null,
      day,
      now.toISOString(),
      ctx.deviceHash,
      EVENT_USAGE_KINDS.device,
      MAX_EVENTS_PER_DEVICE_PER_DAY,
      ctx.ipHash,
      EVENT_USAGE_KINDS.ip,
      MAX_EVENTS_PER_IP_PER_DAY,
    ),
  ])
  return json({ ok: true })
}
