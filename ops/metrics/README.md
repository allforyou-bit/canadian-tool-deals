# ops/metrics — aggregate numbers only

Everything in this folder is committed to git, so it must never contain personal data: no emails,
names, essays, transcripts, card details, Stripe ids, hashes or tokens (memo §4.1, §1.4). Two
writers put files here:

| File | Written by | When |
|---|---|---|
| `<YYYY-MM-DD>.json` | `.github/workflows/metrics.yml` (`products/clb/scripts/metrics.ts export`) | daily, after the Worker's 05:00 UTC snapshot |
| `ads.json` | the daily Routine (`ops/routines/daily.md`), or the owner's weekly fallback | daily while ads run |

## Personal-data guard

`products/clb/scripts/metrics.ts guard` runs on every `*.json` here, in `metrics.yml` before each
commit and in `ci.yml` on every push. It fails on:

- any `@` character;
- the words `input_text`, `transcript`, `email` or `essay` anywhere (keys or values, any case);
- any token-like string: 16 or more characters of `A–Z a–z 0–9 _ -` that mix letters and digits
  (API keys, Stripe ids, hashes, UUIDs). Model ids from `shared/config.ts` and dates are allowed.

The guard reports line and column only, never the matched text. If it fails, do not "fix" the file
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
    "events": { "landing": 55, "sample_start": 9, "sample_done": 7, "signup": 3, "checkout_start": 2, "purchase": 1 },
    "grades": { "writing": 9, "speaking": 6, "free": 6, "refused": 1 },
    "costUsd": 0.3871,
    "purchases": { "paid": 1, "grossCents": 7900 },
    "refunds": { "count": 0, "cents": 0 },
    "disputes": 0
  }
}
```

| Field | Meaning |
|---|---|
| `day` | the UTC day the numbers cover |
| `computedAt` | when the Worker wrote the row (`metrics_daily.created_at`) |
| `metrics.events.<name>` | count of first-party events that day: `landing`, `sample_start`, `sample_done`, `signup`, `checkout_start`, `purchase`, `refund` (names with a zero count may be missing) |
| `metrics.grades` | graded tasks that were not refused (`writing`, `speaking`, of which `free`), and out-of-scope refusals (`refused`) |
| `metrics.costUsd` | Anthropic + Workers AI cost of every grade that day, in US dollars |
| `metrics.purchases` | purchases paid that day that granted a pass (`paid`) and their total in Canadian cents (`grossCents`); region-rejected payments are excluded |
| `metrics.refunds` | refunds issued that day (count and Canadian cents), dispute outcomes excluded |
| `metrics.disputes` | Stripe `charge.dispute.created` events received that day |

The export keeps the newest 3 rows and overwrites a day's file with the same content, so running it
twice changes nothing. If the newest row is older than yesterday (UTC), the workflow opens the issue
"Metrics snapshot missing" and fails.

## Ads spend: `ads.json`

A JSON array with one row per day, oldest first. A re-imported day **replaces** its row (never a
second row for the same date), so the Routine can run twice safely.

```json
[
  { "date": "2026-10-26", "spendCad": 19.84, "clicks": 12, "impressions": 410, "conversions": 1 },
  { "date": "2026-10-27", "spendCad": 20.11, "clicks": 15, "impressions": 388, "conversions": 1 }
]
```

| Field | Type | Meaning |
|---|---|---|
| `date` | `YYYY-MM-DD` | the day the Google Ads report covers (account time zone) |
| `spendCad` | number ≥ 0 | cost that day in Canadian dollars |
| `clicks` | whole number ≥ 0 | clicks |
| `impressions` | whole number ≥ 0 | impressions |
| `conversions` | number ≥ 0 | conversions reported by Google Ads (the purchase tag on `/checkout/success/`); may be fractional under some attribution settings [unverified] |

No other fields are allowed (the parser rejects unknown keys). Validation and maths:
`products/clb/scripts/ads.ts` (tests: `scripts/ads.test.ts`).

**Freshness.** While `ops/config/ad-cap.json` says ads run (`confirmedByOwner` is `true` and today is
between `startDate` and `endDate`), the newest `date` must be at most two days before today (UTC).
Otherwise `metrics.yml` opens "Ads alert: pause the campaign" — the Worker cannot pause Google Ads,
so the owner pauses the campaign in the Google Ads app.

**CAC.** `node scripts/run.mjs scripts/ads.ts cac --from D --to D` (from `products/clb`) prints spend,
purchases (from the daily files), Google-reported conversions, the blended CAC (spend ÷ all
purchases) and the conservative CAC (spend ÷ the smaller of purchases and conversions) that the KPI
Routine uses for K4.
