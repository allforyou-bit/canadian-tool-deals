# Routine: books

**Cadence:** every second Monday (for the EI report) and on the 1st of each month (memo §5.2).
**Runs as:** a fresh, stateless Claude Code session with this repository checked out. All dates are
UTC. Start with `git pull`.

This is bookkeeping support, not tax or legal advice. Every figure is an ESTIMATE from aggregate
data; the owner declares and files.

## Inputs (read only these)

| Input | Use |
|---|---|
| `ops/metrics/<YYYY-MM-DD>.json` | sales (`purchases.paid`, `grossCents`), refunds, API cost per day |
| `ops/metrics/ads.json` | ad spend per day |
| `ops/books/payouts.json` (owner-maintained: `[{"date": "YYYY-MM-DD", "amountCad": 123.45}]`, from the Stripe Dashboard when the owner confirms a bank deposit) | reconciliation to Stripe payouts |
| `ops/books/expenses.json` (optional, owner-maintained: `[{"date", "amountCad", "category", "note"}]`, e.g. Claude Pro, Workers Paid, domain, mailbox) | expenses that are not in the metrics |
| `business/online/decision-memo.md` §4.1 "Tax and GST/HST" | the thresholds below |

Never query D1, Stripe or any live service, and never read user text.

## Constants

| Name | Value | Source |
|---|---|---|
| Stripe fee | 2.9% + C$0.30 per paid purchase | memo §3.2 (secondary) — ESTIMATE until the owner checks Stripe's statements |
| FX | 1 USD = 1.37 CAD, for API cost only | memo header [prior knowledge, unverified] |
| GST/HST small-supplier threshold | C$30,000 of taxable supplies over four consecutive calendar quarters | memo §4.1 (ETA s.148) |

## Outputs

Commit to `master` (`chore(books): <period>`); if the push is refused, open a PR.

1. **Monthly, on the 1st:** `ops/books/<YYYY-MM>.md` for the month that just ended, with:
   - Income: gross sales, refunds, net sales (C$).
   - Expenses: Stripe fees (estimated), Anthropic API (C$), ad spend, and every row of
     `ops/books/expenses.json` for the month, grouped by `category`.
   - Net business income for the month (ESTIMATE).
   - Year-to-date totals for the owner's T2125 (statement of business activities) — a summary for the
     owner to transfer, not a filed form. Do not assign form line numbers.
   - **Payout check:** net sales minus estimated fees for the month versus the sum of
     `ops/books/payouts.json` rows dated in the month and up to 14 days after it (payout timing). Show
     the difference. If it is more than C$5 or more than 5% of net sales, open or update the issue
     **"Books: payouts do not reconcile <YYYY-MM>"**.
   - **GST/HST tracker:** taxable supplies (net sales) per calendar quarter and the sum of the last
     four quarters, against C$30,000. At 80% of the threshold, open or update the issue
     **"Books: GST/HST threshold at 80%"** (the owner must register within 30 days after crossing, memo §4.1).
2. **Every second Monday:** `ops/books/ei/<YYYY-MM-DD>.md` (date of the Monday) with the net of each of
   the two previous Monday–Sunday weeks: gross − refunds − estimated fees − API − ads − expenses dated in
   the week. State plainly: "ESTIMATE for the owner's EI report. Check the week boundaries Service
   Canada uses [unverified: Monday–Sunday is assumed]." Also write a Korean version of the two numbers
   and that sentence below it (해요체).

## Must not

- File, submit or send anything; send emails; contact CRA, Service Canada, Stripe or banks.
- Change prices, refund, or spend money.
- Put customer names, emails, card details or Stripe ids in any file.

## Idempotency

The same period always produces the same file (overwrite it); issues are matched by exact title.

ASSERT: on the 1st of the month ops/books/<previous YYYY-MM>.md exists with a payout-check line, and on a second Monday ops/books/ei/<that Monday>.md exists.
