# Routine: books

**Cadence:** fire it **every Monday** and **on the 1st of each month** (memo §5.2: monthly and
bi-weekly). Standard schedules cannot express "every second Monday", so each run decides from the date
what to do:

- **EI Monday:** today is a Monday and (today − `anchorMonday`) is a whole multiple of 14 days, where
  `anchorMonday` comes from `ops/config/ei-schedule.json` (owner-maintained; EI report periods are set by
  Service Canada). If `confirmedByOwner` is `false`, still write the EI note but start it with
  "EI report dates not confirmed by the owner (ops/config/ei-schedule.json)."
- **Month start:** today is the 1st.
- Neither (an off-week Monday): write nothing and end with the run summary "nothing due today".

Schedule for whoever creates the Routine: two schedules with this same prompt, Mondays (`0 12 * * 1`)
and the 1st (`0 12 1 * *`), UTC. A single `0 12 1 * 1` means "the 1st **or** a Monday" only in classic
cron semantics [unverified for the Routine scheduler], so prefer two schedules. A run on a day that
matches both does both parts.

**Runs as:** a fresh, stateless Claude Code session with this repository checked out. All dates are
UTC. Start with `git pull`.

This is bookkeeping support, not tax or legal advice. Every figure is an ESTIMATE from aggregate
data; the owner declares and files.

## Inputs (read only these)

| Input | Use |
|---|---|
| `ops/metrics/<YYYY-MM-DD>.json` | sales (`purchases.paid`, `grossCents`), refunds, API cost per day |
| `ops/books/payouts.json` (owner-maintained: `[{"date": "YYYY-MM-DD", "amountCad": 123.45}]`, from the Stripe Dashboard when the owner confirms a bank deposit) | reconciliation to Stripe payouts |
| `ops/books/expenses.json` (optional: `[{"date", "amountCad", "category", "note"}]`; categories below) | money paid for the product that is not in the metrics |
| `ops/config/ei-schedule.json` (`anchorMonday`, `confirmedByOwner`) | which Mondays are EI report Mondays |
| `business/online/decision-memo.md` §4.1 "Tax and GST/HST" and §7.2 | the thresholds below; the zero-capital cost plan |

Never query D1, Stripe or any live service, and never read user text.

**`ops/books/expenses.json` categories.** Every row is money actually paid for this product. The daily
Routine appends credit purchases through its top-up PR (`ops/routines/daily.md` step 2); the owner can
add other rows by hand.

| `category` | What | Counted as |
|---|---|---|
| `anthropic-credits` | a prepaid Anthropic credit purchase (the eval, staging and production spend all come out of these credits) | cash paid in advance for API use; the use itself is the metrics' `costUsd`, so it is **not** deducted a second time |
| any other value, for example `paid-plan`, `registration`, `other` | a paid plan bought for this product (Workers Paid, a domain, a Claude plan used only for the Routines), a business-name registration fee if ServiceOntario says one is needed [unverified], or another cost | an expense in the month and week it is dated |

A Claude subscription the owner already pays for their own use is not a product cost: leave it out.
There are no ads (memo §7.2), so there is no ad spend.

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
   - Expenses: Stripe fees (estimated), Anthropic API used (C$, from `costUsd` × 1.37), and every
     `ops/books/expenses.json` row for the month that is not `anthropic-credits`, grouped by `category`.
   - Net business income for the month (ESTIMATE) = net sales − fees − API used − those expenses.
   - **Cash paid for Anthropic credits** in the month (the `anthropic-credits` rows), on its own line, with
     the sentence: "Prepaid credits are cash paid in advance; the API used above is what was consumed.
     Which one belongs on the tax return is a question for the owner's tax preparer [unverified]."
   - Year-to-date totals for the owner's T2125 (statement of business activities) — a summary for the
     owner to transfer, not a filed form. Do not assign form line numbers.
   - **Payout check:** net sales minus estimated fees for the month versus the sum of
     `ops/books/payouts.json` rows dated in the month and up to 14 days after it (payout timing). Show
     the difference. If it is more than C$5 or more than 5% of net sales, open or update the issue
     **"Books: payouts do not reconcile <YYYY-MM>"**. With no sales in the month, write "no sales, nothing
     to reconcile".
   - **GST/HST tracker:** taxable supplies (net sales) per calendar quarter and the sum of the last
     four quarters, against C$30,000. At 80% of the threshold, open or update the issue
     **"Books: GST/HST threshold at 80%"** (the owner must register within 30 days after crossing, memo §4.1).
2. **On an EI Monday** (see Cadence): `ops/books/ei/<YYYY-MM-DD>.md` (date of the Monday) with the net of each of
   the two previous Monday–Sunday weeks: gross − refunds − estimated fees − API used − expenses dated in
   the week that are not `anthropic-credits`, and on a separate line the credits bought in each week.
   State plainly: "ESTIMATE for the owner's EI report. Check the week boundaries Service Canada uses
   [unverified: Monday–Sunday is assumed]." Also write a Korean version of the numbers and that sentence
   below it (해요체).

## Must not

- File, submit or send anything; send emails; contact CRA, Service Canada, Stripe, Anthropic or banks.
- Change prices, refund, buy credits or spend money.
- Put customer names, emails, card details or Stripe ids in any file.

## Idempotency

The same period always produces the same file (overwrite it); issues are matched by exact title.

ASSERT: on the 1st of the month ops/books/<previous YYYY-MM>.md exists with a payout-check line; on an EI Monday (today − anchorMonday in ops/config/ei-schedule.json is a multiple of 14 days) ops/books/ei/<today>.md exists; on any other day the run summary says "nothing due today".
