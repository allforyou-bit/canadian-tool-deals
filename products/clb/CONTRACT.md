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
| `POST /api/auth/logout` | `auth.logout` | → `{ok:true}` + cookie cleared |
| `POST /api/account/delete` | `account.deleteAccount` | → `DeleteAccountResponse` |
| `POST /api/account/marketing` | `account.setMarketing` | `MarketingRequest` → `{ok:true}` |
| `POST /api/support` | `account.support` | `SupportRequest` → `{ok:true}` |
| `GET /api/history` | `grading.history` | → `HistoryResponse` |
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

- `lib/http.ts`: `json`, `error`, `readJson<T>(req, maxBytes)`, `getCookie`, `setCookie(name, value, {maxAgeSeconds, httpOnly})`.
- `lib/crypto.ts`: `sha256Hex`, `saltedHash(salt, value)`, `randomToken(bytes)`, `randomId(prefix)`, `hmacSha256Hex`, `timingSafeEqualHex`.
- `lib/session.ts`: `getUser(req, env, now)`, `getActivePass(env, userId, now)`.
- `lib/flags.ts`: `getFlags(env)`, `setFlag(env, name, value)`.
- `lib/usage.ts`: `getUsage`, `capReached`, `freeAvailability`, `recordFreeWriting`, `recordFreeSpeaking`.
- `lib/spend.ts`: `tokenCostMicroUsd(model, usage)`, `whisperCostMicroUsd(seconds)`, `spendSnapshot(env, now)`, `evaluateTiers(snapshot)`.
- `lib/time.ts`: `dayKey`, `startOfUtcDay`, `startOfUtcMonth`, `addDays` (all UTC).
- `email.ts`: `sendEmail(env, {to, subject, text, kind, replyTo?, idempotencyKey?})` → `boolean` (never throws), `alertOwner(env, subject, text)`.
- `turnstile.ts`: `verifyTurnstile(env, token)` → `boolean`.
- `shared/content-rules.ts`: `FORBIDDEN_CLAIMS`, `AD_ONLY_FORBIDDEN`, `ALLOWED_PHRASES`, `findClaims(text, rules?)`.

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

- **Events.** Server-side only: `signup` (core, when `auth.verify` creates a new user), `checkout_start`,
  `purchase`, `refund` (billing). Client-side via `POST /api/events`: `landing`, `sample_start`,
  `sample_done`; `events.track` rejects the server-only names. Server code inserts directly:
  `INSERT INTO events (name, path, utm_json, day, created_at) VALUES (?1, ?2, NULL, ?3, ?4)`.
- **Grader API for the eval harness** (grading owns, ops consumes) in `worker/src/grading/claude.ts`:
  `buildGraderParams(input: GraderInput): <params object for client.beta.messages.create / batch requests>`,
  `parseGraderMessage(message): GradeResult` (throws on invalid output), and in `worker/src/grading/filter.ts`:
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
  (conversion tag on `/checkout/success/` only).
