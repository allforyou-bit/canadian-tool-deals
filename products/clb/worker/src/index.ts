// Worker entry: /api/* is handled here; everything else is served from the static export (ASSETS).
// Handler modules are owned per area (see products/clb/CONTRACT.md):
//   auth.ts, account.ts, events.ts, cron.ts, email.ts, turnstile.ts  → core
//   grading/*                                                        → grading
//   billing/*                                                        → billing

import type { HealthResponse } from '../../shared/api'
import * as account from './account'
import * as auth from './auth'
import * as billing from './billing'
import { handleScheduled } from './cron'
import type { Ctx, Env } from './env'
import * as events from './events'
import * as grading from './grading'
import { randomToken, saltedHash } from './lib/crypto'
import { error, getCookie, json, setCookie } from './lib/http'
import { getUser } from './lib/session'

type Handler = (req: Request, ctx: Ctx) => Promise<Response>

const ROUTES: Record<string, Handler> = {
  'GET /api/health': async (_req, ctx) => json({ ok: true, version: ctx.env.APP_VERSION } satisfies HealthResponse),
  'GET /api/me': account.me,
  'POST /api/auth/magic-link': auth.requestMagicLink,
  'POST /api/auth/verify': auth.verify,
  'POST /api/auth/logout': auth.logout,
  'POST /api/account/delete': account.deleteAccount,
  'POST /api/account/marketing': account.setMarketing,
  'POST /api/support': account.support,
  'GET /api/history': grading.history,
  'POST /api/grade/writing': grading.gradeWriting,
  'POST /api/grade/speaking': grading.gradeSpeaking,
  'POST /api/checkout': billing.checkout,
  'POST /api/stripe/webhook': billing.webhook,
  'POST /api/refund-request': billing.refundRequest,
  'POST /api/events': events.track,
}

const DEVICE_COOKIE = 'mpc_device'

/** IPv4 /24 or IPv6 /48 prefix, so rate limits survive small address changes without storing IPs. */
export function ipPrefix(ip: string): string {
  if (ip.includes(':')) return ip.split(':').slice(0, 3).join(':')
  return ip.split('.').slice(0, 3).join('.')
}

export default {
  async fetch(req: Request, env: Env, exec: ExecutionContext): Promise<Response> {
    const url = new URL(req.url)
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req)

    const handler = ROUTES[`${req.method} ${url.pathname}`]
    if (!handler) return error('not_found', 'Unknown endpoint')

    // Same-origin guard for state-changing requests (the Stripe webhook is exempt: it is signed).
    if (req.method === 'POST' && url.pathname !== '/api/stripe/webhook') {
      const origin = req.headers.get('origin')
      if (origin && origin !== new URL(env.SITE_URL).origin) return error('forbidden', 'Cross-origin request')
    }

    let device = getCookie(req, DEVICE_COOKIE)
    const newDevice = !device
    if (!device) device = randomToken(16)
    const cf = (req as Request & { cf?: IncomingRequestCfProperties }).cf
    const ip = req.headers.get('cf-connecting-ip') ?? '0.0.0.0'
    const ctx: Ctx = {
      env,
      exec,
      user: await getUser(req, env),
      ipHash: await saltedHash(env.HASH_SALT, `ip:${ipPrefix(ip)}`),
      deviceHash: await saltedHash(env.HASH_SALT, `device:${device}`),
      country: (cf?.country as string | undefined) ?? null,
      region: (cf?.regionCode as string | undefined) ?? null,
      now: new Date(),
    }

    let res: Response
    try {
      res = await handler(req, ctx)
    } catch (e) {
      console.error('handler error', url.pathname, e instanceof Error ? e.message : 'unknown')
      res = error('internal', 'Something went wrong')
    }
    if (newDevice) {
      res = new Response(res.body, res)
      res.headers.append('set-cookie', setCookie(DEVICE_COOKIE, device, { maxAgeSeconds: 400 * 24 * 3600 }))
    }
    return res
  },

  async scheduled(event: ScheduledController, env: Env, exec: ExecutionContext): Promise<void> {
    exec.waitUntil(handleScheduled(event, env))
  },
} satisfies ExportedHandler<Env>
