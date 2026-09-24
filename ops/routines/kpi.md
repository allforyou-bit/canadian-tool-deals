# Routine: weekly KPI and rules

**Cadence:** Mondays (memo §5.2). **Runs as:** a fresh, stateless Claude Code session with this
repository checked out. You remember nothing from earlier runs; everything you need is here and in
the repo. All dates are UTC. Start with `git pull` on `master`.

## Purpose

Write the weekly KPI and cost digest in English and Korean, evaluate every numeric rule of the
zero-capital plan (memo §6 as revised by memo §7.2: K1, K2, K5–K11 and S3) with the exact definitions
below, and propose — never make — changes. There are no ads (memo §7.2): rules K3, K4 and S0–S2 were
removed with them and are not evaluated.

## Inputs (read only these)

| Input | Use |
|---|---|
| `ops/metrics/<YYYY-MM-DD>.json` (all days) | funnel, free practice, grades, API cost, purchases, refunds, disputes (format: `ops/metrics/README.md`) |
| `ops/config/anthropic-limit.json` | the prepaid Anthropic credits (`prepaidUsd`, `prepaidSince`) and the Console monthly limits |
| `ops/books/expenses.json` (optional, owner-maintained: `[{"date", "amountCad", "category", "note"}]`, categories in `ops/routines/books.md`) | K10 cash out; paid plans in `net` |
| `ops/owner/hours.json` (optional: `[{"week": "2026-W44", "hours": 2.5, "supportHours": 0.5}]` plus an optional `{"setupHours": 9.5}` entry) | K2 (`hours`, `setupHours`) and K11 (`supportHours`) |
| GitHub issues titled `Platform: …` (open and closed) | K9 |
| The digest issues `KPI digest <week>` and their comments by the repository owner | the owner's yes/no answers, last week's hours, and which drafts of `business/online/launch-kit-ko.md` were posted (for example "10/27 네이버 카페에 글 A 올림") |
| `business/online/decision-memo.md` §6 and §7.2 | the rules, for wording |

Never query D1, Stripe, Cloudflare or Anthropic; never read user text.

**Owner hours from the digest issue.** Last week's digest asks the owner how many hours they spent on
the product last week and how much of that was support. If a comment by the **repository owner** on that
issue answers it (for example "5시간, 지원 0.5시간" or "5 h, support 0.5 h"), record it in
`ops/owner/hours.json` as `{"week": "<that ISO week>", "hours": <n>, "supportHours": <n>}` before you
evaluate the rules: replace the row for that week if one exists, keep rows sorted by week, and commit
(`chore(kpi): owner hours <week>`). A comment with the one-time setup hours (for example "설정 9.5시간")
is recorded the same way as the `{"setupHours": <n>}` entry. Ignore comments by anyone else. If the answer is unclear, record
nothing and ask again in this week's digest.

## Constants (keep them visible in the report)

| Name | Value | Source |
|---|---|---|
| FX | 1 USD = 1.37 CAD | memo header [prior knowledge, unverified] |
| Stripe fee per paid purchase | 2.9% + C$0.30 | memo §3.2 (secondary source) — ESTIMATE |
| Fixed costs | none in the plan (Workers Free, `workers.dev`, no domain, no ads); any paid plan the owner buys is a row in `ops/books/expenses.json` | memo §7.2 |
| Prepaid top-up per pass sold | about US$7 per 30-day pass on Opus 5, about US$3 on Sonnet 5 | research ESTIMATE (memo §3.1 token counts) |

Eval runs, staging checks and the level-B prompt-cache check spend the same prepaid credits as
production but are **not** in the daily files' `costUsd`; say so under the constants.

## Definitions

For a window of days (inclusive, ending **yesterday** unless stated):

- `sales` = Σ `purchases.paid`; `gross` = Σ `purchases.grossCents` ÷ 100 (C$); `refundsCad` = Σ `refunds.cents` ÷ 100
  (`refunds` includes the owner's partial refunds, such as refunds of unused days, counted on the day Stripe reports them)
- `fees` = `gross × 0.029 + 0.30 × sales`
- `apiCad` = Σ `costUsd` × 1.37 (production grading and speech-to-text)
- `plans` = Σ `amountCad` of `ops/books/expenses.json` rows dated in the window whose `category` is **not**
  `anthropic-credits` (credit purchases are prepaid API cost, already counted by `apiCad` when used)
- `net` = gross − refundsCad − fees − apiCad − plans
- `samples` = Σ `events.sample_start` (free AI samples started); `samplesDone` = Σ `events.sample_done`
- `practice` = Σ `events.practice_start`; `practiceDone` = Σ `events.practice_done` (the free practice mode
  without AI; nothing is uploaded — memo §7.2)
- `cashOut` = Σ `amountCad` of **all** rows of `ops/books/expenses.json` (Anthropic credits and any paid plan)
- `cashIn` = gross − refundsCad − fees over **all** days
- A missing event name in a daily file means 0.

Funnel ratios (for example `practiceDone ÷ practice` or `samples ÷ landing`) are ratios of aggregate
counts, not per-person conversions: events are not linked to people. Say so when you show them.

## Rules (verdicts: PASS, FIRED, PENDING, N/A, NEEDS-OWNER; K9 also FIRED-STOP)

| Rule | Evaluate | FIRED when | Action to propose |
|---|---|---|---|
| K1 schedule | from 2026-11-02 (PENDING before) | no daily file dated ≤ 2026-11-01 has `events.checkout_start ≥ 1` or `purchases.paid ≥ 1` | stop and return to the home-services plan |
| K2 owner hours | every week | `ops/owner/hours.json` shows `hours` > 3 in any two weeks, or `setupHours` > 12 (NEEDS-OWNER if the file is missing) | cut to the core: propose which optional owner work to drop (community posts, outreach, new features); the automatic parts and support stay |
| K5 samples by Nov 15 | first run on or after 2026-11-15 (PENDING before; report progress) | all-time `samples` up to and including 2026-11-15 < **10** | review channels: list which drafts in `business/online/launch-kit-ko.md` the owner has not posted yet (from the owner's comments on the digest issues) and propose at most two other free channels from it. No ads, no automated posting |
| K6 November | first run on or after 2026-12-01 (PENDING before) | November `net` < C$500 **and** `net` of Nov 24–30 ≤ `net` of Nov 17–23 | maintenance mode: no new features and **no second product**; credits are bought only to serve paying customers |
| K7 refunds and disputes | every week, all-time | (`sales ≥ 20` and Σ `refunds.count` ÷ sales > 10%) or (`sales > 0` and Σ `disputes` ÷ sales > 0.75%) | owner pauses checkout (`flags.yml`: `checkout_enabled` = false); grading review |
| K8 API cost | last 7 days; N/A when gross − refundsCad ≤ 0 | apiCad > 20% × (gross − refundsCad) | tighten per-user caps (proposal in the report only) |
| K9 platform | every week | a `Platform:` issue whose title contains suspend, suspension, reserve, reject, rejected, disabled or closed exists (open or closed). Two or more such issues → FIRED-STOP | one: the owner reviews the notice (the product may be unable to sell or grade until it is resolved); two: stop |
| K10 stop-loss | all-time | `cashOut − cashIn` > **C$100** | stop |
| K11 trailing net and support time | every week (decisive on Dec 26 and Jan 31, see `day90.md`) | trailing-30-day `net` < **−C$20**, **or** the average `supportHours` over the last 4 weeks that have one is > **1** | wind down (FIRED) or keep the site running as a slow organic asset (PASS) |
| S3 reviewer | last 30 days | `sales ≥ 30` (all buyers are organic now) | owner may hire a qualified reviewer (certified ESL or test-prep instructor) |

Notes on the rules:

- **K9.** Google Ads is gone, so a platform is any service the product depends on: Stripe, Anthropic,
  Google (the sign-in client or its Cloud project), Cloudflare, Resend or GitHub. The memo's "organic only"
  is already the plan.
- **K10.** Memo §7.2 names the cash side ("Anthropic credits plus any paid plan, above C$100"). Revenue
  offsets it as in the original stop-loss, so credits bought from sales do not stop a product that pays
  for itself; with no sales the two readings are the same. Report `cashOut`, `cashIn` and the difference.
  If `cashOut` alone is above C$100 while the difference is not, add the note "cash out above C$100,
  covered by sales". If `ops/books/expenses.json` is missing, K10 is NEEDS-OWNER: the credits bought
  before launch belong there (`ops/routines/books.md`), so a missing file means the ledger was not kept.
- **K11.** Report both parts. If `net` is not below −C$20 and no week has `supportHours`, the verdict is
  NEEDS-OWNER (ask for support hours in the digest). Memo §7.2: with a fixed cost of about C$0, a site
  that loses little keeps running; what it still costs is the owner's support time.
- **K5.** Report `samples` next to `practice`, so the owner can see whether the free practice mode is used
  even when AI samples are few.

## Prepaid Anthropic credits (memo §7.2, Z6)

The API is prepaid and auto-reload stays off, so the credit balance is the hard limit. Read
`prepaidUsd` (the balance in US$) and `prepaidSince` (the UTC day of that balance) in
`ops/config/anthropic-limit.json`; `deploy.yml` passes them to the production Worker as
`ANTHROPIC_PREPAID_USD` and `ANTHROPIC_PREPAID_SINCE`. If `prepaidSince` is `null` or either field is
missing, write "prepaid ledger not configured: after buying credits, the owner records the balance and
the day (business/online/owner-setup.md)" in the digest and skip this section.

- `spentUsd` = Σ `costUsd` of the daily files from `prepaidSince` (inclusive) to yesterday; `usedPct` = spentUsd ÷ `prepaidUsd`.
- `runwayDays` = (0.97 × `prepaidUsd` − spentUsd) ÷ the average daily `costUsd` of the last 14 days ("no spend" if that average is 0).
- The Worker acts on the same ledger by itself (`PREPAID` in `products/clb/shared/config.ts`): free samples
  off at 70%, owner alerts at 50% and 80%, grading paused at 97% so no call fails half-way. The digest only
  reports. Because eval and staging spend is not in `costUsd`, say that `spentUsd` is a lower bound and the
  Anthropic Console balance is the real number.
- When `usedPct ≥ 0.5` or `runwayDays < 14`, add the proposal "Buy more Anthropic credits? The steps are in
  the issue 'Anthropic credits: top up' (the daily Routine opens it from the Worker's alerts)." When
  `sales ≥ 1` in the last 30 days, add the ESTIMATE from the constants (US$ per pass sold).
- The Console monthly limit (`monthlyLimitUsd`, and `evalMonthlyLimitUsd` for the eval workspace if it
  exists): report the configured value and the month-to-date `costUsd`. Under the prepaid plan the owner
  sets the workspace limit to the credit amount and changes it together with a top-up (the daily Routine's
  top-up PR), so this Routine opens **no** limit PR. If month-to-date `costUsd` ≥ 0.95 × `monthlyLimitUsd`,
  add the question "Month-to-date grading spend is US$<n>, at least 95% of the US$<limit> Console limit.
  Raise the limit in the Console together with a top-up?" If `confirmedByOwner` is `false`, say the
  configured values are not confirmed.

## Outputs

1. `ops/reports/kpi/<ISO week of today>.md` (for example `2026-W44.md`): the digest. English first,
   then the same content in Korean (해요체). Sections: headline numbers for last week and all-time
   (landing, free practice started and finished, free AI samples started and finished, sign-ups,
   checkout starts, sales, gross, refunds, net, API cost), the prepaid credits, the rules table with each
   verdict and the numbers behind it, proposals (each with a one-line yes/no question), the question
   "How many hours did you spend on the product last week, and how many of them on support?", and the
   constants used. It must contain exactly one line of the form
   `RULES: K1=<v> K2=<v> K5=<v> K6=<v> K7=<v> K8=<v> K9=<v> K10=<v> K11=<v> S3=<v>`.
   Commit it to `master` (`chore(kpi): weekly digest <week>`); if the push is refused, open a PR.
2. A GitHub issue titled **"KPI digest <week>"** with the same content, so the owner is notified and
   can answer yes or no per proposal, and give last week's hours, in a comment. If it exists, edit its
   body instead of opening another.
3. No PRs. Proposals are questions in the digest; the prepaid top-up PR belongs to the daily Routine.

## Must not

- Merge PRs, buy credits, spend money, change prices, refund, or toggle flags.
- Send emails or post anywhere except this repo's issues (and a PR only when a push is refused).
- Read D1, Stripe, Cloudflare or the Anthropic Console directly, or any user text.
- Put anything but aggregate numbers and the owner's hours in the report, the issue or commits.
- Suggest ads or automated posting (memo §1.4, §7.2).

## Idempotency

A second run in the same week overwrites the same report file with the same content, edits the same
issue and writes the same `hours.json` row. Nothing is duplicated.

ASSERT: ops/reports/kpi/<ISO week>.md exists for this week and contains exactly one "RULES:" line with a verdict for all 10 rules (K1, K2, K5, K6, K7, K8, K9, K10, K11, S3).
