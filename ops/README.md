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
| `config/anthropic-limit.json` | the monthly limit the owner set in the Anthropic Console; the KPI Routine proposes raises as PRs |
| `metrics/` | daily aggregate metrics and `ads.json` (formats and the personal-data guard: `metrics/README.md`) |
| `routines/*.md` | the Routine prompts: `daily`, `kpi`, `eval`, `books`, `nov30`, `day90` |
| `reports/`, `books/` | written by the Routines (aggregate numbers only) |

## GitHub Actions (`.github/workflows/`)

| Workflow | Trigger | Asserts | Needs |
|---|---|---|---|
| `ci.yml` | every push and PR | root lint/test/build; on PRs the root `out/` file list equals the base's; practice coach typecheck, tests (billing ≥ 80% lines), build, dry-run deploy, content lint, personal-data guard, e2e on Chromium and WebKit | nothing |
| `deploy.yml` | push to `master` touching `products/clb/**`, or manual | `/api/health` returns this commit's version and `/` returns 200; otherwise rollback | `MPC_DEPLOY=true`, Cloudflare secrets |
| `flags.yml` | manual (works from the GitHub mobile app) | the KV flag reads back as written | Cloudflare secrets |
| `metrics.yml` | daily 07:17 UTC (can start late) and manual | a snapshot for yesterday exists; `ads.json` is fresh while ads run | Cloudflare secrets (the ads check runs without) |
| `reconcile.yml` | daily 08:43 UTC and manual | every paid Stripe Checkout Session of the last 3 days matches D1, and back | Cloudflare secrets, `STRIPE_SECRET_KEY` |
| `eval.yml` | Mondays, manual, and PRs touching grading | eval thresholds and no regression > 5 points | `ANTHROPIC_API_KEY` (offline tests run without) |
| `audit.yml` | Wednesdays and manual | no high or critical npm advisories in either package | nothing |

Every workflow stops with a notice, not an error, when its secrets are missing.

## Repository secrets and variables (names only)

Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `TURNSTILE_SECRET`, `HASH_SALT`.

Variables: `MPC_DEPLOY`, `MPC_SITE_URL`, `MPC_MAILING_ADDRESS`, `MPC_FROM_EMAIL`, `MPC_OWNER_EMAIL`,
`MPC_GRADER_MODEL`, `MPC_TURNSTILE_SITE_KEY`, `MPC_CF_BEACON_TOKEN`, `MPC_GADS_SEND_TO`, `MPC_EVAL_LIMIT`.

Setup steps for the owner, in Korean: `business/online/owner-setup.md`.
