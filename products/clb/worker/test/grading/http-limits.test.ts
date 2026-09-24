// Request body limits in lib/http.ts: multipart needs a declared Content-Length and is parsed by the
// runtime (memo §7.2 Z2); JSON and raw text keep the streamed byte limit.
import { describe, expect, it } from 'vitest'
import { declaredLength, readFormDataLimited, readJson, readTextLimited } from '../../src/lib/http'
import { multipartRequest, ORIGIN } from './helpers'

const URL_ = `${ORIGIN}/api/test`

function form(audioBytes = 100): FormData {
  const f = new FormData()
  f.set('taskId', 'advice')
  f.set('audio', new File([new Uint8Array(audioBytes)], 'answer', { type: 'audio/webm' }))
  return f
}

/** A chunked body of `chunks` × 64 KB that records how many chunks were pulled. */
function chunked(chunks: number, byte = 0x20) {
  const state = { pulled: 0 }
  const body = new ReadableStream<Uint8Array>({
    pull(c) {
      if (state.pulled >= chunks) return c.close()
      state.pulled++
      c.enqueue(new Uint8Array(64 * 1024).fill(byte))
    },
  })
  return { body, state }
}

describe('declaredLength', () => {
  const req = (v?: string) => new Request(URL_, { method: 'POST', headers: v === undefined ? {} : { 'content-length': v }, body: 'x' })
  it('reads a plain non-negative integer', () => {
    expect(declaredLength(req('0'))).toBe(0)
    expect(declaredLength(req('1048576'))).toBe(1_048_576)
  })
  for (const v of [undefined, '', 'abc', '-1', '1e6', '12.5', '0x10', '1 2', '9999999999999999']) {
    it(`is null for ${JSON.stringify(v)}`, () => {
      expect(declaredLength(req(v))).toBeNull()
    })
  }
})

describe('readFormDataLimited', () => {
  it('parses multipart form data within the declared limit', async () => {
    const r = await readFormDataLimited(await multipartRequest(URL_, form(1000)), 64 * 1024)
    expect(r).toBeInstanceOf(FormData)
    const f = r as FormData
    expect(f.get('taskId')).toBe('advice')
    expect((f.get('audio') as File).size).toBe(1000)
    expect((f.get('audio') as File).type).toBe('audio/webm')
  })

  it('answers length_required without reading a body that declares no size', async () => {
    const { body, state } = chunked(4)
    const req = new Request(URL_, { method: 'POST', headers: { 'content-type': 'multipart/form-data; boundary=x' }, body })
    expect(await readFormDataLimited(req, 1024 * 1024)).toBe('length_required')
    expect(req.bodyUsed).toBe(false)
    expect(state.pulled).toBeLessThanOrEqual(1)
  })

  it('answers too_large without reading a body that declares more than the limit', async () => {
    const req = await multipartRequest(URL_, form(2000))
    const declared = Number(req.headers.get('content-length'))
    expect(await readFormDataLimited(req, declared - 1)).toBe('too_large')
    expect(req.bodyUsed).toBe(false)
    // exactly at the limit is fine
    expect(await readFormDataLimited(await multipartRequest(URL_, form(2000)), declared)).toBeInstanceOf(FormData)
  })

  it('answers null for a body that is not multipart form data', async () => {
    const req = new Request(URL_, { method: 'POST', headers: { 'content-type': 'application/json', 'content-length': '2' }, body: '{}' })
    expect(await readFormDataLimited(req, 1024)).toBeNull()
    const broken = new Request(URL_, {
      method: 'POST',
      headers: { 'content-type': 'multipart/form-data; boundary=zzz', 'content-length': '11' },
      body: 'not a form!',
    })
    expect(await readFormDataLimited(broken, 1024)).toBeNull()
  })
})

describe('readJson and readTextLimited keep the streamed limit', () => {
  it('stop reading a chunked body without Content-Length as soon as it passes the limit', async () => {
    const json = chunked(20)
    const req = new Request(URL_, { method: 'POST', body: json.body })
    expect(req.headers.get('content-length')).toBeNull()
    expect(await readJson(req, 100 * 1024)).toBeNull()
    expect(json.state.pulled).toBeLessThan(20)

    const text = chunked(20)
    expect(await readTextLimited(new Request(URL_, { method: 'POST', body: text.body }), 100 * 1024)).toBeNull()
    expect(text.state.pulled).toBeLessThan(20)
  })

  it('refuse a declared length over the limit before reading', async () => {
    const req = new Request(URL_, { method: 'POST', headers: { 'content-length': '5000' }, body: '{}' })
    expect(await readJson(req, 1000)).toBeNull()
    expect(req.bodyUsed).toBe(false)
  })

  it('read bodies within the limit', async () => {
    expect(await readJson(new Request(URL_, { method: 'POST', body: '{"a":1}' }), 1000)).toEqual({ a: 1 })
    expect(await readJson(new Request(URL_, { method: 'POST', body: '{not json' }), 1000)).toBeNull()
    expect(await readTextLimited(new Request(URL_, { method: 'POST', body: 'héllo' }), 1000)).toBe('héllo')
    expect(await readTextLimited(new Request(URL_, { method: 'POST', body: 'x'.repeat(1001) }), 1000)).toBeNull()
  })
})
