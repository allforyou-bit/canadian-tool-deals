# Ops scripts

TypeScript scripts used by the GitHub Actions workflows (`.github/workflows/`) and the Routines
(`ops/routines/`). They run with plain Node 22 — no TypeScript runtime and no npm scripts:
`scripts/run.mjs` bundles a script with the esbuild that is already in `node_modules` and calls its
exported `main(args)`.

```sh
# from products/clb, after `npm ci`
node scripts/run.mjs scripts/content-lint.ts [--out out] [--ads ../../ops/ads/google.csv] [--require-address] [--text "…"]
node scripts/run.mjs scripts/metrics.ts export [--dir ../../ops/metrics] [--days 3] [--rows FILE]
node scripts/run.mjs scripts/metrics.ts guard ../../ops/metrics
node scripts/run.mjs scripts/ads.ts check [--ads F] [--cap F] [--today YYYY-MM-DD]
node scripts/run.mjs scripts/ads.ts cac --from YYYY-MM-DD --to YYYY-MM-DD
node scripts/run.mjs scripts/reconcile.ts [--days 3] [--out DIR] [--mode live|test]   # needs STRIPE_SECRET_KEY + Cloudflare
node scripts/run.mjs scripts/deploy-config.ts check --target production|staging     # deploy.yml
npx wrangler deployments status --json -c worker/wrangler.jsonc | node scripts/run.mjs scripts/deploy-config.ts live-version
node scripts/run.mjs scripts/lighthouse-check.ts --min 85 run-1.report.json [run-2.report.json …]   # level-b.yml
node scripts/run.mjs scripts/smoke.ts --base https://… [--version V] [--wait-seconds N]
node scripts/run.mjs scripts/indexnow.ts write-key --out out | ping --site https://… --sitemap out/sitemap.xml   # needs INDEXNOW_KEY
node scripts/run.mjs scripts/eval/gen-synthetic.ts [--dry-run]            # needs ANTHROPIC_EVAL_API_KEY (or ANTHROPIC_API_KEY)
node scripts/run.mjs scripts/eval/run-live.ts [--limit N] [--subset-metrics M]
node scripts/run.mjs scripts/eval/cache-check.ts                          # two paid grader calls
node scripts/run.mjs scripts/eval/cancel-batch.ts .eval/results/batch-id.txt
```

| Script | What it does | Tests |
|---|---|---|
| `content-lint.ts` | forbidden claims (shared/content-rules.ts) on every exported page, meta tag and JSON-LD; the not-affiliated notice on pages naming CELPIP or IELTS; ad text rules and lengths for `ops/ads/google.csv`; with `--require-address` (production deploys) the mailing-address placeholder fails | `content-lint.test.ts` |
| `metrics.ts` | copies `metrics_daily` rows from D1 to `ops/metrics/<day>.json` (allowlisted shape, incl. `paidEvents` and `outcomes`); personal-data guard over every file under ops/metrics, recursively | `metrics.test.ts` |
| `ads.ts` | parses `ops/metrics/ads.json`, ad cap and freshness (counted from the campaign start), funnel and CAC | `ads.test.ts` (memo B8: funnel reconciles to fixture purchases ±0) |
| `reconcile.ts`, `reconcile-core.ts` | Stripe Checkout Sessions ↔ D1 purchases, limited to the Stripe key's mode (live/test) | `reconcile.test.ts` |
| `deploy-config.ts` | deploy.yml configuration check: wrangler ids per target, site URL and custom domain, mailing address (required for production), a real Turnstile site key and secret (required for production), grader variables, Anthropic limit (production: `monthlyLimitUsd`; staging: `evalMonthlyLimitUsd`), Stripe test keys on staging, the staging lock (`STAGING_ALLOWED_EMAILS` from `MPC_STAGING_ALLOWED_EMAILS` or `MPC_OWNER_EMAIL`; never in production) and the `STAGING - ` sender; `live-version` reads the version at 100% from `wrangler deployments status --json` (before the deploy and before a rollback) | `deploy.test.ts` |
| `smoke.ts` | `/api/health` (version), key pages, `/api/me` shape against a deployed site (deploy.yml, level-b.yml) | `deploy.test.ts` |
| `lighthouse-check.ts` | level-B check B1: median mobile performance score of the Lighthouse JSON reports ≥ `--min` (85); errored, desktop or scoreless runs do not count | `lighthouse.test.ts` |
| `indexnow.ts` | writes the IndexNow key file into the export; pings api.indexnow.org with the sitemap URLs (never fails a deploy) | `deploy.test.ts` |
| `eval/harness.ts` | eval metrics and thresholds (memo B12) | `eval/harness.test.ts` on 5 hand-written fixtures |
| `eval/gen-synthetic.ts`, `eval/synthetic-plan.ts` | synthetic eval set via the Message Batches API, into `.eval/` (gitignored) | `eval/plan.test.ts`, `eval/live.test.ts` |
| `eval/run-live.ts`, `eval/batch.ts`, `eval/client.ts` | grades the synthetic set 3× with the production grader request; eval key, model/effort/max_tokens as the Worker, worst-case cost check against `EVAL_BUDGET_USD`, batch cancel on SIGTERM or the wait limit, baselines per limit | `eval/plan.test.ts`, `eval/live.test.ts` |
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
