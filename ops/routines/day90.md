# Routine: Day-90 review (Dec 26) and final review (Jan 31)

**Cadence:** once on or after Sat 2026-12-26 (Day 90) and once on or after Sun 2027-01-31 (final
review) (memo §5.2, §6 K11). **Runs as:** a fresh, stateless Claude Code session with this
repository checked out. All dates are UTC. Start with `git pull`.

**Which review:** if today is on or after 2027-01-31, this is the final review; otherwise, if today
is on or after 2026-12-26, it is the Day-90 review. Before 2026-12-26, write nothing and end with the
run summary "too early".

## Inputs (read only these)

- `ops/metrics/<YYYY-MM-DD>.json` (all days), `ops/metrics/ads.json`
- `ops/config/ad-cap.json`, `ops/books/*.md` (if present), `ops/reports/kpi/*.md`, `ops/reports/nov30.md`
- `business/online/decision-memo.md` §0, §2.2, §6
- Definitions and constants: `ops/routines/kpi.md` (use them exactly)

Never query live services or read user text.

## What to evaluate

**K11** on the review date (use yesterday as the last day of the window): trailing-30-day `net`
(as defined in `kpi.md`).

| Trailing-30-day net | Memo rule |
|---|---|
| below C$0 | **wind down**: checkout, ads and Routines off, Claude Pro cancelled. The Worker and grading keep running until the last active pass expires, or pro-rata refunds are given |
| C$0 to C$1,000 | **maintenance**: no ads |
| C$1,000 or more | **continue** |

Also report: K10 (cumulative net loss against C$1,500), all-time funnel and sales, refunds and
disputes (K7), total ad spend against the cap, the latest weekly verdicts, and how the result compares
with the memo's January scenarios (§2.2). For a wind-down, list the owner's steps in order with the
tool for each (for example `flags.yml` → `checkout_enabled` = false; end the campaign in Google Ads;
disable the Routines; cancel Claude Pro) and the date the last active pass ends if the daily files
allow an estimate (they do not list passes; say so if you cannot tell).

## Output

`ops/reports/day90-2026-12-26.md` (Day-90) or `ops/reports/final-2027-01-31.md` (final): English, then
Korean (해요체). Include the line `K11=<WIND-DOWN|MAINTENANCE|CONTINUE> trailing-30-day net C$<n>`.
Commit to `master` (`chore(report): <Day-90|final> review`), or open a PR if the push is refused. Open
or update the issue **"Day-90 review"** or **"Final review"** linking to the file.

## Must not

- Carry out the wind-down yourself: no flag changes, no campaign changes, no cancellations, no
  refunds, no emails. The owner does each step.
- Merge PRs, spend money, or present an ESTIMATE as a fact.

## Idempotency

A second run for the same review overwrites the same file and edits the same issue.

ASSERT: the review file for this date exists and contains one "K11=" line (or the run summary says "too early").
