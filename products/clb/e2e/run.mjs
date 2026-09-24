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
const OUT = join(ROOT, 'out')
const PLAYWRIGHT_MODULE = process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs'
const DEFAULT_CHROMIUM = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const CHROMIUM_PATH = process.env.CHROMIUM_PATH || (existsSync(DEFAULT_CHROMIUM) ? DEFAULT_CHROMIUM : undefined)
const BROWSERS = (process.env.E2E_BROWSERS || 'chromium')
  .split(',')
  .map((b) => b.trim())
  .filter(Boolean)
const ONLY = process.env.E2E_ONLY || ''

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

function defaultState() {
  return {
    signedIn: false,
    email: 'learner@example.test',
    pass: null,
    free: { writing: true, speaking: false },
    usage: { writingToday: 0, speakingToday: 0, graded30d: 0 },
    flags: { checkoutEnabled: true, gradingEnabled: true, banner: '' },
    /** next response per endpoint, e.g. { 'POST /api/grade/writing': { status: 402, body: {...} } } */
    overrides: {},
    calls: [],
  }
}

const ACTIVE_PASS = { sku: 'pass30', startsAt: '2026-09-20T12:00:00.000Z', endsAt: '2099-10-20T12:00:00.000Z' }

function meBody(s) {
  return {
    signedIn: s.signedIn,
    ...(s.signedIn ? { email: s.email, pass: s.pass } : {}),
    free: s.free,
    usage: s.usage,
    flags: s.flags,
  }
}

function apiHandler(s, method, path, body) {
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
    case 'GET /api/history':
      if (!s.signedIn) return err(401, 'unauthorized')
      return ok({
        items: [{ gradeId: 'g1', taskId: 'email', createdAt: '2026-09-21T10:00:00.000Z', topErrorKinds: ['grammar', 'spelling'] }],
        recurring: [{ kind: 'grammar', count: 3 }],
      })
    case 'POST /api/grade/writing':
      return ok({ gradeId: 'g-w', result: WRITING_RESULT, free: !s.pass })
    case 'POST /api/grade/speaking':
      if (!s.signedIn) return err(401, 'unauthorized')
      return ok({ gradeId: 'g-s', result: SPEAKING_RESULT, free: !s.pass })
    case 'POST /api/checkout':
      if (!s.signedIn) return err(401, 'unauthorized')
      return ok({ url: CHECKOUT_URL })
    case 'POST /api/refund-request':
      if (!s.pass) return err(403, 'forbidden', 'No refundable purchase')
      s.pass = null
      return ok({ ok: true, refundedCents: 3900 })
    case 'POST /api/account/delete':
      s.signedIn = false
      s.pass = null
      return ok({ ok: true })
    case 'POST /api/account/marketing':
    case 'POST /api/support':
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
      if (el) { el.setAttribute('data-fake-turnstile', 'solved'); el.textContent = 'Security check (test stand-in)'; }
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
    state.calls.push({ method: req.method(), path: u.pathname, body, contentType: ctype, raw })
    const res = apiHandler(state, req.method(), u.pathname, body)
    return route.fulfill({ status: res.status, contentType: 'application/json', body: JSON.stringify(res.body) })
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

test('anonymous writing sample: security check, feedback, events', async ({ page, base, state }) => {
  await page.goto(`${base}/practice/writing/email/?utm_source=google&gclid=abc123&email=someone%40example.test`)
  await page.locator('[data-fake-turnstile="solved"]').waitFor()
  const answer = page.getByLabel('Your answer')
  await answer.fill(ESSAY)
  await page.getByText('Within the target range.').waitFor()
  await page.getByRole('button', { name: 'Get feedback' }).click()

  const result = page.getByTestId('grade-result')
  await result.waitFor({ state: 'visible' })
  const text = await result.innerText()
  assert.ok(text.includes(NOT_A_SCORE), 'not-a-score sentence')
  assert.ok(text.includes('You covered all three points.'), 'criteria rendered')
  assert.ok(text.includes('He parks in front of my driveway.'), 'correction rendered')
  assert.ok(text.includes('That was your free sample.'), 'free-sample upsell')

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
  await page.locator('[data-fake-turnstile="solved"]').waitFor()
  await page.waitForTimeout(100)
  await page.getByRole('button', { name: 'Get feedback' }).click()
  const alert = page.getByRole('alert').filter({ hasText: 'You have used your free sample.' })
  await alert.waitFor()
  assert.equal(await alert.getByRole('link', { name: 'See pricing' }).getAttribute('href'), '/pricing/')
})

test('writing error codes show the right guidance', async ({ page, base, state }) => {
  await page.goto(`${base}/practice/writing/survey/`)
  await page.locator('[data-fake-turnstile="solved"]').waitFor()
  await page.getByLabel('Your answer').fill(ESSAY)
  const cases = [
    ['grading_paused', 503, 'Feedback is paused for maintenance.'],
    ['rate_limited', 429, 'fair-use limit'],
    ['turnstile_failed', 403, 'The security check did not pass.'],
    ['too_large', 413, 'Your answer is too long.'],
  ]
  for (const [code, status, expected] of cases) {
    state.overrides['POST /api/grade/writing'] = { status, body: { error: code, message: code } }
    await page.waitForTimeout(100) // fake Turnstile hands out a fresh token after each reset
    await page.getByRole('button', { name: 'Get feedback' }).click()
    await page.getByRole('alert').filter({ hasText: expected }).waitFor()
  }
})

test('speaking: record, review, submit, transcript feedback', async ({ page, base, state, browserName }) => {
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

  await page.getByRole('button', { name: 'Start: preparation time' }).click()
  await page.getByRole('button', { name: 'Start speaking now' }).click()
  await page.getByText('Recording', { exact: true }).waitFor()
  await page.waitForTimeout(2500)
  await page.getByRole('button', { name: 'Stop recording' }).click()
  await page.locator('audio').waitFor()
  await page.getByRole('button', { name: 'Get feedback' }).click()

  const result = page.getByTestId('grade-result')
  await result.waitFor({ state: 'visible' })
  const text = await result.innerText()
  assert.ok(text.includes('Transcript (what we heard)'))
  assert.ok(text.includes(SPEAKING_RESULT.transcript))
  assert.ok(text.includes(NOT_A_SCORE))
  assert.ok(text.includes('You said'))

  const [call] = callsTo(state, '/api/grade/speaking')
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
  const marketing = page.getByRole('checkbox', { name: /occasional emails/ })
  assert.equal(await marketing.isChecked(), false, 'marketing box starts unticked')
  // the site URL in the wording is filled in after hydration
  await page.getByTestId('consent-text').filter({ hasText: new URL(base).origin }).waitFor()
  const consent = await page.getByTestId('consent-text').innerText()
  assert.ok(consent.startsWith('Yes, send me occasional emails'), 'English consent wording')
  assert.ok(consent.includes('mailing address on our Privacy page') || /\d/.test(consent), 'names the sender address')
  assert.ok(consent.includes(new URL(base).origin), 'names the site')

  await page.getByLabel('Email address').fill(state.email)
  await page.getByRole('checkbox', { name: 'I am 18 or older.' }).check()
  await page.locator('[data-fake-turnstile="solved"]').waitFor()
  await page.waitForTimeout(100)
  await page.getByRole('button', { name: 'Email me a sign-in link' }).click()
  await page.getByRole('heading', { name: 'Check your email' }).waitFor()

  const [link] = callsTo(state, '/api/auth/magic-link')
  assert.deepEqual(link.body, {
    email: state.email,
    lang: 'en',
    turnstileToken: TURNSTILE_TOKEN,
    marketingOptIn: false,
    marketingConsentText: consent,
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

test('login in Korean sends the Korean consent text', async ({ page, base, state }) => {
  await page.goto(`${base}/login/?lang=ko`)
  await page.getByTestId('consent-text').filter({ hasText: new URL(base).origin }).waitFor()
  const consent = await page.getByTestId('consent-text').innerText()
  assert.ok(consent.startsWith('네, Maple Practice Coach'))
  await page.getByLabel('이메일 주소').fill(state.email)
  await page.getByRole('checkbox', { name: '만 18세 이상이에요.' }).check()
  await page.getByRole('checkbox', { name: /이메일을 가끔 받겠습니다/ }).check()
  await page.locator('[data-fake-turnstile="solved"]').waitFor()
  await page.waitForTimeout(100)
  await page.getByRole('button', { name: '로그인 링크 받기' }).click()
  await page.getByRole('heading', { name: '이메일을 확인해 주세요' }).waitFor()
  const [link] = callsTo(state, '/api/auth/magic-link')
  assert.equal(link.body.lang, 'ko')
  assert.equal(link.body.marketingOptIn, true)
  assert.equal(link.body.marketingConsentText, consent)
})

test('a used or expired sign-in link explains what to do', async ({ page, base }) => {
  await page.goto(`${base}/auth/verify/#token=someOldTokenThatIsNoLongerValid`)
  await page.getByText('This sign-in link has expired or was already used.').waitFor()
  assert.equal(new URL(page.url()).hash, '')
})

test('pricing: BuyPass hands over to the checkout URL', async ({ page, base, state }) => {
  state.signedIn = true
  await page.goto(`${base}/pricing/`)
  const box = page.getByRole('checkbox', { name: 'I live in Canada, outside Quebec' }).first()
  await box.waitFor()
  assert.ok((await page.locator('main').innerText()).includes('Not available in Quebec'))
  await box.check()
  await page.getByRole('button', { name: 'Buy the 30-day pass' }).click()
  await page.waitForURL(CHECKOUT_URL)
  assert.deepEqual(callsTo(state, '/api/checkout')[0].body, { sku: 'pass30', residentAttestation: true, lang: 'en' })
}, { needs: 'pricing/index.html' })

test('pricing: signed out, closed and region-blocked states', async ({ page, base, state }) => {
  await page.goto(`${base}/pricing/`)
  const signIn = page.getByRole('link', { name: 'Sign in to buy' }).first()
  await signIn.waitFor()
  assert.equal(await signIn.getAttribute('href'), '/login/?next=/pricing/')

  if (existsSync(join(OUT, 'ko/pricing/index.html'))) {
    await page.goto(`${base}/ko/pricing/`)
    const koSignIn = page.getByRole('link', { name: '로그인하고 구매하기' }).first()
    await koSignIn.waitFor()
    assert.equal(await koSignIn.getAttribute('href'), '/login/?next=/ko/pricing/&lang=ko')
    await page.getByText('퀘벡에서는 이용할 수 없어요').first().waitFor()
    await page.goto(`${base}/pricing/`)
  }

  state.signedIn = true
  state.flags.checkoutEnabled = false
  await page.reload()
  await page.getByText('Purchases open soon').first().waitFor()

  state.flags.checkoutEnabled = true
  state.overrides['POST /api/checkout'] = { status: 403, body: { error: 'region_not_supported', message: 'x' } }
  await page.reload()
  await page.getByRole('checkbox', { name: 'I live in Canada, outside Quebec' }).first().check()
  await page.getByRole('button', { name: 'Buy the 30-day pass' }).click()
  await page.getByRole('alert').filter({ hasText: 'Passes are sold only in Canada outside Quebec.' }).waitFor()
}, { needs: 'pricing/index.html' })

test('account: self-serve refund with confirmation', async ({ page, base, state }) => {
  state.signedIn = true
  state.pass = ACTIVE_PASS
  await page.goto(`${base}/account/`)
  await page.getByText('within 14 days of purchase').waitFor()
  await page.getByRole('button', { name: 'Request a refund' }).click()
  await page.getByText('Your pass will end as soon as the refund is made.').waitFor()
  await page.getByRole('button', { name: 'Yes, refund my pass' }).click()
  await page.getByText('Refunded C$39.').waitFor()
  assert.deepEqual(callsTo(state, '/api/refund-request')[0].body, { lang: 'en' })
  await page.getByText('You do not have an active pass.').waitFor()
})

test('account: marketing withdrawal and support message', async ({ page, base, state }) => {
  state.signedIn = true
  await page.goto(`${base}/account/`)
  await page.getByRole('button', { name: 'Stop marketing emails' }).click()
  await page.getByText('You will not receive marketing emails.').waitFor()
  assert.deepEqual(callsTo(state, '/api/account/marketing')[0].body, { optIn: false })

  await page.getByLabel('Your message').fill('The timer did not start on my phone.')
  await page.getByRole('button', { name: 'Send message' }).click()
  await page.getByText('We will reply by email.').waitFor()
  assert.deepEqual(callsTo(state, '/api/support')[0].body, { message: 'The timer did not start on my phone.', lang: 'en' })
})

test('account: delete with a confirm step', async ({ page, base, state }) => {
  state.signedIn = true
  await page.goto(`${base}/account/`)
  await page.getByRole('button', { name: 'Delete my account' }).click()
  assert.equal(callsTo(state, '/api/account/delete').length, 0, 'nothing deleted before confirming')
  await page.getByRole('button', { name: 'Yes, delete permanently' }).click()
  await page.getByText('Your account has been deleted.').waitFor()
  assert.equal(callsTo(state, '/api/account/delete').length, 1)
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Sign in' }).waitFor()
})

test('checkout success waits for the pass; status page reports health', async ({ page, base, state }) => {
  state.signedIn = true
  await page.goto(`${base}/checkout/success/`)
  await page.getByText('Confirming your payment…').waitFor()
  state.pass = ACTIVE_PASS
  await page.getByText('Your 30-day pass is active until').waitFor({ timeout: 8000 })

  state.flags.banner = 'Scheduled maintenance tonight.'
  await page.goto(`${base}/status/`)
  await page.getByTestId('status-api').filter({ hasText: 'Working' }).waitFor()
  assert.ok((await page.getByRole('status').first().innerText()).includes('Scheduled maintenance tonight.'))
})

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

    for (const t of tests) {
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
  console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped (${BROWSERS.join(', ')})`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
