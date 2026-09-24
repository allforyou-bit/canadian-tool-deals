# Google Search Ads: phase 1 (memo §1.1, §6, B13)

`google.csv` holds the keywords and ad text for one Search campaign with three ad groups (email
writing, survey writing, speaking). It is checked by the ads lint on every push
(`products/clb/scripts/content-lint.ts`, run in `ci.yml`): no CELPIP, IELTS, CLB, "official",
"guarantee", "score", "accurate", "level", "band", "aligned" and no number presented as a result in
any ad line; no test trademark anywhere in the file; headlines ≤ 30 characters, descriptions ≤ 90.

**Only an owner-merged PR changes this file or `ops/config/ad-cap.json`.** Routines and Actions never
create, edit, pause or fund campaigns (memo §1.4).

## Campaign settings (set by hand in Google Ads)

These come from the memo. Google's menu names change and were not checked from here; the ones given
below are [unverified] labels to look for.

| Setting | Value | Source |
|---|---|---|
| Campaign type | Search, with the Display Network and search partners switched off [unverified: option names] | memo: "one capped Google Search Ads test" |
| Locations | **Canada**, and **exclude Quebec** | memo §1.1 |
| Location option | people *in* your targeted locations, not people "interested in" them [unverified: option wording] | memo: residents of Canada outside Quebec |
| Languages | English | ads are in English |
| Daily budget | **C$20** | memo §1.1 (phase 1) |
| Start date | **2026-10-26** (only after Gate C passed and the Service Canada call happened) | memo §6 W5, §1.3 |
| End date | **2026-11-08**, so the campaign stops even if nobody acts | memo §1.1 |
| Total cap | C$1,200 of ad spend to 2027-01-31 (`ops/config/ad-cap.json`) | memo §1.2, scale rules |
| Bidding | Not fixed by the memo. "Maximize clicks" is a simple starting point [assumption, review it]. | — |
| Conversion | one conversion action, **Purchase**, counted when `/checkout/success/` loads | memo B8 |
| Auto-tagging | on, so landings carry a `gclid` | memo B8 (`landing` event stores utm and gclid) |
| Daily report | a scheduled daily email to the business Gmail with Day, Cost, Clicks, Impressions, Conversions [unverified: scheduled reports exist] | memo §4.1 task 15, §5.2 |

After creating the Purchase conversion action, copy its tag's send-to value (it looks like
`AW-…/…` [unverified format]) into the repository variable `MPC_GADS_SEND_TO`; the next deploy puts the
tag on `/checkout/success/` only (`NEXT_PUBLIC_GADS_SEND_TO`, CONTRACT §6).

Replace `YOUR-DOMAIN` in every `final_url` row with the live domain (the value of `MPC_SITE_URL`
without `https://`) before you enter or import the ads.

## File layout

One row per item; the header is exactly `type,ad_group,match_type,text`.

| `type` | `ad_group` | `match_type` | `text` |
|---|---|---|---|
| `negative` | empty (campaign level) | `phrase`, `exact` or `broad` | a negative keyword |
| `keyword` | ad group name | `phrase` or `exact` | a keyword |
| `headline` | ad group name | empty | a responsive search ad headline (≤ 30 characters) |
| `description` | ad group name | empty | a responsive search ad description (≤ 90 characters) |
| `final_url` | ad group name | empty | the landing page for the ad group's ad (one per group) |

Each ad group has at least 3 headlines and 2 descriptions — our reading of Google's minimum for a
responsive search ad [unverified] — and exactly one final URL.

## Entering it by hand

This layout is **not** Google Ads Editor's import format: its exact column headers were not verified
from here, so import may not work directly. Enter the campaign by hand instead (about 30 minutes):

1. Create the Search campaign with the settings above. Add every `negative` row as a campaign-level
   negative keyword with its match type.
2. For each ad group name in the file (`Writing - Email`, `Writing - Survey`, `Speaking`):
   1. Create the ad group.
   2. Add its `keyword` rows. Phrase match is written `"keyword"` and exact match `[keyword]` in the
      keyword box [unverified: current entry syntax].
   3. Create one responsive search ad: paste every `headline` row as a headline and every
      `description` row as a description, and set the final URL from the `final_url` row (with your
      domain in place of `YOUR-DOMAIN`).
3. Leave the campaign paused until the start date, or set the start date to 2026-10-26.

If Google suggests extra headlines or "automatically created assets", decline them: every line the
ads show must pass the lint above, and automatic text cannot be checked [unverified: setting name].

## Fallback: weekly report upload

If the daily Routine cannot read the scheduled report email, download the campaign's report by
**day** (columns: Day, Cost, Clicks, Impressions, Conversions) as CSV once a week and add it to
`ops/ads/reports/<YYYY-MM-DD>.csv` in a commit (about 5 minutes, memo B8). The daily Routine turns it
into rows of `ops/metrics/ads.json`. The report must contain only these daily totals.

## Changing the ads

Edit `google.csv` in a PR. CI runs the lint; the owner merges, then re-enters the change in Google Ads.
