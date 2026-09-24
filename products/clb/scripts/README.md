# Ops scripts

TypeScript scripts used by the GitHub Actions workflows (`.github/workflows/`) and the Routines
(`ops/routines/`). They run with plain Node 22 — no TypeScript runtime and no npm scripts:
`scripts/run.mjs` bundles a script with the esbuild that is already in `node_modules` and calls its
exported `main(args)`.

```sh
# from products/clb, after `npm ci`
node scripts/run.mjs scripts/content-lint.ts [--out out] [--ads ../../ops/ads/google.csv] [--text "…"]
node scripts/run.mjs scripts/metrics.ts export [--dir ../../ops/metrics] [--days 3] [--rows FILE]
node scripts/run.mjs scripts/metrics.ts guard ../../ops/metrics
node scripts/run.mjs scripts/ads.ts check [--ads F] [--cap F] [--today YYYY-MM-DD]
node scripts/run.mjs scripts/ads.ts cac --from YYYY-MM-DD --to YYYY-MM-DD
node scripts/run.mjs scripts/reconcile.ts [--days 3] [--out DIR]          # needs STRIPE_SECRET_KEY + Cloudflare
node scripts/run.mjs scripts/eval/gen-synthetic.ts [--dry-run]            # needs ANTHROPIC_API_KEY
node scripts/run.mjs scripts/eval/run-live.ts [--limit N]                  # needs ANTHROPIC_API_KEY
```

| Script | What it does | Tests |
|---|---|---|
| `content-lint.ts` | forbidden claims (shared/content-rules.ts) on every exported page, meta tag and JSON-LD; the not-affiliated notice on pages naming CELPIP or IELTS; ad text rules and lengths for `ops/ads/google.csv` | `content-lint.test.ts` |
| `metrics.ts` | copies `metrics_daily` rows from D1 to `ops/metrics/<day>.json`; personal-data guard | `metrics.test.ts` |
| `ads.ts` | parses `ops/metrics/ads.json`, ad cap and freshness, funnel and CAC | `ads.test.ts` (memo B8: funnel reconciles to fixture purchases ±0) |
| `reconcile.ts`, `reconcile-core.ts` | Stripe Checkout Sessions ↔ D1 purchases | `reconcile.test.ts` |
| `eval/harness.ts` | eval metrics and thresholds (memo B12) | `eval/harness.test.ts` on 5 hand-written fixtures |
| `eval/gen-synthetic.ts`, `eval/synthetic-plan.ts` | synthetic eval set via the Message Batches API, into `.eval/` (gitignored) | `eval/plan.test.ts` |
| `eval/run-live.ts`, `eval/batch.ts` | grades the synthetic set 3× with the production grader request | `eval/plan.test.ts` (request building) |

Checks: `npx vitest run scripts` and `npx tsc -p scripts/tsconfig.json`. Tests never reach the
network; the D1 and Stripe readers are tested with recorded output shapes.

Live D1 access goes through `wrangler d1 execute DB --remote --json` (SELECT only, `lib/d1.ts`) and
needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Scripts print counts and ids only — never
emails, essays, tokens or Stripe payloads.
