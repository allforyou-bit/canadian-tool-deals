import { env } from 'cloudflare:workers'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { saltedHash } from '../../src/lib/crypto'
import { dayKey } from '../../src/lib/time'
import { api, stubFetch, uniqueEmail } from './helpers'

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
})
