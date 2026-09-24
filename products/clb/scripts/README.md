# Ops scripts

TypeScript scripts used by the GitHub Actions workflows (`.github/workflows/`) and the Routines
(`ops/routines/`). They run with plain Node 22 — no TypeScript runtime and no npm scripts:
`scripts/run.mjs` bundles a script with the esbuild that is already in `node_modules` and calls its
exported `main(args)`.

```sh
# from products/clb, after `npm ci`
node scripts/run.mjs scripts/content-lint.ts [--out out] [--require-address] [--require-legal-name] [--text "…"]   # legal name from LEGAL_NAME
node scripts/run.mjs scripts/metrics.ts export [--dir ../../ops/metrics] [--days 3] [--rows FILE]
node scripts/run.mjs scripts/metrics.ts guard ../../ops/metrics
node scripts/run.mjs scripts/funnel.ts --from YYYY-MM-DD --to YYYY-MM-DD [--metrics DIR] [--purchases FILE]
node scripts/run.mjs scripts/reconcile.ts [--days 3] [--out DIR] [--mode live|test]   # needs STRIPE_SECRET_KEY + Cloudflare
node scripts/run.mjs scripts/deploy-config.ts check --target production|staging     # deploy.yml
npx wrangler deployments status --json -c worker/wrangler.jsonc | node scripts/run.mjs scripts/deploy-config.ts live-version
node scripts/run.mjs scripts/lighthouse-check.ts --min 85 run-1.report.json [run-2.report.json …]   # level-b.yml
node scripts/run.mjs scripts/smoke.ts --base https://… [--version V] [--wait-seconds N] [--expect-google true|false] [--expect-magic-link owner|all|off]
node scripts/run.mjs scripts/indexnow.ts write-key --out out --site https://… | ping --site https://… --sitemap out/sitemap.xml   # key: INDEXNOW_KEY or derived from the site
node scripts/run.mjs scripts/eval/gen-synthetic.ts [--limit N] [--dry-run]   # needs ANTHROPIC_EVAL_API_KEY (or ANTHROPIC_API_KEY)
node scripts/run.mjs scripts/eval/run-live.ts [--limit N] [--model ID] [--subset-metrics M] [--ledger FILE]
node scripts/run.mjs scripts/eval/compare.ts .eval/results/claude-opus-5/metrics.json .eval/results/claude-sonnet-5/metrics.json
node scripts/run.mjs scripts/eval/cache-check.ts                          # two paid grader calls
node scripts/run.mjs scripts/eval/cancel-batch.ts .eval/results/batch-id.txt
```

| Script | What it does | Tests |
|---|---|---|
| `content-lint.ts` | forbidden claims (shared/content-rules.ts) on every exported page, meta tag and JSON-LD; the not-affiliated notice on pages naming CELPIP or IELTS; with `--require-address` (deploys where `MPC_MAILING_ADDRESS` is set) the mailing-address placeholder fails; with `--require-legal-name` the terms and privacy pages must show the seller's legal name (`LEGAL_NAME`, memo §7.2 Z5). No ads to lint (Z1) | `content-lint.test.ts` |
| `metrics.ts` | copies `metrics_daily` rows from D1 to `ops/metrics/<day>.json` (allowlisted shape, incl. the free practice events and `outcomes`; `paidEvents` optional, absent without ads); personal-data guard over every file under ops/metrics, recursively (only `README.md` and `<day>.json` belong there) | `metrics.test.ts` |
| `funnel.ts` | funnel totals over a window of daily files (landing, practice, samples, sign-ups, checkouts, purchases, refunds); with `--purchases`, the memo B8 check that the funnel reconciles to the purchases ±0 | `funnel.test.ts` |
| `reconcile.ts`, `reconcile-core.ts` | Stripe Checkout Sessions ↔ D1 purchases, limited to the Stripe key's mode (live/test) | `reconcile.test.ts` |
| `deploy-config.ts` | deploy.yml configuration check (memo §7.2 Z3–Z6): wrangler ids per target, site URL and custom domain, the seller's legal name (required for production), mailing address (optional; required again with `MPC_LEARNER_EMAIL=on`), Google sign-in (`MPC_GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`, required for production), `MPC_OWNER_EMAIL` (required for production), the sender (default: Resend's sandbox `onboarding@resend.dev`, refused with `MAGIC_LINK=all` or `LEARNER_EMAIL=on`), `MAGIC_LINK` / `LEARNER_EMAIL` (always passed; default `owner` / `off`), a real Turnstile site key and secret (required for production), grader variables, Anthropic limit (production: `monthlyLimitUsd`; staging: `evalMonthlyLimitUsd`) and the prepaid-credit ledger (production, only when `prepaidUsd` and `prepaidSince` are both valid), Stripe test keys on staging, the staging lock (`STAGING_ALLOWED_EMAILS` from `MPC_STAGING_ALLOWED_EMAILS` or `MPC_OWNER_EMAIL`; never in production) and the `STAGING - ` sender; `live-version` reads the version at 100% from `wrangler deployments status --json` (before the deploy and before a rollback) | `deploy.test.ts` |
| `smoke.ts` | `/api/health` (version), key pages, `/api/me` shape (incl. `flags.speakingAvailable` and `auth`) against a deployed site (deploy.yml, level-b.yml); deploy.yml also checks that `auth` reports the sign-in methods it configured | `deploy.test.ts` |
| `lighthouse-check.ts` | level-B check B1: median mobile performance score of the Lighthouse JSON reports ≥ `--min` (85); errored, desktop or scoreless runs do not count | `lighthouse.test.ts` |
| `indexnow.ts` | writes the IndexNow key file into the export (key: `MPC_INDEXNOW_KEY`, else the first 32 hex characters of SHA-256 of the site origin, memo §7.2 Z10); pings api.indexnow.org with the sitemap URLs (never fails a deploy) | `deploy.test.ts` |
| `eval/harness.ts` | eval metrics and thresholds (memo B12) | `eval/harness.test.ts` on 5 hand-written fixtures |
| `eval/gen-synthetic.ts`, `eval/synthetic-plan.ts` | synthetic eval set via the Message Batches API, into `.eval/` (gitignored); `--limit N` makes only the items a limit-N run grades (N practice samples + ceil(N/2) probes + ceil(N/2) benign items) | `eval/plan.test.ts`, `eval/live.test.ts` |
| `eval/run-live.ts`, `eval/batch.ts`, `eval/client.ts`, `eval/ledger.ts` | grades the synthetic set 3× with the production grader request; eval key, model/effort/max_tokens as the Worker, worst-case cost check against what is left of the run's `EVAL_BUDGET_USD` (spend ledger shared by every batch of one workflow run), batch cancel on SIGTERM or the wait limit, baselines per limit, subset rule and model | `eval/plan.test.ts`, `eval/live.test.ts` |
| `eval/compare.ts` | eval.yml "compare": one side-by-side table of the runs on claude-opus-5 and claude-sonnet-5 (thresholds, refusals, estimated cost per grade) | `eval/live.test.ts` |
| `eval/cache-check.ts` | level-B check (memo B3): the second identical grader request reads the prompt cache | `eval/live.test.ts` |
| `eval/cancel-batch.ts` | cancels a batch left running by a stopped eval run (eval.yml's last step) | `eval/live.test.ts` |

Checks: `npx vitest run scripts` and `npx tsc -p scripts/tsconfig.json`. Tests never reach the
network; the D1 and Stripe readers are tested with recorded output shapes. `tsc` also fails when
worker/src/cron.ts `DailyMetrics` changes shape without the metrics allowlist (metrics.ts).

`run.mjs` passes SIGINT/SIGTERM on to the script, so a cancelled Actions run lets the eval scripts
cancel their Message Batch.

Live D1 access goes through `wrangler d1 execute DB --remote --json` (SELECT only, `lib/d1.ts`) and
needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Scripts print counts and ids only — never
emails, essays, tokens or Stripe payloads.
