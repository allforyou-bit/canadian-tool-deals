# ops — how the practice coach runs itself (memo §5.2)

The Worker does time-critical work (spend monitor every 15 minutes, daily purge and metrics
snapshot). GitHub Actions hold the secrets and run checks, deploys and exports. Routines (scheduled
Claude sessions) read repo files, write reports and open issues or PRs. Every job asserts an outcome
and is safe to run twice. No job spends money, changes prices, sends marketing or refunds outside
policy without an owner merge or approval (memo §1.4).

## What is here

| Path | What |
|---|---|
| `ads/google.csv`, `ads/README.md` | phase-1 Search ads (keywords, headlines, descriptions, negatives) and the settings to enter by hand |
| `config/ad-cap.json` | the owner-approved ad cap (C$1,200 to Jan 31), daily budget and campaign dates; changed only by an owner-merged PR |
| `config/anthropic-limit.json` | the monthly limits the owner set in the Anthropic Console (production workspace, and the separate eval workspace); the KPI Routine proposes raises as PRs. `deploy.yml` passes `monthlyLimitUsd` to the production Worker and `evalMonthlyLimitUsd` to the staging Worker (which grades with the eval key) as `ANTHROPIC_MONTHLY_LIMIT_USD`, and a change to this file on `master` redeploys |
| `config/ei-schedule.json` | a Monday on which the owner files the EI bi-weekly report; the books Routine counts 14-day periods from it |
| `metrics/` | daily aggregate metrics and `ads.json` (formats and the personal-data guard: `metrics/README.md`) |
| `routines/*.md` | the Routine prompts: `daily`, `kpi`, `eval`, `books`, `nov30`, `day90` |
| `reports/`, `books/` | written by the Routines (aggregate numbers only) |

Routines never read essays or transcripts. One exception to "never read user text" is allowed: the
daily Routine reads support emails **inside Gmail only** to draft replies for the owner (memo §7.1 B14;
the privacy page discloses it). Nothing from a ticket leaves Gmail.

## GitHub Actions (`.github/workflows/`)

| Workflow | Trigger | Asserts | Needs |
|---|---|---|---|
| `ci.yml` | pull requests, and pushes to `master` | root lint/test/build; on PRs the root `out/` file list equals the base's; practice coach typecheck, tests with the coverage thresholds in `vitest.config.mts` (≥ 80% lines in `worker/src/billing` and `worker/src/lib/{usage,spend}.ts`), build, dry-run deploy, content lint, personal-data guard, e2e on Chromium and WebKit | nothing |
| `deploy.yml` | **production:** push to `master` touching `products/clb/**` or `ops/config/anthropic-limit.json`, or manual. **staging:** same-repo pull requests touching those paths, or manual with `target` staging | the configuration is complete (production refuses to run without `MPC_MAILING_ADDRESS` and without a real Turnstile site key and `TURNSTILE_SECRET`; staging refuses live Stripe keys and runs only with an email allowlist); the smoke test passes (`/api/health` returns this commit's version, key pages load, `/api/me` has the right shape). The smoke test runs whenever `wrangler deploy` was started, even if the Deploy step failed (wrangler makes the new version live before it attaches domains and crons). If the Deploy step or the smoke test failed, the live version is read again and, when it is no longer the one noted before the deploy, rolled back to it; the run fails naming the failed step. A custom domain in the site URL is attached with `--domain`. Production then pings IndexNow (never fails). **Staging is locked:** `STAGING_ALLOWED_EMAILS` (sign-in links only to those addresses, no anonymous grading), the eval Anthropic key only (a placeholder without it, so staging grading fails), `ANTHROPIC_MONTHLY_LIMIT_USD` = `evalMonthlyLimitUsd`, a `STAGING - ` sender name, Stripe and Turnstile test keys | production: `MPC_DEPLOY=true`, `MPC_MAILING_ADDRESS`, `MPC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET`; staging: `MPC_STAGING=true`, `MPC_STAGING_SITE_URL`, `MPC_STAGING_ALLOWED_EMAILS` or `MPC_OWNER_EMAIL`, the `env.staging` ids in `worker/wrangler.jsonc`; Cloudflare secrets |
| `flags.yml` | manual (works from the GitHub mobile app); `target` production or staging | the KV flag reads back as written; for `free_enabled`/`grading_enabled` it also writes the owner marker `owner:<flag>` (the Worker never turns a switch back on while its marker is `false`), and turning grading off records `pause:started_at` so passes are extended by the pause | Cloudflare secrets |
| `level-b.yml` | manual (`target` staging or production, optional URL) | the automated memo level-B checks that are not covered elsewhere (table below): the smoke checks above; the prompt cache (the production grader request sent twice; the second reports `cache_read_input_tokens > 0`, memo B3; two paid calls, about US$0.05–0.15 on Opus 5, ESTIMATE); Lighthouse 13.5.0 on `/`, mobile, 3 runs, median performance ≥ 85 (memo B1; reports kept as a run artifact) | the site URL variables; `ANTHROPIC_EVAL_API_KEY` (or `ANTHROPIC_API_KEY`) for the cache check |
| `metrics.yml` | daily 07:17 UTC (can start late) and manual | a snapshot for yesterday exists and passes the personal-data guard; `ads.json` is fresh while ads run (checked even when the export fails) | Cloudflare secrets (the ads check runs without) |
| `reconcile.yml` | daily 08:43 UTC and manual | every paid Stripe Checkout Session of the last 3 days matches D1, and back; only purchases of the key's mode (live or test) are compared | Cloudflare secrets, `STRIPE_SECRET_KEY` |
| `eval.yml` | Mondays, manual, and PRs touching grading, `shared/*.ts` or the workflow | eval thresholds and no regression > 5 points against the baseline for the same sample limit; nothing is sent when the worst-case cost is above `MPC_EVAL_BUDGET_USD`; cancelled runs cancel their batches | `ANTHROPIC_EVAL_API_KEY` (a separate Anthropic workspace; without it the production key is used with a warning; offline tests run without either) |
| `audit.yml` | Wednesdays and manual | practice coach: no high or critical npm advisories (fails otherwise). Root site: advisories reported as a notice only — a static export, and upgrading root Next is an owner decision (owner-setup §6, memo §7.1 B0) | nothing |

Every workflow stops with a notice, not an error, when its secrets are missing.

## Level-B checks (Day 21 gate, memo W3)

Every "B:" acceptance cell of memo §7 and how it is checked. The manual ones are owner checks by
decision (memo §7.1 B11 / level B); their exact steps and pass criteria are in
`business/online/owner-setup.md` 2-7a.

| Memo | Level-B check | How |
|---|---|---|
| B16 | root `out/` file list unchanged on every PR | automated: `ci.yml` |
| B0 | `wrangler deploy` to staging | automated: `deploy.yml` (staging) — deploy + smoke test green |
| B1 | Lighthouse mobile performance ≥ 85 on `/` | automated: `level-b.yml` (Lighthouse job) |
| B3 | prompt cache read on the second call within 5 minutes | automated: `level-b.yml` (prompt-cache check) |
| B4 | 60-second webm and mp4 clips each graded in < 20 s | **manual**: timed on staging on a desktop browser (webm) and a real iPhone (mp4) |
| B6 | purchase, refund and dispute cases with Stripe test keys | **manual**: test-mode purchase, self-refund and dispute on staging (replaces the memo's Stripe CLI events) |
| B8 | live reconciliation against Stripe | automated: `reconcile.yml` (daily, production D1 against the key's mode) |
| B11 | a failed smoke test rolls back; a missing metrics file alerts | automated: `deploy.yml` (verification + rollback), `metrics.yml` (issue + failed run); the owner confirms once that GitHub emails failed runs |
| B12 | weekly eval; a prompt PR that drops a metric by > 5 points fails | automated: `eval.yml` |
| B13 | Google Ads import succeeds | **manual** (owner, task 15; only when ads run) |
| B15 | E2E green against staging | **manual**: signed-in walkthrough of staging (`ci.yml` runs the Playwright e2e against a mocked `/api`) |

B2, B5, B7, B9, B10 and B14 have no level-B cell (level A only).

## Repository secrets and variables (names only)

Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `ANTHROPIC_API_KEY` (production only),
`ANTHROPIC_EVAL_API_KEY` (eval and staging), `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_TEST_SECRET_KEY`,
`STRIPE_TEST_WEBHOOK_SECRET`, `RESEND_API_KEY` (production and staging), `TURNSTILE_SECRET` (required for
production deploys), `HASH_SALT`.

Variables: `MPC_DEPLOY`, `MPC_SITE_URL`, `MPC_MAILING_ADDRESS` (required for production deploys),
`MPC_TURNSTILE_SITE_KEY` (required for production deploys), `MPC_FROM_EMAIL`, `MPC_OWNER_EMAIL`,
`MPC_SUPPORT_EMAIL`, `MPC_GRADER_MODEL`, `MPC_GRADER_EFFORT`, `MPC_GRADER_MAX_TOKENS`, `MPC_CF_BEACON_TOKEN`,
`MPC_GADS_SEND_TO`, `MPC_INDEXNOW_KEY`, `MPC_EVAL_LIMIT`, `MPC_EVAL_PR_LIMIT`, `MPC_EVAL_BUDGET_USD`,
`MPC_STAGING`, `MPC_STAGING_SITE_URL`, `MPC_STAGING_ALLOWED_EMAILS` (staging sign-in allowlist,
comma-separated; empty → `MPC_OWNER_EMAIL`; staging is not deployed when both are empty).

Setup steps for the owner, in Korean: `business/online/owner-setup.md`.
