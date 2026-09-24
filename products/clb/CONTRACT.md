# Build contract: products/clb (Maple Practice Coach)

Spec: `business/online/decision-memo.md` §7 (B0–B16). This file fixes the interfaces so the parts can be
built in parallel. **Frozen files** (listed below) change only through the integrator; if you need a
change there, report it instead of editing.

## 1. Layout and ownership

| Path | Owner | Notes |
|---|---|---|
| `shared/config.ts`, `shared/api.ts`, `shared/tasks.ts`, `shared/content-rules.ts` | integrator (frozen) | single source of truth for prices, caps, flags, contracts, claim rules |
| `worker/src/index.ts`, `env.ts`, `email.ts`, `turnstile.ts`, `lib/*` | integrator (frozen) | router, bindings, http/crypto/session/flags/usage/spend/time helpers |
| `worker/migrations/0001_init.sql` | integrator (frozen) | D1 schema |
| `vitest.config.mts`, `package.json`, `worker/wrangler.jsonc`, `worker/tsconfig.json`, `worker/test/setup.ts`, `worker/test/env.d.ts` | integrator (frozen) | |
| `worker/src/auth.ts`, `account.ts`, `events.ts`, `cron.ts` (+ `worker/src/lib/disposable.ts` may be added by core) | **core** | tests in `worker/test/core/` |
| `worker/src/grading/**` | **grading** | tests in `worker/test/grading/`, fixtures in `worker/test/fixtures/grading/` |
| `worker/src/billing/**` | **billing** | tests in `worker/test/billing/`, fixtures in `worker/test/fixtures/billing/` |
| `app/layout.tsx`, `app/globals.css`, `app/practice/**`, `app/login/**`, `app/auth/**`, `app/account/**`, `app/checkout/**`, `app/status/**`, `components/**` (except `components/content/**`), `lib/**`, `public/**`, `next.config.ts`, `tsconfig.json`, `e2e/**` | **frontend-app** | builds with `flock /tmp/clb-next-build.lock npm run build` |
| `app/page.tsx`, `app/not-found.tsx`, `app/ko/**`, `app/pricing/**`, `app/formats/**`, `app/help/**`, `app/legal/**`, `app/sitemap.ts`, `app/robots.ts`, `components/content/**`, `content/**` | **frontend-content** | uses `<BuyPass>` from frontend-app; same build lock |
| repo-root `.github/workflows/**`, repo-root `ops/**`, `products/clb/scripts/**`, `business/online/owner-setup.md` | **ops** | |

Everything outside `products/clb/`, `ops/`, `.github/` and `business/online/owner-setup.md` is off-limits (the
root home-services site must stay byte-identical — memo B16).

## 2. Handler signatures (router: `worker/src/index.ts`)

```ts
type Handler = (req: Request, ctx: Ctx) => Promise<Response>   // Ctx: worker/src/env.ts
```

| Route | Export | Request → Response (shared/api.ts) |
|---|---|---|
| `GET /api/me` | `account.me` | → `MeResponse` |
| `POST /api/auth/magic-link` | `auth.requestMagicLink` | `MagicLinkRequest` → `MagicLinkResponse` |
| `POST /api/auth/verify` | `auth.verify` | `VerifyRequest` → `VerifyResponse` + `Set-Cookie` |
| `POST /api/auth/google/start` | `authGoogle.start` | `GoogleStartRequest` → `GoogleStartResponse` (memo §7.2 Z3) |
| `GET /api/auth/google/callback` | `authGoogle.callback` | Google redirect → 303 to `next` or `/account/` with the session cookie; errors → `/login/?error=…` |
| `POST /api/auth/logout` | `auth.logout` | → `{ok:true}` + cookie cleared |
| `POST /api/account/delete` | `account.deleteAccount` | → `DeleteAccountResponse` |
| `POST /api/account/marketing` | `account.setMarketing` | `MarketingRequest` → `{ok:true}` |
| `POST /api/support` | `account.support` | `SupportRequest` → `{ok:true}` (signed-in only) |
| `POST /api/unsubscribe` | `account.unsubscribe` | `UnsubscribeRequest` → `{ok:true}` (no sign-in; HMAC-checked) |
| `GET /api/history` | `grading.history` | → `HistoryResponse` |
| `GET /api/history/item?id=` | `grading.historyItem` | → `HistoryItemResponse` (own rows only; 404 when purged/refused) |
| `POST /api/grade/writing` | `grading.gradeWriting` | `WritingGradeRequest` → `GradeResponse` |
| `POST /api/grade/speaking` | `grading.gradeSpeaking` | multipart (`taskId`, `promptIndex`, `explanationLang`, `audio`, optional `durationSeconds`) → `GradeResponse` |
| `POST /api/checkout` | `billing.checkout` | `CheckoutRequest` → `CheckoutResponse` |
| `POST /api/stripe/webhook` | `billing.webhook` | Stripe event → `{received:true}` |
| `POST /api/refund-request` | `billing.refundRequest` | `RefundRequest` → `RefundResponse` |
| `POST /api/events` | `events.track` | `EventRequest` → `{ok:true}` |
| scheduled | `cron.handleScheduled(event, env)` | `event.cron` is `*/15 * * * *` (spend/flags monitor) or `0 5 * * *` (retention + metrics) |

Errors: always `error(code, message)` from `lib/http.ts` (codes in `ApiError`). `index.ts` already does:
same-origin check on POSTs (webhook exempt), device cookie, `ctx.user`, salted `ipHash`/`deviceHash`,
`ctx.country`/`ctx.region` from `request.cf`, and a catch-all 500.

## 3. Shared helpers (frozen — use, don't copy)

- `lib/http.ts`: `json`, `error`, `readJson<T>(req, maxBytes)` (streamed byte limit), `readFormDataLimited(req, maxBytes)`
  (→ FormData | 'too_large' | 'length_required' | null; Content-Length required), `declaredLength(req)`,
  `readTextLimited(req, maxBytes)`, `readBodyLimited`, `getCookie`, `setCookie(name, value, {maxAgeSeconds, httpOnly})`.
- `lib/crypto.ts`: `sha256Hex`, `saltedHash(salt, value)`, `randomToken(bytes)`, `randomId(prefix)`, `hmacSha256Hex`, `timingSafeEqualHex`.
- `lib/session.ts`: `getUser(req, env, now)`, `getActivePass(env, userId, now)`, `sessionIdHash`, `createSession`.
- `lib/flags.ts`: `getFlags(env)`, `setFlag(env, name, value)`.
- `lib/usage.ts`: `getUsage`, `capReached`, `freeAvailability`, `recordFreeWriting`, `recordFreeSpeaking` (atomic claims →
  boolean), `reserveGrade(env, reservation, now, {fairUse})` → `'daily' | 'rolling30' | 'no_feedback' | null` (inserts the
  pending grades row in one conditional statement), `noFeedbackToday`.
- `lib/spend.ts`: `tokenCostMicroUsd(model, usage)`, `whisperCostMicroUsd(seconds)`, `spendSnapshot(env, now)` (L capped by
  `ANTHROPIC_MONTHLY_LIMIT_USD` when set; prepaid ledger fields), `spendSnapshotCached(env, now)` (60 s per isolate, display paths
  only), `clearSpendCache()`, `prepaidConfig(env)`, `evaluateTiers(snapshot)` (adds `prepaidPause`, `prepaidAlert`).
- `lib/usage.ts` (zero-capital): `speakingMinutesToday(env, now)`, `speakingAvailableToday(env, now)` (global Workers AI
  budget `SPEAKING_DAILY_AUDIO_MINUTES`).
- `lib/time.ts`: `dayKey`, `startOfUtcDay`, `startOfUtcMonth`, `addDays` (all UTC).
- `email.ts`: `sendEmail(env, {to, subject, text, kind, replyTo?, idempotencyKey?})` → `boolean` (never throws; every
  non-alert email gets the CASL unsubscribe link), `alertOwner(env, subject, text)`, `unsubscribeUrl(env, email)`,
  `unsubscribeSignature(env, emailHash)`.
- `turnstile.ts`: `verifyTurnstile(env, token)` → `boolean`.
- `shared/content-rules.ts`: `FORBIDDEN_CLAIMS` (pages, emails), `AD_ONLY_FORBIDDEN`, `GRADER_OUTPUT_RULES` (grader
  explanation fields), `GRADER_LEARNER_TEXT_RULES` (quotes and rewrites: claim-shaped only), `ALLOWED_PHRASES`,
  `findClaims(text, rules?)`.
- `cron.ts`: `recordPauseStart(env, now)` (KV `pause:started_at`, only if absent; never throws).

Identifier hashing conventions (must match across modules):
- session cookie → `saltedHash(HASH_SALT, 'session:' + raw)` (see `lib/session.ts`)
- magic-link token → `saltedHash(HASH_SALT, 'magic:' + raw)`
- email → `saltedHash(HASH_SALT, 'email:' + lowercasedEmail)` stored in `users.email_hash`
- timestamps are ISO-8601 UTC strings (`new Date().toISOString()`); compare as strings.

## 4. Outbound HTTP and tests

- All outbound calls use the global `fetch` **at call time** (Stripe REST, Resend, Turnstile). The Anthropic
  client is constructed per request with `fetch: (input, init) => fetch(input, init)` so a stubbed global
  fetch is honoured. Tests stub with `vi.stubGlobal('fetch', ...)` / `vi.spyOn(globalThis, 'fetch')` and
  restore in `afterEach`. **No test ever reaches the network.**
- Workers AI: tests replace `env.AI.run` with a stub (`vi.spyOn(env.AI, 'run')` or pass a fake env).
- Worker tests run in workerd via `@cloudflare/vitest-pool-workers` 0.22 (vitest 4). Import `env` from
  `cloudflare:test` (or `cloudflare:workers`), call the Worker with `exports.default.fetch(url, init)` from
  `cloudflare:workers`, and use `https://coach.test` as the origin (matches `SITE_URL` in tests; send
  `origin: https://coach.test` on POSTs). `request.cf` is not settable through `exports.default.fetch`; to
  test region rules call the handler directly with a hand-built `Ctx`.
- D1 state persists across tests within a file: create unique emails/ids per test.
- Commands (from `products/clb/`): `npx vitest run <path>`; `npx tsc -p worker/tsconfig.json`;
  `npx tsc --noEmit -p tsconfig.json` (Next app); `npm run build`; `npm run deploy:dry`.

## 5. Privacy and claims (hard rules)

- Never store audio. Essays/transcripts only in `grades.input_text`/`result_json` (purged after
  `RETENTION_DAYS`). IPs and device ids only as salted hashes. No personal data in logs (`console.*` must not
  print emails, essays, tokens or Stripe payloads).
- No secrets in the repo. Test secrets live only in `vitest.config.mts` bindings (dummy values).
- Grader explanations, pages, emails and ads must pass `findClaims` (ads also `AD_ONLY_FORBIDDEN`) except
  inside `ALLOWED_PHRASES`. Every practice page shows `AI_DISCLOSURE` before submission; every page shows
  `NOT_AFFILIATED` in the footer. No band/score output anywhere (`bandShown:false`).
- Brand name is `BRAND` from config; never put CELPIP/IELTS/CLB in names, titles or ads.

## 6. Cross-area interfaces

- **Events.** Server-side only: `signup` (core, when `auth.verify` or the Google callback creates a new user), `checkout_start`,
  `purchase`, `refund` (billing). Client-side via `POST /api/events`: `landing`, `sample_start`,
  `sample_done`; `events.track` rejects the server-only names. Server code inserts directly:
  `INSERT INTO events (name, path, utm_json, day, created_at) VALUES (?1, ?2, NULL, ?3, ?4)`.
- **Grader API for the eval harness** (grading owns, ops consumes) in `worker/src/grading/claude.ts`:
  `buildGraderParams(input: GraderInput, opts?: { batch?: boolean; effort?; maxTokens? })` → params for `client.beta.messages.create`
  (`batch: true` omits `betas`/`fallbacks`, which the Batches API rejects), `parseGraderMessage(message,
  explanationLang?: Lang): GradeResult` (throws on invalid output), `callGrader(env, input)`, `GraderOutputError`
  (carries model, usage, stop reason), `GraderApiError` (status, billable attempts, worst-case cost), `graderSettings(env)`,
  `worstCaseCallCostMicroUsd` and `callCost(call)` (sums every fallback attempt in `usage.iterations`); in
  `worker/src/grading/filter.ts`:
  `filterResult(result: GradeResult): { result: GradeResult; removed: number }`, where
  `GraderInput = { taskId: string; promptIndex: number; text: string; explanationLang: Lang; model: string }`
  (speaking passes the transcript as `text`).
- **Buy button** (frontend-app owns `components/BuyPass.tsx`; frontend-content uses it on `/pricing/` and
  `/ko/pricing/`): `export function BuyPass(props: { sku: Sku; lang: Lang }): JSX.Element` — client component
  with the "I live in Canada, outside Quebec" checkbox; calls `POST /api/checkout`; handles signed-out,
  `checkout_unavailable`, `region_not_supported`.
- **Site chrome**: `app/layout.tsx` (frontend-app) renders header, footer with `NOT_AFFILIATED`, and the
  `/api/me` banner for every page; content pages render only their body.
- **Public build-time env for the site** (all optional; safe defaults): `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
  (default Cloudflare test key `1x00000000000000000000AA`), `NEXT_PUBLIC_MAILING_ADDRESS`,
  `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_CF_BEACON_TOKEN` (Web Analytics), `NEXT_PUBLIC_GADS_SEND_TO`
  (conversion tag on `/checkout/success/` only), `NEXT_PUBLIC_SUPPORT_EMAIL` (public support address on legal/help
  pages; unset → account-page support form + mailing address).

## 7. Zero-capital launch (memo §7.2)

Binding decisions: Z1–Z11 (no ads; Workers Free + workers.dev; Google sign-in for learners and the email link only for
the owner; no learner email; the owner's legal name as seller; prepaid Anthropic credits with a ledger; trimmed Actions;
revised kill rules; a free practice mode without AI; an organic launch kit; the root site's Next.js patch).
New env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, MAGIC_LINK ('owner'|'all'|'off'), LEARNER_EMAIL ('off'|'on'),
LEGAL_NAME, ANTHROPIC_PREPAID_USD, ANTHROPIC_PREPAID_SINCE. New error code `at_capacity` (503). New client events
`practice_start`, `practice_done`.
