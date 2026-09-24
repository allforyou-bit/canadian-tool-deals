# Routine: Nov 30 go/pivot memo

**Cadence:** once, on or after Mon 2026-11-30 (memo §5.2, §6 W10). **Runs as:** a fresh, stateless
Claude Code session with this repository checked out. All dates are UTC. Start with `git pull`.

## Purpose

Write the go/pivot memo for the owner: evaluate K6 and the Nov 30 follow-ups, and state what the
memo's rules say to do next. The owner decides; you only report.

## Inputs (read only these)

- `ops/metrics/<YYYY-MM-DD>.json` for 2026-09-28 to 2026-11-30, `ops/metrics/ads.json`
- `ops/config/ad-cap.json`, `ops/config/anthropic-limit.json`
- `ops/reports/kpi/*.md` (the weekly verdicts so far)
- `business/online/decision-memo.md` §1.1, §2.2, §6
- Definitions and constants: `ops/routines/kpi.md` (use them exactly; do not invent new ones)

Never query live services or read user text.

## What to evaluate

1. **K6:** November net (2026-11-01 to 2026-11-30, `net` as defined in `kpi.md`) < C$500 **and** the
   net of Nov 24–30 ≤ the net of Nov 17–23 → FIRED: all spend stops, maintenance mode, **no second
   product**. Net ≥ C$500 → continue, and a second product may be considered for month 4 (memo §1.1:
   a Shopify App Store app or an Apify pay-per-event Actor portfolio).
2. **K5 follow-up:** if all samples up to 2026-11-15 were fewer than 30, write the niche review the memo
   asks for: which funnel step lost people (landing → sample_start → sample_done → signup →
   checkout_start → purchase), using only the aggregate counts.
3. **K10 and K11 today:** cumulative net loss against C$1,500, and the trailing-30-day net band.
4. **Ads:** total spend against `capCad`; whether any S rule allows ads to resume within the cap.
5. **Compare with the memo's scenarios** (§2.2: conservative, base, upside for November) and say which
   one November looks like, with the numbers.

## Output

`ops/reports/nov30.md`: English, then the same in Korean (해요체). Start with a one-paragraph
decision summary, then the numbers, the rules with verdicts, and the options with what each commits
the owner to. Include the line `DECISION INPUT: K6=<PASS|FIRED> November net C$<n>`. Commit to
`master` (`chore(report): Nov 30 go/pivot memo`), or open a PR if the push is refused. Then open or
update the issue **"Nov 30 go/pivot memo"** linking to the file so the owner is notified.

## Must not

- Start a second product, change ads, prices or flags, spend money, send emails, or merge PRs.
- Present an ESTIMATE as a fact or promise any result.

## Idempotency

A second run overwrites `ops/reports/nov30.md` with the same content and edits the same issue.

ASSERT: ops/reports/nov30.md exists and contains one "DECISION INPUT: K6=" line.
