// Shared helpers for grading tests: a global fetch stub for the Anthropic Messages API and
// Turnstile, signed-in users with sessions and passes, and request builders. No test reaches the network.
import { env } from 'cloudflare:test'
import { exports } from 'cloudflare:workers'
import { vi } from 'vitest'
import type { GradeResult, Lang } from '../../../shared/api'
import { findClaims, GRADER_OUTPUT_RULES } from '../../../shared/content-rules'
import { MAX_TOP_ERRORS } from '../../src/grading/validate'
import type { Ctx, Env, User } from '../../src/env'
import { randomToken, saltedHash } from '../../src/lib/crypto'
import { addDays } from '../../src/lib/time'
import probesJson from '../fixtures/grading/immigration-probes.json'
import themedJson from '../fixtures/grading/immigration-themed.json'
import goldenJson from '../fixtures/grading/writing-golden.json'

export const ORIGIN = 'https://coach.test'

export interface Fixture {
  id: string
  taskId: string
  promptIndex: number
  explanationLang: Lang
  text: string
  apiResponse: ApiMessage
}

export interface ApiMessage {
  id: string
  type: 'message'
  role: 'assistant'
  model: string
  content: Array<Record<string, unknown>>
  stop_reason: string | null
  stop_sequence: string | null
  usage: Record<string, unknown> & { input_tokens: number; output_tokens: number }
}

export const golden = (goldenJson as { items: Fixture[] }).items
export const probes = (probesJson as { items: Fixture[] }).items
export const themed = (themedJson as { items: Fixture[] }).items

/** The grader JSON inside a fixture's text block. */
export function graderOutput(f: Fixture): Record<string, unknown> {
  const text = f.apiResponse.content.find((b) => b.type === 'text') as { text: string }
  return JSON.parse(text.text) as Record<string, unknown>
}

export const USAGE = { input_tokens: 500, output_tokens: 1200, cache_read_input_tokens: 1950, cache_creation_input_tokens: 0 }

/** A Messages API body whose text block holds `output` (an object is JSON-encoded). */
export function apiMessage(output: unknown, over: Partial<ApiMessage> = {}): ApiMessage {
  return {
    id: 'msg_test_' + randomToken(6),
    type: 'message',
    role: 'assistant',
    model: 'claude-opus-5',
    content: [{ type: 'text', text: typeof output === 'string' ? output : JSON.stringify(output) }],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { ...USAGE },
    ...over,
  }
}

export const SIMPLE_OUTPUT = {
  refused: false,
  criteria: [
    { name: 'Content and task completion', strengths: 'You answer the prompt.', improve: 'Add one example.' },
    { name: 'Organisation and coherence', strengths: 'The order is clear.', improve: 'Use paragraphs.' },
    { name: 'Vocabulary range and precision', strengths: 'Good word choice.', improve: 'Vary your verbs.' },
    { name: 'Grammar and readability', strengths: 'Sentences are clear.', improve: 'Check verb tenses.' },
  ],
  topErrors: [
    { kind: 'grammar', original: 'I goes', correction: 'I go', why: 'Use the base form after "I".' },
    { kind: 'spelling', original: 'recieve', correction: 'receive', why: 'The rule is "i before e except after c".' },
  ],
  rewrites: ['I go to the library every evening.'],
  nextStep: 'Practise present simple verb forms.',
}

export interface CapturedCall {
  url: string
  headers: Headers
  body: Record<string, unknown>
}

export type Responder = (call: CapturedCall) => Response | Promise<Response>

export const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'request-id': 'req_test' } })

/** An email the Worker posted to Resend (owner alerts). */
export interface SentEmail {
  to: string[]
  subject: string
  text: string
}

/**
 * Stub global fetch: Anthropic calls go to `anthropic`; Turnstile passes unless the token is "bad-token"; Resend
 * (owner alerts) answers 200 and the email is recorded.
 */
export function stubFetch(anthropic: Responder): { calls: CapturedCall[]; turnstileTokens: string[]; emails: SentEmail[] } {
  const calls: CapturedCall[] = []
  const turnstileTokens: string[] = []
  const emails: SentEmail[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const req = new Request(input, init)
      const url = new URL(req.url)
      if (url.origin === 'https://api.anthropic.com' && url.pathname === '/v1/messages' && req.method === 'POST') {
        const call = { url: req.url, headers: req.headers, body: (await req.json()) as Record<string, unknown> }
        calls.push(call)
        return anthropic(call)
      }
      if (url.hostname === 'challenges.cloudflare.com') {
        const body = (await req.json()) as { response?: string }
        turnstileTokens.push(body.response ?? '')
        return jsonResponse({ success: body.response !== 'bad-token' })
      }
      if (url.origin === 'https://api.resend.com' && url.pathname === '/emails' && req.method === 'POST') {
        emails.push((await req.json()) as SentEmail)
        return jsonResponse({ id: 'email_test' })
      }
      throw new Error(`unexpected fetch in test: ${req.method} ${url.origin}${url.pathname}`)
    }),
  )
  return { calls, turnstileTokens, emails }
}

/** Stub that always answers with the same Messages API body. */
export const stubGrader = (message: ApiMessage) => stubFetch(() => jsonResponse(message))

export interface TestUser {
  user: User
  cookie: string
}

export async function createUser(opts: { pass?: boolean; freeSpeakingUsed?: boolean } = {}): Promise<TestUser> {
  const id = 'u_' + randomToken(9).replace(/[-_]/g, 'x')
  const email = `${id}@example.test`
  const now = new Date()
  await env.DB.prepare(
    `INSERT INTO users (id, email, email_hash, created_at, last_active_at, lang, free_speaking_used)
     VALUES (?1, ?2, ?3, ?4, ?4, 'en', ?5)`,
  )
    .bind(id, email, await saltedHash(env.HASH_SALT, 'email:' + email), now.toISOString(), opts.freeSpeakingUsed ? 1 : 0)
    .run()
  const raw = randomToken(24)
  await env.DB.prepare('INSERT INTO sessions (id_hash, user_id, created_at, expires_at) VALUES (?1, ?2, ?3, ?4)')
    .bind(await saltedHash(env.HASH_SALT, 'session:' + raw), id, now.toISOString(), addDays(now, 30).toISOString())
    .run()
  if (opts.pass) {
    await env.DB.prepare(
      `INSERT INTO passes (id, user_id, sku, starts_at, ends_at, purchase_id) VALUES (?1, ?2, 'pass30', ?3, ?4, ?5)`,
    )
      .bind('pass_' + id, id, addDays(now, -1).toISOString(), addDays(now, 29).toISOString(), 'cs_test_' + id)
      .run()
  }
  return {
    user: { id, email, lang: 'en', freeSpeakingUsed: opts.freeSpeakingUsed === true, selfRefundUsed: false },
    cookie: `mpc_session=${raw}`,
  }
}

let ipCounter = Math.floor(Math.random() * 50_000)
/** A fresh IPv4 /24 per call, so per-IP free limits never leak between tests. */
export function uniqueIp(): string {
  ipCounter++
  return `10.${(ipCounter >> 8) & 255}.${ipCounter & 255}.9`
}

export interface PostOpts {
  cookie?: string
  ip?: string
}

export function postWriting(body: unknown, opts: PostOpts = {}): Promise<Response> {
  const headers: Record<string, string> = {
    origin: ORIGIN,
    'content-type': 'application/json',
    'cf-connecting-ip': opts.ip ?? uniqueIp(),
  }
  if (opts.cookie) headers.cookie = opts.cookie
  return exports.default.fetch(`${ORIGIN}/api/grade/writing`, { method: 'POST', headers, body: JSON.stringify(body) })
}

export function writingBody(f: Pick<Fixture, 'taskId' | 'promptIndex' | 'text' | 'explanationLang'>, token?: string) {
  return { taskId: f.taskId, promptIndex: f.promptIndex, text: f.text, explanationLang: f.explanationLang, turnstileToken: token }
}

/**
 * A multipart POST with Content-Length, as a browser sends a FormData body. A Request built inside the
 * Worker from a FormData body carries no Content-Length header, so the form is encoded first.
 */
export async function multipartRequest(url: string, form: FormData, headers: Record<string, string> = {}): Promise<Request> {
  const encoded = new Request(url, { method: 'POST', body: form })
  const body = await encoded.arrayBuffer()
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': encoded.headers.get('content-type') ?? '', 'content-length': String(body.byteLength), ...headers },
    body,
  })
}

/** The mpc_device cookie a response set, as a Cookie header value. */
export function deviceCookie(res: Response): string {
  const set = res.headers.get('set-cookie') ?? ''
  const m = /mpc_device=([^;]+)/.exec(set)
  if (!m) throw new Error('no device cookie set')
  return `mpc_device=${m[1]}`
}

/** A hand-built Ctx for calling handlers directly (e.g. with a fake Workers AI binding). */
export function makeCtx(over: Partial<Ctx> = {}): Ctx {
  return {
    env: env as Env,
    exec: { waitUntil: () => undefined, passThroughOnException: () => undefined } as unknown as ExecutionContext,
    user: null,
    ipHash: 'ip_' + randomToken(8),
    deviceHash: 'dev_' + randomToken(8),
    country: 'CA',
    region: 'ON',
    now: new Date(),
    ...over,
  }
}

export interface GradeRowDb {
  id: string
  user_id: string | null
  device_hash: string | null
  task_id: string
  prompt_index: number
  kind: string
  input_text: string | null
  result_json: string | null
  error_kinds: string | null
  free: number
  refused: number
  pending: number
  outcome: string | null
  model: string
  input_tokens: number
  output_tokens: number
  cache_read_tokens: number
  cache_write_tokens: number
  audio_seconds: number
  cost_micro_usd: number
  created_at: string
}

export const gradeRow = (id: string) => env.DB.prepare('SELECT * FROM grades WHERE id = ?1').bind(id).first<GradeRowDb>()

export async function gradeRowsFor(userId: string): Promise<GradeRowDb[]> {
  const { results } = await env.DB.prepare('SELECT * FROM grades WHERE user_id = ?1 ORDER BY created_at').bind(userId).all<GradeRowDb>()
  return results
}

/** The most recently inserted anonymous row (grades rows carry no device id: decision 5). Tests in a file run one at a time. */
export const latestAnonymousRow = () =>
  env.DB.prepare('SELECT * FROM grades WHERE user_id IS NULL ORDER BY rowid DESC LIMIT 1').first<GradeRowDb>()

/** A Messages API error body with the given HTTP status. */
export const apiError = (status: number, type = 'api_error') => jsonResponse({ type: 'error', error: { type, message: 'x' } }, status)

/** What fetch throws when the SDK's timeout aborts the request (the SDK then raises APIConnectionTimeoutError). */
export const abortError = () => new DOMException('The operation was aborted.', 'AbortError')

/** Structural check of a GradeResult as the site receives it (independent of validate.ts). */
export function assertGradeResult(r: GradeResult, lang: Lang): string[] {
  const problems: string[] = []
  const isStr = (v: unknown) => typeof v === 'string'
  if (typeof r.refused !== 'boolean') problems.push('refused')
  if (r.bandShown !== false) problems.push('bandShown')
  if (r.explanationLang !== lang) problems.push('explanationLang')
  if (!Array.isArray(r.criteria) || !r.criteria.every((c) => isStr(c.name) && isStr(c.strengths) && isStr(c.improve))) problems.push('criteria')
  if (!Array.isArray(r.topErrors) || r.topErrors.length > MAX_TOP_ERRORS) problems.push('topErrors')
  if (!Array.isArray(r.rewrites) || r.rewrites.length > 2 || !r.rewrites.every(isStr)) problems.push('rewrites')
  if (!isStr(r.nextStep)) problems.push('nextStep')
  if (r.refused && !(isStr(r.refusalMessage) && r.refusalMessage !== '')) problems.push('refusalMessage')
  if (!r.refused && r.criteria.length === 0) problems.push('criteria empty')
  const explanations = [r.refusalMessage ?? '', r.nextStep, ...r.criteria.flatMap((c) => [c.name, c.strengths, c.improve]), ...r.topErrors.map((e) => e.why)]
  for (const t of explanations) if (findClaims(t, GRADER_OUTPUT_RULES).length > 0) problems.push('claim: ' + t)
  return problems
}
