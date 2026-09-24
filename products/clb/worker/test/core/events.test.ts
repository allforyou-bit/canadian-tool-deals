import { env, exports } from 'cloudflare:workers'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EVENT_USAGE_KINDS } from '../../src/events'
import { ipPrefix } from '../../src/index'
import { saltedHash } from '../../src/lib/crypto'
import { dayKey } from '../../src/lib/time'
import { api, count, ORIGIN, stubFetch, uniqueEmail } from './helpers'

beforeEach(() => {
  stubFetch()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

/** today's D1 event counter (free_usage) for a device or IP-prefix hash */
async function counter(keyHash: string, kind: string): Promise<number | null> {
  const row = await env.DB.prepare('SELECT count FROM free_usage WHERE key_hash = ?1 AND kind = ?2 AND day = ?3')
    .bind(keyHash, kind, dayKey(new Date()))
    .first<{ count: number }>()
  return row?.count ?? null
}

async function setCounter(keyHash: string, kind: string, n: number): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO free_usage (key_hash, kind, day, count) VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT (key_hash, kind, day) DO UPDATE SET count = excluded.count`,
  )
    .bind(keyHash, kind, dayKey(new Date()), n)
    .run()
}

async function lastEvent() {
  return env.DB.prepare('SELECT name, path, utm_json, day FROM events ORDER BY id DESC LIMIT 1').first<{
    name: string
    path: string
    utm_json: string | null
    day: string
  }>()
}

describe('POST /api/events', () => {
  it('records a client event', async () => {
    const res = await api('/api/events', { body: { name: 'sample_start', path: '/practice/writing/w1/' } })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(await lastEvent()).toEqual({
      name: 'sample_start',
      path: '/practice/writing/w1/',
      utm_json: null,
      day: dayKey(new Date()),
    })
  })

  it('records the free practice mode events (memo §7.2 Z9)', async () => {
    for (const name of ['practice_start', 'practice_done']) {
      const res = await api('/api/events', { body: { name, path: '/practice/speaking/s1/' } })
      expect(res.status).toBe(200)
      expect(await lastEvent()).toMatchObject({ name, path: '/practice/speaking/s1/', utm_json: null })
    }
  })

  it('counts in D1 (free_usage ev_device / ev_ip), never in KV', async () => {
    const device = `dev-count-${uniqueEmail('x')}`
    const ip = '192.0.2.44'
    const deviceHash = await saltedHash(env.HASH_SALT, `device:${device}`)
    const ipHash = await saltedHash(env.HASH_SALT, `ip:${ipPrefix(ip)}`)
    const put = vi.spyOn(env.FLAGS, 'put')
    for (let i = 0; i < 2; i++) {
      expect((await api('/api/events', { body: { name: 'landing', path: '/' }, device, ip })).status).toBe(200)
    }
    expect(await counter(deviceHash, EVENT_USAGE_KINDS.device)).toBe(2)
    expect(await counter(ipHash, EVENT_USAGE_KINDS.ip)).toBe(2)
    expect(put).not.toHaveBeenCalled()
    put.mockRestore()
  })

  it('rejects server-only and unknown names', async () => {
    for (const name of ['signup', 'checkout_start', 'purchase', 'refund', 'pageview', 42]) {
      const res = await api('/api/events', { body: { name, path: '/' } })
      expect(res.status).toBe(400)
      expect(await res.json()).toMatchObject({ error: 'bad_request' })
    }
  })

  it('strips query and hash from the path and rejects implausible paths', async () => {
    await api('/api/events', { body: { name: 'landing', path: '/pricing/?email=a@b.com#token=secret' } })
    expect((await lastEvent())?.path).toBe('/pricing/')
    for (const path of ['pricing', 'https://evil.test/', `/${'a'.repeat(200)}`, '/has space', 7, undefined]) {
      expect((await api('/api/events', { body: { name: 'landing', path } })).status).toBe(400)
    }
  })

  it('keeps only allow-listed utm keys with safe values', async () => {
    const res = await api('/api/events', {
      body: {
        name: 'landing',
        path: '/ko/',
        utm: {
          utm_source: 'google',
          utm_medium: 'cpc',
          utm_campaign: 'writing practice_ON-1',
          utm_term: 'someone@example.com',
          utm_content: 'x'.repeat(201),
          gclid: 'Cj0KCQjw-abc_123',
          email: 'someone@example.com',
          fbclid: 'abc',
          utm_id: 'nope',
        },
      },
    })
    expect(res.status).toBe(200)
    // no gclid: there are no ads (memo §7.2 Z1)
    expect(JSON.parse((await lastEvent())!.utm_json!)).toEqual({
      utm_source: 'google',
      utm_medium: 'cpc',
      utm_campaign: 'writing practice_ON-1',
    })
    await api('/api/events', { body: { name: 'landing', path: '/', utm: { gclid: 'Cj0KCQjw-abc_123' } } })
    expect((await lastEvent())?.utm_json).toBeNull()

    await api('/api/events', { body: { name: 'landing', path: '/', utm: { utm_source: 7, email: 'x' } } })
    expect((await lastEvent())?.utm_json).toBeNull()
    await api('/api/events', { body: { name: 'landing', path: '/', utm: ['google'] } })
    expect((await lastEvent())?.utm_json).toBeNull()
  })

  it('drops events past 200 per device per day but still answers ok', async () => {
    const device = `dev-events-${uniqueEmail('x')}`
    const deviceHash = await saltedHash(env.HASH_SALT, `device:${device}`)
    await setCounter(deviceHash, EVENT_USAGE_KINDS.device, 199)
    const before = await count('SELECT COUNT(*) AS n FROM events')

    expect((await api('/api/events', { body: { name: 'landing', path: '/' }, device })).status).toBe(200)
    expect(await counter(deviceHash, EVENT_USAGE_KINDS.device)).toBe(200)
    const over = await api('/api/events', { body: { name: 'landing', path: '/' }, device })
    expect(over.status).toBe(200)
    expect(await over.json()).toEqual({ ok: true })

    expect((await count('SELECT COUNT(*) AS n FROM events')) - before).toBe(1)
    // yesterday's count does not carry over
    await env.DB.prepare('UPDATE free_usage SET day = ?1 WHERE key_hash = ?2 AND kind = ?3')
      .bind('2000-01-01', deviceHash, EVENT_USAGE_KINDS.device)
      .run()
    expect((await api('/api/events', { body: { name: 'landing', path: '/' }, device })).status).toBe(200)
    expect((await count('SELECT COUNT(*) AS n FROM events')) - before).toBe(2)
  })

  it('parallel requests cannot overshoot the budget (counter and event share one D1 batch)', async () => {
    const device = `dev-burst-${uniqueEmail('x')}`
    const deviceHash = await saltedHash(env.HASH_SALT, `device:${device}`)
    await setCounter(deviceHash, EVENT_USAGE_KINDS.device, 195)
    const before = await count('SELECT COUNT(*) AS n FROM events')
    const all = await Promise.all(
      Array.from({ length: 12 }, () => api('/api/events', { body: { name: 'sample_done', path: '/' }, device, ip: '198.51.100.77' })),
    )
    expect(all.every((r) => r.status === 200)).toBe(true)
    expect((await count('SELECT COUNT(*) AS n FROM events')) - before).toBe(5)
  })

  it('rejects an oversized body streamed without Content-Length and records nothing (R26)', async () => {
    const events = async () => (await env.DB.prepare('SELECT COUNT(*) AS n FROM events').first<{ n: number }>())!.n
    const before = await events()
    // 1 KiB per pull, up to 1 MiB: the 4 KiB limit must stop reading long before the end
    const enc = new TextEncoder()
    let pulls = 0
    const body = new ReadableStream<Uint8Array>({
      pull(c) {
        pulls += 1
        if (pulls === 1) c.enqueue(enc.encode('{"name":"landing","path":"/","pad":"'))
        else if (pulls < 1024) c.enqueue(enc.encode('x'.repeat(1024)))
        else {
          c.enqueue(enc.encode('"}'))
          c.close()
        }
      },
    })
    const req = new Request(`${ORIGIN}/api/events`, { method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/json' }, body })
    expect(req.headers.get('content-length')).toBeNull()
    const res = await exports.default.fetch(req)
    expect(res.status).toBe(400)
    expect(await events()).toBe(before)
    expect(pulls).toBeLessThan(64)
  })

  it('drops events past 300 per IP prefix per day, even from new devices or without the cookie (decision 8)', async () => {
    const ip = '203.0.113.7'
    const ipHash = await saltedHash(env.HASH_SALT, `ip:${ipPrefix(ip)}`)
    await setCounter(ipHash, EVENT_USAGE_KINDS.ip, 299)
    const events = async () => (await env.DB.prepare('SELECT COUNT(*) AS n FROM events').first<{ n: number }>())!.n
    const before = await events()

    expect((await api('/api/events', { body: { name: 'sample_start', path: '/' }, device: `dev-ip-${uniqueEmail('x')}`, ip })).status).toBe(200)
    expect(await counter(ipHash, EVENT_USAGE_KINDS.ip)).toBe(300)
    // a fresh cookie, no cookie, or another address in the same /24 are all over the limit
    for (const init of [
      { device: `dev-ip-${uniqueEmail('y')}`, ip },
      { device: null, ip },
      { device: `dev-ip-${uniqueEmail('z')}`, ip: '203.0.113.200' },
    ]) {
      const res = await api('/api/events', { body: { name: 'sample_start', path: '/' }, ...init })
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ ok: true })
    }
    expect((await events()) - before).toBe(1)

    // another prefix is unaffected
    expect((await api('/api/events', { body: { name: 'landing', path: '/' }, device: null, ip: '198.51.100.9' })).status).toBe(200)
    expect((await events()) - before).toBe(2)
  })
})
