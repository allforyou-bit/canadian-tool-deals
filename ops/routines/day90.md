# Routine: Day-90 review (Dec 26) and final review (Jan 31)

**Cadence:** once on or after Sat 2026-12-26 (Day 90) and once on or after Sun 2027-01-31 (final
review) (memo §5.2, §6 K11). **Runs as:** a fresh, stateless Claude Code session with this
repository checked out. All dates are UTC. Start with `git pull`.

**Which review:** if today is on or after 2027-01-31, this is the final review; otherwise, if today
is on or after 2026-12-26, it is the Day-90 review. Before 2026-12-26, write nothing and end with the
run summary "too early".

## Inputs (read only these)

- `ops/metrics/<YYYY-MM-DD>.json` (all days)
- `ops/config/anthropic-limit.json`, `ops/books/*.md` and `ops/books/expenses.json` (if present),
  `ops/owner/hours.json` (if present), `ops/reports/kpi/*.md`, `ops/reports/nov30.md`
- `business/online/decision-memo.md` §0, §6 and §7.2
- Definitions and constants: `ops/routines/kpi.md` (use them exactly)

Never query live services or read user text.

## What to evaluate

**K11** as revised in memo §7.2, on the review date (use yesterday as the last day of the window):

| Condition | Result |
|---|---|
| trailing-30-day `net` (as defined in `kpi.md`) below **−C$20**, **or** the owner's average `supportHours` over the last 4 weeks that have one above **1** | **WIND-DOWN** |
| otherwise | **KEEP**: the site keeps running as a slow organic asset (its fixed cost is about C$0); no ads |
| `net` not below −C$20 and no week has `supportHours` | **NEEDS-OWNER**: ask for the support hours in the review issue and re-run after the answer |

A wind-down means: checkout off, Routines off, and any paid plan bought only for this product
cancelled. The Worker and grading keep running until the last active pass expires, or pro-rata refunds
are given (each one a partial refund in Stripe with metadata `end_pass` = `true`, so the pass ends —
`business/online/owner-setup.md`). Credits are bought only if active passes need them. The free practice
mode and the pages cost nothing to keep online on Workers Free; whether to keep them up after checkout is
off is the owner's choice.

Also report: K10 (net cash loss `cashOut − cashIn` against C$100), all-time funnel (free practice, free AI
samples, sign-ups, checkout starts, sales), refunds and disputes (K7), the prepaid credits and runway (as
in `kpi.md`), the latest weekly verdicts, and how the result compares with the memo's organic-only
expectations (§7.2 table). For a wind-down, list the owner's steps in order with the tool for each (for
example `flags.yml` → `checkout_enabled` = false; disable the Routines; cancel the paid plan) and the date
the last active pass ends if the daily files allow an estimate (they do not list passes; say so if you
cannot tell). Do not suggest turning `grading_enabled` off while passes are active: any grading pause
extends every active pass by its length (memo §7.1 B10).

## Output

`ops/reports/day90-2026-12-26.md` (Day-90) or `ops/reports/final-2027-01-31.md` (final): English, then
Korean (해요체). Include the line
`K11=<WIND-DOWN|KEEP|NEEDS-OWNER> trailing-30-day net C$<n> support h/week <n|not reported>`.
Commit to `master` (`chore(report): <Day-90|final> review`), or open a PR if the push is refused. Open
or update the issue **"Day-90 review"** or **"Final review"** linking to the file.

## Must not

- Carry out the wind-down yourself: no flag changes, no cancellations, no refunds, no credit purchases,
  no emails. The owner does each step.
- Suggest ads or automated posting (memo §1.4, §7.2).
- Merge PRs, spend money, or present an ESTIMATE as a fact.

## Idempotency

A second run for the same review overwrites the same file and edits the same issue.

ASSERT: the review file for this date exists and contains one "K11=" line (or the run summary says "too early").
