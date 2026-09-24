# Routine: daily ops

**Cadence:** once a day (memo §5.2: Routine "Daily ops"). **Runs as:** a fresh, stateless Claude Code
session with this repository checked out and the Gmail connector for the business Google account.
Everything you need is in this file and in the repo; you remember nothing from earlier runs.

All dates are UTC. "Today" is the UTC date when you start. Before anything else, update your checkout
to the latest `master` (`git pull`), so you read what the Actions committed overnight.

## Purpose

1. Keep `ops/metrics/ads.json` current from the Google Ads daily report (memo B8).
2. Open GitHub issues for anomalies in the aggregate metrics and for platform notices.
3. Draft (never send) replies to support tickets, as Gmail drafts for the owner to review.

## Inputs (read only these)

| Input | What you use it for |
|---|---|
| Gmail: scheduled Google Ads report emails received in the last 3 days | ad spend, clicks, impressions, conversions per day |
| Gmail: `[MPC] Support ticket …` emails from the last 3 days (sent by the Worker) | the ticket id, language and the learner's question, **inside Gmail only** |
| Gmail: other `[MPC] …` alert emails from the last 3 days (sent by the Worker) | the subject line only |
| Gmail: emails from Google Ads or Stripe about policy, suspension, verification, reserves or billing in the last 3 days | K9 platform notices |
| `ops/ads/reports/*.csv` (owner fallback upload, if present) | ad numbers when the email cannot be read |
| `ops/metrics/<YYYY-MM-DD>.json`, `ops/metrics/ads.json`, `ops/metrics/README.md` | aggregate metrics and the file formats |
| `ops/config/ad-cap.json` | whether ads should be running (`confirmedByOwner` and `startDate`–`endDate`) |
| `shared/config.ts` → `REFUND_POLICY`, `SKUS`, `BRAND`; `shared/content-rules.ts` | policy facts and forbidden words for drafts (paths under `products/clb/`) |

Never read the D1 database, the Stripe or Cloudflare dashboards, or any user essay or transcript.

## Outputs

| Output | Rule |
|---|---|
| `ops/metrics/ads.json` | updated rows, committed to `master` with the message `chore(ads): daily report <dates>` |
| GitHub issues | titled exactly as below; comment on an open issue with the same title instead of opening a new one |
| Gmail drafts | one draft reply per support ticket; **drafts only** |

## Steps

### 1. Ads report → `ops/metrics/ads.json`

1. Ads run today if `ops/config/ad-cap.json` has `confirmedByOwner: true` and `startDate ≤ today ≤ endDate`.
   Also process reports for any earlier day that is missing from `ads.json`.
2. From each Google Ads report email (or `ops/ads/reports/*.csv`), take per **day**: cost in C$,
   clicks, impressions, conversions. Use only these four numbers and the date — never search terms,
   user lists or anything else.
3. For each day, write one row `{ "date", "spendCad", "clicks", "impressions", "conversions" }`
   (exact format: `ops/metrics/README.md`). If a row for that date exists, **replace** it; never add a
   second row for the same date. Keep rows sorted by date. Round `spendCad` to cents.
4. Validate: from `products/clb`, if the tools can run (`npm ci` once), run
   `node scripts/run.mjs scripts/ads.ts check --ads ../../ops/metrics/ads.json --cap ../../ops/config/ad-cap.json`
   and `node scripts/run.mjs scripts/metrics.ts guard ../../ops/metrics`. Both must succeed. If the
   tools cannot run, check the format rules in `ops/metrics/README.md` by reading the file yourself.
5. Commit and push to `master` only if the file changed. If the push is refused, open a PR from a
   branch named `routine/ads-<today>` instead and say so in the run summary.
6. If ads run today and no report for yesterday or the day before can be found, open or update the
   issue **"Ads report missing"**: "No Google Ads report since <newest date in ads.json>. If this lasts
   48 hours, pause the campaign in the Google Ads app." Do not touch the campaign yourself.

### 2. Anomaly issues (aggregate metrics only)

Read yesterday's `ops/metrics/<yesterday>.json` and the 7 files before it. Open or update one issue
per rule that fires, titled **"Anomaly: <rule id> <yesterday>"**, with the numbers that triggered it:

| Rule | Fires when (yesterday, from the daily file unless stated) |
|---|---|
| A1 tracking | ads ran yesterday, `ads.json` shows `clicks > 0` for yesterday, and `events.landing` is 0 or missing |
| A2 grading failures | `events.sample_start ≥ 5` and `events.sample_done / events.sample_start < 0.5` |
| A3 over-refusal | `grades.writing + grades.speaking + grades.refused ≥ 10` and `grades.refused` is more than 20% of that sum |
| A4 cost spike | `costUsd` is more than twice the average of the previous 7 days **and** more than US$5 |
| A5 dispute | `disputes ≥ 1` (also a K7 input) |
| A6 snapshot missing | there is no file for yesterday (the `metrics.yml` workflow also alerts) |
| A7 Worker alerts | any `[MPC] …` alert email other than support tickets arrived — list the subjects only |

### 3. Platform notices (K9)

For each email from Google Ads or Stripe about a policy problem, suspension, verification request,
reserve, payout hold or account rejection, open or update the issue **"Platform: <Google Ads|Stripe> <one-line neutral summary>"**.
Write only what the notice says about the account (for example "account under review"), never
customer details. The KPI Routine counts these issues for K9.

### 4. Support drafts (Gmail drafts only)

For each `[MPC] Support ticket <id>` email from the last 3 days:

1. Skip it if a Gmail draft or a sent reply mentioning `<id>` already exists (this makes the run safe
   to repeat).
2. If the ticket says the sender was signed out (no email on file), there is no one to reply to:
   skip it and count it in the run summary.
3. Write a draft **reply to the learner's address shown in the ticket**, in the ticket's language
   (`en` English, `ko` Korean, 해요체), with the subject `Maple Practice Coach: your message (<id>)`.
4. Answer only from facts in this repo: prices and passes (`SKUS`), the self-serve refund policy
   (`REFUND_POLICY`: within 14 days of purchase, 5 or fewer graded tasks used, once per email and per
   card, from the account page), how to delete data (account page), and how the practice works.
5. Never: predict a result, promise a refund or anything outside the policy, give immigration, visa
   or legal advice (point to a licensed immigration consultant — a CICC member — or a lawyer), or use
   a word that `shared/content-rules.ts` forbids unless it is inside one of its allowed sentences.
6. If the ticket asks for a refund outside the policy, reports a dispute, or mentions a legal matter,
   start the draft with the line `[OWNER: needs your decision]` and do not answer the question.
7. Never copy any part of a ticket into the repo, an issue, a PR or a commit message.

## Must not

- Change anything in Google Ads, Stripe, Cloudflare or Anthropic; pause, start or fund campaigns.
- Spend money, change prices, issue refunds, or toggle kill switches (that is the owner's `flags.yml`).
- Send any email. Drafts only, and only replies to support tickets.
- Read or store user text beyond reading a support ticket inside Gmail to draft its reply.
- Edit code, `ops/config/*`, `ops/ads/google.csv` or any file other than `ops/metrics/ads.json`.
- Merge PRs.

## Idempotency

Running twice on the same day gives the same result: `ads.json` rows are replaced by date, issues are
matched by exact title (comment instead of duplicating), and drafts are skipped when one exists for
the ticket id.

## Run summary

End with a short summary: days written to `ads.json`, issues opened or updated (titles), number of
drafts created and skipped, and anything you could not do.

ASSERT: when ads run, ops/metrics/ads.json has a row dated yesterday or the day before (UTC), or the issue "Ads report missing" was opened or updated today.
