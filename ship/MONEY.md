# The routes

Four ways to be paid, all built, all deployed by the same one-time Cloudflare
connection. They share a generator, an invoice tool and a payment rail, so running
two at once costs nothing extra.

Read `ship/sales/runbook.md` for how to work them day to day, and
`ship/FINDINGS.md` for the verified facts behind every number here.

---

## At a glance

| | Route | Page | Ticket | Cash lands | Who buys |
| --- | --- | --- | --- | --- | --- |
| 1 | **48-Hour Ship** | `/` | CAD 300 | **same day** | someone who published a brief |
| 2 | **Ship Two** (bilingual) | `/` + `/ko/` | CAD 450 | **same day** | a business serving two languages |
| 3 | **48시간 페이지** (Korean market) | `/ko/` | CAD 300–450 | **same day** | Korean-Canadian owner-operators |
| 4 | **Overflow Desk** (white label) | `/agencies/` | CAD 250/page | same day, or net-30 | small agencies and studios |

Same-day means Interac e-Transfer: no signup, no identity queue, no holding
period, irreversible, effectively free. The close date is the cash date. Every
other rail loses days — Stripe holds a first Canadian payout for 7 business days,
a new PayPal seller account up to 21.

**Route 4 is the one with a cash-date risk**, and it is not the rail's fault: an
agency's accounts payable may impose net-30 regardless of what the invoice says.
Ask before the first brief, not after the first invoice. Treat route 4 as a
month-two route that occasionally pays immediately, not as a way to hit a 28-day
number.

---

## 1. 48-Hour Ship — the default

**Page:** the site root. **Offer:** one page with the client's own checkout wired
in, live within 48 hours, CAD 300 flat, paid on go-live with no deposit.

**Why it can work from zero reputation:** your build cost is zero, so you can
deliver before you ask. A stranger competing on price cannot afford to. Reply to
a published brief with a working page at a real URL rather than a pitch, and you
are not in the same conversation as the other bidders.

**Where the buyers are:** `[HIRING]` posts on job subreddits — people who have
already declared a budget by publishing a brief. Read the live rules first; the
build environment is blocked from reddit.com, so that check is yours.

**Four sales clears CAD 1,200.**

## 2. Ship Two — the same page in two languages

**Page:** the site root, sold as an add-on. **Offer:** CAD 450 for the same page
in English and Korean, written in both rather than translated.

The tooling does this properly: two briefs that declare each other, a language
switcher that moves between equivalent pages, Korean privacy and terms copy,
Korean date format, and `word-break: keep-all` so the browser stops splitting
Korean words mid-syllable. `ship/briefs/sample-hanok-kitchen*.json` is the worked
example; the runbook has the delivery recipe.

**Why this one is defensible:** a competitor underbidding on a page build cannot
casually add written Korean. It is the only part of the offer that is hard to copy.

## 3. 48시간 페이지 — the Korean-Canadian market

**Page:** `/ko/`. Not a translation of the English page — a different page, written
for a Korean-Canadian owner-operator, leading with the things that reader cares
about: no deposit, no GST/HST on the invoice under the CRA small-supplier
threshold, e-Transfer, and both languages written rather than run through a
translator.

**Why this is a real edge and not a nice idea:** it is a language moat a generic
Canadian agency cannot cross, and the buyer is reachable in person and by phone —
the two channels Canada's anti-spam law does not regulate. Business-to-business
telephone calls are also exempt from the National Do Not Call List, though the
CRTC's telemarketing rules still apply in full.

**Your own site now demonstrates the product.** Selling a bilingual page from a
monolingual site is a fair thing for a prospect to notice.

## 4. Overflow Desk — white-label capacity

**Page:** `/agencies/`. **Offer:** CAD 250 per page, CAD 1,000 for five, delivered
as source under the agency's name. They keep the client, the markup and the
credit; you never contact their client.

**Different buyer, different failure mode.** An agency with signed work and no
capacity is not price-shopping — they are calendar-shopping, and a fixed rate they
can quote against is worth more to them than a cheaper hourly one. But their
payment terms are set by their process, not by your invoice. One CAD 1,000 batch
is the whole target in a single transaction; a net-30 on it lands around day 42.

---

## What is already done

- Four pages built, deployed by one Cloudflare connection, hosted free and
  commercially permitted
- Bilingual generator: two-brief pairing, switcher, Korean legal copy, correct
  Korean typography, reciprocal-link enforcement at build time
- Invoice and receipt generator, PDF output, no GST/HST line under the threshold,
  refuses to run until your legal name replaces the placeholder
- Fixed-scope contract, outreach kit, scope guard, objection handling
- Five sample sites for the portfolio, all fictional businesses
- Checks that run on every push: responsive, WCAG AA contrast, escaping and
  privacy self-tests, and every internal link requested over HTTP

## What needs you

The irreducible list. Everything else is done.

1. **Your legal name** into three files — `ship/briefs/_site.json`,
   `ship/briefs/ko.json`, `ship/briefs/agencies.json`, plus
   `ship/sales/invoices/_example.json`. The build warns until you do and the
   invoice tool refuses to run. *(5 min)*
2. **Interac Autodeposit on**, and confirm your bank does not charge for incoming
   transfers. *(10 min)*
3. **Connect this repo to Cloudflare Pages** — build command `node
   ship/build.mjs`, output directory `ship/dist`. One time; every push deploys
   after that. The build environment is blocked from Cloudflare's API, so this one
   genuinely cannot be delegated. *(15 min)*
4. **Read the live rules** of wherever you post, then post. Also not delegable:
   reddit.com is blocked from here. *(20 min)*

That is roughly 50 minutes. After it, the daily loop is about 20 minutes of
replying to briefs.

## The honest number

Roughly **22–25%** chance of CAD 1,000 received within 28 days. That has not moved
because of anything built since — the code got better, the odds did not. What
holds it down is starting with no reputation and a conversion rate nobody has
measured, not the quality of what is shipped.

The cheapest way to find out before spending the month: read five `[HIRING]` posts
and count how many this offer actually fits, and how many replies each already
has. If it is one in five or fewer, or every post already has twenty replies, the
channel is wrong for this offer and route 3 or 4 deserves the time instead.
