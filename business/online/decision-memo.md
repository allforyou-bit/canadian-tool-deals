# Decision memo: an AI-run online product, Oct 2026 – Jan 2027 (revised after review)

**Date:** 2026-09-24 · **Day 1:** Mon 2026-09-28 · **Day 90:** Sat 2026-12-26 · **Final review:** Sun 2027-01-31 · **Target window:** Dec 2026 – Jan 2027

**How numbers are tagged.** Every number has a source, **[prior knowledge, unverified]**, or **ESTIMATE:** with its arithmetic. FX is 1 USD = 1.37 CAD [prior knowledge, unverified]; the whole bundle uses this rate.

**Where the sources are.**
- Bundle files are in `business/online/research/`. Short names are used below: `cand_aichat` means `cand_aichat.json`.
- `decision-memo.md` means `/home/user/canadian-tool-deals/business/research/decision-memo.md`. It is the home-services plan.
- Where a dossier and its adversarial verification disagree, this memo uses the verification.

---

## 0. Bottom line

1. **Build one product only if the gates pass.** The product is a web tool that gives feedback on writing and speaking practice. It is for adults in Canada preparing for an English test for immigration or citizenship.
   - Tasks follow the *formats* of Canadian test tasks. Feedback covers descriptive criteria. The product is **not calibrated against official scores** and **never predicts a score or level**.
   - It is sold only to **residents of Canada, excluding Quebec**, as **one-time passes**: C$39 for 30 days and C$79 for 90 days.
   - Payment runs through **plain Stripe Canada, with no merchant of record**.
   - Traffic comes from **one capped Google Search Ads test** plus a handful of static product pages.
   - There are **no AI-written guide articles and no referral programme** in this window (section 1.2).
2. **This is the best option in the bundle, and it is still very unlikely to reach C$5,000/month.**
   - ESTIMATE (judgement): the chance of averaging C$5k/month over Dec–Jan is **well under 1%**.
   - Even the top-decile case in section 2.2 averages about **C$690/month net over Dec–Jan**: (541 + 834) ÷ 2 = 687.5, about 14% of the target.
   - For January (month 3) the conservative, base and upside cases give **−C$96, −C$70 and +C$834** if the product is kept running. The plan's own Day-90 rule (K11) winds the product down in the conservative and base cases.
   - The most likely January result is **between about −C$100 and +C$200**. **Nothing here can be guaranteed.**
3. **The owner's income floor stays outside this product.** It is EI (file by **Sat 2026-10-10**, decision-memo.md F1) and/or the home-services plan in decision-memo.md.
   - Home services wins every conflict for owner hours.
   - The home-services site stays live.
4. **Gates.** Gate 0 (legal and EI), Gate B (Anthropic usage policy, **currently UNRESOLVED**) and Gate C (ad money) are in section 1.3. No Stripe account and no ad spend happen before the Service Canada call.

---

## 1. Decision

### 1.1 Strategy: one product, with no second product before Nov 30

| Field | Decision |
|---|---|
| **Product** | "[Brand] Practice Coach" (working name). Timed practice tasks: 2 writing types and 8 speaking types, modelled on the *formats* of Canadian English-test tasks. Feedback is given per descriptive criterion (for writing: content, organisation, vocabulary, readability; this is a description, not an official rubric). It also gives the 3 most important errors with corrections, model rewrites, and a per-learner log of recurring errors. **No score, band or CLB level appears in any output** (`band_enabled` stays false through Jan 31). |
| **Audience** | Adults (18+) living in Canada **outside Quebec** who are preparing for an English test for PR, citizenship or Express Entry. The product gives practice feedback only: no immigration advice and no score prediction. |
| **Languages** | UI and corrections in English. Explanations can be switched to **Korean**. Korean is the only language the owner can check, and it is the owner's community hook. Other languages are an expansion under S3 (section 6), gated on a paid reviewer. |
| **Price** | 1 free graded writing task (no account; Turnstile) and 1 free graded speaking task (after email verification). Then a **hard paywall**. Passes: **C$39 for 30 days** and **C$79 for 90 days**. No auto-renewal and no subscription. Fair-use cap: 150 graded tasks per 30 days. No GST/HST is charged while the owner is a small supplier (ETA s.148, cross_payments). |
| **Refunds** | Self-serve within 14 days of purchase if 5 or fewer graded tasks were used. **Once per email and per card fingerprint.** This follows the strictest regime found (cross_payments "REFUNDS"). |
| **Payments** | **Stripe Canada, direct.** Hosted Checkout, one-time mode, billing address required. Country checks run before and after payment (B6). Buyers outside Canada or in Quebec are refunded automatically. |
| **Primary channel** | **Google Search Ads** on non-trademark intent phrases. Geo is Canada excluding Quebec. Phase 1: C$20/day for 14 days (Oct 26 – Nov 8), with the campaign end date set to Nov 8 so it stops even if nobody acts. Total ad spend to Jan 31 is capped at the Gate C amount (C$1,200). |
| **Secondary channel** | 8–10 static product pages written once in this session and approved by the owner: landing, pricing, task-format descriptions of *our own* tasks, help/FAQ, and legal pages. These are product documentation, not articles. SEO is **not** a growth channel in this window (section 1.2). |
| **Stack** | This repo's Next.js 16 as a **static export**, served by **one Cloudflare Worker with static assets**. The same Worker handles `/api/*`, with D1, KV and Workers AI (Whisper). The Claude API grades. Stripe takes payments. Resend sends transactional email. |
| **Name rules** | "CELPIP", "IELTS" and "CLB" never appear in the brand, domain, logo or ad text. Product pages may use them descriptively next to "not affiliated with or endorsed by Paragon Testing Enterprises". That "CELPIP" is Paragon's trademark is [prior knowledge, unverified] (cand_aichat facts). |

**Why only one product:**
- **Setup hours.** One web product alone needs 7.25–10.75 h of setup (cand_aichat verification). Section 4.1 already comes to 11–12 h once the income-floor tasks are counted.
- **Extra shots are correlated.** ESTIMATE (cross_baserates): 10 independent shots at 0.5–1% each give 1 − 0.995¹⁰ ≈ 4.9% to 1 − 0.99¹⁰ ≈ 9.6%. Shared owner, audience and channel push this lower.
- **EI.** A second activity weakens the "minor in extent" argument (EI Regs s.30(3)(a),(d), cross_payments).
- **The next product is considered only if November net is at least C$500** (the same rule as K6). The candidates are a Shopify App Store app (Judge 1) or an Apify pay-per-event (PPE) Actor portfolio (Judge 2). Either would be a 6–12 month asset, not part of the January number.

### 1.2 How the judges' disagreements were resolved

**Which product.**
- Judge 1 (odds): the CLB-style practice tool. Judge 2 (hands-off and capital): Apify PPE Actors with no ads, with the income floor kept outside. Judge 3 (AI leverage): the practice tool.
- **Decision: the practice tool, with Judge 2's floor principle adopted in full (section 0.3).**
- It has the highest willingness to pay in the bundle and the quickest route to cash: it is a web product with no store review.
- Stripe's first payout comes 7–14 days after the first payment ("Canada: 7 days for the first settlement"; Stripe doc mirror, secondary, via cand_saas as cited in cand_newsletter). The payout cadence after that was not verified.
- Apify cannot move the Dec–Jan number. Its anecdotes: "about $10 in the first month, 7 months to a first $100". Payout invoices are "generated on the 11th for the previous month and auto-approved on the 14th, with a $20 minimum" (cand_apiagents).
- **Apify becomes the fallback if Gate B fails.**

**Payment rail.**
- Judge 1: plain Stripe, Canada only. Judge 2: any low-risk option. Judge 3: a merchant of record (Paddle, Polar or Stripe Managed Payments).
- **Decision: plain Stripe; Canada only, excluding Quebec.**
- A merchant of record is needed for *foreign* VAT, which a Canada-only product avoids (cross_payments conclusion 1).
- Stripe Managed Payments excludes "professional-service/consulting offers", and its eligibility review was not verified. Polar puts exam tools and chatbots under "closer review" (cand_korea).
- Cost. ESTIMATE: Stripe direct is 2.9% + C$0.30 = 1.43 ÷ 39 ≈ **3.7% at C$39**. Stripe Managed Payments is about **8.6%** (cross_payments ESTIMATE: 7.1% × 5,000 + 75 = $430 at C$5k/month).

**Pricing.**
- Judge 1: passes at C$39/C$79 with 1+1 free tasks. Judge 3: C$29/month plus a C$69 90-day pass.
- **Decision: passes only.** A C$29 subscription undercuts the C$39 pass (cand_aichat verification, problem 3). Passes avoid the negative-option and renewal-consent duties (cross_payments "REFUNDS"). Exam buyers leave after their test anyway.
- Judge 1 put net per sale at C$31.18 / C$59.93. This memo uses **C$27.7 / C$56.4**, which include a 10% refund allowance (section 3.2).

**Ads.**
- Judge 1: C$20–30/day with gates. Judge 2: avoid plans that depend on ads (C$2.2–3.2k at risk). Judge 3: a capped test.
- **Decision: staged and capped.** Phase 1 is C$280. **Total ad spend to Jan 31 is at most the Gate C amount (C$1,200) unless the owner re-confirms in writing.** Phase 1 can detect only catastrophic failure, not profitability (section 6).

**Anthropic usage policy, "Academic testing".**
- Judge 1: a gate. Judge 2: high risk. Judge 3: the owner decides in week 1.
- **Decision: Gate B is UNRESOLVED.** The live text is checked on Day 1, Anthropic is emailed, and the product launches only under the restricted framing (section 1.3).

**Guide articles (a content channel).**
- Judges 1 and 3: 2–3 quality-gated guide pages a week. Judge 2: auto-published AI media needs professional review.
- **Decision: none in this window.** The policy lists "Media or professional journalistic content: … automatically generate content and publish it for external consumption" as High-Risk. It requires that "a qualified professional in that field must review the content … prior to dissemination" (archived policy; cross_payments).
- An owner merge is **not** that review: the owner is not an ESL or test-prep professional, and their English level is unknown.
- Restart only under S3, with a hired qualified reviewer (a certified ESL or test-prep instructor; cost not found).

**Referral programme.**
- Judges 1 and 3: 30% commission for tutors.
- **Decision: dropped for this window.**
- It needs building (codes, ledger, payouts) and adds owner payout labour and possibly tax-slip duties [prior knowledge, unverified].
- It needs CASL outreach from the owner.
- ESTIMATE: it cuts net to 27.7 − 0.30 × 39 = C$16.0 per referred sale.

**Languages.**
- Judges 1 and 3: seven explanation languages.
- **Decision: English plus Korean.** Nobody can review the other six.

**Second product.**
- Shopify (Judge 1), an SEO tools section (Judge 2), a Telegram bot (Judge 3).
- **Decision: none before Nov 30, and only if November net is at least C$500.** Telegram is dropped: selling TON on a Canada-registered exchange was not found (cand_bots verification).

### 1.3 Gates

**Gate 0: legal right, EI and owner hours (owner; Day 1 – Fri Oct 9).**
1. The owner confirms from their IRCC documents that they may be self-employed (decision-memo.md Gate 0). If not, **stop**.
2. **Declare self-employment activity from the first week of setup, not from the first sale.** Declare it on the EI application and on every bi-weekly report.
   - EI Regs s.30(1) applies in any week the claimant "is … engaged in the operation of a business on the claimant's own account", whoever does the work (cross_payments).
   - EI filing is due by Sat Oct 10 (decision-memo.md F1).
3. **Call Service Canada by Fri Oct 9** (decision-memo.md already schedules this for Mon Oct 5).
   - Describe **both** activities together: home services (decision-memo.md Path A) and this online product.
   - Give hours and capital: the C$1,200 ad cap plus about C$100/month fixed costs.
   - Ask whether the combination would be "minor in extent" (EI Regs s.30(2)–(3)).
4. **Do not open the Stripe account and do not buy ads until the call has happened.**
5. If Service Canada says the combination would *not* be minor, **no paid sales while claiming EI.**
   - ESTIMATE: at the maximum benefit B = $729/week, EI is worth 729 × 52 ÷ 12 ≈ C$3,159/month (cross_payments). This product's realistic range is −C$100 to +C$800/month (section 2).
   - If no ruling can be obtained, apply decision-memo.md §5.4 and declare every week's net.
6. **Hours rule.** Owner business hours per week are home services plus this product:

| Configuration | Home services (decision-memo.md) | Online product | Combined | Verdict |
|---|---|---|---|---|
| On EI, Path A with a few declared jobs | owner logs actual hours | ≤3 h/week after setup (W1 ≈ 3–4 h, W2 ≈ 4–5 h, W3 ≈ 2–3 h) | **≤15 h/week** (ESTIMATE threshold; not a legal test) | Online product proceeds |
| On EI, and combined hours > 15/week | e.g. B1 week 4 ≈ **36 h** (decision-memo.md §7) | — | > 15 | **Online product waits**; home services wins |
| Not on EI (Path B, or not eligible) | ≈ 36–44 h/week (decision-memo.md §7) | ≤3 h/week | ≤ 47 h | Proceeds only if the combined total stays ≤ 45 h/week (below decision-memo.md's 50 h ceiling); otherwise it waits |

**Gate B: Anthropic Usage Policy. Status: UNRESOLVED.** The AI has only read an archived version.
- **What the archived text says** (effective 2025-09-15, via OpenTermsArchive):
  - It lists as High-Risk "Academic testing, accreditation and admissions: Use cases related to standardized testing companies that administer school admissions …, language proficiency, or professional certification exams".
  - It requires review by a "qualified professional" before dissemination for High-Risk uses.
- **The AI's reading.** A third-party practice tool that neither administers a test nor feeds an official decision is *probably* outside. But "related to" is broad, and a grader for language-proficiency-style tasks is plausibly inside. "Probably outside" is not a pass. **This cannot be guaranteed.**
- **Owner task 2, Day 1 (0.25 h):**
  - Open the live `anthropic.com/legal/aup` page and paste its text into the repo issue. The AI cannot fetch anthropic.com from here.
  - The AI compares it with the archived text.
  - The owner emails Anthropic's usage-policy contact, using a description the AI drafts. A reply is not guaranteed.
- **Rules:**
  - If the live text clearly covers practice tools, **do not launch the grader**. Switch to Judge 2's Apify PPE plan (no ads), or stop and rely on the floor.
  - If there is no reply by **Day 21 (Sun Oct 18)**, launch only as "writing and speaking practice feedback": **no CLB, band, level or score vocabulary in any output or ad**.
  - The owner signs a written risk acceptance in the checklist (`business/online/owner-setup.md`, section "위험 수용").
- **Separate from Gate B:** no AI-published articles (1.2).

**Gate C: ad money (owner, Day 7).**
- The owner confirms they can lose **C$1,200** of ad spend by Jan 31, on top of fixed costs (section 3.4), without it touching rent or food.
- If not: organic-only mode. Expected results then sit at or below the conservative case.

### 1.4 DO-NOT-DO list

| Do not | Why (source) |
|---|---|
| Any paid immigration, CRS, visa or "consultation" bot, including the owner's "AI consultation-bot" idea in any regulated field | IRPA s.91(1). Penalty up to $200,000 and/or 2 years (s.91(9), cross_payments). Legal, health, finance and employment uses are High-Risk under the Anthropic policy. The product hard-refuses such questions. |
| Publishing AI-written guide or article pages without a qualified professional reviewer | Anthropic "Media" High-Risk clause (cross_payments). An owner merge is not qualified review. Google scaled-content policy (cross_distribution). |
| Freemium or daily free checks | Median conversion is 2.1% for freemium vs 10.7% for a hard paywall (RevenueCat 2026, secondary, cand_aichat facts). Free-user API cost adds up (cross_operator). |
| "Official", "guaranteed", "CLB-aligned", "accurate", any score or level prediction, fake testimonials | Competition Act s.74.01; fines up to $750k for an individual (cross_payments). Calibration here is synthetic and circular (cand_aichat verification). |
| "CELPIP", "IELTS" or "CLB" in the brand, domain or ad text | Trademark risk to the only fast channel (cand_aichat verification, problem 12). |
| Sales outside Canada, or to Quebec | Foreign VAT would force a merchant of record (cross_payments). Quebec French-language and CPA distance-contract rules, and the statutory chargeback, are not addressed (cross_payments lists Quebec as an unknown). |
| A mobile app, game portal, Chrome extension, Etsy shop, newsletter, SEO/AdSense site, Telegram, Discord or Kakao bot, or Korean saju in this window | Verifier p5k is 0.1–0.5/10 for each. Store lag, unmonetized launches, crypto or late payouts, and owner-clerk labour (Judge 1 and Judge 2 eliminate lists). This covers the owner's "game" and "subscription app" examples. |
| Auto-posting to Reddit, TikTok, YouTube, Naver or X | Platform automation rules (cross_distribution). |
| A referral or affiliate programme, or a second product, before Nov 30 | Section 1.2. |
| Letting a Routine or Action spend money, change prices, send marketing or refund outside policy without an owner merge or approval | The owner carries CASL s.13, PIPEDA and Competition Act liability (cross_payments). Routines cannot approve pending actions (cross_operator). |
| Committing any user essay, transcript, email or other personal data to git; storing raw voice | PIPEDA 4.5.3 and 4.7 (cross_payments). Git history defeats deletion, and GitHub is not a disclosed processor. |
| Pushing `products/` or `business/online/` while the repo is public | The repo is public (cross_operator, first-hand). |
| Hosting on Vercel Hobby | Non-commercial use only (decision-memo.md F40). |
| Treating this product as income | Section 2. |

---

## 2. Honest odds

### 2.1 Base rates (all secondary unless marked)

| Base rate | Value | Source |
|---|---|---|
| Median new indie product MRR, year 0 | US$148. Only 0.9% are "breaking out". | TrustMRR n=5,079; opt-in and biased upward (cross_baserates) |
| Products earning $0 | >54% | ScrapingFish n=937, 2022 (cross_baserates) |
| Time to US$1K MRR among survivors | median 8 months | n=28, survivor-selected (cross_baserates) |
| Subscription apps reaching US$10k cumulative within 2 years | about 1 in 20 | RevenueCat, secondary (cross_baserates). ESTIMATE: averaging C$5k over 3 months = C$15k ÷ 1.37 ≈ **US$10.9k cumulative in 3 months**, so P is well below 5%. |
| New pages reaching Google's top 10 within a year | 1.74% | Ahrefs, updated 2026-04-27 (cand_aichat facts) |
| AI-built sites in their first months | 6–150 sessions/month; 4 of 4 rejected by AdSense | cand_seo verification |
| Google Ads cost per click | cross-industry **US$5.42**; Business Services US$5.87; US$66.69 per lead | WordStream 2026 (cross_baserates). CELPIP/CLB-specific CPC: **not found**. |
| Founders running ads | 57% wait 7+ months for a return, or cannot tell | Freemius (cross_distribution) |
| Fast success stories | Nearly all had an audience or founder-led posting; this owner has neither | cross_baserates |
| Autonomous AI operators | "still needed a great deal of human support" | Anthropic Project Vend (cross_baserates) |

**Plain statement.**
- No evidence in the bundle shows an owner with no audience, who does not post, averaging C$5k/month by January from a new online product.
- ESTIMATE (judgement): **well under 1%** for this plan. Even the top-decile case in 2.2 reaches about C$0.7k/month over Dec–Jan.

**Cannot be guaranteed:**
- any sale at all;
- Google Ads approval or tolerance of the trademark;
- Stripe approval without a reserve;
- Anthropic's reading of its policy;
- Service Canada's EI ruling;
- grading quality;
- whether iPhone recording works on every device;
- Routine or Action reliability. This repo's scraper was "green" for about 46 days while producing nothing (cross_operator).

### 2.2 Scenarios by month: Oct (setup), then Nov, Dec and Jan (months 1–3). All ESTIMATE.

**Common inputs** (from section 3):
- Net per 30-day sale after a 10% refund allowance: **C$27.7**.
- Net per 90-day sale: **C$56.4**.
- Fixed costs F: **C$100/month** (Claude Pro plan).
- Payers per visit = (visit → free sample) × (sample → paid).
- Ads run Oct 26 – Nov 8: Oct 6 days × 20 = **C$120**; Nov 8 days × 20 = **C$160**.
- "Rules applied" means that on Dec 26, K11 winds the product down if trailing-30-day net is below C$0. January is then about −C$9 to −C$12 (Workers C$6.85 + domain C$1.70 + API for remaining active passes).

| Case | Assumptions (no rate is sourced for this niche) | Oct | Nov (M1) | Dec (M2) | Jan (M3) |
|---|---|---|---|---|---|
| **Conservative: sourced CPC** | CPC = US$5.42 × 1.37 = **C$7.43** (WordStream). Visit→sample 5%, sample→paid 3% → 0.15% of visits pay; CAC = 7.43 ÷ 0.0015 ≈ C$4,953. K3 fires at C$280. Organic 0 / 30 / 60 / 100 (anchored below cand_seo's 6–150 range; no guides). | 16 clicks → 0.02 payers. 0.6 − 100 − 120 = **−C$219** | 22 clicks + 30 organic → 0.08 payers. 2 − 100 − 160 = **−C$258** | 60 × 0.0015 = 0.09 → 2 − 100 = **−C$98** | kept running: 0.15 × 27.7 − 100 = **−C$96**; rules applied **−C$9** |
| **Base: prior CPC** | CPC **C$1.50** [prior knowledge, unverified; Judge 1 range C$1–2]. Visit→sample 12%, sample→paid 6% → 0.72%; CAC = 1.50 ÷ 0.0072 = C$208 > 27.7, so K4 turns ads off on Nov 8. Organic 20 / 60 / 100 / 150. | 80 clicks + 20 organic → 0.72 payers × 27.7 = 20 − 100 − 120 = **−C$200** | 107 clicks + 60 organic → 1.2 payers → 33 − 100 − 160 = **−C$227** | 100 × 0.0072 = 0.72 → 20 − 100 = **−C$80** | kept running: 1.08 → 30 − 100 = **−C$70**; rules applied **−C$12** |
| **Upside: top-decile luck** | CPC **C$0.80**, visit→sample 25%, sample→paid 10.7% (the hard-paywall median, used as a ceiling) → 2.675%; CAC = C$29.9. 25% of buyers take the 90-day pass: blended net 0.75 × 27.7 + 0.25 × 56.4 = **C$34.9**, above CAC, so S0 holds at C$20/day. The ad cap binds (120 + 600 + 480 = C$1,200 around Dec 24). Organic 50 / 300 / 600 / 1,000. | 150 clicks + 50 organic → 5.35 payers × 34.9 = 187 − 100 − 120 = **−C$33** | 750 clicks + 300 organic → 28.1 payers → 981 − 100 − 600 = **+C$280** | 600 clicks + 600 organic → 32.1 → 1,121 − 100 − 480 = **+C$541** | 1,000 organic → 26.8 → 934 − 100 = **+C$834** (gross ≈ 26.8 × C$49 blended price = C$1,311) |

**Upside with written re-confirmation of more ad budget** (C$620 in Dec and in Jan): Dec **+C$564**, Jan **+C$937**. The ads barely pay for themselves at this CAC: margin 34.9 − 29.9 = C$5 per buyer.

**Averages and totals (ESTIMATE, rules applied):**

| Case | Nov–Jan average | 4-month total (Oct–Jan) |
|---|---|---|
| Conservative | (−258 − 98 − 9) ÷ 3 = **−C$122/month** | −219 − 258 − 98 − 9 = **−C$584** |
| Base | (−227 − 80 − 12) ÷ 3 = **−C$106/month** | **−C$519** |
| Upside | (280 + 541 + 834) ÷ 3 = **+C$552/month** | **+C$1,622** |

**Phase-1 detection power (ESTIMATE):**
- At the sourced CPC: C$280 ÷ 7.43 ≈ 38 clicks. Even at base conversion that is 38 × 0.72% ≈ 0.27 payers, with a CAC ≈ 7.43 ÷ 0.0072 ≈ **C$1,032**.
- At C$1.50: 187 clicks ≈ 1.3 payers.
- **Phase 1 can detect only catastrophic failure** (almost no one starts a free sample). It cannot prove profitability.

**What C$5k/month would take (ESTIMATE):**
- With paid acquisition: buyers N = (5,000 + F) ÷ (27.7 − CAC).
  - CAC C$10: 5,100 ÷ 17.7 = **288 buyers/month** and C$2,880 of ads.
  - CAC C$15: 5,100 ÷ 12.7 = 402 buyers.
  - CAC C$20: 5,100 ÷ 7.7 = 662 buyers and C$13,240 of ads.
- With no paid acquisition: 5,100 ÷ 27.7 = **184 new buyers every month**. Passes do not stack (cand_aichat verification, problem 3). With 30% taking the 90-day pass: 5,100 ÷ (0.7 × 27.7 + 0.3 × 56.4 = 36.3) = **140/month**.
- At C$1.50 CPC, a CAC of C$10 needs click→paid ≥ 1.50 ÷ 10 = 15%. Nothing in the bundle suggests that is reachable.

C$5k is **before income tax and self-employed CPP**. ESTIMATE of CPP at that level: (60,000 − 3,500) × 11.9% ≈ C$6,724/year ≈ C$560/month (decision-memo.md F9).

---

## 3. Unit economics

### 3.1 API cost per graded task

**Claude API prices** (official, per 1M tokens, from the task brief):
- Sonnet 5 (`claude-sonnet-5`): $2 in / $10 out.
- Haiku 4.5 (`claude-haiku-4-5`): $1 in / $5 out.
- Opus 5 (`claude-opus-5`): $5 in / $25 out.

**Caching** (claude-api skill `shared/prompt-caching.md`; model IDs from `shared/models.md`):
- Cache read = 0.1× input.
- Cache write = 1.25× input (5-minute TTL) or 2× (1-hour TTL).
- Minimum cacheable prefix: 1,024 tokens on Sonnet 5 and 4,096 on Haiku 4.5.

**Speech to text:** Workers AI `@cf/openai/whisper-large-v3-turbo` at **US$0.000513 per audio minute** (official cloudflare-docs repo, `whisper-large-v3-turbo.json`, fetched 2026-09-24).

| Route | Model and reason | Tokens (ASSUMPTION) | Warm cache | Cold (writes the cache) |
|---|---|---|---|---|
| Writing grade | Sonnet 5, with the rubric and anchors in a cached prefix of about 6,000 tokens | 6,000 cached + 500 in + 1,400 out | 0.0012 + 0.0010 + 0.0140 = **$0.0162** | 6,000 × 2.5/M = 0.0150 replaces 0.0012 → **$0.0300** |
| Speaking grade | Whisper-turbo (1.5 min), then Sonnet 5 | 6,000 cached + 600 in + 1,200 out | 0.0012 + 0.0012 + 0.0120 + 0.0008 = **$0.0152** | **$0.0290** |
| Guardrail pre-check | Haiku 4.5, uncached (the prompt is under the 4,096 minimum) | 700 in + 30 out | **$0.00085** | same |
| Offline work (synthetic eval set, prompt review) | Opus 5 / Sonnet 5 via the Batch API (50% off) | — | in F | — |

**Caching setup.**
- One explicit `cache_control` breakpoint at the end of each task-type prefix, with a 5-minute TTL.
- Move to the 1-hour TTL only if logs show 5–60 minute gaps between calls sharing a prefix. Per the skill, a 1-hour write needs at least three requests to pay off.
- Log `cache_creation_input_tokens` and `cache_read_input_tokens` on every call.

**Cost per 30-day pass holder (ESTIMATE).** The usage figure of 40 writing + 80 speaking tasks is carried over from the dossier and is not sourced. Each task includes the guardrail call.
- Warm: 40 × 0.017 + 80 × 0.016 = **US$1.96** (C$2.69).
- Cold: 40 × 0.031 + 80 × 0.030 = **US$3.64** (C$4.99).
- At the fair-use cap: 150 × 0.031 = US$4.65 = **C$6.37**.

> **Revised during the build (2026-09-24, see §7.1).** The shipped grader differs from this table: one call to
> `claude-opus-5` (the Claude API guidance's default; the owner may switch to `claude-sonnet-5` with `GRADER_MODEL`), with
> adaptive thinking, so output tokens include thinking. The review's ESTIMATE from the committed test fixtures (short
> essays, so real use is likely higher): about 1,950 cached + 527 input + 1,576 output tokens per writing grade, i.e.
> **≈ US$0.043 warm / ≈ US$0.054 cold on Opus 5** and **≈ US$0.017 on Sonnet 5**. On Opus 5 a 30-day pass holder at the
> dossier's 120 tasks costs roughly **US$5.2–6.5 (C$7.1–8.9)** instead of C$2.69–4.99, so §3.2 net per C$39 pass falls to
> roughly C$24–29 (ESTIMATE). These numbers must be replaced by measured usage from the weekly eval and the first live weeks.

### 3.2 Per-sale economics (ESTIMATE)

| Line | C$39 30-day pass | C$79 90-day pass |
|---|---|---|
| Stripe fee, 2.9% + C$0.30 (secondary, cross_payments; one-time payment, so no Billing fee) | 1.131 + 0.30 = **1.43** | 2.291 + 0.30 = **2.59** |
| API (3.1; the 90-day pass assumed to cost 2× a 30-day pass) | 2.69–4.99 | 5.37–9.97 |
| Free-sample cost carried per buyer: one cold writing + speaking sample = US$0.061 = C$0.084; divided by conversion: 1 ÷ 0.107 = 9.35 samplers per buyer, 1 ÷ 0.03 = 33.3 | 0.79–2.80 | 0.79–2.80 |
| **Net before refunds** | 39 − 1.43 − 4.99 − 2.80 = 29.78 to 39 − 1.43 − 2.69 − 0.79 = 34.09 → plan **C$31** | 79 − 2.59 − 9.97 − 2.80 = 63.64 to 70.25 → plan **C$63** |
| Floor at the fair-use cap | 39 − 1.43 − 6.37 − 2.80 = **C$28.40** | — |
| **Refunds** at 10% (the K7 threshold). Revenue is lost; Stripe keeps its fee [prior knowledge, unverified]; up to 5 tasks are used (5 × 0.031 × 1.37 = C$0.21) | 0.9 × 31 − 0.1 × (1.43 + 0.21) = **C$27.7** | 0.9 × 63 − 0.1 × (2.59 + 0.21) = **C$56.4** |
| Gross margin on kept sales | 31 ÷ 39 = **79%** | 63 ÷ 79 = **80%** |

**Also counted:**
- Automatic refunds to buyers outside Canada or in Quebec lose the fee: ESTIMATE ≤ C$1.43 each. The country check before checkout (B6) should keep these rare. No rate was found.
- The self-refund is allowed once per email and per card fingerprint, so it cannot be used as a repeating free trial.
- The Stripe dispute fee in Canada was not found.

### 3.3 Hosting and fixed costs per month (ESTIMATE)

| Item | US$ | C$ | Source |
|---|---|---|---|
| Claude Pro, for Routines (Max 5x if the cap is hit: US$100) | 20 (100) | 27.40 (137) | secondary (cross_operator) |
| Cloudflare Workers Paid (static assets free and unlimited; D1 included) | 5 | 6.85 | official (cross_operator) |
| Anthropic API for dev and eval (Batch) | 30 | 41 | ESTIMATE allowance |
| Domain (about C$20/year) | — | 1.70 | [prior knowledge, unverified] |
| Virtual mailbox or PO box | — | 0–30 | [prior knowledge, unverified] (cand_aichat) |
| Resend, free tier | 0 | 0 | [prior knowledge, unverified] |
| **F** | | 27.40 + 6.85 + 41 + 1.70 + 0–30 = **C$77–107**; with Max 5x, C$187–217. Plan figure: **C$100** | |

### 3.4 Paying users needed and cash at risk

**Buyers needed for C$5k/month net (ESTIMATE):**

| Case | Buyers per month |
|---|---|
| No ads, 30-day passes only | 5,100 ÷ 27.7 = **184** |
| No ads, 30% take the 90-day pass | **140** |
| Ads at CAC C$10 / 15 / 20 | 288 / 402 / 662 |

**Cash at risk over the 4 billed months, Oct–Jan (ESTIMATE):**

| Item | C$ |
|---|---|
| Claude Pro + Workers Paid: 4 × (27.40 + 6.85) | 137 |
| API for dev and eval (cand_aichat range) | 70–200 |
| Free-sample spend, worst case (cap of US$40/month × 3.5 months × 1.37) | 0–192 |
| Domain | 20 |
| Mailbox: 4 × 0–30 | 0–120 |
| Ontario business-name registration fee [prior knowledge, unverified] | 0–60 |
| Human rater | 0 (bands stay off) |
| **Subtotal without ads** | **C$227–729** |
| If Max 5x is needed: 4 × (137 − 27.40) | +C$438 |
| Ad cap | +C$1,200 |
| **Worst case** | 729 + 438 + 1,200 ≈ **C$2,367** |

K10 (section 6) stops everything at a cumulative net loss of C$1,500.

**Anthropic spend limits (fixes a lock-out risk):**
- Monthly limit = **max(US$150, 30% of trailing-30-day gross in USD)**. ESTIMATE: worst-case API use is about 20% of gross (cold C$4.99 + samples C$2.80 on a C$39 sale), plus a margin.
- The KPI Routine proposes each raise as a PR for the owner to approve.
- How spend-limit settings work in the Console is [prior knowledge, unverified].
- The Worker enforces the tiers in B10: free samples stop first, paid grading keeps running.

---

## 4. Owner tasks

### 4.1 One-time setup, in order

All times are ESTIMATES.

| # | Task | Time | Notes |
|---|---|---|---|
| 1 | **Gate 0:** check IRCC documents for the right to self-employ | 0.25 h | Income-floor task (decision-memo.md Gate 0) |
| 2 | **Gate B:** paste the live AUP text into an issue; send the AI-drafted email to Anthropic; sign the risk-acceptance line | 0.25 h | Section 1.3 |
| 3 | **Make the GitHub repo private** | 0.1 h | It is public and exposes `business/03-EI-결정규칙.md` (cross_operator, first-hand). Private repos get 2,000 free Actions minutes/month (github/docs). Pushes before then carry no secrets or user data (see 5.1). |
| 4 | Dedicated business Google account and email | 0.5 h | Keeps suspensions away from personal accounts. Also receives the Ads reports. |
| 5 | Keep or buy **Claude Pro**. Allowlist `api.stripe.com`, `api.cloudflare.com` and `api.resend.com` in environment settings, or accept that live operations run only in Actions. Connect Gmail to the Routines. | 0.5 h | These hosts are blocked from this session (cross_operator) |
| 6 | **Anthropic Console:** API key, monthly limit US$150, alerts, key stored as a GitHub secret | 0.5 h | Limit mechanics are [prior knowledge, unverified] |
| 7 | **Cloudflare:** account, Workers Paid (US$5), domain, scoped API token stored as a secret | 1.0 h | Read the commercial-use terms (decision-memo.md F40) |
| 8 | **EI application**, with self-employment activity declared | 1.0 h | Income-floor task; by Sat Oct 10 (F1). EI Act s.38(1)(c). |
| 9 | **Service Canada call** describing both activities | 0.5–1.5 h | Hold times [prior knowledge, unverified]. **Tasks 11 and 15 happen only after this call.** |
| 10 | **ServiceOntario business-name registration** if trading as "[Brand]"; otherwise use the legal name everywhere (0 h) | 0–0.5 h | SOR/2012-36 s.2(1)(d) requires the business name in every commercial email (decision-memo.md F13). The registration rule is [prior knowledge, unverified] (decision-memo.md Q5). |
| 11 | **Stripe Canada:** ID check, bank, SIN. **Live and test** restricted keys, plus live and test webhook secrets, stored as secrets. Radar rule blocking non-CA cards if available. | 1.5 h | Radar availability is [prior knowledge, unverified]. The server-side checks in B6 work without it. |
| 12 | **Resend:** account and API key (the AI adds DNS records through the Cloudflare token) | 0.5 h | |
| 13 | **Virtual mailbox or PO box** for CASL emails and the privacy policy | 0.75 h | Whether a PO box suffices is not stated (F13) |
| 14 | **Read and approve** the privacy policy, terms (including "Not available in Quebec"), refund policy, AI disclosure, not-affiliated notice and the 8–10 product pages. Korean summaries are provided. | 1.0 h | The owner is the accountable person under PIPEDA (Sched. 1, 4.8.2) |
| 15 | **Google Ads** (only if Gate C passes): account, billing, C$20/day budget, **campaign end date Nov 8**, import the AI-built CSV, conversion tag, **scheduled daily performance email** to the business Gmail | 1.65 h | Scheduled reports and end dates exist [prior knowledge, unverified]. Advertiser-verification time: not found. |
| 16 | Search Console verification (the AI prepares the DNS). Bing is deferred. | 0.15 h | |
| 17 | **Launch day:** one real C$39 purchase and self-refund; record one speaking task on an iPhone | 0.35 h | End-to-end check of money flow and iOS audio |

**Total (ESTIMATE).**
- Adding every row: 0.25 + 0.25 + 0.1 + 0.5 + 0.5 + 0.5 + 1.0 + 1.0 + (0.5 to 1.5) + 0.5 + 1.5 + 0.5 + 0.75 + 1.0 + 1.65 + 0.15 + 0.35 = **11.0–12.0 h. That is over the ≈10 h budget.**
- Rows 1, 8 and 9 (1.75–2.75 h) are income-floor tasks that decision-memo.md already requires. The online product's own share is **≈9.25 h**.
- If the owner counts every row, bring it under 10 h by:
  - trading under the legal name (−0.5 h), and
  - dropping Google Ads (−1.65 h). This moves the product to organic-only mode, which is the conservative case or worse.
- Result: 11.0–12.0 − 2.15 = **8.85–9.85 h**.
- K2 (section 6) triggers if setup exceeds 12 h.

**Tax and GST/HST.**
- Do not register for GST/HST. The owner is a small supplier until taxable supplies pass C$30,000 over four quarters, and must apply within 30 days after crossing (ETA s.148, s.240(2.1)).
- Voluntary registration is not recommended (cross_payments). No QST applies, because Quebec is excluded.
- Report income on T2125: file by 2027-06-15 and pay by 2027-04-30. CPP is 11.9% above $3,500. Instalments are not required if tax owing is ≤$3,000 (decision-memo.md F9–F10).
- Keep receipts. The 6-year retention period is [prior knowledge, unverified].

**Privacy (PIPEDA; cross_payments "PIPEDA DESIGN").**
- Audio is transcribed, then discarded.
- Essays and transcripts live only in D1 and are purged 90 days after the user's last activity.
- Users have a delete-my-data button.
- **User text never enters git, logs, metrics exports or Routine prompts.**
- The privacy policy lists processors: Anthropic, Cloudflare, Stripe, Resend, and Google (the Ads conversion tag). It names the owner as the accountable person and gives the mailbox address.
- Keep a breach log for 24 months. Users must confirm they are 18+.

### 4.2 Weekly tasks (target ≤ 180 min)

| Task | Minutes per week (ESTIMATE) |
|---|---|
| Read the Monday KPI and cost digest (Korean and English); reply yes or no to each proposal | 20 |
| Ads: import the AI-updated CSV; approve or deny cap changes (only while ads run) | 0–20 |
| Escalations: refunds outside policy, disputes (submit Stripe evidence), anything flagged as legal | 10–30 |
| Review and send the Routine's support drafts (≈1 min per draft, cross_operator ESTIMATE; 10–30 drafts) | 10–30 |
| EI bi-weekly report using the AI's weekly net figure (10 min every 2 weeks) | 5 |
| Confirm Stripe payouts reached the bank | 5–10 |
| Monthly books check (15 min/month) | 4 |
| Platform appeals: Ads policy, Stripe requests (incident weeks only) | 0–30 |
| Optional: spot-check 5 graded outputs, if the owner's English allows | 0–20 |
| **Total** | low: 20 + 0 + 10 + 10 + 5 + 5 + 4 + 0 + 0 = **54 min**; high: 20 + 20 + 30 + 30 + 5 + 10 + 4 + 30 + 20 = **169 min**. That is **0.9–2.8 h**, under the 3 h cap. |

There are no guide merges, tutor emails or referral payouts, because those channels are dropped.

---

## 5. AI tasks

### 5.1 This session's build list

**Limits of this session.**
- It **cannot deploy or call live services**: egress to Stripe, Cloudflare and Resend is blocked, and there are no Anthropic or Cloudflare keys (cross_operator).
- "Done" in this session means **acceptance level A**: both builds pass, vitest passes with Stripe, Anthropic and Workers AI mocked through `fetch`, fixtures exist, `wrangler deploy --dry-run` passes if wrangler can be installed, and no secrets are in the repo.
- **Acceptance level B** (live checks) runs in GitHub Actions after the owner adds secrets.
- **Push rule (revised 2026-09-24):** the GitHub API still reports the repo as `public`. The session's instructions require pushing to the working branch, so work is pushed there, but only content with **no secrets, keys, tokens or user data** (checked by a grep before each push). Making the repo private remains owner task 3 and should happen before launch, because the grading prompt and ops files are business assets.

**Build order by priority:**
- **P0:** read `node_modules/next/dist/docs/` (static exports, route handlers, metadata/JSON-LD; required by AGENTS.md). Then B16 (root config isolation), B0, B2, B3, B5, B6, B10, and the B15 unit tests.
- **P1:** B4 (speaking pipeline, including iOS), B7, B8 (including ads-spend ingestion), B11 (CI/CD workflows), and B1 in full (including the 8–10 product pages and legal pages).
- **P2:** B12 (eval harness, with **synthetic data generated by a committed script**, not committed data), B13 (ads CSV), B14 (Routine prompts), and the owner checklist in Korean at `business/online/owner-setup.md`, mirroring 4.1 and including the risk-acceptance line.
- **Deferred until S3:** the guide/content engine and extra explanation languages.

Routine triggers are created with `create_trigger` only after the owner says yes.

### 5.2 Recurring operations

Architecture (cross_operator): the Worker runs time-critical jobs, GitHub Actions hold the secrets, and Routines are the "brain" that opens PRs. Every job is idempotent, because Routines have documented double-fire bugs (CHANGELOG, cross_operator).

| Runner | Job | Cadence | Outcome assertion (not job status) |
|---|---|---|---|
| Worker cron | Spend and error monitor; sets KV flags through the B10 tiers; emails alerts | every 15 min | Month-to-date spend < tier; 5xx rate < 2% |
| Worker cron | Retention purge (older than 90 days); daily **aggregate** metrics snapshot into D1 | daily 05:00 UTC | Purge count is logged; the snapshot row exists |
| Actions | Test, build, deploy (staging on PR, production on `main`), plus a root-site diff job | on push | `/api/health` returns 200; a static page returns 200; the root `out/` file list is unchanged |
| Actions | Export aggregate metrics JSON to `ops/metrics/`; a CI grep rejects any email, essay or transcript field | daily (GitHub cron can start up to 11.9 h late; cross_operator) | File dated today; counts present |
| Actions | Stripe ↔ D1 reconciliation | daily | 0 unmatched, otherwise an issue is opened |
| Actions | Grading eval on the synthetic set (Batch) | weekly, and on every prompt PR | B12 thresholds |
| Actions | Dependency audit | weekly | No high-severity findings |
| Routine (Pro, ≈1.4 runs/day, within the secondary 5/day cap) | **Daily ops:** read the Google Ads report email through Gmail and commit `ops/metrics/ads.json`; read metrics; open anomaly issues; draft support replies as Gmail drafts | daily | `ads.json` is fresh; if it is older than 48 h while ads run, alert the owner to pause ads in the Google Ads app (the Worker cannot pause Google Ads) |
| Routine | **KPI and rules:** weekly report (EN/KO); evaluate the section 6 rules; propose the ads CSV and any Anthropic-limit raise as PRs | Mon | Rule-verdict line present |
| Routine | **Eval review:** examine failures in the **synthetic set only**; propose prompt fixes as a PR, merged only if the eval passes | weekly | — |
| Routine | **Books:** T2125 export, GST four-quarter tracker, EI weekly net | monthly / bi-weekly | Totals reconcile to Stripe payouts |
| Routine | **Nov 30 go/pivot memo** and **Dec 26 Day-90 memo** | once each | — |

---

## 6. 90-day plan (Day 1 = Mon Sep 28)

| Week | Dates | Milestones | Gate |
|---|---|---|---|
| W1 | Sep 28 – Oct 4 | Owner: tasks 1–7. AI: P0 build, legal drafts, AUP comparison. | **Day 7: Gate C decided. Gate 0 part 1.** Gate B: if the live text clearly covers practice tools, switch to Apify. |
| W2 | Oct 5–11 | **EI filed by Sat Oct 10. Service Canada call by Fri Oct 9.** Then tasks 10–13. AI: P1 build. | Service Canada result and hours rule (1.3) |
| W3 | Oct 12–18 | Owner: tasks 14–16. AI: P2 build, production deploy with checkout off, level-B checks in Actions. | **Day 21 (Oct 18):** all level-B checks green. Gate B launch rule applied. |
| W4 | Oct 19–25 | **Soft launch:** checkout on; task 17 | Real payment → entitlement → refund works |
| W5 | Oct 26 – Nov 1 | **Ads phase 1 at C$20/day** (only if Gate C passed and Service Canada has been called) | **K1: checkout live by Sun Nov 1** |
| W6 | Nov 2–8 | Campaign ends Nov 8 on its own | **K3 / K4** on Nov 8 |
| W7 | Nov 9–15 | Landing or paywall copy: one change per week, through config | **K5 on Nov 15** |
| W8–9 | Nov 16–29 | Iterate; resume ads only if an S rule allows and within the cap | K7–K10 run continuously |
| W10 | Nov 30 – Dec 6 | **Nov 30 memo** | **K6** |
| W11–12 | Dec 7–20 | Optional A/B test of C$29 vs C$39 for the 30-day pass, only if sample→paid < 5% | S rules |
| W13 | Dec 21–27 | **Day-90 review (Dec 26)** | **K11** |
| Jan | Jan 1–31 | Continue, maintain, or wind down. **Final review Jan 31.** | K11 again |

**Kill rules** (all numeric; the KPI Routine evaluates them and the owner confirms):
- **K1, schedule:** checkout not live by **Sun Nov 1** → stop and return to decision-memo.md.
- **K2, owner hours:** more than 3 h/week in any two weeks, or setup above 12 h → cut to the core: no ads, organic only.
- **K3, upper funnel:** once C$280 of ads is spent, fewer than **10 free samples started from paid clicks** → ads off. One landing fix and one retest (≤C$140, within the cap) are allowed. At the sourced CPC this fires (38 clicks × 5% ≈ 2 samples); at C$1.50 it does not (187 × 12% ≈ 22).
- **K4, CAC:** rolling 14-day CAC above the **measured blended first-sale net** (plan C$27.7–34.9) → ads off.
- **K5, Nov 15:** fewer than **100** free samples from all channels → switch the keyword set, within the cap. Fewer than **30** → niche review at Nov 30.
- **K6, Nov 30:** November net < **C$500** with no week-over-week growth → all spend stops; maintenance mode; **no second product**. Net ≥ C$500 → continue, and a second product may be considered for month 4.
- **K7, refunds and disputes:** refunds > 10% of sales (once there are ≥20 sales), or disputes > 0.75% [threshold: prior knowledge, unverified] → checkout and ads paused; grading review.
- **K8, API cost:** API cost above 20% of revenue for 7 days → tighten per-user caps.
- **K9, platform:** Google Ads suspension, or a Stripe reserve or rejection → organic only. A second platform failure → stop.
- **K10, stop-loss:** cumulative net loss (fixed + ads + API − revenue) above **C$1,500** → stop.
- **K11, Dec 26 and Jan 31:** trailing-30-day net below **C$0** → wind down.
  - Wind-down means checkout, ads and Routines off, and Claude Pro cancelled.
  - The Worker and grading keep running until the last active pass expires, or pro-rata refunds are given.
  - Net of **C$0–1,000** → maintenance (no ads). Net ≥ C$1,000 → continue.

**Scale rules.** LTV is taken as the measured first-sale net, because the repurchase rate is unknown. **Total ad spend to Jan 31 is capped at the Gate C amount (C$1,200) unless the owner re-confirms in writing.** Re-confirmation means an owner-merged PR editing `ops/config/ad-cap.json`.
- **S0:** CAC between C$15 and first-sale net → hold at C$20/day.
- **S1:** CAC C$9–15 → up to C$30/day.
- **S2:** CAC ≤ first-sale net ÷ 3 (≈ C$9.2) on ≥20 purchases → the owner may raise the cap to C$60/day; re-checked weekly.
- **S3:** ≥30 organic buyers a month → the owner may hire a qualified reviewer (certified ESL or test-prep instructor; cost not found) to restart guide pages (≤3 per ISO week, CI gate) and to review other explanation languages.

---

## 7. Build spec

**Architecture.**
- Next.js is used as a **static export** (the repo's existing pattern, `next.config.ts`). **One Cloudflare Worker** serves the exported assets and handles `/api/*`.
- Reasons:
  - Static export cannot use request-dependent Route Handlers, cookies, Proxy or Server Actions (local docs, `01-app/02-guides/static-exports.md`).
  - Cloudflare's integration is "not a verified adapter" (`01-app/01-getting-started/17-deploying.md`).
  - Static asset requests on Workers are free and unlimited (official, cross_operator).
- **The home-services site stays reachable (not archived).** The root app and `out/` are untouched, along with whatever deployment it already has. It is the owner's fallback plan.
- There is no `.github/workflows` today, so CI for the root site is new work (B11).

**Acceptance levels:** A = checked in this session (mocked services). B = checked in Actions after the owner adds secrets.

| # | Component | Spec | Acceptance |
|---|---|---|---|
| **B16** (first) | Root isolation | Edit only three root files: add `"products"` to `tsconfig.json` `exclude`; add `'products/**'` to `vitest.config.mts` `test.exclude`; add `"products/**"` to `eslint.config.mjs` `globalIgnores`. No other changes to root `app/`, `components/`, `content/` or `out/`. | A: root `npm run build`, lint and vitest pass; the `out/` file list is identical to `main`. B: the CI job diffs the `out/` file list on every PR. |
| **B0** | Layout | `products/clb/` has its own `package.json` (Next 16.2.3, React 19.2.4, as at the root) and `next.config.ts` (`output:'export'`, `trailingSlash:true`). `products/clb/worker/` has `src/index.ts` and `wrangler.jsonc` with bindings `DB` (D1), `FLAGS` (KV), `AI` (Workers AI) and `ASSETS` (`../out`; the Worker runs first for `/api/*`). Config key names are [prior knowledge, unverified]; check them against cloudflare-docs on GitHub. | A: both builds pass; a secret grep is clean; dry-run if installable. B: `wrangler deploy` to staging. |
| **B1** | Pages (static) | `/`, `/ko/`, `/pricing/` (with "Not available in Quebec"), `/practice/writing/[task]/` and `/practice/speaking/[task]/` via `generateStaticParams` (2 + 8), `/login/`, `/auth/verify/`, `/account/`, **`/checkout/success/`**, **`/checkout/cancel/`**, `/formats/` and `/help/` (8–10 product-documentation pages), `/legal/{privacy,terms,refunds,ai-disclosure,not-affiliated}/`, `/status/`. AI-disclosure banner on every practice page. 18+ confirmation. **No `/guides/`.** | A: export succeeds; each practice page renders "You are getting feedback from an AI (Claude)" before submission (test). B: Lighthouse mobile performance ≥ 85 on `/`. |
| **B2** | Auth | Magic link. `POST /api/auth/magic-link`: Turnstile, ≤3 per hour per email, SHA-256-hashed token, 15-minute TTL. `POST /api/auth/verify` sets an HttpOnly, Secure, SameSite=Lax cookie (30 days) backed by a D1 session. Logout endpoint. CASL: an unticked marketing box naming purpose, sender and withdrawal right; stored with a timestamp and text version. | A: token is single-use and expires; the session rotates; the marketing flag is false unless ticked (unit tests). |
| **B3** | Grading | `POST /api/grade/writing`: auth + entitlement or free credit → caps → Haiku 4.5 guardrail (50 max tokens). Immigration, legal or CRS questions get a fixed refusal pointing to CICC-licensed consultants or lawyers. Then `claude-sonnet-5` with the cached task prefix (≥1,024 tokens, explicit breakpoint), user text delimited and treated as data, JSON output (`criteria[]`, `topErrors[]`, `rewrites[]`, `explanationLang ∈ {en,ko}`, `bandShown:false` constant), max_tokens 1,500. Usage and cost in micro-USD written to a `grades` row. **Output filter** blocks "official", "guarantee", "CLB", "band", "level", "score", "accurate", "aligned" and any number presented as a result. | A (mocked): 20 golden inputs give schema-valid JSON; the guardrail catches 10 of 10 immigration probes and refuses **≤1 of 20 benign immigration-themed essays**; the filter strips every forbidden term; a cost row exists for every call. B: cache-read tokens > 0 on the second call within 5 minutes. |
| **B4** | Speaking | `MediaRecorder.isTypeSupported` picks **`audio/webm;codecs=opus` or `audio/mp4`** (iOS Safari produces mp4/AAC [prior knowledge, unverified]). ≤120 s, ≤3 MB → `POST /api/grade/speaking` → `@cf/openai/whisper-large-v3-turbo` (input per the model schema: base64 audio or `{body, contentType}`, as the reviewer read cloudflare-docs; re-check) → Sonnet grader. Audio is never stored. The UI says pronunciation and fluency are not assessed from a transcript (cand_aichat verification). | A: MIME selection unit test; Playwright **WebKit** and Chromium tests with a mocked `/api`; no D1 write contains audio. B: 60-second webm and mp4 clips each graded in < 20 s; owner iPhone check (task 17). |
| **B5** | Free sample and abuse | Anonymous writing sample: Turnstile + device cookie + hashed IP /24 limit (1 per device, 3 per IP per day). Speaking sample only after email verification. **Free budget US$2/day and US$40/month** → KV `free_enabled=false`. Disposable-email blocklist. | A: the second anonymous sample from the same device is refused; a simulated budget trip flips the flag. |
| **B6** | Payments | `POST /api/checkout` (auth; SKU `pass30`/`pass90`; "I live in Canada, outside Quebec" checkbox). It **refuses unless `request.cf.country=='CA'` and `request.cf.regionCode!='QC'`** [field names: prior knowledge, unverified] → Stripe Checkout via REST: mode `payment`, `billing_address_collection=required`, `client_reference_id`, metadata. `POST /api/stripe/webhook` verifies `Stripe-Signature` (HMAC-SHA256 via WebCrypto, 300 s tolerance [prior knowledge, unverified]) and is idempotent on `event.id`. **On `checkout.session.completed`:** retrieve the PaymentIntent's latest charge; grant the pass only if billing country == 'CA' **and** billing state != 'QC' **and** `card.country == 'CA'`; otherwise refund and email. Store the evidence fields. Grant starts now or extends an active pass. **`charge.refunded` / `charge.dispute.created`:** revoke and flag. `POST /api/refund-request`: ≤14 days, ≤5 tasks, **once per email and card fingerprint** → refund → revoke. | A (mocked fetch + signed fixtures): grant, extend, refund, dispute, non-CA, QC, foreign card, duplicate event, second self-refund refused. Entitlement is checked server-side on every grade call. B: the same cases with Stripe CLI test events in Actions using **test keys**. |
| **B7** | Account and privacy | `GET /api/me`. `POST /api/account/delete` removes essays, transcripts and profile but keeps payment records. `POST /api/support` stores a ticket and forwards to the owner. | A: deleting an account removes all of that user's `grades` rows. |
| **B8** | Analytics | Cloudflare Web Analytics (cookieless [prior knowledge, unverified]). D1 `events`: landing (utm, gclid), sample_start, sample_done, signup, checkout_start, purchase, refund. Ads conversion tag on `/checkout/success/`, disclosed in the privacy policy. **Ads spend:** `ops/metrics/ads.json` from the Routine reading the scheduled Ads email; fallback is a weekly owner CSV upload (5 min). CAC = spend ÷ purchases with gclid. | A: the daily JSON funnel reconciles to fixture purchases ±0; parsing of `ads.json` is tested. B: live reconciliation against Stripe. |
| **B9** | Product pages and SEO basics | Sitemap, metadata and JSON-LD for B1 pages (local Next docs). IndexNow ping from Actions. CI content lint on every page: no forbidden claim; trademarks only descriptive, with the not-affiliated line; `lastReviewed` date. **No article engine.** | A: the lint fails on a fixture containing "official CLB score". |
| **B10** | Admin and kill switches | No admin UI. KV flags `free_enabled`, `grading_enabled`, `checkout_enabled`, `band_enabled` (false through Jan 31) and `banner`, toggled through an Actions `workflow_dispatch` (usable from the GitHub mobile app) and by the Worker cron. **Spend tiers** against the Anthropic monthly limit L = max(US$150, 30% of trailing-30-day gross): ≥70% of L → free samples off and owner alerted; ≥95% → alert and a PR proposing a raise; daily anomaly cap max(US$15, L ÷ 10) → grading paused and passes extended by the pause length. Per-user caps: 15 writing + 30 speaking per day; 150 per 30 days. | A: simulated spend at 90% of L turns free samples off **while paid grading stays on**; the daily cap returns a 503 maintenance JSON and logs the extension. |
| **B11** | CI/CD | `ci.yml` (lint, vitest, both builds, root `out/` diff), `deploy.yml` (wrangler + D1 migrations + smoke test + rollback on failure), `flags.yml`, `metrics.yml` (with a personal-data grep), `reconcile.yml`, `eval.yml`. Monitoring asserts outcomes (cross_operator conclusion 8). | A: workflows lint (actionlint if installable). B: a failed smoke test rolls back; a missing metrics file emails an alert. |
| **B12** | Eval | `scripts/gen-synthetic-eval.ts` produces 60 writing + 60 speaking samples through Opus 5 Batch at run time; the output lives in an Actions artifact, not in git. Checks: schema validity ≥98%; forbidden claims = 0; the same input graded 3× gives the same top-3 error categories on ≥80% of samples (ESTIMATE threshold). **No user-generated text is ever used or committed.** No band calibration in this window: AI-labelled targets are circular (cand_aichat verification). | A: harness runs on 5 committed hand-written fixtures. B: weekly run; any prompt PR that drops a metric by >5 points fails. |
| **B13** | Ads files | `ops/ads/google.csv`: ad groups by task type; phrase and exact intent keywords (e.g. "english writing practice test canada"); trademark keywords only if policy allows [prior knowledge, unverified], never in ad text. Negatives: free, pdf, jobs, immigration consultant. **Geo: Canada excluding Quebec.** C$20/day; end date Nov 8. | A: lint finds no "CELPIP", "CLB", "official", "guarantee", "score" or "accurate" in any ad line. B: import succeeds (owner). |
| **B14** | Ops Routines | `ops/routines/{daily,kpi,eval,books,nov30,day90}.md`. Each is stateless, reads and writes only repo files and aggregate metrics, never reads user text, and ends with an assertion line. | A: a dry run of each prompt against fixtures produces its artifact. |
| **B15** | Tests | Vitest for pricing, entitlement, caps and tiers, cost calculator, webhook signature and idempotency, refund policy (including once-only), CA/QC/card checks, CASL text, guardrail routing including false positives, output filter. Worker integration tests with Miniflare / the Workers vitest pool [prior knowledge, unverified]. Playwright on Chromium and WebKit: sample → signup → checkout (mocked in A, Stripe test mode in B) → grade → refund. | A: all green; coverage ≥80% on `worker/src/billing` and `worker/src/caps`. B: E2E green against staging. |

---

### 7.1 Amendments made during the build and review (2026-09-24)

These replace the matching parts of the table above. Each came from a build or review finding; tests cover them.

- **B0.** `products/clb` runs `next` **16.3.6** (16.2.3 has a critical advisory); test tooling is pinned through npm
  `overrides`; `npm audit` is clean. The root site stays on 16.2.3 because B16 requires its output to stay identical — the
  owner decides on that upgrade (owner-setup).
- **B16.** A fourth root file changed: `app/globals.css` gained `@source not` lines for `products/`, `ops/`, `.github/`
  and `business/online/`. Tailwind 4 scans every non-ignored file, and without these lines the new documents added classes
  to the root CSS. With them, the root `out/` is byte-identical to commit `47f9414` (268 files, build id normalised).
- **B3.** One grader call instead of a Haiku 4.5 pre-check plus a Sonnet 5 grader. The structured output has a `refused`
  flag; out-of-scope (immigration/legal advice) requests get a **fixed** bilingual refusal pointing to a CICC-licensed
  consultant or a lawyer, never model-written text. Default model `claude-opus-5` (see the 3.1 note); `GRADER_EFFORT` and
  `GRADER_MAX_TOKENS` are owner-tunable after an eval sweep. At most three top errors, as the pages say. The guardrail
  acceptance numbers (10/10 probes, ≤1/20 benign refusals) can only be measured live (B12 eval), not with mocks.
- **B10.** A cap slot is reserved atomically before every model call (a pending `grades` row), so parallel requests cannot
  exceed the caps. Requests that give no feedback (refusals, failures) do not count toward the fair-use caps but are
  limited to 10 per user per UTC day, which bounds one account's model spend. Spend tiers use
  `min(formula L, the Anthropic Console limit)` when the owner sets that limit. **Any** grading pause (automatic or the
  owner's) extends active passes; the cron never re-enables a switch the owner turned off.
- **B6.** Card payments only; the Stripe API version is pinned; partial refunds and failed refunds are handled; the buyer
  agrees to the terms version shown next to the button, which is stored with the purchase.
- **B7.** Account deletion de-identifies grade rows (text, user id and device id removed) instead of deleting them, so
  the cost ledger that drives the spend tiers stays correct. Saved answers and feedback are viewable from the account page
  until the 90-day purge.
- **B2 / CASL.** Every learner email carries an unsubscribe link (no sign-in; hashed id + HMAC). The server writes the
  consent text itself and records opt-in only when the link is opened on the requesting device and the mailing address is
  configured; deploys fail without `MPC_MAILING_ADDRESS`.
- **B11 / level B.** Automated level-B checks: staging deploy + smoke test, the prompt-cache check (B3) and a
  Lighthouse mobile check on `/` (B1) in the "Level-B checks" workflow. Still **manual owner checks** before Day 21
  (listed with pass criteria in owner-setup.md): the test-mode purchase / refund / dispute on staging (B6), speaking
  latency with 60-second clips on a real phone and desktop (B4), a signed-in walkthrough of staging (B15), and the B11
  rollback **drill** on staging (a manual `deploy.yml` run with `rollback_drill`, which fails the smoke test on purpose
  and must end rolled back; the rollback path has never run against Cloudflare before this drill). Staging is
  locked to the owner's email (`STAGING_ALLOWED_EMAILS`: sign-in links only to listed addresses, no anonymous grading),
  never receives the production Anthropic key, and is capped at the eval workspace limit.
- **B12 / B15 review loop.** Two review rounds (6 lenses, then 3) found 70 and 9 issues (1 critical, a spend bypass
  through refused requests); all were fixed with tests. A third, regression-only round on the round-2 changes found one
  more (the rollback path was never exercised), fixed with the drill above. No live service (Stripe, Anthropic, Cloudflare, Resend) was
  called from this session.
- **B14.** Routines never read essays or transcripts. The daily Routine may read support emails **inside Gmail** to draft
  replies for the owner to review; the privacy page discloses this.

## 8. Risks, mitigations and unknowns

| Risk | Mitigation |
|---|---|
| **Demand and CAC.** CELPIP/CLB CPC was not found, and the sourced cross-industry CPC (C$7.43) makes paid acquisition unprofitable at this price | Capped phase 1 with an automatic end date; K3/K4; ad cap C$1,200 to Jan 31; K10 stop-loss |
| **Anthropic policy classification** (Gate B unresolved) | Day-1 live check and email; practice-feedback framing; no score vocabulary; Apify fallback; written risk acceptance |
| **Anthropic "Media" rule** | No AI articles in this window; reviewer-gated restart only under S3 |
| **Trademark or ads-policy restriction** on the only fast channel | Descriptive naming; no trademark in ad text; organic-only fallback (K9) |
| **Misleading-representation claims** (Competition Act s.74.01) | No CLB, band or score claims; output and ad filters; "not calibrated against official scores" notice |
| **Grading quality**, refunds | Self-refund policy (once only); eval gates; K7 |
| **Competitors:** CELPIPAce has AI scoring and a paid tier (cand_aichat facts); free ChatGPT | Timed formats, Korean explanations and the error log; the moat is thin, and this is accepted |
| **EI loss** under s.30 (setup counts, not only sales) | Declare from week 1; describe both activities to Service Canada before Stripe or ads; hours rule (1.3) |
| **Owner time squeezed** by the home-services plan (≈36–44 h/week, decision-memo.md §7) | Home services wins; hours rule; K2 |
| **Quebec** legal duties | Excluded at geo, checkout and webhook |
| **Stripe hold or refusal**; fees lost on country refunds | Pre-checkout country check; K9 |
| **Spend lock-out or cost blow-out** | Tiered caps: free samples stop first, paid grading continues; the limit scales with gross; Turnstile; per-user caps |
| **Automation failing silently** | Outcome assertions; `ads.json` freshness alert; Worker crons for time-critical work; idempotent jobs |
| **Personal data in git**; the repo is public | Push rule (5.1); aggregate-only metrics with a CI grep; synthetic-only eval |
| **iPhone recording** | mp4/webm support; WebKit test; launch-day iPhone check |
| **Owner's English** limits reviews and support | Korean digests; strict self-serve refund; English + Korean only |
| **Q4 CPC inflation** [prior knowledge, unverified] | Rules use measured CAC |

**To verify with live web access later:**
1. The current Anthropic Usage Policy text, and Anthropic's reply.
2. CELPIP/CLB-style keyword CPC and search volume (Keyword Planner via the owner's account).
3. Google Ads policies on trademarks and test prep; scheduled report emails; campaign end dates.
4. Stripe Canada: fees, dispute fee, Radar rule availability, new-account reserves, payout cadence after the first payout.
5. Resend free tier.
6. Cloudflare `assets` config keys, `request.cf` field names, Whisper-turbo input format and accuracy on accented English, and webm vs mp4 handling.
7. iOS Safari MediaRecorder output format.
8. Quebec French-language requirements (Charter as amended by Bill 96) and Quebec CPA distance-contract duties [prior knowledge, unverified], in case Quebec is added later.
9. Ontario CPA 2023 rules for digital passes.
10. Ontario Business Names Act registration and fee.
11. Paragon trademark guidelines.
12. The Service Canada "minor extent" ruling, and any extension of Pilot Project 24.
13. Official Routine limits (5 or 15 runs/day are secondary figures) and Routine Gmail-connector access.
14. CELPIP test fee and test-taker volume.
15. The cost of a qualified ESL or test-prep reviewer (for S3).

**Unknowns that could flip the decision:**
- the owner's savings (Gate C) and English level;
- EI eligibility and the Service Canada answer;
- how many hours the home-services plan actually takes;
- any Korean-Canadian community ties. Every fast success in the evidence used founder-led distribution (cross_baserates).