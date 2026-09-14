# Runbook

Everything an AI agent could build is built. This file is the part that needs a
person, written so it can be worked through in order.

Read the honesty section first. It is not a disclaimer — it is the part that
decides whether this is worth your fortnight.

---

## 1. Honesty first

**This plan has roughly a one-in-four chance of reaching CAD 1,000 inside 28 days.**

That number comes from a four-lens adversarial review of five candidate plans, and
it is the number the review assigned to this one after the worst flaws were fixed.
It is not modesty and it is not sandbagging. Here is what sits behind it.

What is genuinely strong:

- **Only four sales are needed.** CAD 300 × 4 = CAD 1,200. Not 140 digital
  downloads, not 34 subscribers.
- **The payment rail has zero latency.** Interac e-Transfer arrives in minutes, has
  no signup, no identity queue and no holding period, and cannot be reversed. The
  day you close is the day you hold the money.
- **Delivery risk is near zero.** The build is hours of work and the tooling is
  already written and tested. You are not promising something you cannot ship.
- **Nothing is on the critical path waiting for approval.** No app store review, no
  marketplace verification, no platform deciding whether you may sell.

What is genuinely weak, and you should know it before you start:

- **You have no reviews and no reputation on any channel.** That is the single
  biggest obstacle and no amount of copy fixes it.
- **The conversion rate is an assumption.** The research found no verified
  application-to-paid rate for this kind of offer, and no documented case of a solo
  builder reaching CAD 1,000 in month one from a standing start. Anyone who quotes
  you one is guessing.
- **Every [HIRING] post draws dozens of replies within hours**, many from sellers
  quoting a fraction of CAD 300.
- **Reddit's live rules could not be checked from the build environment.** You must
  read them yourself before posting. A rule breach gets the post removed instantly.

The single mechanism this plan bets on: **you deliver before you ask.** Your build
cost is zero, so you can send someone a working page at a real URL instead of a
pitch. Nobody underbidding you on price is doing that, because for them it costs
real hours. That is the whole edge. Protect it.

---

## 2. Setup, once, about 40 minutes

Work through these in order. None takes 30 minutes on its own.

### 2.1 Put your legal name in (5 min)

Three files carry `REPLACE-WITH-YOUR-LEGAL-NAME`, and all three need your real
legal name — the one you would put on an invoice:

- `ship/briefs/_site.json`
- `ship/briefs/sample-proposal-northbrook.json`
- `ship/sales/invoices/_example.json`

```bash
grep -rl 'REPLACE-WITH-YOUR-LEGAL-NAME' ship/briefs ship/sales
```

That also lists this runbook, which mentions the token because it is documenting
it — leave this file alone. And search `ship/briefs ship/sales` rather than
`ship/`: the latter matches `ship/dist` too, which is generated output rewritten on
every build, so editing anything in there accomplishes nothing.

Every build warns until the three are replaced, and the invoice tool refuses to run
at all. To confirm:

```bash
node ship/build.mjs --check   # no "still contains a placeholder" warnings
```

Invoicing under your own legal name means no Ontario business-name registration is
needed. A trade name would cost $60 for five years. (Ontario-specific. If you are
in another province, check your own registry before using a business name.)

### 2.2 Turn on Interac e-Transfer Autodeposit (10 min)

In your bank's app. Two reasons:

- Money lands without the sender needing a security question, which removes the
  most common reason a transfer stalls for a day.
- It is the difference between "cash today" and "cash when they get round to it".

**Also confirm your bank does not charge you for incoming e-Transfers.** Most
packages include them; some basic accounts do not. This is a 60-second check that
changes your margin.

### 2.3 Connect the repo to Cloudflare Pages (15 min)

This is the only deployment step, and it has to be you: the build environment
cannot reach Cloudflare's API.

1. Create a free Cloudflare account.
2. Workers & Pages → Create → Pages → Connect to Git → this repository.
3. Build command: `node ship/build.mjs`
4. Build output directory: `ship/dist`
5. No environment variables. No secrets.

After that, every push deploys automatically and you never touch it again.

**Why Cloudflare and not Vercel:** Vercel's Fair Use Guidelines restrict Hobby
teams to "non-commercial personal use only", define commercial usage to include
"any method of requesting or processing payment from visitors of the site", and
state that "All commercial usage of the platform requires either a Pro or
Enterprise plan". GitHub Pages is likewise "not intended for or allowed to be used
as a free web-hosting service to run your online business, e-commerce site, or any
other website that is primarily directed at either facilitating commercial
transactions". Cloudflare's free plan limits usage — 100,000 dynamic requests a
day, 10 ms CPU per invocation, unlimited free static asset requests — but does not
prohibit commercial purpose. Static pages never touch the CPU limit.

### 2.4 Decide about a card fallback (optional, 15 min)

Interac only works for Canadian buyers. If you want to accept a card:

- **Ko-fi Free** is the fastest route: 0% on tips, 5% on Commissions, paid into
  your own Stripe with no payout delay of Ko-fi's own.
- **Stripe direct** is 2.9% + CA$0.30 domestic. Onboard as Individual / sole
  proprietorship; two verification documents; review can take up to 24 hours.

**The number that matters: Stripe holds the first payout in Canada for 7 business
days.** Starting from Monday 14 September that is Wednesday 23 September — day 10.
So card money is never same-day, and a card sale in the last week of the window
does not become cash inside the window.

**Do not use a brand-new PayPal account as the primary rail.** A new seller account
can have payments held for **up to 21 days** — 21 of your 28.

Recommendation: take Interac, offer a card only if a buyer insists, and prefer
Canadian buyers for that reason alone.

### 2.5 Read the channel rules yourself (20 min)

The build environment is blocked from reddit.com, so this genuinely cannot be
delegated. Before posting, read:

- r/forhire rules and its posting format (title tags, flair, account age and karma
  minimums)
- r/SaaS and r/startups — both gate promotion into specific recurring threads

Post inside the rules or the post is removed and the account takes the hit.

### 2.6 Take the screenshots (5 min)

```bash
node ship/build.mjs
node ship/tools/preview.mjs --out ./shots
```

Three images per sample, at phone and desktop, light and dark. These go in the
post. A zero-review seller with screenshots beats a zero-review seller without.

---

## 3. The offer

| | |
| --- | --- |
| **Ship** | CAD 300 — one page, your checkout on it, live in 48 hours |
| **Ship Two** | CAD 450 — two pages, or the same page in English and Korean |
| **Rush** | +CAD 150 — 24 hours instead of 48 |
| **Payment** | Interac e-Transfer, on go-live |
| **Target** | 4 × Ship = CAD 1,200 |

**Payment terms, and why they are what they are.** The review's demand lens was
blunt: a zero-review stranger asking for a deposit before delivery is the least
competitive offer in the thread, because the buyer's entire worry is being taken
for the deposit. So the deposit is gone. You build first, they see it live, they
pay, then the source is handed over.

Your exposure if someone walks away: a few hours, and a page on your own subdomain
that was never published under their name. Their exposure: nothing. That asymmetry
is the offer.

**The handover is the leverage.** Until payment the page sits on your `pages.dev`
subdomain. On payment it points at their domain and the source and deploy
configuration go to them. Nobody has to trust anybody very far.

---

## 4. The daily loop

**Every morning, 20 minutes.** Open r/forhire, sort by new, read the [HIRING]
posts. Reply to the three whose brief this template actually fits. Do not reply to
briefs it does not fit — a bad fit costs you the delivery and the review.

**On a real conversation.** Build the proposal page *before* the second message.
Copy a sample brief, rewrite it for their offer, `node ship/build.mjs`, send the
URL. Set `"mode": "proposal"` so the page is `noindex` and carries the
unaffiliated-draft banner.

**On a yes.** Build it properly, deploy, send the live URL, take the one round of
changes, then invoice:

```bash
cp ship/sales/invoices/_example.json ship/sales/invoices/2026-002.json
# edit the client, the number and the date
node ship/tools/invoice.mjs ship/sales/invoices/2026-002.json
```

Send the PDF. Confirm the transfer landed. Then hand over the source, and only
then.

**Delivering Ship Two (the bilingual one).** This is two briefs, not one, and the
build enforces that they link to each other:

```bash
cp ship/briefs/sample-hanok-kitchen.json    ship/briefs/client.json
cp ship/briefs/sample-hanok-kitchen-ko.json ship/briefs/client-ko.json
# set slug/meta/content in each, and point alternates at each other:
#   client.json     -> "alternates": [{ "lang": "ko", "label": "한국어",  "href": "/client-ko/" }]
#   client-ko.json  -> "alternates": [{ "lang": "en", "label": "English", "href": "/client/" }]
node ship/build.mjs
```

Write the Korean; do not translate the English. That is the thing being sold, and
it is the one part of this package a cheaper competitor cannot copy. `meta.locale:
"ko-KR"` takes care of the rest — interface strings, date format, the whole privacy
and terms copy in Korean, and the line-breaking rule that stops the browser
splitting Korean words mid-syllable.

If the two briefs do not link to each other the build refuses and names the fix.

**Every evening, 5 minutes.** Write down: replies sent, replies answered, calls
booked, money in. Three days of numbers tells you whether the channel works. A
feeling does not.

---

## 5. Hard limits

These are not suggestions. Each one is a verified rule with a real penalty.

**No cold email. Not one.** This is a rule for this sprint, not a statement of the
law — CASL does provide a conspicuous publication exception, with conditions, and
`ship/FINDINGS.md` sets them out. It is ruled out here because the conditions must
be evidenced per recipient and the downside is not survivable: Canada's anti-spam
law reaches CAD 1,000,000 per violation for an individual. "The address was published on their website" is not
consent — the CRTC has stated that conspicuous publication sets "a higher standard
than the simple public availability of electronic addresses", the onus of proof is
on the sender, and CRTC Decision 2016-428 imposed a $50,000 penalty on exactly that
defence. Replying to someone who contacted you first, or who published a brief
asking to be contacted, is a different thing and is fine.

**No page published under a real business's name.** Proposal pages are `noindex`,
carry the unaffiliated-draft banner, and go to the one person who asked. A public
lookalike page for a named business you have not been hired by is
unauthorized use of their name and likely their copy, and the generator makes the
banner impossible to switch off for exactly this reason.

**Never put your own payment account on a client's page.** The button links to
*their* Stripe, Square, Ko-fi, PayPal or booking page. If you sit in the money
path you have taken on their chargebacks, their refunds and their customer
disputes for CAD 300. The contract says this explicitly.

**Nothing deploys to Vercel Hobby.** See 2.3.

**No regulated advice, ever.** Not immigration (paid representation or advice
without a licence is an offence under IRPA s.91, criminal rather than civil), not
legal, not tax, not medical, not financial. You are selling a web page. If a
client's brief needs one of those, the page links to a licensed professional.

**Do not resurrect the price-comparison site as a revenue plan.** See
`ship/FINDINGS.md`. Amazon's Program Policies state that a site "must not have
price tracking and/or price alerting functionality", the Product Advertising API
retired on 15 May 2026, and Associates pays roughly 60 days after month end — so
September commission arrives in late November regardless of traffic.

---

## 6. Calendar facts for this window

- **Day 1** is Monday 14 September 2026. **Day 28** is Sunday 11 October 2026.
- Day 28 is a **Sunday**, so the last banking day of the window is **Friday 9
  October** — day 26. Any rail that is not Interac effectively loses two days.
- **30 September** is a federal statutory holiday. Settlements crossing it can
  shift. Interac is unaffected in practice, but confirm with your own bank.
- Thanksgiving Monday falls on 12 October, just outside the window.
- A Stripe first payout started on day 1 clears around **day 10**. A card sale
  after roughly day 18 will not be cash by day 26.

---

## 7. If it is not working

Judge the channel on numbers, not on mood.

**After 3 days and ~15 replies with no real conversation**, the problem is the
offer or the channel, not your persistence. Change one thing, not three:

1. **Lead with the artifact.** Build the page from their public brief first and
   put the URL in the first message. This is the highest-leverage change available
   and it is the one nobody else can copy cheaply.
2. **Go narrower.** "One-page site with a working checkout, live in 48 hours" beats
   "web design". A thin niche is the only place a zero-review seller wins.
3. **Go local.** Canadian buyers mean Interac, which means same-day cash, and a
   local seller is a different category of trust from an anonymous global bid.
   Business-to-business telephone calls are exempt from the National Do Not Call
   List, so calling a business is lawful — but the CRTC's telemarketing rules apply
   in full: identify yourself and your purpose in the opening sentence, keep to
   permitted hours, and keep your own do-not-call list.

**After 14 days with nothing**, stop and re-plan rather than grinding. The research
behind this file ranked four other candidates; the next-best that survives the
legal and execution filters is agency overflow work — subcontracting to small
agencies that have signed a client and cannot staff the build. It has a higher
ticket (CAD 1,200 in one transaction) and a much worse cash date, because agencies
pay on net-30. It is a better month-two plan than a day-15 plan.

---

## 8. Tax, briefly and accurately

Under the Canada Revenue Agency's **CAD 30,000 small supplier threshold** there is
no requirement to register for GST/HST, no business number needed, and nothing to
charge or remit. CAD 1,000 is 3.3% of that threshold. The invoice generator
therefore prints no tax line, and says so on the invoice.

Self-employment income is reported on **Form T2125** with your personal return.
Keep the invoices; that is the record.

This is a description of the rules, not tax advice. If your situation is more
complicated than "one person, under CAD 30,000, no employees", ask an accountant —
it is an hour of their time, not a project.
