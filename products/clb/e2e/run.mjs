// End-to-end checks for the exported site (products/clb/out) with every /api/* call mocked.
//
// How to run (no npm packages needed; uses a globally installed Playwright):
//   cd products/clb
//   flock /tmp/clb-next-build.lock npm run build      # produces ./out
//   node e2e/run.mjs                                  # Chromium only (default)
//   E2E_BROWSERS=chromium,webkit node e2e/run.mjs     # CI: Chromium and WebKit
//
// Environment:
//   E2E_BROWSERS       comma list of chromium | webkit (default: chromium)
//   PLAYWRIGHT_MODULE  path to Playwright's index.mjs (default: /opt/node22/lib/node_modules/playwright/index.mjs)
//   CHROMIUM_PATH      Chromium executable (default: /opt/pw-browsers/chromium-1194/chrome-linux/chrome if present)
//   E2E_WEBKIT_MEDIA=1 also run the full recording flow on WebKit (fake microphones are Chromium-only)
//   E2E_ONLY           run only tests whose name contains this text
//   E2E_OUT            exported site to serve (default: ./out). Copy out/ elsewhere inside the build lock
//                      when another build may rewrite out/ while the tests run.
//   E2E_REPEAT         run the whole suite this many times (default 1), to shake out timing-dependent tests
//
// Exit code is non-zero when any test fails. Nothing here reaches the network: requests to other
// hosts are aborted, and Turnstile and Stripe Checkout are replaced by local stand-ins.

import assert from 'node:assert/strict'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { dirname, extname, join, normalize, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = process.env.E2E_OUT ? resolve(process.env.E2E_OUT) : join(ROOT, 'out')
const PLAYWRIGHT_MODULE = process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs'
const DEFAULT_CHROMIUM = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const CHROMIUM_PATH = process.env.CHROMIUM_PATH || (existsSync(DEFAULT_CHROMIUM) ? DEFAULT_CHROMIUM : undefined)
const BROWSERS = (process.env.E2E_BROWSERS || 'chromium')
  .split(',')
  .map((b) => b.trim())
  .filter(Boolean)
const ONLY = process.env.E2E_ONLY || ''
const REPEAT = Math.max(1, Number(process.env.E2E_REPEAT) || 1)

// Copied from shared/config.ts and shared/content-rules.ts (plain node cannot import .ts).
const AI_DISCLOSURE_EN =
  'You are getting feedback from an AI (Claude by Anthropic). It can make mistakes. It does not predict test results.'
const AI_DISCLOSURE_KO = 'AI(Anthropic의 Claude)가 피드백을 드려요. 틀릴 수 있으며, 시험 결과를 예측하지 않아요.'
const NOT_AFFILIATED_START = 'Independent practice tool. Not affiliated with or endorsed by Paragon Testing Enterprises'
const NOT_A_SCORE = 'Feedback is not a score and does not predict test results.'
const TASK_PAGES = [
  '/practice/writing/email/',
  '/practice/writing/survey/',
  ...['advice', 'experience', 'scene', 'predictions', 'compare', 'difficult', 'opinions', 'unusual'].map(
    (id) => `/practice/speaking/${id}/`,
  ),
]
/** TERMS_VERSION from shared/config.ts: BuyPass must send exactly this. */
const TERMS_VERSION = /export const TERMS_VERSION = '([^']+)'/.exec(readFileSync(join(ROOT, 'shared/config.ts'), 'utf8'))?.[1]
if (!TERMS_VERSION) throw new Error('TERMS_VERSION not found in shared/config.ts')

/**
 * Whether this build had NEXT_PUBLIC_MAILING_ADDRESS: only then may the site ask for marketing
 * consent (lib/consent.ts), and the prerendered sign-in page contains the consent sentence.
 */
let mailingAddressBuilt
function builtWithMailingAddress() {
  mailingAddressBuilt ??= readFileSync(join(OUT, 'login/index.html'), 'utf8').includes('send me occasional emails')
  return mailingAddressBuilt
}
const TURNSTILE_TOKEN = 'XXXX.DUMMY.TOKEN.XXXX'
const CHECKOUT_URL = 'https://checkout.stripe.com/c/pay/cs_test_e2e'
const GOOD_TOKEN = 'e2eGoodMagicToken_0123456789abcdef'

// ---------------------------------------------------------------- static server (trailing-slash export)

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml',
}

function resolveFile(urlPath) {
  let p
  try {
    p = decodeURIComponent(urlPath.split('?')[0])
  } catch {
    return null
  }
  const abs = normalize(join(OUT, p))
  if (abs !== OUT && !abs.startsWith(OUT + sep)) return null
  if (existsSync(abs) && statSync(abs).isDirectory()) {
    const index = join(abs, 'index.html')
    return existsSync(index) ? index : null
  }
  return existsSync(abs) ? abs : null
}

function startServer() {
  const server = createServer((req, res) => {
    const url = req.url || '/'
    if (url.startsWith('/api/')) {
      // every /api call is mocked in the browser; reaching here means a test forgot a route
      res.writeHead(501, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'internal', message: 'not mocked' }))
      return
    }
    const path = url.split('?')[0]
    // trailingSlash: true → /foo redirects to /foo/ when /foo/index.html exists
    if (!path.endsWith('/') && !extname(path) && existsSync(join(OUT, path, 'index.html'))) {
      res.writeHead(308, { location: `${path}/` })
      res.end()
      return
    }
    const file = resolveFile(url)
    if (!file) {
      const notFound = join(OUT, '404.html')
      res.writeHead(404, { 'content-type': TYPES['.html'] })
      res.end(existsSync(notFound) ? readFileSync(notFound) : 'Not found')
      return
    }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' })
    res.end(readFileSync(file))
  })
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)))
}

// ---------------------------------------------------------------- mocked Worker API

const WRITING_RESULT = {
  refused: false,
  criteria: [
    { name: 'Content and task completion', strengths: 'You covered all three points.', improve: 'Add one concrete example.' },
    { name: 'Organisation and coherence', strengths: 'Clear paragraphs.', improve: 'Use a linking phrase between points two and three.' },
  ],
  topErrors: [
    { kind: 'grammar', original: 'He park in front of my driveway.', correction: 'He parks in front of my driveway.', why: 'Third-person singular verbs take -s.' },
  ],
  rewrites: ['I would appreciate it if you could park on the street instead.'],
  nextStep: 'Practise linking words such as "however" and "as a result".',
  explanationLang: 'en',
  bandShown: false,
  wordCount: 160,
}

const SPEAKING_RESULT = {
  ...WRITING_RESULT,
  transcript: 'I think my friend should update the resume first and then visit a settlement agency.',
  wordCount: undefined,
}

const SAVED_ESSAY = 'Dear neighbour, I am writing about the car that is often parked in front of my driveway.'

/** GET /api/history/item answers: g1 is still stored; g2 was purged after the retention period (404). */
const HISTORY_ITEMS = {
  g1: { gradeId: 'g1', taskId: 'email', kind: 'writing', createdAt: '2026-09-21T10:00:00.000Z', text: SAVED_ESSAY, result: WRITING_RESULT },
}

/** GET /api/history pages: the first page's cursor (createdAt|id of its last row) and the older page. */
const HISTORY_CURSOR = '2026-06-01T10:00:00.000Z|g2'
const OLDER_HISTORY = [{ gradeId: 'g3', taskId: 'survey', createdAt: '2026-05-20T10:00:00.000Z', topErrorKinds: ['vocabulary'] }]

/** A valid unsubscribe link fragment (the mock plays the Worker's signature check). */
const UNSUB = { h: 'ab'.repeat(32), s: 'cd'.repeat(32) }

function defaultState() {
  return {
    signedIn: false,
    email: 'learner@example.test',
    pass: null,
    /** end of the pass chain; defaults to the active pass end */
    accessEndsAt: undefined,
    latestPurchase: null,
    marketingOptIn: false,
    free: { writing: true, speaking: false },
    usage: { writingToday: 0, speakingToday: 0, graded30d: 0 },
    flags: { checkoutEnabled: true, gradingEnabled: true, freeEnabled: true, banner: '' },
    /** GET /api/history: the first page says there is an older page (nextBefore) */
    olderHistory: false,
    /** next response per endpoint, e.g. { 'POST /api/grade/writing': { status: 402, body: {...} } } */
    overrides: {},
    /**
     * delays (ms) for the next calls per endpoint, e.g. { 'GET /api/me': [700] }. The answer is
     * computed when the request arrives and sent after the delay, like a slow request that left
     * before the state changed.
     */
    delays: {},
    calls: [],
  }
}

const ACTIVE_PASS = { sku: 'pass30', startsAt: '2026-09-20T12:00:00.000Z', endsAt: '2099-10-20T12:00:00.000Z' }

function meBody(s) {
  return {
    signedIn: s.signedIn,
    ...(s.signedIn
      ? {
          email: s.email,
          pass: s.pass,
          marketingOptIn: s.marketingOptIn,
          accessEndsAt: s.accessEndsAt === undefined ? (s.pass?.endsAt ?? null) : s.accessEndsAt,
          latestPurchase: s.latestPurchase,
        }
      : {}),
    free: s.free,
    usage: s.usage,
    flags: s.flags,
  }
}

function apiHandler(s, method, path, body, query) {
  const key = `${method} ${path}`
  if (s.overrides[key]) {
    const o = s.overrides[key]
    delete s.overrides[key]
    return o
  }
  const ok = (b) => ({ status: 200, body: b })
  const err = (status, error, message = error) => ({ status, body: { error, message } })
  switch (key) {
    case 'GET /api/me':
      return ok(meBody(s))
    case 'GET /api/health':
      return ok({ ok: true, version: 'e2e' })
    case 'POST /api/events':
      return ok({ ok: true })
    case 'POST /api/auth/magic-link':
      return ok({ ok: true })
    case 'POST /api/auth/verify':
      if (body?.token !== GOOD_TOKEN) return err(400, 'bad_request', 'Invalid or expired link')
      s.signedIn = true
      return ok({ ok: true, email: s.email })
    case 'POST /api/auth/logout':
      s.signedIn = false
      return ok({ ok: true })
    case 'GET /api/history': {
      if (!s.signedIn) return err(401, 'unauthorized')
      const before = query.get('before')
      // older pages carry no recurring block (it describes recent work, first page only)
      if (before === HISTORY_CURSOR) return ok({ items: OLDER_HISTORY, recurring: [], nextBefore: null })
      if (before !== null) return err(400, 'bad_request', 'Invalid cursor')
      return ok({
        items: [
          { gradeId: 'g1', taskId: 'email', createdAt: '2026-09-21T10:00:00.000Z', topErrorKinds: ['grammar', 'spelling'] },
          { gradeId: 'g2', taskId: 'advice', createdAt: '2026-06-01T10:00:00.000Z', topErrorKinds: ['fluency'] },
        ],
        recurring: [{ kind: 'grammar', count: 3 }],
        nextBefore: s.olderHistory ? HISTORY_CURSOR : null,
      })
    }
    case 'GET /api/history/item': {
      if (!s.signedIn) return err(401, 'unauthorized')
      const item = HISTORY_ITEMS[query.get('id') ?? '']
      return item ? ok(item) : err(404, 'not_found', 'Not found')
    }
    case 'POST /api/grade/writing':
      // like the Worker: without a pass, nothing is graded while free samples are switched off
      if (!s.pass && !s.flags.freeEnabled) return err(429, 'free_unavailable', 'The free writing sample is not available right now.')
      return ok({ gradeId: 'g-w', result: { ...WRITING_RESULT, explanationLang: body?.explanationLang ?? 'en' }, free: !s.pass })
    case 'POST /api/grade/speaking':
      if (!s.signedIn) return err(401, 'unauthorized')
      if (!s.pass && !s.flags.freeEnabled) return err(429, 'free_unavailable', 'The free speaking sample is not available right now.')
      return ok({ gradeId: 'g-s', result: SPEAKING_RESULT, free: !s.pass })
    case 'POST /api/checkout':
      if (!s.signedIn) return err(401, 'unauthorized')
      if (body?.termsVersion !== TERMS_VERSION) return err(400, 'bad_request', 'Please reload the page')
      return ok({ url: CHECKOUT_URL })
    case 'POST /api/refund-request':
      if (!s.pass) return err(403, 'forbidden', 'No refundable purchase')
      s.pass = null
      s.accessEndsAt = undefined
      return ok({ ok: true, refundedCents: 3900 })
    case 'POST /api/account/delete':
      s.signedIn = false
      s.pass = null
      return ok({ ok: true })
    case 'POST /api/account/marketing':
      s.marketingOptIn = body?.optIn === true
      return ok({ ok: true })
    case 'POST /api/support':
      return ok({ ok: true })
    case 'POST /api/unsubscribe':
      // no sign-in: only the signature decides
      if (body?.h !== UNSUB.h || body?.s !== UNSUB.s) return err(400, 'bad_request', 'Invalid unsubscribe link')
      return ok({ ok: true })
    default:
      return err(404, 'not_found', `no mock for ${key}`)
  }
}

function fakeTurnstileScript(onload) {
  const cb = onload && /^[A-Za-z_$][\w$]*$/.test(onload) ? `window[${JSON.stringify(onload)}]()` : ''
  return `(function () {
  var n = 0, widgets = {};
  function solve(id) { setTimeout(function () { if (widgets[id]) widgets[id].callback(${JSON.stringify(TURNSTILE_TOKEN)}) }, 30) }
  window.turnstile = {
    render: function (sel, opts) {
      var id = 'w' + (++n); widgets[id] = opts;
      var el = document.querySelector(sel);
      if (el) { el.setAttribute('data-fake-turnstile', 'rendered'); el.textContent = 'Security check (test stand-in)'; }
      solve(id); return id;
    },
    reset: function (id) { solve(id) },
    remove: function (id) { delete widgets[id] },
  };
  ${cb}
})();`
}

/** Route everything for one browser context: block other hosts, fake Turnstile/Stripe, mock /api. */
async function installRoutes(context, state, base) {
  const origin = new URL(base).origin
  await context.route('**/*', (route) => {
    const u = new URL(route.request().url())
    if (u.origin === origin || u.protocol === 'blob:' || u.protocol === 'data:') return route.fallback()
    return route.abort('blockedbyclient')
  })
  await context.route('https://challenges.cloudflare.com/turnstile/v0/api.js*', (route) => {
    const onload = new URL(route.request().url()).searchParams.get('onload')
    return route.fulfill({ status: 200, contentType: 'text/javascript', body: fakeTurnstileScript(onload) })
  })
  await context.route('https://checkout.stripe.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Stripe test</title><h1>Stripe test checkout</h1>' }),
  )
  await context.route(`${origin}/api/**`, async (route) => {
    const req = route.request()
    const u = new URL(req.url())
    const ctype = req.headers()['content-type'] || ''
    let body = null
    if (ctype.includes('application/json')) {
      try {
        body = req.postDataJSON()
      } catch {
        body = null
      }
    }
    const raw = req.postDataBuffer()
    state.calls.push({ method: req.method(), path: u.pathname, query: u.search, body, contentType: ctype, raw })
    const res = apiHandler(state, req.method(), u.pathname, body, u.searchParams)
    const delay = state.delays[`${req.method()} ${u.pathname}`]?.shift()
    if (delay) await new Promise((r) => setTimeout(r, delay))
    // the page may have navigated away during a delay
    return route.fulfill({ status: res.status, contentType: 'application/json', body: JSON.stringify(res.body) }).catch(() => {})
  })
}

const callsTo = (s, path) => s.calls.filter((c) => c.path === path)

/** Retry an assertion until it passes (for fire-and-forget requests such as analytics). */
async function eventually(check, timeoutMs = 3000) {
  const end = Date.now() + timeoutMs
  for (;;) {
    try {
      return check()
    } catch (e) {
      if (Date.now() > end) throw e
      await new Promise((r) => setTimeout(r, 50))
    }
  }
}

const TOKEN_COUNTER = '[data-turnstile-tokens]'

/**
 * Wait until the security check has handed the form more than `seen` tokens and return the new
 * count. The counter is committed in the same React render as the form's token state, so the next
 * click is guaranteed to carry a fresh (single-use) token — no sleeping.
 */
async function freshToken(page, seen = 0) {
  const handle = await page.waitForFunction(
    ([sel, n]) => {
      const count = Number(document.querySelector(sel)?.getAttribute('data-turnstile-tokens') ?? 0)
      return count > n ? count : false
    },
    [TOKEN_COUNTER, seen],
  )
  return handle.jsonValue()
}

/** Wait until keyboard focus is on the element with this text (a button or link). */
async function focusOn(page, text) {
  await page.waitForFunction((t) => document.activeElement?.textContent?.trim() === t, text)
}

// ---------------------------------------------------------------- tests

const tests = []
const test = (name, fn, opts = {}) => tests.push({ name, fn, ...opts })

/** 11 sentences × 15 words = 165 words (target 150–200) */
const ESSAY = Array.from(
  { length: 11 },
  (_, i) => `Sentence ${i + 1} explains the problem with the driveway and a fair way to solve it.`,
).join(' ')

test('every practice page shows the AI disclosure before any input', async ({ page, base }) => {
  for (const path of TASK_PAGES) {
    await page.goto(base + path)
    const note = page.getByRole('note').filter({ hasText: AI_DISCLOSURE_EN })
    await note.waitFor({ state: 'visible' })
    assert.equal(await note.count(), 1, `${path}: one disclosure note`)
    assert.ok((await note.innerText()).includes(AI_DISCLOSURE_KO), `${path}: Korean disclosure`)
    assert.ok((await note.innerText()).includes(NOT_AFFILIATED_START), `${path}: not-affiliated line in the note`)
    // the note comes before the prompt picker and every form control
    const before = await page.evaluate((text) => {
      const n = [...document.querySelectorAll('[role="note"]')].find((el) => el.textContent.includes(text))
      const first = document.querySelector('main fieldset, main textarea, main button')
      return Boolean(n && first && n.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING)
    }, AI_DISCLOSURE_EN)
    assert.ok(before, `${path}: disclosure precedes the inputs`)
    const footer = await page.locator('footer').innerText()
    assert.ok(footer.includes(NOT_AFFILIATED_START), `${path}: footer not-affiliated line`)
  }
  // the static HTML itself carries the disclosure (no JavaScript needed)
  const html = readFileSync(join(OUT, 'practice/writing/email/index.html'), 'utf8')
  assert.ok(html.indexOf(AI_DISCLOSURE_EN) > 0 && html.indexOf(AI_DISCLOSURE_EN) < html.indexOf('<textarea'))
})

test('anonymous writing sample: 18+ confirmation, security check, feedback, events', async ({ page, base, state }) => {
  await page.goto(`${base}/practice/writing/email/?utm_source=google&gclid=abc123&email=someone%40example.test`)
  let seen = await freshToken(page)
  const answer = page.getByLabel('Your answer')
  await answer.fill(ESSAY)
  // the word counter is described, not live; only a change of range state is announced
  const live = page.getByTestId('word-range-live')
  await live.filter({ hasText: 'Within the target range.' }).waitFor({ state: 'attached' })
  const counterId = await answer.getAttribute('aria-describedby')
  assert.equal(await page.locator(`[id="${counterId}"]`).getAttribute('aria-live'), null, 'counter is not a live region')

  // signed-out visitors must confirm they are 18 or older before anything is sent
  await page.getByRole('button', { name: 'Get feedback' }).click()
  await page.getByRole('alert').filter({ hasText: 'Please confirm that you are 18 or older.' }).waitFor()
  assert.equal(callsTo(state, '/api/grade/writing').length, 0, 'nothing sent before the 18+ confirmation')
  await page.getByRole('checkbox', { name: 'I am 18 or older.' }).check()
  await page.getByRole('button', { name: 'Get feedback' }).click()

  const result = page.getByTestId('grade-result')
  await result.waitFor({ state: 'visible' })
  const text = await result.innerText()
  assert.ok(text.includes(NOT_A_SCORE), 'not-a-score sentence')
  assert.ok(text.includes('You covered all three points.'), 'criteria rendered')
  assert.ok(text.includes('He parks in front of my driveway.'), 'correction rendered')
  assert.ok(text.includes('That was your free sample.'), 'free-sample upsell')
  await focusOn(page, 'Your feedback')

  const [grade] = callsTo(state, '/api/grade/writing')
  assert.equal(grade.body.taskId, 'email')
  assert.equal(grade.body.promptIndex, 0)
  assert.equal(grade.body.explanationLang, 'en')
  assert.equal(grade.body.turnstileToken, TURNSTILE_TOKEN)
  assert.ok(grade.body.text.startsWith('Sentence 1'))

  const events = await eventually(() => {
    const evs = callsTo(state, '/api/events').map((c) => c.body)
    assert.deepEqual(evs.map((e) => e.name).sort(), ['landing', 'sample_done', 'sample_start'])
    return evs
  })
  const landing = events.find((e) => e.name === 'landing')
  assert.deepEqual(landing.utm, { utm_source: 'google', gclid: 'abc123' })
  assert.equal(landing.path, '/practice/writing/email/')
  for (const e of events) assert.ok(!JSON.stringify(e).includes('@'), 'no personal data in events')

  // a second try after the free sample maps payment_required to the pricing link
  state.overrides['POST /api/grade/writing'] = { status: 402, body: { error: 'payment_required', message: 'Pass needed' } }
  seen = await freshToken(page, seen) // tokens are single-use: wait for the reset one
  await page.getByRole('button', { name: 'Get feedback' }).click()
  const alert = page.getByRole('alert').filter({ hasText: 'You have used your free sample.' })
  await alert.waitFor()
  assert.equal(await alert.getByRole('link', { name: 'See pricing' }).getAttribute('href'), '/pricing/')
})

test('writing error codes show the right guidance', async ({ page, base, state }) => {
  await page.goto(`${base}/practice/writing/survey/`)
  let seen = await freshToken(page)
  await page.getByLabel('Your answer').fill(ESSAY)
  await page.getByRole('checkbox', { name: 'I am 18 or older.' }).check()
  const cases = [
    ['grading_paused', 503, 'active passes are extended by the length of the pause'],
    ['rate_limited', 429, 'answers a day that could not get feedback'],
    ['turnstile_failed', 403, 'The security check did not pass.'],
    ['too_large', 413, 'Your answer is too long.'],
  ]
  for (const [i, [code, status, expected]] of cases.entries()) {
    state.overrides['POST /api/grade/writing'] = { status, body: { error: code, message: code } }
    // each submission uses up the token; wait for the fresh one instead of sleeping
    if (i > 0) seen = await freshToken(page, seen)
    await page.getByRole('button', { name: 'Get feedback' }).click()
    await page.getByRole('alert').filter({ hasText: expected }).waitFor()
  }
  assert.equal(callsTo(state, '/api/grade/writing').length, cases.length, 'every case reached the server')
})

test('free samples switched off: a new visitor is told they are not available, never that they used theirs', async ({ page, base, state }) => {
  // /api/me reports every sample as unavailable while free_enabled is off
  state.flags.freeEnabled = false
  state.free = { writing: false, speaking: false }
  await page.goto(`${base}/practice/writing/email/`)
  const off = page.getByRole('status').filter({ hasText: 'Free samples are not available right now. Get a pass to receive feedback.' })
  await off.waitFor()
  assert.equal(await off.getByRole('link', { name: 'See pricing' }).getAttribute('href'), '/pricing/')
  assert.equal(await page.getByText('You have used your free writing sample').count(), 0, 'no "used" wording')
  assert.equal(await page.getByText('Free sample: one writing task without an account.').count(), 0, 'no free-sample offer')

  // a submission anyway (e.g. the page was open before the switch) gets the same wording, without a sign-in link
  await freshToken(page)
  await page.getByLabel('Your answer').fill(ESSAY)
  await page.getByRole('checkbox', { name: 'I am 18 or older.' }).check()
  await page.getByRole('button', { name: 'Get feedback' }).click()
  const alert = page.getByRole('alert').filter({ hasText: 'Free samples are not available right now. Get a pass to receive feedback.' })
  await alert.waitFor()
  assert.deepEqual(
    await alert.getByRole('link').evaluateAll((links) => links.map((a) => a.getAttribute('href'))),
    ['/pricing/'],
  )
  assert.equal(callsTo(state, '/api/events').filter((c) => c.body?.name === 'sample_start').length, 0, 'no sample_start')

  // Korean wording
  await page.goto(`${base}/practice/writing/email/?lang=ko`)
  await page.getByText('지금은 무료 체험을 이용할 수 없어요. 피드백을 받으려면 이용권을 구매해 주세요.').waitFor()
  assert.equal(await page.getByText('무료 쓰기 체험을 이미 사용했어요').count(), 0)

  // speaking: signed out, the sign-in note does not promise a free task
  await page.goto(`${base}/practice/speaking/opinions/?lang=en`)
  await page.getByText('Sign in to practise speaking. Free samples are not available right now, so feedback needs a pass.').waitFor()
  assert.equal(await page.getByText('Your first speaking task is free').count(), 0)

  // speaking: signed in without a pass (never used the sample)
  state.signedIn = true
  await page.reload()
  await page.getByRole('status').filter({ hasText: 'Free samples are not available right now. Get a pass to receive feedback.' }).waitFor()
  assert.equal(await page.getByText('You have used your free speaking sample').count(), 0)

  // the account page says the same
  await page.goto(`${base}/account/`)
  await page.getByText('Writing sample: Not available right now').waitFor()
  await page.getByText('Speaking sample: Not available right now').waitFor()
})

test('speaking: keyboard flow with focus and announcements, no-speech message, transcript feedback', async ({ page, base, state, browserName }) => {
  state.signedIn = true
  state.free.speaking = true
  await page.goto(`${base}/practice/speaking/advice/`)
  const notice = page.getByTestId('transcript-notice')
  await notice.waitFor()
  const noticeText = await notice.innerText()
  assert.ok(noticeText.includes('Pronunciation and fluency are not assessed'))
  assert.ok(noticeText.includes('발음과 유창성은 평가하지 않아요'))

  if (browserName === 'webkit' && process.env.E2E_WEBKIT_MEDIA !== '1') {
    // WebKit has no fake microphone in Playwright; check the recorder UI and the MIME choice only.
    const start = page.getByRole('button', { name: 'Start: preparation time' })
    const unsupported = page.getByText('This browser cannot record audio.')
    await start.or(unsupported).first().waitFor()
    const supported = await page.evaluate(() =>
      typeof MediaRecorder === 'undefined'
        ? []
        : ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].filter((t) => MediaRecorder.isTypeSupported(t)),
    )
    console.log(`    webkit MediaRecorder supports: ${JSON.stringify(supported)}`)
    return
  }

  const live = page.getByTestId('recorder-live')
  await page.getByRole('button', { name: 'Start: preparation time' }).focus()
  await page.keyboard.press('Enter')
  // focus moves to the next control and the timed phase is announced
  await focusOn(page, 'Start speaking now')
  await live.filter({ hasText: 'Preparation time started.' }).waitFor({ state: 'attached' })
  await page.keyboard.press('Enter')
  await focusOn(page, 'Stop recording')
  await live.filter({ hasText: 'Recording started.' }).waitFor({ state: 'attached' })
  await page.waitForTimeout(2500) // the length of the recording, not a wait for the app
  await page.keyboard.press('Enter')
  await page.locator('audio').waitFor()
  await focusOn(page, 'Get feedback')
  await live.filter({ hasText: 'Recording stopped.' }).waitFor({ state: 'attached' })

  // an empty transcript comes back as bad_request: say what to do about the microphone
  state.overrides['POST /api/grade/speaking'] = {
    status: 400,
    body: { error: 'bad_request', message: 'No speech detected. Please check your microphone and try again.' },
  }
  await page.getByRole('button', { name: 'Get feedback' }).click()
  await page.getByRole('alert').filter({ hasText: 'We could not hear any speech. Check your microphone' }).waitFor()
  await focusOn(page, 'Get feedback')

  await page.getByRole('button', { name: 'Get feedback' }).click()
  const result = page.getByTestId('grade-result')
  await result.waitFor({ state: 'visible' })
  const text = await result.innerText()
  assert.ok(text.includes('Transcript (what we heard)'))
  assert.ok(text.includes(SPEAKING_RESULT.transcript))
  assert.ok(text.includes(NOT_A_SCORE))
  assert.ok(text.includes('You said'))

  const calls = callsTo(state, '/api/grade/speaking')
  assert.equal(calls.length, 2)
  const call = calls[1]
  assert.ok(call.contentType.startsWith('multipart/form-data'), 'multipart upload')
  const raw = call.raw.toString('latin1')
  for (const field of ['taskId', 'promptIndex', 'explanationLang', 'audio', 'durationSeconds']) {
    assert.ok(raw.includes(`name="${field}"`), `field ${field}`)
  }
  assert.match(raw, /name="taskId"\r\n\r\nadvice\r\n/)
  assert.match(raw, /name="promptIndex"\r\n\r\n0\r\n/)
  assert.match(raw, /name="audio"; filename="answer\.(webm|mp4)"\r\nContent-Type: audio\/(webm|mp4)/)
  const duration = Number(/name="durationSeconds"\r\n\r\n([\d.]+)\r\n/.exec(raw)?.[1])
  assert.ok(duration >= 1 && duration <= 120, `duration ${duration}`)
  assert.ok(call.raw.length > 1000 && call.raw.length < 3 * 1024 * 1024, `upload size ${call.raw.length}`)
})

test('speaking asks signed-out visitors to sign in', async ({ page, base }) => {
  await page.goto(`${base}/practice/speaking/opinions/`)
  const link = page.getByRole('link', { name: 'Sign in', exact: true }).last()
  await page.getByText('Sign in to practise speaking.').waitFor()
  assert.equal(await link.getAttribute('href'), '/login/?next=/practice/speaking/opinions/')
})

test('login → magic link → verify (hash token) → account shows the pass', async ({ page, base, state }) => {
  await page.goto(`${base}/login/?next=/account/`)
  await freshToken(page) // hydrated, and the form holds a token
  const marketing = page.getByRole('checkbox', { name: /occasional emails/ })
  if (builtWithMailingAddress()) {
    assert.equal(await marketing.isChecked(), false, 'marketing box starts unticked')
    // the site URL in the wording is filled in after hydration
    await page.getByTestId('consent-text').filter({ hasText: new URL(base).origin }).waitFor()
    const consent = await page.getByTestId('consent-text').innerText()
    assert.ok(consent.startsWith('Yes, send me occasional emails'), 'English consent wording')
    assert.ok(!consent.includes('Privacy page'), 'names the real mailing address')
    const address = process.env.NEXT_PUBLIC_MAILING_ADDRESS
    if (address) assert.ok(consent.includes(`Maple Practice Coach, ${address}, ${new URL(base).origin}.`), 'address and site as configured')
  } else {
    // no mailing address configured: CASL consent cannot be asked for, so there is no box at all
    assert.equal(await marketing.count(), 0, 'no marketing box without a mailing address')
  }

  await page.getByLabel('Email address').fill(state.email)
  await page.getByRole('checkbox', { name: 'I am 18 or older.' }).check()
  await page.getByRole('button', { name: 'Email me a sign-in link' }).click()
  await page.getByRole('heading', { name: 'Check your email' }).waitFor()
  await focusOn(page, 'Check your email') // the form is gone; focus moves to the confirmation

  const [link] = callsTo(state, '/api/auth/magic-link')
  assert.deepEqual(link.body, {
    email: state.email,
    lang: 'en',
    turnstileToken: TURNSTILE_TOKEN,
    marketingOptIn: false,
    marketingConsentText: '',
    adult: true,
  })

  // the emailed link opens /auth/verify/#token=…
  state.pass = ACTIVE_PASS
  await page.goto(`${base}/auth/verify/#token=${GOOD_TOKEN}`)
  await page.waitForURL(`${base}/account/`)
  assert.equal(new URL(page.url()).hash, '', 'token removed from the URL')
  const summary = page.getByTestId('pass-summary')
  await summary.waitFor()
  assert.ok((await summary.innerText()).startsWith('30-day pass:'))
  assert.deepEqual(callsTo(state, '/api/auth/verify')[0].body, { token: GOOD_TOKEN })
  await page.getByText('Recurring error types').waitFor()
  await page.getByText('Grammar · 3 times').waitFor()
})

test('sign-in wins over a slow /api/me that left before the session cookie existed', async ({ page, base, state }) => {
  // The header asks /api/me as soon as /auth/verify/ loads; make that (signed-out) answer arrive
  // after the verify call has succeeded. Before the fix, refreshMe() reused it and the account
  // page said "Sign in to see your pass".
  state.pass = ACTIVE_PASS
  state.delays['GET /api/me'] = [700]
  await page.goto(`${base}/auth/verify/#token=${GOOD_TOKEN}`)
  await page.waitForURL(`${base}/account/`)
  await page.getByTestId('pass-summary').waitFor()
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Account' }).waitFor()
  // the late signed-out answer has landed by now and must not have replaced the signed-in state
  await page.waitForTimeout(800)
  assert.equal(await page.getByText('Sign in to see your pass').count(), 0)
  assert.equal(await page.getByTestId('pass-summary').count(), 1)
})

test('login in Korean sends the Korean consent text', async ({ page, base, state }) => {
  await page.goto(`${base}/login/?lang=ko`)
  await page.getByRole('heading', { name: '로그인', exact: true }).waitFor()
  await freshToken(page)
  await page.getByLabel('이메일 주소').fill(state.email)
  await page.getByRole('checkbox', { name: '만 18세 이상이에요.' }).check()
  let consent = ''
  if (builtWithMailingAddress()) {
    await page.getByTestId('consent-text').filter({ hasText: new URL(base).origin }).waitFor()
    consent = await page.getByTestId('consent-text').innerText()
    assert.ok(consent.startsWith('네, Maple Practice Coach'))
    await page.getByRole('checkbox', { name: /이메일을 가끔 받겠습니다/ }).check()
  }
  await page.getByRole('button', { name: '로그인 링크 받기' }).click()
  await page.getByRole('heading', { name: '이메일을 확인해 주세요' }).waitFor()
  const [link] = callsTo(state, '/api/auth/magic-link')
  assert.equal(link.body.lang, 'ko')
  assert.equal(link.body.marketingOptIn, builtWithMailingAddress())
  assert.equal(link.body.marketingConsentText, consent)
})

test('Korean entry points keep Korean: landing CTA → practice feedback in Korean, pricing → sign-in', async ({ page, base, state }) => {
  await page.goto(`${base}/ko/`)
  // a client-side <Link> navigation: the page renders before the address bar changes
  await page.locator('main a[href="/practice/writing/email/?lang=ko"]').first().click()
  await page.waitForURL(`${base}/practice/writing/email/?lang=ko`)
  await page.waitForFunction(() => document.querySelector('main select')?.value === 'ko')
  await page.getByRole('button', { name: '피드백 받기' }).waitFor()
  await freshToken(page)
  await page.getByLabel('내 답안').fill(ESSAY)
  await page.getByRole('checkbox', { name: '만 18세 이상이에요.' }).check()
  await page.getByRole('button', { name: '피드백 받기' }).click()
  await page.getByTestId('grade-result').waitFor()
  assert.equal(callsTo(state, '/api/grade/writing')[0].body.explanationLang, 'ko')

  if (existsSync(join(OUT, 'ko/pricing/index.html'))) {
    await page.goto(`${base}/ko/pricing/`)
    await page.getByRole('link', { name: '로그인하고 구매하기' }).first().click()
    await page.waitForURL(`${base}/login/?next=/ko/pricing/&lang=ko`)
    await page.getByRole('heading', { name: '로그인', exact: true }).waitFor()
  }

  // the choice is remembered, so the magic-link tab and the account page stay Korean
  const tab = await page.context().newPage()
  await tab.goto(`${base}/account/`)
  await tab.getByRole('heading', { name: '내 계정' }).waitFor()
  await tab.close()
}, { needs: 'ko/index.html' })

test('a used or expired sign-in link explains what to do', async ({ page, base }) => {
  await page.goto(`${base}/auth/verify/#token=someOldTokenThatIsNoLongerValid`)
  await page.getByText('This sign-in link has expired or was already used.').waitFor()
  assert.equal(new URL(page.url()).hash, '')
})

test('pricing: BuyPass shows the terms and hands over to the checkout URL', async ({ page, base, state }) => {
  state.signedIn = true
  await page.goto(`${base}/pricing/`)
  const box = page.getByRole('checkbox', { name: 'I live in Canada, outside Quebec' }).first()
  await box.waitFor()
  assert.ok((await page.locator('main').innerText()).includes('Passes are not sold in Quebec.'))
  const terms = page.getByTestId('buy-terms').first()
  assert.equal(await terms.innerText(), 'By buying you agree to the Terms of use and Refund policy.')
  assert.equal(await terms.getByRole('link', { name: 'Terms of use' }).getAttribute('href'), '/legal/terms/')
  assert.equal(await terms.getByRole('link', { name: 'Refund policy' }).getAttribute('href'), '/legal/refunds/')
  await box.check()
  await page.getByRole('button', { name: 'Buy the 30-day pass' }).click()
  await page.waitForURL(CHECKOUT_URL)
  assert.deepEqual(callsTo(state, '/api/checkout')[0].body, {
    sku: 'pass30',
    termsVersion: TERMS_VERSION,
    residentAttestation: true,
    lang: 'en',
  })
}, { needs: 'pricing/index.html' })

test('pricing: signed out, closed, stale terms and region-blocked states', async ({ page, base, state }) => {
  await page.goto(`${base}/pricing/`)
  const signIn = page.getByRole('link', { name: 'Sign in to buy' }).first()
  await signIn.waitFor()
  assert.equal(await signIn.getAttribute('href'), '/login/?next=/pricing/')

  if (existsSync(join(OUT, 'ko/pricing/index.html'))) {
    await page.goto(`${base}/ko/pricing/`)
    const koSignIn = page.getByRole('link', { name: '로그인하고 구매하기' }).first()
    await koSignIn.waitFor()
    assert.equal(await koSignIn.getAttribute('href'), '/login/?next=/ko/pricing/&lang=ko')
    await page.getByText('퀘벡에서는 이용권을 판매하지 않아요.').first().waitFor()
    await page.goto(`${base}/pricing/`)
  }

  state.signedIn = true
  state.flags.checkoutEnabled = false
  await page.reload()
  // neutral: checkout may be off for a pause or for good
  await page.getByText('Passes are not available to buy right now.').first().waitFor()
  assert.equal(await page.getByText('Purchases open soon').count(), 0)

  state.flags.checkoutEnabled = true
  state.overrides['POST /api/checkout'] = { status: 400, body: { error: 'bad_request', message: 'Please reload the page' } }
  await page.reload()
  await page.getByRole('checkbox', { name: 'I live in Canada, outside Quebec' }).first().check()
  await page.getByRole('button', { name: 'Buy the 30-day pass' }).click()
  await page.getByRole('alert').filter({ hasText: 'Please reload the page and try again.' }).waitFor()

  state.overrides['POST /api/checkout'] = { status: 403, body: { error: 'region_not_supported', message: 'x' } }
  await page.reload()
  await page.getByRole('checkbox', { name: 'I live in Canada, outside Quebec' }).first().check()
  await page.getByRole('button', { name: 'Buy the 30-day pass' }).click()
  await page.getByRole('alert').filter({ hasText: 'Passes are sold only in Canada outside Quebec.' }).waitFor()
}, { needs: 'pricing/index.html' })

test('account: overall access date and self-serve refund with a focused confirm step', async ({ page, base, state }) => {
  state.signedIn = true
  state.pass = ACTIVE_PASS
  state.accessEndsAt = '2100-01-18T12:00:00.000Z' // a second pass queued after the current one
  await page.goto(`${base}/account/`)
  await page.getByTestId('access-ends').filter({ hasText: 'Jan 18, 2100' }).waitFor()
  await page.getByText('Your next pass starts when the current one ends.').waitFor()

  await page.getByText('within 14 days of purchase').waitFor()
  await page.getByRole('button', { name: 'Request a refund' }).click()
  await page.getByText('Your pass will end as soon as the refund is made.').waitFor()
  await focusOn(page, 'Yes, refund my pass')
  await page.keyboard.press('Enter')
  await page.getByText('Refunded C$39.').waitFor()
  assert.deepEqual(callsTo(state, '/api/refund-request')[0].body, { lang: 'en' })
  await page.getByText('You do not have an active pass.').waitFor()
})

test('account: marketing state, withdrawal, opt-in and support message', async ({ page, base, state }) => {
  state.signedIn = true
  state.marketingOptIn = true
  await page.goto(`${base}/account/`)
  const marketingState = page.getByTestId('marketing-state')
  await marketingState.filter({ hasText: 'You receive marketing emails from us.' }).waitFor()
  // opted in: only the withdraw button, no consent form
  assert.equal(await page.getByTestId('account-consent-text').count(), 0)
  await page.getByRole('button', { name: 'Stop marketing emails' }).click()
  await page.getByText('You will not receive marketing emails.').waitFor()
  assert.deepEqual(callsTo(state, '/api/account/marketing')[0].body, { optIn: false })
  await marketingState.filter({ hasText: 'You do not receive marketing emails.' }).waitFor()
  await focusOn(page, 'You do not receive marketing emails.') // the button it replaced had focus
  assert.equal(await page.getByRole('button', { name: 'Stop marketing emails' }).count(), 0)

  if (builtWithMailingAddress()) {
    const consent = await page.getByTestId('account-consent-text').innerText()
    await page.getByRole('checkbox', { name: /occasional emails/ }).check()
    await page.getByRole('button', { name: 'Save my choice' }).click()
    await marketingState.filter({ hasText: 'You receive marketing emails from us.' }).waitFor()
    assert.deepEqual(callsTo(state, '/api/account/marketing')[1].body, { optIn: true, consentText: consent })
  } else {
    assert.equal(await page.getByTestId('account-consent-text').count(), 0, 'no consent request without a mailing address')
  }

  await page.getByLabel('Your message').fill('The timer did not start on my phone.')
  await page.getByRole('button', { name: 'Send message' }).click()
  await page.getByText('We will reply by email.').waitFor()
  assert.deepEqual(callsTo(state, '/api/support')[0].body, { message: 'The timer did not start on my phone.', lang: 'en' })
})

test('account: history opens the saved answer and feedback; purged items say so', async ({ page, base, state }) => {
  state.signedIn = true
  await page.goto(`${base}/account/`)
  const open = page.getByRole('button', { name: 'Show answer and feedback' })
  await open.first().waitFor()
  assert.equal(await open.count(), 2)
  await open.first().click()
  await page.getByTestId('history-answer').filter({ hasText: SAVED_ESSAY }).waitFor()
  const feedback = page.getByTestId('grade-result')
  await feedback.waitFor()
  assert.ok((await feedback.innerText()).includes('He parks in front of my driveway.'))
  assert.equal(await page.getByRole('button', { name: 'Hide answer and feedback' }).getAttribute('aria-expanded'), 'true')
  assert.deepEqual(
    callsTo(state, '/api/history/item').map((c) => c.query),
    ['?id=g1'],
  )

  await page.getByRole('button', { name: 'Show answer and feedback' }).click() // the second (purged) item
  await page.getByText('This answer and its feedback are no longer stored.').waitFor()
})

test('account: history "Show older tasks" loads the next page and keeps the recurring block', async ({ page, base, state }) => {
  state.signedIn = true
  state.olderHistory = true
  await page.goto(`${base}/account/`)
  const list = page.getByTestId('history-list')
  await list.getByRole('listitem').nth(1).waitFor()
  assert.equal(await list.getByRole('listitem').count(), 2)
  await page.getByText('Grammar · 3 times').waitFor()

  const more = page.getByRole('button', { name: 'Show older tasks' })
  await more.focus()
  await page.keyboard.press('Enter')
  await list.getByRole('listitem').filter({ hasText: 'Responding to survey questions' }).waitFor()
  assert.equal(await list.getByRole('listitem').count(), 3, 'the older page is appended')
  // the recurring block comes from the first page and stays
  await page.getByText('Grammar · 3 times').waitFor()
  // the last page: no button; focus moved to the first item it added
  assert.equal(await more.count(), 0)
  await page.waitForFunction(
    () => document.activeElement?.tagName === 'LI' && document.activeElement.textContent?.includes('Responding to survey questions'),
  )
  assert.deepEqual(
    callsTo(state, '/api/history').map((c) => c.query),
    ['', '?before=2026-06-01T10%3A00%3A00.000Z%7Cg2'],
  )
  // the default state has no older page: the button is not shown
  state.olderHistory = false
  await page.reload()
  await list.getByRole('listitem').nth(1).waitFor()
  assert.equal(await page.getByRole('button', { name: 'Show older tasks' }).count(), 0)
})

test('account: delete with a confirm step (focus moves in and back)', async ({ page, base, state }) => {
  state.signedIn = true
  await page.goto(`${base}/account/`)
  await page.getByRole('button', { name: 'Delete my account' }).click()
  await focusOn(page, 'Yes, delete permanently')
  await page.getByRole('button', { name: 'Cancel' }).click()
  await focusOn(page, 'Delete my account')
  await page.getByRole('button', { name: 'Delete my account' }).click()
  assert.equal(callsTo(state, '/api/account/delete').length, 0, 'nothing deleted before confirming')
  await page.getByRole('button', { name: 'Yes, delete permanently' }).click()
  await page.getByText('Your account has been deleted.').waitFor()
  assert.equal(callsTo(state, '/api/account/delete').length, 1)
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Sign in' }).waitFor()
})

test('checkout success waits for THIS purchase, not an older pass', async ({ page, base, state }) => {
  // a repeat buyer: the old pass is active while the new payment is still pending
  state.signedIn = true
  state.pass = ACTIVE_PASS
  state.latestPurchase = { id: 'cs_test_e2e', sku: 'pass90', status: 'pending' }
  await page.goto(`${base}/checkout/success/?session_id=cs_test_e2e`)
  await page.getByText('Confirming your payment…').waitFor()
  const polls = callsTo(state, '/api/me').length
  await eventually(() => assert.ok(callsTo(state, '/api/me').length >= polls + 1, 'polled again'), 6000)
  assert.equal(await page.getByTestId('purchase-confirmed').count(), 0, 'the old pass is not shown as this purchase')

  state.latestPurchase.status = 'paid'
  state.accessEndsAt = '2100-01-18T12:00:00.000Z'
  const confirmed = page.getByTestId('purchase-confirmed')
  await confirmed.waitFor({ timeout: 8000 })
  const text = await confirmed.innerText()
  assert.ok(text.includes('90-day pass is confirmed'), text)
  assert.ok(text.includes('Jan 18, 2100'), text)

  // a payment refunded by the region rule is never shown as active
  state.latestPurchase = { id: 'cs_test_region', sku: 'pass30', status: 'rejected_region' }
  await page.goto(`${base}/checkout/success/?session_id=cs_test_region`)
  await page.getByText('so we refunded this payment').waitFor()
  assert.equal(await page.getByTestId('purchase-confirmed').count(), 0)
})

test('status page reports health, the notice, and a failing /api/me', async ({ page, base, state }) => {
  state.flags.banner = 'Scheduled maintenance tonight.'
  await page.goto(`${base}/status/`)
  await page.getByTestId('status-api').filter({ hasText: 'Working' }).waitFor()
  await page.getByTestId('status-grading').filter({ hasText: 'On' }).waitFor()
  assert.ok((await page.getByRole('status').first().innerText()).includes('Scheduled maintenance tonight.'))

  state.overrides['GET /api/me'] = { status: 500, body: { error: 'internal', message: 'x' } }
  await page.reload()
  await page.getByTestId('status-grading').filter({ hasText: 'Not reachable' }).waitFor()
  await page.getByTestId('status-checkout').filter({ hasText: 'Not reachable' }).waitFor()
  await page.getByRole('button', { name: 'Try again' }).click()
  await page.getByTestId('status-checkout').filter({ hasText: 'On' }).waitFor()
})

test('unsubscribe link works without signing in (EN and KO)', async ({ page, base, state }) => {
  await page.goto(`${base}/unsubscribe/#h=${UNSUB.h}&s=${UNSUB.s}`)
  const done = page.getByRole('status').filter({ hasText: 'You are unsubscribed.' })
  await done.waitFor()
  assert.ok((await done.innerText()).includes('수신 거부가 완료됐어요.'))
  assert.deepEqual(callsTo(state, '/api/unsubscribe')[0].body, { h: UNSUB.h, s: UNSUB.s })
  assert.equal(state.signedIn, false)

  // an altered signature is refused by the server
  await page.goto('about:blank')
  await page.goto(`${base}/unsubscribe/#h=${UNSUB.h}&s=${'0'.repeat(64)}`)
  await page.getByRole('alert').filter({ hasText: 'This unsubscribe link is incomplete or has been changed.' }).waitFor()
  assert.equal(callsTo(state, '/api/unsubscribe').length, 2)

  // a truncated link never reaches the server
  await page.goto('about:blank')
  await page.goto(`${base}/unsubscribe/#h=${UNSUB.h}`)
  await page.getByRole('alert').filter({ hasText: '수신 거부 링크가 완전하지 않거나' }).waitFor()
  assert.equal(callsTo(state, '/api/unsubscribe').length, 2)
}, { needs: 'unsubscribe/index.html' })

// ---------------------------------------------------------------- runner

async function main() {
  if (!existsSync(join(OUT, 'practice', 'index.html'))) {
    console.error('out/ is missing or incomplete. Build first: flock /tmp/clb-next-build.lock npm run build')
    process.exit(2)
  }
  let playwright
  try {
    playwright = await import(PLAYWRIGHT_MODULE)
  } catch (e) {
    console.error(`Cannot load Playwright from ${PLAYWRIGHT_MODULE} (set PLAYWRIGHT_MODULE): ${e.message}`)
    process.exit(2)
  }
  const server = await startServer()
  const base = `http://127.0.0.1:${server.address().port}`
  const results = []

  for (const browserName of BROWSERS) {
    const type = playwright[browserName]
    if (!type) throw new Error(`Unknown browser ${browserName}`)
    const options = { headless: true }
    if (browserName === 'chromium') {
      options.args = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required']
      if (CHROMIUM_PATH) options.executablePath = CHROMIUM_PATH
    }
    let browser
    try {
      browser = await type.launch(options)
    } catch (e) {
      console.error(`FAIL ${browserName}: cannot launch (${e.message.split('\n')[0]})`)
      results.push({ browserName, name: '(launch)', status: 'fail' })
      continue
    }
    console.log(`\n${browserName} ${browser.version()}`)

    for (const t of Array.from({ length: REPEAT }, () => tests).flat()) {
      if (ONLY && !t.name.includes(ONLY)) continue
      if (t.needs && !existsSync(join(OUT, t.needs))) {
        console.log(`  SKIP ${t.name} (out/${t.needs} not built yet)`)
        results.push({ browserName, name: t.name, status: 'skip' })
        continue
      }
      const state = defaultState()
      const context = await browser.newContext({ locale: 'en-CA', timezoneId: 'America/Toronto' })
      if (browserName === 'chromium') await context.grantPermissions(['microphone'], { origin: base })
      await installRoutes(context, state, base)
      const page = await context.newPage()
      page.setDefaultTimeout(10_000)
      const pageErrors = []
      page.on('pageerror', (e) => pageErrors.push(e.message))
      const started = Date.now()
      try {
        await t.fn({ page, base, state, browserName })
        assert.deepEqual(pageErrors, [], 'uncaught page errors')
        results.push({ browserName, name: t.name, status: 'pass' })
        console.log(`  ok   ${t.name} (${Date.now() - started} ms)`)
      } catch (e) {
        const shot = join(tmpdir(), `clb-e2e-${browserName}-${results.length}.png`)
        await page.screenshot({ path: shot, fullPage: true }).catch(() => {})
        results.push({ browserName, name: t.name, status: 'fail' })
        console.log(`  FAIL ${t.name}\n       ${String(e.message).split('\n').join('\n       ')}\n       screenshot: ${shot}`)
      } finally {
        await context.close()
      }
    }
    await browser.close()
  }
  server.close()

  const failed = results.filter((r) => r.status === 'fail').length
  const passed = results.filter((r) => r.status === 'pass').length
  const skipped = results.filter((r) => r.status === 'skip').length
  const repeated = REPEAT > 1 ? `, each test ${REPEAT} times` : ''
  console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped (${BROWSERS.join(', ')}${repeated})`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
