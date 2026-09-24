import { env, exports } from 'cloudflare:workers'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ipPrefix } from '../../src/index'
import { saltedHash } from '../../src/lib/crypto'
import { dayKey } from '../../src/lib/time'
import { api, ORIGIN, stubFetch, uniqueEmail } from './helpers'

beforeEach(() => {
  stubFetch()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

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
    expect(JSON.parse((await lastEvent())!.utm_json!)).toEqual({
      utm_source: 'google',
      utm_medium: 'cpc',
      utm_campaign: 'writing practice_ON-1',
      gclid: 'Cj0KCQjw-abc_123',
    })

    await api('/api/events', { body: { name: 'landing', path: '/', utm: { utm_source: 7, email: 'x' } } })
    expect((await lastEvent())?.utm_json).toBeNull()
    await api('/api/events', { body: { name: 'landing', path: '/', utm: ['google'] } })
    expect((await lastEvent())?.utm_json).toBeNull()
  })

  it('drops events past 200 per device per day but still answers ok', async () => {
    const device = `dev-events-${uniqueEmail('x')}`
    const deviceHash = await saltedHash(env.HASH_SALT, `device:${device}`)
    const key = `ev:${deviceHash}:${dayKey(new Date())}`
    await env.FLAGS.put(key, '199')
    const before = await env.DB.prepare('SELECT COUNT(*) AS n FROM events').first<{ n: number }>()

    expect((await api('/api/events', { body: { name: 'landing', path: '/' }, device })).status).toBe(200)
    expect(await env.FLAGS.get(key)).toBe('200')
    const over = await api('/api/events', { body: { name: 'landing', path: '/' }, device })
    expect(over.status).toBe(200)
    expect(await over.json()).toEqual({ ok: true })

    const after = await env.DB.prepare('SELECT COUNT(*) AS n FROM events').first<{ n: number }>()
    expect(after!.n - before!.n).toBe(1)
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
    const key = `ev:ip:${ipHash}:${dayKey(new Date())}`
    await env.FLAGS.put(key, '299')
    const events = async () => (await env.DB.prepare('SELECT COUNT(*) AS n FROM events').first<{ n: number }>())!.n
    const before = await events()

    expect((await api('/api/events', { body: { name: 'sample_start', path: '/' }, device: `dev-ip-${uniqueEmail('x')}`, ip })).status).toBe(200)
    expect(await env.FLAGS.get(key)).toBe('300')
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
