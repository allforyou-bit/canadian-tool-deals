import { exports } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'

describe('router', () => {
  it('serves /api/health', async () => {
    const res = await exports.default.fetch('https://coach.test/api/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, version: 'test' })
  })

  it('returns 404 JSON for unknown /api routes', async () => {
    const res = await exports.default.fetch('https://coach.test/api/nope')
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ error: 'not_found' })
  })

  it('rejects cross-origin POSTs', async () => {
    const res = await exports.default.fetch('https://coach.test/api/events', {
      method: 'POST',
      headers: { origin: 'https://evil.test', 'content-type': 'application/json' },
      body: '{}',
    })
    expect(res.status).toBe(403)
  })

  it('has the D1 schema applied', async () => {
    const { env } = await import('cloudflare:test')
    const row = await env.DB.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name='grades'").first<{ n: number }>()
    expect(row?.n).toBe(1)
  })
})
