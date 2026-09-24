# ops — how the practice coach runs itself (memo §5.2, §7.2)

The Worker does time-critical work (spend and prepaid-credit checks every 15 minutes, daily purge and
metrics snapshot). GitHub Actions hold the secrets and run checks, deploys and exports. Routines
(scheduled Claude sessions) read repo files, write reports and open issues or PRs. Every job asserts an
outcome and is safe to run twice. No job spends money, buys credits, changes prices, sends email to
learners or refunds outside policy without an owner merge or approval (memo §1.4).

**Zero-capital launch (memo §7.2).** No ads, no paid hosting, no domain: Cloudflare Workers Free on the
`workers.dev` address, learners sign in with Google, the site sends learners no email (owner alerts go
through Resend's free sender `onboarding@resend.dev`), and the Anthropic API runs on a small prepaid
credit balance with auto-reload off. Acquisition is organic: the product pages, the sitemap, IndexNow on
every production deploy, the free practice mode without AI, and a few one-time community posts by the
owner (`business/online/launch-kit-ko.md`). Nothing in `ops/` posts anywhere.

## What is here

| Path | What |
|---|---|
| `config/anthropic-limit.json` | the prepaid Anthropic credits (`prepaidUsd`, the balance in US$, and `prepaidSince`, its UTC day) and the Console monthly limits the owner set (`monthlyLimitUsd` for production, `evalMonthlyLimitUsd` for the eval workspace). `deploy.yml` passes them to the Worker (`ANTHROPIC_PREPAID_USD`, `ANTHROPIC_PREPAID_SINCE`, `ANTHROPIC_MONTHLY_LIMIT_USD`), and a change to this file on `master` redeploys. After a top-up the daily Routine proposes the new values as a PR; the owner merges |
| `config/ei-schedule.json` | a Monday on which the owner files the EI bi-weekly report; the books Routine counts 14-day periods from it |
| `metrics/` | daily aggregate metrics (format and the personal-data guard: `metrics/README.md`) |
| `routines/*.md` | the Routine prompts: `daily`, `kpi`, `eval`, `books`, `nov30`, `day90` |
| `reports/`, `books/` | written by the Routines (aggregate numbers only); `books/expenses.json` also holds the credit purchases |
| `owner/hours.json` | the owner's hours per week (total and support), recorded by the KPI Routine from the owner's answers in the digest issue |

Routines never read essays or transcripts. One exception to "never read user text" is allowed: the
daily Routine reads support emails **inside Gmail only** to draft replies for the owner (memo §7.1 B14;
the privacy page discloses it). Nothing from a ticket leaves Gmail.

## What the Routines watch (memo §6 as revised in §7.2)

| Rule | Meaning | Where |
|---|---|---|
| K1 | checkout live by Sun Nov 1 | `routines/kpi.md` |
| K2 | owner hours: > 3 h/week in any two weeks, or setup > 12 h | `routines/kpi.md` |
| K5 | fewer than 10 free AI samples by Nov 15 → review channels | `routines/kpi.md`, `routines/nov30.md` |
| K6 | November net < C$500 without growth → maintenance, no second product | `routines/nov30.md` |
| K7, K8, K9 | refunds and disputes; API cost above 20% of revenue; platform notices | `routines/kpi.md`, `routines/daily.md` |
| K10 | stop-loss: cash out (credits and any paid plan) minus sales income above C$100 | `routines/kpi.md` |
| K11 | wind down only if trailing-30-day net < −C$20 or owner support time > 1 h/week | `routines/kpi.md`, `routines/day90.md` |
| S3 | ≥ 30 buyers a month → the owner may hire a qualified reviewer | `routines/kpi.md` |

K3, K4 and S0–S2 were ad rules and are gone. Free AI samples have their own budget (US$0.50 a day and
US$5 a month, `FREE` in `products/clb/shared/config.ts`). The Worker's own prepaid ledger turns free
samples off at 70% of the credits, alerts the owner at 50% and 80%, and pauses grading at 97%; the daily Routine turns
those alerts into the issue "Anthropic credits: top up" and, after the owner has bought credits and
replied with the new balance, a PR with the new values.

## GitHub Actions (`.github/workflows/`)

The repository is private on GitHub Free: 2,000 Actions minutes a month. Without a payment method GitHub
charges nothing and simply stops Actions at the limit until the month resets (memo §7.2), so the workflows
were trimmed (no scheduled eval, staging deploys by hand only). The workflow files are the authority; this
table is a summary.

| Workflow | Trigger | Asserts | Needs |
|---|---|---|---|
| `ci.yml` | pull requests, and pushes to `master`; a change only to `business/online/`, `ops/metrics/`, `ops/routines/` or this README starts no run | root lint/test/build; on PRs the root `out/` file list equals the base's (skipped with a notice when the PR changes the root `package.json`/`package-lock.json` on purpose); practice coach: workflow lint (actionlint), typecheck, tests with the coverage thresholds in `vitest.config.mts`, build, dry-run deploy, content lint, personal-data guard, e2e on Chromium and WebKit | nothing |
| `deploy.yml` | **production** (when `MPC_DEPLOY` is `true`): push to `master` touching `products/clb/**` (not its docs, eval harness or e2e) or `ops/config/anthropic-limit.json`, or manual. **staging:** manual only, with `target` staging | the configuration is complete (production refuses to run without the owner's legal name `MPC_LEGAL_NAME`, Google sign-in (`MPC_GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`), `MPC_OWNER_EMAIL` and a real Turnstile key; `MPC_MAILING_ADDRESS` is optional); the smoke test passes and a failed deploy or smoke test rolls back to the version noted before the deploy. Production then pings IndexNow (never fails; without `MPC_INDEXNOW_KEY` the key is derived from the site URL). Staging stays locked to the email allowlist, the eval key and test keys, with no prepaid ledger | Cloudflare secrets, the variables and secrets below |
| `flags.yml` | manual (from the Actions tab in a browser, also on a phone) | the KV flag reads back as written; for `free_enabled`/`grading_enabled` it also writes the owner marker `owner:<flag>` (the Worker never turns a switch back on while its marker is `false`), and turning grading off records `pause:started_at` so passes are extended by the pause | Cloudflare secrets |
| `level-b.yml` | manual | the automated memo level-B checks: smoke checks; the prompt cache (two paid grader calls, which spend prepaid credits); Lighthouse mobile performance ≥ 85 on `/` | the site URL variables; an Anthropic key for the cache check |
| `metrics.yml` | daily 07:17 UTC (can start late) and manual | a snapshot for yesterday exists and passes the personal-data guard | Cloudflare secrets |
| `metrics-guard.yml` | pull requests and pushes to `master` that change `ops/metrics/` | the personal-data guard over `ops/metrics` (CI skips those changes) | nothing |
| `reconcile.yml` | daily 08:43 UTC and manual | every paid Stripe Checkout Session of the last 3 days matches D1, and back | Cloudflare secrets, `STRIPE_SECRET_KEY` |
| `eval.yml` | manual (with an optional `compare` run: the same samples on claude-opus-5 and claude-sonnet-5, side by side, informational) and PRs touching grading, the eval harness, `shared/*.ts` or the workflow; **no schedule** | eval thresholds and no regression > 5 points against the baseline for the same sample limit; a batch is sent only when its worst-case cost fits the run's budget (`MPC_EVAL_BUDGET_USD` or the `budget_usd` input, US$5 by default; the default sample limit is 5); a stuck batch is cancelled after 60 minutes | an Anthropic key (offline tests run without one) |
| `audit.yml` | Wednesdays and manual | practice coach: no high or critical npm advisories. Root site: reported as a notice | nothing |

Every workflow stops with a notice, not an error, when its secrets are missing.

### Kill switch without Actions

If Actions are unavailable (for example the monthly minutes are used up), write the same KV keys that
`flags.yml` writes (its header has the details). For `free_enabled` and `grading_enabled`, first set the
owner marker `owner:<flag>` to the value, so the Worker's spend check does not turn the switch back on;
then set `flag:<flag>` (`flag:checkout_enabled`, `flag:grading_enabled` or `flag:free_enabled`) to `false`
or `true`. Either with wrangler from `products/clb`, for example
`npx wrangler kv key put flag:grading_enabled false --binding FLAGS --remote -c worker/wrangler.jsonc`
(add `--env staging` for staging), or in the Cloudflare dashboard: Workers KV → the `FLAGS` namespace → add
or edit the keys [unverified: dashboard labels]. The Worker's next 15-minute check records a grading pause
by itself, and its spend and prepaid-credit checks run on Cloudflare, so they keep working without Actions.

## Level-B checks (Day 21 gate, memo W3)

Every "B:" acceptance cell of memo §7 and how it is checked. The manual ones are owner checks by
decision (memo §7.1 B11 / level B); their exact steps and pass criteria are in
`business/online/owner-setup.md`.

| Memo | Level-B check | How |
|---|---|---|
| B16 | root `out/` file list unchanged on every PR | automated: `ci.yml` (except a PR that upgrades the root site's Next.js on purpose, memo §7.2) |
| B0 | `wrangler deploy` to staging | automated: `deploy.yml` run by hand with target staging — deploy + smoke test green |
| B1 | Lighthouse mobile performance ≥ 85 on `/` | automated: `level-b.yml` (Lighthouse job) |
| B3 | prompt cache read on the second call within 5 minutes | automated: `level-b.yml` (prompt-cache check) |
| B4 | 60-second webm and mp4 clips each graded in < 20 s | **manual**: timed on staging on a desktop browser (webm) and a real iPhone (mp4) |
| B6 | purchase, refund and dispute cases with Stripe test keys | **manual**: test-mode purchase, self-refund and dispute on staging |
| B8 | live reconciliation against Stripe | automated: `reconcile.yml` (daily, production D1 against the key's mode) |
| B11 | a failed smoke test rolls back; a missing metrics file alerts | rollback: **drill on staging** — run `deploy.yml` by hand with target staging and `rollback_drill` ticked (after at least one earlier staging deploy); pass = the run is green and its summary says "Rollback drill passed … rolled back to <version>". Missing metrics: automated `metrics.yml` (issue + failed run); the owner confirms once that GitHub emails failed runs |
| B12 | an eval; a prompt PR that drops a metric by > 5 points fails | automated: `eval.yml` (manual runs and prompt PRs; no weekly schedule since memo §7.2) |
| B15 | E2E green against staging | **manual**: signed-in walkthrough of staging (`ci.yml` runs the Playwright e2e against a mocked `/api`) |

B13 (Google Ads import) was dropped with the ads. B2, B5, B7, B9, B10 and B14 have no level-B cell
(level A only).

## Repository secrets and variables (names only)

The workflow files are the authority for these names; the owner's steps are in
`business/online/owner-setup.md`.

Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `ANTHROPIC_API_KEY`, `ANTHROPIC_EVAL_API_KEY`
(optional: a separate eval workspace; without it the eval uses `ANTHROPIC_API_KEY` with a warning),
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_TEST_SECRET_KEY`, `STRIPE_TEST_WEBHOOK_SECRET`,
`RESEND_API_KEY` (owner alerts only), `TURNSTILE_SECRET` (required for production deploys), `HASH_SALT`,
`GOOGLE_CLIENT_SECRET` (Google sign-in; required for production deploys).

Variables: `MPC_DEPLOY`, `MPC_SITE_URL` (the `workers.dev` address), `MPC_LEGAL_NAME` (the seller's legal
name; required for production deploys), `MPC_MAILING_ADDRESS` (optional), `MPC_TURNSTILE_SITE_KEY`
(required for production deploys), `MPC_GOOGLE_CLIENT_ID` (required for production deploys), `MPC_FROM_EMAIL`
(optional; unset means Resend's sandbox sender `Maple Practice Coach <onboarding@resend.dev>`),
`MPC_OWNER_EMAIL` (required for production deploys; must be the Resend account's own address, or alerts
are not delivered), `MPC_MAGIC_LINK` (optional: `owner` by default, the email sign-in link for the owner
only; `all` or `off`), `MPC_LEARNER_EMAIL` (optional: `off` by default; `on` only once a sending domain
exists), `MPC_SUPPORT_EMAIL`, `MPC_GRADER_MODEL` (default `claude-opus-5`;
`claude-sonnet-5` is the owner's choice), `MPC_GRADER_EFFORT`, `MPC_GRADER_MAX_TOKENS`,
`MPC_CF_BEACON_TOKEN`, `MPC_INDEXNOW_KEY` (optional), `MPC_EVAL_LIMIT`, `MPC_EVAL_PR_LIMIT`,
`MPC_EVAL_BUDGET_USD`, `MPC_STAGING_SITE_URL`, `MPC_STAGING_ALLOWED_EMAILS` (staging sign-in allowlist,
comma-separated; empty → `MPC_OWNER_EMAIL`; staging is not deployed when both are empty).

Setup steps for the owner, in Korean: `business/online/owner-setup.md`.
