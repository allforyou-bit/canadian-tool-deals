# Findings

What a 13-agent research pass turned up while deciding what to build. Two things
here need your attention regardless of whether you ever use the generator in this
directory, so they come first.

Every claim below has a source. Where something could not be confirmed it says so
rather than guessing.

---

## Read this first: two live exposures on the existing site

### 1. `canadian-tool-deals.vercel.app` is running commercially on a Vercel plan that forbids it

Vercel's Fair Use Guidelines state that "Hobby teams are restricted to
non-commercial personal use only" and that "All commercial usage of the platform
requires either a Pro or Enterprise plan". Commercial usage is defined to include
"any method of requesting or processing payment from visitors of the site", and
the inclusion of advertising is named among the examples. Only soliciting donations
is carved out.

The Amazon affiliate tag `canadiantool-20` is embedded in `lib/brands.ts` and
`lib/scrapers/amazon.ts` and is served on the live site. That is monetisation.

Enforcement is not a bill — Vercel documents an account and deployment pause
process, so the outcome is the site going dark.

- https://vercel.com/docs/limits/fair-use-guidelines
- https://vercel.com/kb/guide/why-is-my-account-deployment-blocked

**Options, cheapest first:** remove the affiliate tag and keep it a genuinely
non-commercial personal project; or move it to Cloudflare Pages, whose free plan
limits usage but not commercial purpose; or move to Vercel Pro at USD 20 per seat
per month.

This is your call, not mine — it is your project and I have not touched it.

### 2. The price-comparison concept cannot be made compliant with Amazon at all

This matters because "fix the scrapers" is the obvious next move and it is a dead
end for reasons that have nothing to do with the scrapers.

- Amazon Associates Program Policies: **"Your Site must not have price tracking
  and/or price alerting functionality, unless otherwise agreed by Amazon."** The
  same restriction applies to mobile applications, which covers the unpublished
  Chrome extension. → https://affiliate-program.amazon.com/help/operating/policies
- The Operating Agreement permits price comparison only conditionally, and requires
  Amazon's own lowest new price (and lowest used price where provided) to be
  displayed from Amazon's data.
  → https://affiliate-program.amazon.com/help/operating/agreement
- Non-image Product Advertising Content may be cached for **at most 24 hours**, and
  needs an adjacent timestamp if refreshed less often than hourly. Scraped prices
  were never compliant content in the first place.
  → https://affiliate-program.amazon.com/help/node/topic/GVJ2BJP35457CLML
- **PA-API 5.0 was retired on 15 May 2026.** The replacement Creators API requires
  at least 10 qualifying referred sales in a rolling 30 days to get or keep access —
  a threshold a site with no sales cannot cross.
  → https://affiliate-program.amazon.com/creatorsapi/docs

So: no API access without sales, no sales without prices, and no lawful way to
display scraped prices. The loop does not close.

**And even if it did, the money arrives too late.** Amazon.ca Associates pays
"approximately 60 days after the end of the month for which they are being paid".
September 2026 commissions arrive around the end of November 2026. At the verified
category rates, CAD 1,000 of commission needs roughly CAD 33,000 of tracked sales.
Separately, an account that has not referred three qualifying purchases within 180
days of signup is closed.

- https://associates.amazon.ca/help/node/topic/G63DR893K4DH55XZ
- https://associates.amazon.ca/help/node/topic/G7MJTPEP9NC3YKMG

---

## Why the scrapers return nothing

Measured, not guessed. The audit ran jobs in this repository's own GitHub Actions
to get the evidence from the same IP range the scheduled scrape runs on.

- **Fill rate: 6 real prices in 360 store slots.** 60 query files × 6 stores; 160
  slots are "brand carried at that store"; 6 hold a price. Everything else is a
  "Search X on Y" link or a "not carried" note.
- **The scheduled run's own log says `live: 0`** for all 54 queries on 2026-09-13.
  Not degraded — zero.
- **Home Depot Canada is a blackhole for datacenter IPs.** Not a 403: no response at
  all. The domain, `/robots.txt` and `/en/home.html` all aborted from an Actions
  runner.
- **Canadian Tire 403s datacenter IPs at the Akamai edge**, and the internal API the
  scraper hardcodes no longer exists.
- **The deploy pipeline is also broken.** Production serves an *older commit than
  `master`*, and the live `/api/search` returns 5-month-stale data with the wrong
  product under the query.

The same blocking is reproducible from this build container, where the egress
policy refuses `CONNECT` to all six retailer domains and to the deployed site
itself.

**Conclusion:** this is not a selector-maintenance problem. Large Canadian
retailers block datacenter IP ranges at the CDN edge, and no amount of header
spoofing from GitHub Actions changes that.

---

## Where money can actually land inside 28 days

Ranked by how many days pass between a customer agreeing to pay and cash being in a
Canadian bank account.

| Rail | Days to cash | Notes |
| --- | --- | --- |
| **Interac e-Transfer** | **minutes** | No signup, no ID queue, no holding period, irreversible. Canadian payers only. Turn on Autodeposit. |
| Stripe direct | ~10 | **First payout in Canada is held 7 business days.** 2.9% + CA$0.30 domestic. Individual/sole proprietorship onboarding, two ID documents, review up to 24 h. |
| Ko-fi (Commissions) | ~10 | 5% on Commissions, paid into your own Stripe, no delay of Ko-fi's own — so it inherits Stripe's first-payout hold. |
| Gumroad | 8–14 | **Digital products only.** Services need an account 30 days old *and* one completed payout; Gumroad closes accounts selling services. 10% + 50c. |
| Polar | 12–16 | **Prohibits human services outright** — marketing, design, web development, consulting. Orgs created after 2026-05-27 pay 5% + 50c. |
| PayPal (new account) | **up to 21** | A new seller account can have payments held up to 21 days. Not a primary rail. |
| Lemon Squeezy | 15–30 | Twice-monthly payouts, US$50 minimum. Mid-migration to Stripe Managed Payments. |
| Paddle | **~46** | Payout created on the 1st, sent by the 15th, then up to 3 working days, US$100 minimum. Mathematically disqualified. |
| Amazon Associates | **~60–90** | See above. |
| Wise | n/a | Receiving payment for goods or services on a personal account breaches its terms. |

**CRA small supplier threshold: CAD 30,000.** Below it there is no requirement to
register for GST/HST, no business number needed, and nothing to charge or remit.
Self-employment income goes on Form T2125.

---

## Where it can be hosted for free, commercially

| Host | Commercial use on free tier | Binding limit |
| --- | --- | --- |
| **Cloudflare Pages / Workers** | **Permitted** | 100,000 dynamic requests/day; 10 ms CPU per invocation; static asset requests free and unlimited; 500 Pages builds/month |
| Vercel Hobby | **Forbidden** | "non-commercial personal use only" |
| GitHub Pages | **Forbidden** | not for "online business, e-commerce site…" |
| Netlify Free | Restricted | new accounts get 300 credits/month; bandwidth 20 credits/GB |

- https://www.cloudflare.com/plans/developer-platform/
- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/pages/functions/pricing/
- https://docs.github.com/en/site-policy/github-terms/github-terms-for-additional-products-and-features

The generator in `ship/` emits static files only, so the 10 ms CPU limit is never
reached: static asset requests do not invoke a Worker.

---

## The legal gate on outreach

**Canada's Anti-Spam Legislation reaches CAD 1,000,000 per violation for an
individual.**

The trap is assuming a published address implies consent. It does not. The CRTC has
stated that conspicuous publication sets "a higher standard than the simple public
availability of electronic addresses", the onus of proof sits on the sender, and
Decision CRTC 2016-428 imposed a $50,000 penalty on a sender relying on exactly
that defence across 385,668 messages.

**The exception does exist, and it has conditions.** CASL provides a conspicuous
publication exception: a commercial electronic message may be sent to a business
address that is conspicuously published, where the publication is not accompanied
by a do-not-contact statement, and where the message is *relevant to the
recipient's business role, functions or duties*. All three conditions must hold,
and the sender carries the burden of proving them. So this is not "never lawful" —
it is "lawful only if you can evidence each condition for each recipient, and the
penalty for being wrong is career-ending for an individual."

`ship/sales/runbook.md` takes the stricter position of no cold email at all. That
is an operating decision made for a 28-day sprint by one person with no compliance
support, not a statement that the exception is unavailable.

What is not restricted by CASL at all: talking to someone in person, replying to
someone who contacted you first, and replying to someone who published a request to
be contacted.

**Business-to-business telephone calls are exempt from the National Do Not Call
List**, so cold-calling a business is lawful — but the CRTC's telemarketing rules
still apply in full.

Whether a platform direct message counts as a commercial electronic message under
CASL **could not be resolved**. Treat it as unresolved and do not build a plan on
it.

---

## What was considered and rejected

| Direction | Killed by |
| --- | --- |
| Fix the scrapers, monetise with affiliate links | No compliant route to Amazon prices; ~60-day payout; datacenter IPs blocked at the CDN edge |
| Sell a digital product on Gumroad | ~140 sales needed at CAD 7–10; first payout day 8–14; needs an audience that does not exist |
| Door-to-door bilingual packages for Korean-owned businesses in Toronto | Scored highest overall, but its core mechanism is publishing 30 lookalike pages for **named real businesses** — unauthorised use of their names and copy. It also needs ~20 hours of in-person selling and assumes GTA residency. |
| Sell a "your Vercel deployment breaches Hobby terms" checker | A `*.vercel.app` URL does not reveal which plan a deployment is on, so every output would be a guess published about a named third party's legal compliance |
| WSIB clearance-tracking tool for Ontario contractors | CAD 149 of revenue against the buyer's $100,000 statutory fine exposure, delivered by an untested script |
| Subcontracting overflow work to small agencies | Best risk profile of the five, but agencies pay net-30: a brief signed on day 12 pays around day 42 |

---

## Honest caveats on the plan that was chosen

- The conversion assumption behind "4 sales in 28 days" is **an assumption**. The
  research found no verified application-to-paid rate for this offer type.
- The research found **no documented case** of a solo builder reaching CAD 1,000 in
  their first month from a standing start with no budget. That absence is itself a
  finding.
- Reddit's live rules could not be read from the build environment, so the posting
  rules must be checked by a person before posting.
- Probability of CAD 1,000 received within 28 days: **roughly 22–25%** after the
  fixes described in `ship/sales/runbook.md`. That is the honest number.
