# Routine: daily ops

**Cadence:** once a day (memo §5.2: Routine "Daily ops"). **Runs as:** a fresh, stateless Claude Code
session with this repository checked out and the Gmail connector for the business Google account (the
owner's address, `MPC_OWNER_EMAIL`, which is also the Resend account's address). Everything you need is
in this file and in the repo; you remember nothing from earlier runs.

All dates are UTC. "Today" is the UTC date when you start. Before anything else, update your checkout
to the latest `master` (`git pull`), so you read what the Actions committed overnight.

## Purpose

1. Open GitHub issues for anomalies in the aggregate metrics, for the Worker's alerts and for platform
   and service notices.
2. Turn the Worker's prepaid-credit alerts into a top-up reminder the owner can act on, and prepare the
   file change after the owner has bought credits (memo §7.2, Z6).
3. Draft (never send) replies to support tickets, as Gmail drafts for the owner to review.

There are no ads (memo §7.2): nothing here reads or writes ad data.

**Support emails are the one exception to "Routines never read user text"** (memo §7.1, B14 as amended
2026-09-24; integrator decision 7): you may read `[MPC] Support ticket …` emails **inside Gmail only**, to
draft a reply there. The privacy page discloses this (support messages go to the owner's Gmail; an AI
assistant, Claude, drafts replies that the owner reviews and sends). Nothing from a ticket ever leaves
Gmail: not into the repo, an issue, a PR, a commit message, the run summary or any other tool. You never
read practice essays or transcripts, which live only in the Worker's database.

## Inputs (read only these)

| Input | What you use it for |
|---|---|
| Gmail: `[MPC] Support ticket …` emails from the last 3 days (sent by the Worker) | the ticket id, language, the learner's message and address, **inside Gmail only**, to draft the reply |
| Gmail: the count of `[MPC] Support ticket …` emails received more than 90 days ago | the mailbox-retention reminder (step 5); count only, never open them |
| Gmail: other `[MPC] …` alert emails from the last 3 days (sent by the Worker) | the subject line only (the body only for prepaid-credit alerts, which hold aggregate numbers) |
| Gmail: emails from Stripe, Anthropic, Google (Cloud or sign-in), Cloudflare, Resend or GitHub about policy, suspension, verification, reserves, billing or usage limits in the last 3 days | platform and service notices (step 3) |
| `ops/metrics/<YYYY-MM-DD>.json`, `ops/metrics/README.md` | aggregate metrics and their format |
| `ops/config/anthropic-limit.json` | `prepaidUsd` and `prepaidSince` (the balance and its UTC day, which `deploy.yml` passes to the Worker as `ANTHROPIC_PREPAID_USD` and `ANTHROPIC_PREPAID_SINCE`), `monthlyLimitUsd`, and the file's `notes` |
| `ops/books/expenses.json` | whether a credit purchase is already recorded |
| The GitHub issue "Anthropic credits: top up" and its comments by the repository owner | the new balance after a top-up (step 2) |
| `products/clb/shared/config.ts` → `REFUND_POLICY`, `SKUS`, `BRAND`, `PREPAID`; `products/clb/shared/content-rules.ts`; `products/clb/content/site.ts` and `products/clb/content/legal/*.ts` | policy facts and forbidden words for drafts |

The Worker's emails come from Resend's free sender `onboarding@resend.dev` (memo §7.2). Search the whole
mailbox, Spam included (for example Gmail's `in:anywhere` [unverified: Gmail search operators]); you only
read, never move or label.

Never read the D1 database, the Stripe, Cloudflare or Anthropic dashboards, or any user essay or
transcript. If a learner pastes an essay into a support message, do not comment on it or quote it; the
reply only says where to get feedback (the practice pages).

## Outputs

| Output | Rule |
|---|---|
| GitHub issues | titled exactly as below; comment on an open issue with the same title instead of opening a new one |
| One PR per top-up (step 2) | changes only `ops/config/anthropic-limit.json` and `ops/books/expenses.json`; never a direct commit |
| Gmail drafts | one draft reply per support ticket; **drafts only** |

## Steps

### 1. Anomaly issues (aggregate metrics only)

Read yesterday's `ops/metrics/<yesterday>.json` and the 7 files before it. Open or update one issue
per rule that fires, titled **"Anomaly: <rule id> <yesterday>"**, with the numbers that triggered it:

| Rule | Fires when (yesterday, from the daily file unless stated) |
|---|---|
| A1 grading failures | `events.sample_start ≥ 5` and `events.sample_done / events.sample_start < 0.5` |
| A2 no-feedback rate | `grades.writing + grades.speaking + grades.refused ≥ 10` and `grades.refused` is more than 20% of that sum. `refused` counts every request that gave no feedback: scope or safety refusals, failed model calls, no speech and requests the Worker gave up on after 15 minutes (memo §7.1 B10). If the file has `metrics.outcomes`, put its counts in the issue (for example `scope_refused`, `safety_refused`, `failed`, `no_speech`, `too_long`) so the owner can tell refusals from failures; if it does not, say the file does not tell them apart |
| A3 cost spike | `costUsd` is more than twice the average of the previous 7 days **and** more than US$1 (the prepaid balance is small, about US$10 at launch — memo §7.2) |
| A4 dispute | `disputes ≥ 1` (also a K7 input) |
| A5 snapshot missing | there is no file for yesterday (the `metrics.yml` workflow also alerts) |
| A6 Worker alerts | any `[MPC] …` alert email other than support tickets arrived (for example free samples switched off, grading paused, a prepaid-credit alert, a non-card payment, a failed refund, or the digest the Worker sends once it has forwarded 30 support tickets in a UTC day) — list the subjects only |

### 2. Prepaid Anthropic credits (top-up reminder)

The API is prepaid with auto-reload off. The Worker compares its spend since the prepaid date with the
prepaid amount (`PREPAID` in `shared/config.ts`): free samples off at 70%, an owner alert at 50% and at
80% (once each per top-up), and grading paused at 97% so that no call fails half-way. The exact alert
subjects are the Worker's; treat any `[MPC] …` alert whose subject mentions **credit** or **prepaid**
(any case) as a prepaid-credit alert.

1. **Reminder.** For each prepaid-credit alert from the last 3 days, open or update the issue
   **"Anthropic credits: top up"**. Write, in English and then Korean (해요체): the alert subjects and dates;
   `prepaidUsd` and `prepaidSince` from `ops/config/anthropic-limit.json`; the production spend since that
   day (Σ `costUsd` of the daily files from that day to yesterday — a lower bound, because eval runs and
   staging checks spend the same credits); and the owner's steps, in this order:
   1. In the Anthropic Console, buy credits (Billing → Buy credits [unverified: menu names]). Leave
      auto-reload off. Credits are not refundable and expire after one year [secondary source].
   2. If the production workspace has a monthly spend limit, raise it to at least the new balance.
   3. Reply in this issue with the balance the Console shows now and what you paid, for example
      `잔액 US$12.30` and `구매 US$10 = C$14.20` (add `한도 US$20` if you changed the workspace limit).
   4. Merge the pull request the Routine then opens. Merging redeploys the Worker with the new balance.
   If an alert says grading is paused, put **"Grading is paused"** first in the issue body: paying
   customers get no feedback until the new balance is deployed (their passes are extended by the pause,
   memo §7.1 B10). Add the ESTIMATE that one 30-day pass uses about US$7 of credits on Opus 5 and about
   US$3 on Sonnet 5.
2. **Pull request.** If the issue has a comment by the **repository owner** with a balance line that no
   open or merged PR has used yet, open (or update) a PR from branch `routine/prepaid-<comment date>`:
   - in `ops/config/anthropic-limit.json`, set `prepaidUsd` to that balance and `prepaidSince` to the
     comment's UTC date (`YYYY-MM-DD`); if the comment gives a limit (`한도`/`limit`), set `monthlyLimitUsd`
     to it. Change nothing else in the file.
   - if the comment gives a purchase (`구매`/`bought`), append to `ops/books/expenses.json` (create it as
     `[]` if missing) one row `{"date": "<comment date>", "amountCad": <C$ paid>, "category": "anthropic-credits",
     "note": "Anthropic credits US$<n>"}`. If only US$ is given, use US$ × 1.37 and end the note with
     `(C$ ESTIMATE at 1.37)`. Skip the row if one with the same date and note exists.
   - PR body: the numbers, then "Owner decision needed. Merging this is the written confirmation the memo
     asks for. It redeploys the Worker with the new prepaid balance." and `Closes #<issue number>`.
   - Comment on the issue with the PR link. Ignore comments by anyone else. If the owner's comment has no
     number you can read, comment asking for the reply format of the reminder (its third step) and open
     no PR.

### 3. Platform and service notices

1. **Platform (K9).** For each email from Stripe, Anthropic, Google (the sign-in client or its Cloud
   project), Cloudflare, Resend or GitHub about a policy problem, suspension, verification request,
   reserve, payout hold, account rejection or a disabled or closed account, open or update the issue
   **"Platform: <Stripe|Anthropic|Google|Cloudflare|Resend|GitHub> <one-line neutral summary>"**. Write
   only what the notice says about the account (for example "account under review"), never customer
   details. The KPI Routine counts these issues for K9.
2. **GitHub Actions minutes.** The repository is private on GitHub Free: 2,000 Actions minutes a month, and
   without a payment method Actions simply stop at 100% until the month resets (memo §7.2). For a GitHub
   email about included usage at 90% or 100%, open or update the issue **"GitHub Actions minutes: <90%|100%>
   used <YYYY-MM>"** with the line: "Deploys, kill switches (`flags.yml`), metrics and reconcile stop at 100%.
   The Worker's own spend checks keep running on Cloudflare. To flip a kill switch without Actions, use the
   Cloudflare dashboard (`ops/README.md`, 'Kill switch without Actions')."
3. **Cloudflare free-plan limits.** For a Cloudflare email about Workers, D1, KV or Workers AI usage limits
   [unverified: whether Cloudflare sends these on the Free plan], open or update the issue **"Cloudflare
   limit: <one-line neutral summary>"**.

### 4. Support drafts (Gmail drafts only)

For each `[MPC] Support ticket <id>` email from the last 3 days:

1. Skip it if a Gmail draft or a sent reply mentioning `<id>` already exists (this makes the run safe
   to repeat).
2. If the ticket says the sender was signed out (no email on file), there is no one to reply to:
   skip it and count it in the run summary. (Support requires sign-in, so only older tickets look
   like this.)
3. Write a draft **reply to the learner's address shown in the ticket**, in the ticket's language
   (`en` English, `ko` Korean, 해요체), with the subject `Maple Practice Coach: your message (<id>)`. This
   reply from the owner's Gmail is the only email a learner gets from the business (the site itself sends
   learners no email — memo §7.2).
4. Answer only from facts in this repo: prices and passes (`SKUS`), the self-serve refund policy
   (`REFUND_POLICY`: within 14 days of purchase, 5 or fewer graded tasks used, once per email and per
   card, from the account page), how to delete data (account page), and how the practice works. From
   the legal pages and `content/site.ts` (English is authoritative) you may also state: learners sign in
   with Google, and the site receives only their email address and Google account id, never the password;
   the site sends no email about accounts or passes, and the account page shows the pass, any refund and
   the link to Stripe's receipt; practising without feedback uses no AI and its recordings never leave the
   device; speaking feedback has a daily capacity shared by everyone, which can close before a learner's
   own limit and reopens at midnight UTC; if feedback is paused, active passes are extended by the length
   of the pause; passes are not sold in Quebec and are paid by card only; the site sends no marketing
   email; deleting the account ends any active pass, and signing up again with the same email does not
   give the free speaking task or the self-serve refund again.
5. Never: predict a result, promise a refund or anything outside the policy, give immigration, visa
   or legal advice (point to a licensed immigration consultant — a CICC member — or a lawyer), or use
   a word that `shared/content-rules.ts` forbids unless it is inside one of its allowed sentences.
6. Start the draft with the line `[OWNER: needs your decision]` and do not answer the question when the
   ticket:
   - asks for a refund outside the policy (including a refund of unused days), reports a dispute, or
     mentions a legal matter;
   - is a **privacy request**: asks for a copy of their personal information or how it was used or
     disclosed (access), asks to correct information, asks to delete data or the account other than by
     the account-page button, withdraws consent, or complains about how their information is handled.
     Add a second line
     `[OWNER: privacy request received <ticket date, YYYY-MM-DD>; reply due by <ticket date + 30 days>]`
     (PIPEDA s.8(3); the procedure is in `business/online/owner-setup.md`);
   - reports a possible security problem or data leak (the owner's breach procedure in
     `business/online/owner-setup.md`).
   The owner deletes these `[OWNER …]` lines before sending.
7. Never copy any part of a ticket into the repo, an issue, a PR, a commit message or the run summary.
   The run summary gives counts only (for example "3 drafts, 1 marked OWNER").

### 5. Support mailbox retention reminder (count only)

The privacy page promises that mailbox copies of support messages are deleted 90 days after they were
sent. The owner deletes them; you never delete, archive or forward email. Count the `[MPC] Support ticket`
emails in the mailbox that were received more than 90 days ago (for example with the Gmail search
`subject:"[MPC] Support ticket" older_than:90d` [unverified: Gmail search operators]). If the count is 1
or more, open or update the issue **"Support mailbox: delete tickets older than 90 days"** with the count
and today's date only, and the line "Delete these emails and your replies (business/online/owner-setup.md)."
If the count is 0, do nothing (the owner closes the issue).

## Must not

- Change anything in Stripe, Cloudflare, Anthropic, Google, Resend or GitHub settings; buy credits;
  post anywhere outside this repo.
- Spend money, change prices, issue refunds, or toggle kill switches (that is the owner's `flags.yml`).
- Send any email. Drafts only, and only replies to support tickets.
- Delete, archive, label, forward or move any email (mailbox clean-up is the owner's task).
- Read or store user text beyond reading a support ticket inside Gmail to draft its reply.
- Edit code or any file except through the step-2 PR (`ops/config/anthropic-limit.json`,
  `ops/books/expenses.json`); commit nothing to `master` directly.
- Merge PRs.

## Idempotency

Running twice on the same day gives the same result: issues are matched by exact title (comment
instead of duplicating), the step-2 PR is keyed by its branch name and skipped when its values are
already on `master`, expense rows are not added twice, and drafts are skipped when one exists for the
ticket id.

## Run summary

End with a short summary: issues opened or updated (titles), the top-up PR opened or updated (if any),
number of drafts created, skipped and marked `[OWNER …]`, the old-ticket count from step 5, and anything
you could not do. No ticket text, addresses or names.

ASSERT: the run summary lists the issues opened or updated and the draft counts, and if a prepaid-credit alert ([MPC] subject mentioning credit or prepaid) arrived in the last 3 days, the issue "Anthropic credits: top up" was opened or updated in this run.
