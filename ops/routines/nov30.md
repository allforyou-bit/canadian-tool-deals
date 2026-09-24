# Routine: Nov 30 go/pivot memo

**Cadence:** once, on or after **Tue 2026-12-01 12:00 UTC** (memo §5.2, §6 W10). November 30's numbers
exist only after the Worker's 05:00 UTC snapshot on Dec 1 and the `metrics.yml` export after it (07:17 UTC,
which GitHub can start hours late). **Runs as:** a fresh, stateless Claude Code session with this
repository checked out. All dates are UTC. Start with `git pull`.

**Before anything else:**
1. If now is before 2026-12-01 12:00 UTC, write nothing and end with the run summary "too early".
2. If `ops/metrics/2026-11-30.json` does not exist, or any day from 2026-11-01 to 2026-11-30 has no file,
   write nothing, open or update the issue **"Nov 30 memo: data incomplete"** listing the missing dates
   (dates only), and stop. The owner (or the next run) re-runs this Routine once the files exist; K6 is
   never decided on missing days.

## Purpose

Write the go/pivot memo for the owner: evaluate K6 and the Nov 30 follow-ups under the zero-capital plan
(memo §7.2: no ads, organic only), and state what the rules say to do next. The owner decides; you only
report.

## Inputs (read only these)

- `ops/metrics/<YYYY-MM-DD>.json` for 2026-09-28 to 2026-11-30
- `ops/config/anthropic-limit.json`, `ops/books/expenses.json` (if present), `ops/owner/hours.json` (if present)
- `ops/reports/kpi/*.md` (the weekly verdicts so far)
- `business/online/decision-memo.md` §1.1, §2.2, §6 and §7.2
- Definitions and constants: `ops/routines/kpi.md` (use them exactly; do not invent new ones)

Never query live services or read user text.

## What to evaluate

1. **K6:** November net (2026-11-01 to 2026-11-30, `net` as defined in `kpi.md`) < C$500 **and** the
   net of Nov 24–30 ≤ the net of Nov 17–23 → FIRED: maintenance mode, **no second product**, credits bought
   only to serve paying customers. Net ≥ C$500 → continue, and a second product may be considered for
   month 4 (memo §1.1: a Shopify App Store app or an Apify pay-per-event Actor portfolio).
2. **K5 follow-up:** if K5 fired (fewer than 10 free AI samples up to 2026-11-15), write the channel review
   the rule asks for: which funnel step lost people (landing → practice_start → practice_done, and
   landing → sample_start → sample_done → signup → checkout_start → purchase), using only aggregate
   counts, and which drafts in `business/online/launch-kit-ko.md` were used according to the weekly
   digests. Say that the two funnels cannot be linked per person.
3. **K10 and K11 today:** net cash loss (`cashOut − cashIn`) against C$100, and the trailing-30-day net
   against −C$20 together with the owner's support hours against 1 h/week.
4. **Prepaid credits:** the prepaid amount, spend since its date and the runway, as in `kpi.md`.
5. **Compare with the memo's organic-only expectations** (§7.2 table: conservative, base, upside) and say
   which one November looks like, with the numbers. The §2.2 table assumed ads and no longer applies.

## Output

`ops/reports/nov30.md`: English, then the same in Korean (해요체). Start with a one-paragraph
decision summary, then the numbers, the rules with verdicts, and the options with what each commits
the owner to. Include the line `DECISION INPUT: K6=<PASS|FIRED> November net C$<n>`. Commit to
`master` (`chore(report): Nov 30 go/pivot memo`), or open a PR if the push is refused. Then open or
update the issue **"Nov 30 go/pivot memo"** linking to the file so the owner is notified.

## Must not

- Start a second product, change prices or flags, buy credits, spend money, send emails, or merge PRs.
- Suggest ads or automated posting (memo §1.4, §7.2).
- Present an ESTIMATE as a fact or promise any result.

## Idempotency

A second run overwrites `ops/reports/nov30.md` with the same content and edits the same issue. When the
memo is written, comment "data complete, memo written" on the issue "Nov 30 memo: data incomplete" if it
is open (do not close it; the owner does).

ASSERT: ops/reports/nov30.md exists and contains one "DECISION INPUT: K6=" line, or the run summary says "too early", or the issue "Nov 30 memo: data incomplete" was opened or updated in this run.
