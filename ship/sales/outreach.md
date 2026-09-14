# Outreach

Every template here is written to be pasted and edited, not sent verbatim. A reply
that is obviously a form letter is worse than no reply.

**Read the rules of the subreddit or forum before posting.** They change, they are
enforced by humans, and the build environment is blocked from reddit.com, so this
check is genuinely yours to do. A removed post also costs you the account's
standing, which is harder to replace than the post.

---

## 1. The [FOR HIRE] post

Title format varies by subreddit — check the current rules for the exact tags,
flair and any account age or karma minimum.

> **[FOR HIRE] One-page site with your checkout on it, live in 48 hours — CAD 300 flat (Canada-based)**
>
> I build one thing, and I build it fast: a single well-made page for your offer,
> with your own checkout or booking link wired in, live on a real URL within 48
> hours of the brief.
>
> **CAD 300 flat.** Not an hourly rate, not an estimate, not a starting point.
>
> **You pay after it is live.** No deposit. I build it, you open it on your phone,
> you send one round of changes, and you pay when it is right. If you look at it
> and decide you do not want it, you pay nothing.
>
> **What you get**
> - One page, copy written from your brief — not a theme with your name dropped in
> - Your Stripe / Square / Ko-fi / PayPal / Calendly link on the button. My payment
>   details never touch your page
> - Privacy and terms pages, written to match what the page actually does
> - Deployed and hosted on a free plan that permits commercial use — no hosting
>   bill after handover
> - No cookies, no analytics, no third-party scripts, so no consent banner
> - Security headers set properly, dark mode, and it works on a phone
> - The source files are yours on payment. Nothing is locked to me
>
> **What I do not do:** logos, photography, product catalogues, logins, databases,
> or ongoing retainers. One page, done properly, then it is yours.
>
> **Samples** (fictional businesses, built with the same tooling):
> [three URLs]
>
> Add CAD 150 for a 24-hour rush, or CAD 450 for two pages — or the same page in
> English and Korean, written rather than machine-translated.
>
> Reply here or DM with what you sell and who buys it. I will tell you straight if
> it is not a fit.

**Why each part is there:** the flat price removes the estimate conversation; "pay
after it is live" removes the reason most people do not hire a stranger; the
samples answer the zero-reviews problem; "what I do not do" prevents the scope
fight; and "I will tell you straight if it is not a fit" is the line that actually
gets replies, because everyone else says yes to everything.

---

## 2. Replying to a [HIRING] post

Three a day, to briefs this genuinely fits. Read the whole brief first — quoting
something they explicitly ruled out is an instant pass.

> Hi — this is squarely what I do, so here is a straight answer rather than a pitch.
>
> **CAD 300 flat, live within 48 hours of your brief.** For what you have
> described that covers [restate their ask in your own words, specifically — this
> is the part that proves you read it].
>
> You pay after it is live. I build it, send you the URL, you send one round of
> changes, and you pay when it is right. No deposit.
>
> Two things I would want from you: [the checkout or booking link you want on the
> button] and [whichever detail their brief is missing].
>
> Samples, all built with the same tooling: [URLs]
>
> One thing worth saying plainly: [the honest caveat — something their brief
> implies that is outside the fixed scope, or a genuine risk in their plan].
>
> — [Name], based in [city]

That last paragraph is the one that converts. Everyone else is agreeing with
everything. Being the one person who names a problem in their brief is cheap, true,
and memorable.

---

## 3. The move that actually wins: build it first

For any brief worth having, build the page before the second message.

```bash
cp ship/briefs/sample-tallystone.json ship/briefs/prospect-name.json
# rewrite it for their offer — 20 minutes
node ship/build.mjs prospect-name
node ship/tools/preview.mjs prospect-name --out ./shots
```

Set `"mode": "proposal"`. That gives you `noindex, nofollow`, a `Disallow: /`
robots file, no structured data, and an unaffiliated-draft banner on every page —
which is what keeps a helpful gesture from being a misuse of someone's name.

Then:

> I had a slow hour so I built it. [URL]
>
> It is a draft on my subdomain, not indexed, and it says so at the top. Your
> checkout link is not on it yet because I do not have it.
>
> If it is close, I will finish it properly and it is live within 48 hours for CAD
> 300, paid after. If it is not what you had in mind, keep the URL anyway — it
> costs me nothing and you may get a use out of it.

**Send it only to the person who published the brief.** Never post a proposal URL
publicly, never index it, never build one for a business that has not asked for
anything.

---

## 4. Objections, answered honestly

**"Why so cheap? What is the catch?"**
> The scope is fixed and narrow, so there is nothing to estimate, and the hosting
> genuinely costs nothing on the tier it deploys to. The catch is real and it is
> scope: one excellent page, not a bespoke multi-page project. If you need the
> second thing, I am the wrong person and I will say so.

**"Can you do it cheaper?"**
> No. It is already the price for the whole thing, paid after delivery. What I can
> do is take something out of the scope if there is something in it you do not
> need.

**"How do I know you will not disappear with my money?"**
> You pay after it is live, so there is nothing to disappear with. That is the
> whole reason the terms are that way round.

**"Do you use AI?"**
> Yes, as part of how it gets produced, which is exactly why the price is what it
> is. Every line is reviewed before you see it. If you would rather I did not, say
> so in the brief and I will not.

**"Can you add a shop / login / booking system?"**
> Not inside this. The page links out to whatever tool you already use for that.
> Building one is a real project and would need a real quote — I would rather tell
> you that now than discover it on day two.

**"Can you do it in 24 hours?"**
> Yes, for CAD 150 more, if a slot is free. Ask before you count on it.

---

## 5. Scope guard

Inside CAD 300, no argument: one page; copy from the brief; their checkout or
booking link; privacy and terms; deploy; one round of changes; handover.

Outside, quoted separately, every time: a second page (CAD 150); a Korean version
(CAD 150); a logo; photography; a product catalogue; a form that stores submissions;
a login or database; email hosting; a domain purchase; changes after the included
round (CAD 75); anything needing a licensed professional's sign-off.

**Say it before doing it.** The sentence is: *"That is outside what we agreed —
it is CAD [x] and adds [y] hours. Want me to do it?"* Doing it quietly and
resenting it is how a CAD 300 job becomes a CAD 300 job that took three days.

---

## 6. Channels, in order of expected value

1. **[HIRING] posts on job subreddits.** Buyers self-identify and have declared a
   budget. Highest intent available at zero cost. Read the rules first.
2. **Thread-gated promotion subreddits** — the recurring "share what you are
   building" and "feedback" threads. Post inside the designated thread only.
3. **Business-to-business telephone, locally.** Exempt from the National Do Not
   Call List, so calling a business is lawful — but the CRTC's telemarketing rules
   apply in full: identify yourself and your purpose in the first sentence, call
   only within permitted hours, and keep your own do-not-call list. Canadian buyers
   also mean Interac, which means same-day cash.
4. **In person.** The one channel Canada's anti-spam law does not regulate at all.
5. **A Show HN-style post of the generator itself**, if you want to. It is a real
   tool people can run, which is what those venues are for. Do not solicit upvotes
   from anyone — that is an explicit rule everywhere it exists, and getting caught
   costs more than the post is worth.

**Not a channel: cold email.** Not one message. See the hard limits in
`ship/sales/runbook.md`.
