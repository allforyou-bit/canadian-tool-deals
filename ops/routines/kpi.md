# Routine: weekly KPI and rules

**Cadence:** Mondays (memo §5.2). **Runs as:** a fresh, stateless Claude Code session with this
repository checked out. You remember nothing from earlier runs; everything you need is here and in
the repo. All dates are UTC. Start with `git pull` on `master`.

## Purpose

Write the weekly KPI and cost digest in English and Korean, evaluate every numeric rule of memo §6
(K1–K11, S0–S3) with the exact definitions below, and propose — never make — changes as PRs.

## Inputs (read only these)

| Input | Use |
|---|---|
| `ops/metrics/<YYYY-MM-DD>.json` (all days) | funnel, grades, API cost, purchases, refunds, disputes (format: `ops/metrics/README.md`) |
| `ops/metrics/ads.json` | ad spend, clicks, conversions per day |
| `ops/config/ad-cap.json`, `ops/config/anthropic-limit.json` | approved ad cap and dates; the Anthropic Console limits the owner set (production workspace and the separate eval workspace) |
| `ops/owner/hours.json` (optional, owner-maintained: `[{"week": "2026-W44", "hours": 2.5}]` plus an optional `{"setupHours": 9.5}` entry) | K2 |
| GitHub issues titled `Platform: …` (open and closed) | K9 |
| Last week's digest issue `KPI digest <week>` and its comments | the owner's yes/no answers |
| `business/online/decision-memo.md` §6 | the rules, for wording |

Never query D1, Stripe, Cloudflare or Google Ads; never read user text.

## Constants (from the memo; keep them visible in the report)

| Name | Value | Source |
|---|---|---|
| FX | 1 USD = 1.37 CAD | memo header [prior knowledge, unverified] |
| Stripe fee per paid purchase | 2.9% + C$0.30 | memo §3.2 (secondary source) — ESTIMATE |
| Fixed costs F | C$100 per month, counted as C$100 × days ÷ 30 from 2026-10-01 | memo §2.2 plan figure — ESTIMATE |
| Plan first-sale net | C$27.7 | memo §3.2 — ESTIMATE |

Eval and development API spend runs on a separate Anthropic workspace and key (owner-setup 2-1). It is not
in the daily files' `costUsd`; it is part of the fixed-cost plan figure F (memo §3.3 allowance US$30 a
month). Say so under the constants.

## Definitions

For a window of days (inclusive, ending **yesterday** unless stated), from the daily files and `ads.json`:

- `sales` = Σ `purchases.paid`; `gross` = Σ `purchases.grossCents` ÷ 100 (C$); `refundsCad` = Σ `refunds.cents` ÷ 100
  (`refunds` includes the owner's partial refunds, such as refunds of unused days, counted on the day Stripe reports them)
- `fees` = Σ over paid purchases of (2.9% × price + 0.30); use `gross × 0.029 + 0.30 × sales`
- `apiCad` = Σ `costUsd` × 1.37; `ads` = Σ `spendCad`; `fixed` = 100 × (days in window on or after 2026-10-01) ÷ 30
- `net` = gross − refundsCad − fees − apiCad − ads − fixed
- `samples` = Σ `events.sample_start`
- `firstSaleNet` = (gross − refundsCad − fees − apiCad) ÷ sales over **all** days, if all-time `sales ≥ 5`; otherwise the plan value C$27.7
- `cac14` = ads ÷ min(sales, Σ `conversions`) over the last 14 days; with zero buyers it is unbounded
  (tool: `node scripts/run.mjs scripts/ads.ts cac --from D --to D` in `products/clb`)

## Rules (verdicts: PASS, FIRED, PENDING, N/A, INCONCLUSIVE, NEEDS-OWNER)

| Rule | Evaluate | FIRED when | Action to propose |
|---|---|---|---|
| K1 schedule | from 2026-11-02 (PENDING before) | no daily file dated ≤ 2026-11-01 has `events.checkout_start ≥ 1` or `purchases.paid ≥ 1` | stop and return to the home-services plan |
| K2 owner hours | every week | `ops/owner/hours.json` shows > 3 h in any two weeks, or `setupHours` > 12 (NEEDS-OWNER if the file is missing) | cut to the core: no ads, organic only |
| K3 upper funnel | once all-time `ads ≥ 280` (PENDING before) | `paidSamples` < 10, summed over every day from the first day with `spendCad > 0` to yesterday. Per day: if the daily file **has a `metrics.paidEvents` object** (even an empty `{}`), that day counts `paidEvents.sample_start`, or **0 when the key is missing**. Only for a day whose file has **no `paidEvents` key at all** (files written before 2026-09-24), count that day's `events.sample_start` as an upper bound. Verdict: `paidSamples` < 10 → FIRED; ≥ 10 → PASS, except that when upper-bound days were used and the exact days alone sum to < 10, the verdict is INCONCLUSIVE. Report the exact and upper-bound parts separately | ads off; one landing fix and one retest of at most C$140 within the cap are allowed |
| K4 CAC | when `ads > 0` in the last 14 days (N/A otherwise) | `cac14 > firstSaleNet` (with zero buyers: 14-day `ads > firstSaleNet`) | ads off |
| K5 samples by Nov 15 | first run on or after 2026-11-15 (PENDING before; report progress) | all-time `samples` up to 2026-11-15 < 100; note "< 30 → niche review at Nov 30" separately | switch the keyword set within the cap (PR to `ops/ads/google.csv`) |
| K6 November | first run on or after 2026-12-01 (PENDING before) | November `net` < C$500 **and** `net` of Nov 24–30 ≤ `net` of Nov 17–23 | all spend stops; maintenance mode; no second product |
| K7 refunds and disputes | every week, all-time | (`sales ≥ 20` and Σ `refunds.count` ÷ sales > 10%) or (`sales > 0` and Σ `disputes` ÷ sales > 0.75%) | owner pauses checkout (`flags.yml`: `checkout_enabled` = false) and ads; grading review |
| K8 API cost | last 7 days; N/A when gross − refundsCad ≤ 0 | apiCad > 20% × (gross − refundsCad) | tighten per-user caps (proposal in the report only) |
| K9 platform | every week | a `Platform:` issue whose title contains suspend, suspension, reserve, reject, rejected, disabled or closed exists (open or closed). Two or more such issues → "FIRED-STOP" | one: organic only; two: stop |
| K10 stop-loss | all-time from 2026-09-28 | (fixed + ads + apiCad) − (gross − refundsCad − fees) > C$1,500 | stop |
| K11 trailing net | every week (decisive on Dec 26 and Jan 31, see `day90.md`) | trailing-30-day `net` < C$0; report the band: < 0 wind down, 0–1,000 maintenance (no ads), ≥ 1,000 continue | as the band says |
| S0 | when K4 is not FIRED and ads ran in the last 14 days | 15 ≤ `cac14` ≤ firstSaleNet → PASS means "hold at C$20/day" | hold |
| S1 | same | 9 ≤ `cac14` < 15 | up to C$30/day (owner-merged PR to `ops/config/ad-cap.json`) |
| S2 | same | `cac14` ≤ firstSaleNet ÷ 3 and all-time `sales ≥ 20` | owner may raise to C$60/day (PR to `ad-cap.json`); re-check weekly |
| S3 | last 30 days | sales − Σ `conversions` ≥ 30 (organic buyers) | owner may hire a qualified reviewer (certified ESL or test-prep instructor) |

For S rules, use FIRED to mean "the condition holds". Total ad spend to 2027-01-31 may not pass
`capCad` in `ops/config/ad-cap.json` unless the owner merges a PR that raises it (memo scale rules).

**Anthropic limit.** L = max(US$150, 0.3 × trailing-30-day gross in USD), where gross in USD is
gross C$ × 0.7 (the Worker's conservative factor, `SPEND.cadToUsdConservative`). `mtdUsd` = Σ `costUsd`
over the days of the current UTC calendar month up to yesterday (production grading only; the eval
workspace is separate; the Console limit is assumed to run per calendar month [unverified]). Propose raising `monthlyLimitUsd` in `ops/config/anthropic-limit.json` when
**either** L > `monthlyLimitUsd` **or** `mtdUsd` ≥ 0.95 × `monthlyLimitUsd` (the Worker's spend tiers use
the smaller of L and the configured limit, so reaching 95% of the configured limit means free samples are
already off and the Console limit is close — memo §3.4, B10). Report L, `mtdUsd` and the configured limit
in the digest. When L > `monthlyLimitUsd`, open the raise PR with the new value L rounded up to whole
dollars. When only the 95% condition holds (L is not above the configured limit), the memo gives no
number: do not open a PR; put the proposal in the digest with the question "Month-to-date grading spend is
US$<mtdUsd>, at least 95% of the US$<limit> limit. Raise the Console limit, and to what amount?" The raise
PR body (and the digest proposal) lists the owner's steps in this order: (1) raise the limit of the
**production** workspace in the Anthropic Console first, (2) then merge the PR (or change
`monthlyLimitUsd` to that number on `master`); a change to this file redeploys the Worker, which passes
`monthlyLimitUsd` to it as `ANTHROPIC_MONTHLY_LIMIT_USD` (owner-setup 2-1). If `confirmedByOwner` is
`false`, say in the digest that the configured limit is not confirmed.

## Outputs

1. `ops/reports/kpi/<ISO week of today>.md` (for example `2026-W44.md`): the digest. English first,
   then the same content in Korean (해요체). Sections: headline numbers for last week and all-time
   (funnel, sales, gross, refunds, net, API cost, ad spend, CAC), the rules table with each verdict
   and the numbers behind it, proposals (each with a one-line yes/no question), and the constants used.
   It must contain exactly one line of the form
   `RULES: K1=<v> K2=<v> K3=<v> K4=<v> K5=<v> K6=<v> K7=<v> K8=<v> K9=<v> K10=<v> K11=<v> S0=<v> S1=<v> S2=<v> S3=<v>`.
   Commit it to `master` (`chore(kpi): weekly digest <week>`); if the push is refused, open a PR.
2. A GitHub issue titled **"KPI digest <week>"** with the same content, so the owner is notified and
   can answer yes or no per proposal in a comment. If it exists, edit its body instead of opening another.
3. One PR per proposal that changes a file (branch `routine/kpi-<week>-<topic>`): keyword changes to
   `ops/ads/google.csv` (must pass the ads lint), a raise in `ops/config/anthropic-limit.json`, or an
   ad-cap change in `ops/config/ad-cap.json`. If a PR from that branch is open, update it.
   Every PR body says: "Owner decision needed. Merging this is the written confirmation the memo asks for."

## Must not

- Merge PRs, change ad budgets or campaigns, spend money, change prices, refund, or toggle flags.
- Send emails or post anywhere except this repo's issues and PRs.
- Read D1, Stripe, Cloudflare or Google Ads directly, or any user text.
- Put anything but aggregate numbers in the report, the issue or PRs.

## Idempotency

A second run in the same week overwrites the same report file with the same content, edits the same
issue, and updates the same PR branches. Nothing is duplicated.

ASSERT: ops/reports/kpi/<ISO week>.md exists for this week and contains exactly one "RULES:" line with a verdict for all 15 rules.
