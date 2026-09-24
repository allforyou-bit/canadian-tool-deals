# ops/metrics — aggregate numbers only

Everything in this folder is committed to git, so it must never contain personal data: no emails,
names, essays, transcripts, card details, Stripe ids, hashes or tokens (memo §4.1, §1.4). One writer
puts files here:

| File | Written by | When |
|---|---|---|
| `<YYYY-MM-DD>.json` | `.github/workflows/metrics.yml` (`products/clb/scripts/metrics.ts export`) | daily, after the Worker's 05:00 UTC snapshot |

There are no ads (memo §7.2), so the Google Ads export `ads.json` of the earlier plan is no longer
written and nothing reads it.

## Personal-data guard

`products/clb/scripts/metrics.ts guard` checks **every file in this folder and in any subfolder**: in
`metrics.yml` before each commit, in `metrics-guard.yml` on every pull request or push that changes this
folder (`ci.yml` skips such changes to save Actions minutes), and in `ci.yml` whenever it runs. Only this
`README.md` and `<YYYY-MM-DD>.json` files belong here (no subfolders, lower-case `.json`); anything else
fails. Every file except this README is scanned, whatever its name, and fails on:

- any `@` character;
- the words `input_text`, `transcript`, `email` or `essay` anywhere (keys or values, any case);
- any token-like string: 16 or more characters of `A–Z a–z 0–9 _ -` that mix letters and digits
  (API keys, Stripe ids, hashes, UUIDs). Model ids from `shared/config.ts` and dates are allowed.

Daily files must also match their format below exactly: an **allowlist** of keys at every level, whole
numbers ≥ 0 for counts, and no other fields (so no free-text field can slip in).

The guard reports the file, rule and position only, never the matched text. If it fails, `metrics.yml`
opens the issue "Personal-data guard failed on ops/metrics" and commits nothing. Do not "fix" the file
by hand: find out how the data got there.

## Daily metrics: `<YYYY-MM-DD>.json`

One file per UTC day. The `metrics` object is the Worker's `DailyMetrics` row
(`products/clb/worker/src/cron.ts`, table `metrics_daily`), copied unchanged.

```json
{
  "schema": 1,
  "day": "2026-10-27",
  "source": "d1.metrics_daily",
  "computedAt": "2026-10-28T05:00:01.870Z",
  "metrics": {
    "day": "2026-10-27",
    "events": { "landing": 55, "practice_start": 12, "practice_done": 7, "sample_start": 9, "sample_done": 7, "signup": 3, "checkout_start": 2, "purchase": 1 },
    "grades": { "writing": 9, "speaking": 6, "free": 6, "refused": 1 },
    "outcomes": { "graded": 15, "scope_refused": 1 },
    "costUsd": 0.3871,
    "purchases": { "paid": 1, "grossCents": 3900 },
    "refunds": { "count": 0, "cents": 0 },
    "disputes": 0
  }
}
```

| Field | Meaning |
|---|---|
| `day` | the UTC day the numbers cover |
| `computedAt` | when the Worker wrote the row (`metrics_daily.created_at`) |
| `metrics.events.<name>` | count of first-party events that day: `landing`, `practice_start`, `practice_done`, `sample_start`, `sample_done`, `signup`, `checkout_start`, `purchase`, `refund` (names with a zero count are missing). `practice_start` / `practice_done` count sessions of the free practice mode without AI ("Practise without feedback"): nothing the learner writes or records is sent, only the event name (memo §7.2). `sample_start` / `sample_done` count free samples **with** AI feedback. Events are not linked to people, so ratios between them are aggregate ratios, not conversions |
| `metrics.paidEvents.<name>` | optional and always **absent** now: it was meant to count events from paid ad clicks, and there are no ads (memo §7.2). The allowlist still accepts the key so the format stays stable; nothing reads it |
| `metrics.grades` | tasks that got feedback (`writing`, `speaking`, of which `free`), and requests that got **no feedback** (`refused`: scope or safety refusals, failed model calls, no speech, and requests closed after 15 minutes still pending — memo §7.1 B10) |
| `metrics.outcomes.<outcome>` | grade rows that day by outcome: `graded`, `scope_refused`, `safety_refused`, `failed`, `no_speech`, `too_long` (and `pending` or `unknown` for rows without an outcome). A missing name means 0; files written before this field existed lack the key. Optional detail for the daily Routine's A2 rule |
| `metrics.costUsd` | Anthropic + Workers AI cost of every grade that day, in US dollars, including requests that gave no feedback. Eval runs, staging checks and the level-B prompt-cache check are **not** included, although they spend the same prepaid Anthropic credits (memo §7.2) |
| `metrics.purchases` | purchases paid that day that granted a pass (`paid`) and their total in Canadian cents (`grossCents`); region-rejected and non-card payments (refunded automatically) are excluded |
| `metrics.refunds` | refunds issued that day (count and Canadian cents), including the owner's partial refunds (for example unused days) counted by the amount refunded; region and dispute refunds excluded |
| `metrics.disputes` | Stripe `charge.dispute.created` events received that day |

The export keeps the newest 3 rows and overwrites a day's file with the same content, so running it
twice changes nothing. If the newest row is older than yesterday (UTC), the workflow opens the issue
"Metrics snapshot missing" and fails; if the export itself fails (for example an expired Cloudflare
token or a row that does not match the allowlist), it opens "Metrics export failed".

## Who reads these files

The Routines in `ops/routines/` (daily anomalies, the weekly KPI digest and its rules, books, the Nov 30
and Day-90 reviews). The definitions they use — `net`, the free practice and free sample counts, the
prepaid-credit spend — are in `ops/routines/kpi.md`.
