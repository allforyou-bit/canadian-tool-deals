# Kijiji and Facebook post pack (EN + KO)

Build item 9 in the decision memo (`business/research/decision-memo.md`, section 10).
**The owner posts. The AI never posts, sends messages or phones.**

Each service has 3 English and 3 Korean variants. Titles are 60 characters or fewer when `{AREA}` is 15 characters or fewer; if your area name is longer, shorten the title. Bodies are 120 words or fewer. The 60-character and 120-word limits are our own choice. The platforms' real limits were not researched, so check them on screen.

---

## 1. Before you post

### 1.1 Which services you may advertise

| Service | When to post | Memo rule |
|---|---|---|
| Cleaning (standard, deep, move-in/move-out, biweekly) | From day 3 (Wed Sep 30). **Book direct jobs only for dates after your cleaning liability insurance is bound** (target Wed Oct 7). | "No direct clients before it is bound" (section 7, week 2) |
| Gutters | Only when G1 items 1–4 are true: (1) a vehicle that carries a 24–28 ft ladder, (2) you are fit and comfortable on a ladder, (3) a broker has **confirmed in writing** that your policy covers ladder/eavestrough work, (4) you have the money for ladder, insurance and the $1,500 setup (A5, ESTIMATE). Bookings from these ads count toward item 5 (5 jobs booked before you buy the ladder). **Before G1 passes, use the posts in section 6 as written: they say the date is provisional and send people to your phone, not the website** (see the note at the top of section 6). **If G1 has not passed by Fri Oct 9, delete the gutter ads and call everyone booked to cancel.** Nobody has paid anything, because gutters are paid on completion. | Section 2, Gate G1 |
| Snow | Only after you have **written snow insurance** (Gate S, target Fri Oct 30). | "Pitch snow contracts once written cover exists" (section 7, week 3) |

In code, the same switches are `business.services.gutters` and `business.services.snow` in `config/business.ts` (both OFF by default).

### 1.2 Prices: GTA defaults from `config/prices.ts`

Every dollar figure in this file comes from `PRICE_BOOKS.gta` in `config/prices.ts`.
**If you change the price book or switch city, update every $ figure in this file before you post or repost.**

| Item | Price used in posts | Price-book field |
|---|---|---|
| Standard clean, 1 / 2 / 3 bedrooms | from $150 / $180 / $220 | `cleaning.tiers[].standard` |
| Deep clean, 1 / 2 / 3 bedrooms | from $230 / $270 / $320 | `cleaning.tiers[].deep` |
| Move-in / move-out, 1 / 2 / 3 bedrooms | from $260 / $300 / $360 | `cleaning.tiers[].moveOut` |
| Extra bathroom | +$30 | `cleaning.extraBathroom` |
| Inside oven / inside fridge / inside empty cabinets | +$40 / +$35 / +$40 | `cleaning.addOns` |
| Within 24 h, weekend or statutory holiday | +15% | `cleaning.rushPremiumPct` |
| Gutters, 1 / 2 storeys | from $175 / $225 | `gutters.byStoreys` |
| Gutters, 3 storeys: **do not post by default** (see section 6) | from $300, only if `NEXT_PUBLIC_GUTTER_MAX_STOREYS=3` and a second person is present | `gutters.byStoreys`, `gutterMaxStoreys` |
| Downspout flush | +$70 | `gutters.downspoutFlush` |
| Snow season, single / double / large driveway | from $500 / $650 / $800 (4 instalments from $125 / $162.50 / $200) | `snow.driveway`, `snow.instalments` |
| Front walkway and steps / salting | +$100 / +$100 per season | `snow.walkwayAndSteps`, `snow.salting` |
| November snow, per visit (optional: only if the customer ticks it in the agreement, and only after the contract is confirmed; billed with the Dec 1 instalment, see section 7) | $60 | `snow.perVisit` |

- "From" means the smallest home in that row. The website calculator shows a range from the price-book figure up to 15% more (`rangeUpliftPct`), and the final price is confirmed from photos or on site.
- **Sales tax:** you are not registered for GST/HST at the start (`salesTaxRegistered: false`; small-supplier test $30,000, memo F7). Do not add "+ HST" now. Once you register, add "+ HST" after every price.

### 1.3 Words you must never use

These are invented claims. Rule 1 of the kit forbids them:

- reviews, star ratings, "5-star", "trusted by X families", customer counts
- "since 20XX", "X years of experience" (unless it is true for you personally, and even then keep it out of ads)
- "licensed", "bonded", "certified", "award-winning", "#1", "best in {AREA}"
- "guaranteed" or "satisfaction guaranteed" (no guarantee policy exists in the memo)
- any income or savings promise
- **"insured"**. Use it only with the conditional line below.

**Optional insurance line: add it ONLY after a liability policy is bound and `NEXT_PUBLIC_INSURED=true`:**
- EN: `Liability insured.`
- KO: `배상책임보험에 가입되어 있습니다.`

Never state a coverage amount unless it is printed on your certificate.

### 1.4 Placeholders

| Placeholder | Fill with | Config source |
|---|---|---|
| `{BRAND}` | EN posts: English brand; KO posts: Korean brand | `business.brand.en` / `business.brand.ko` (default "Neighbourhood Home Care" / "우리동네 홈케어") |
| `{AREA}` | Your one neighbourhood cluster, e.g. "Willowdale" | `business.serviceArea.en` / `.ko` |
| `{PHONE}` | Your business phone, formatted like (416) 555-0123 | `business.contact.phone` |
| `{SITE}` | Your website address | `business.siteUrl` |
| `{SNOW_EQUIPMENT}` | EN: "walk-behind snowblower" or "shovel". Use only what you actually own. | your choice under Gate S |
| `{SNOW_EQUIPMENT_KO}` | KO: "소형 제설기(직접 미는 방식)" or "삽(손 제설)" | same |
| `{TRIGGER_DEPTH}` | The snow depth that starts a visit, exactly as written in your signed snow agreement | snow agreement (build item 5) |

---

## 2. Posting cadence (memo section 7)

| When | What |
|---|---|
| **Day 3, Wed Sep 30** | Post **1 Kijiji ad per service you may advertise** (see 1.1). Also post 2 Korean-community posts (see `02-korean-community-posts.md`). |
| **Week 2 onward, Tue–Sat** | **1 repost per day**, counted across all platforms. Rotate the variants (1 → 2 → 3) so the text changes. |
| Every day | Reply to every inquiry within 1 hour (memo week-1 target, not a promise to put in ads). |

- **Log each post** in the CRM or a note: date, platform, variant ID (for example `C-EN-2`), and the link. After two weeks you can see which variant brings inquiries.
- **Replying to someone who contacted you** is excluded from CASL section 6 (SOR/2013-221 s.3(b), memo F12). Still put your business name and contact in the reply. If you send a price quote by email or text, it must carry your business name, **mailing address**, a contact and an unsubscribe line (CASL s.6(6) exempts a requested quote from consent only, memo F11). Use the reply scripts from build item 7.
- **Never send a message first** by email, text, Messenger or chat to someone who has not contacted you (memo do-not-do list: "Cold email or SMS to consumers"; CASL administrative monetary penalty of up to $1M for an individual, s.20(4), memo F11).

---

## 3. Platform rules: check on screen (NOT researched)

The research did not find the rules. The tooling dossier says: "Kijiji rules and any posting fees for service listings: not found. Whether Facebook Marketplace permits service listings in Canada: not found" (`business/research/dossiers/cross_tooling.json`). The only related note is secondary: Facebook Marketplace personal listings are "a contact-the-seller flow", and Instagram commerce is "physical goods only" ([secondary source](https://github.com/squadcodercom/squadcoder/blob/75051b8b08b8cf70d4a26fb20dbe69e8ab052f3d/.squadcoder/skills/israeli-marketplace-seller/references/platform-guides.md)).

So before the first post, check these on screen and **take a screenshot of each rule you rely on**:

- [ ] **Kijiji:** the right category for home services; whether a service ad costs money; paid "bump" or "top ad" options and their price; how often the same ad may be reposted; whether duplicate ads get removed; title and description length limits; whether a phone number and website are allowed in the text; photo limits.
- [ ] **Facebook Marketplace:** whether a service may be listed at all in your area. If not, do not disguise a service as an item for sale.
- [ ] **Facebook groups** (neighbourhood, buy-and-sell, Korean groups): read each group's rules. Some groups have their own rules on business posts, so ask the admin if unclear. Follow them exactly.
- [ ] If a platform removes an ad, **do not re-post it in a way that gets around the rule.**
- [ ] Note in the CRM which platforms allow what.

---

## 4. Photo shot list

**Hard rule:** no photo of a client's home, inside or outside, including before/after shots, unless the client has signed the **separate written photo opt-in** (memo section 6 "Photo-consent clause"; build item 5). PIPEDA governs personal information, and a home photo without a name can still identify the home.

**OK to shoot now (your own things, your own home):**
1. Your cleaning kit laid out on a table: vacuum, microfibre cloths, bucket, spray bottles.
2. Your own kitchen counter or bathroom sink after you clean it. Say nothing that suggests it is a client's home.
3. You, in plain or branded clothing, holding your kit. Showing your face is optional.
4. A printed door hanger or flyer with your `{BRAND}`, or your phone showing the website.
5. A simple text image: service name + "from $X" + `{PHONE}` (use the prices in 1.2).
6. Gutters (only after G1): your own ladder, stabiliser, gloves and scoop, photographed at **your own** home.
7. Snow (only after Gate S): your own shovel or snowblower, photographed at **your own** home.

**Never:**
- house numbers, street signs, licence plates, mail, documents, screens, family photos, or other people's faces
- photos from the internet, from other companies, or stock photos that look like your finished work
- photos of work you did not do

**With a signed photo opt-in (later):** shoot before/after of the same spot from the same angle, crop out anything that identifies the home, and keep the signed opt-in with the job record.

Practical tips (suggestions, not researched): daylight, landscape orientation, wipe the lens, 3–5 photos per ad.

---

## 5. Posts: Cleaning (Track A, always on)

### C-EN-1 · Move-in / move-out
**Title:** `Move-out & move-in cleaning in {AREA} – from $260`

```text
Moving out or moving in? {BRAND} cleans empty homes and condos in {AREA}.

Flat price by home size:
- 1 bedroom from $260
- 2 bedrooms from $300
- 3 bedrooms from $360
Inside oven +$40 · inside fridge +$35 · inside empty cabinets +$40

Get an instant estimate at {SITE}. The final price is confirmed from photos or on site. No obligation.

We don't hold keys: you, your realtor or your lockbox lets us in.

Call or text {PHONE}
한국어 상담 가능
```

### C-EN-2 · Deep clean
**Title:** `Deep cleaning in {AREA} – flat price from $230`

```text
A thorough top-to-bottom clean for houses and condos in {AREA}: kitchen, bathrooms, floors and dusting in every room. The full checklist is on our website.

Deep clean, flat price:
- 1 bedroom from $230
- 2 bedrooms from $270
- 3 bedrooms from $320
Extra bathroom +$30. Within 24 h, weekends and statutory holidays +15%.

Instant estimate: {SITE}
Final price confirmed from photos or on site. No obligation.

{BRAND}
Call or text {PHONE}
```

### C-EN-3 · Standard and biweekly
**Title:** `Home cleaning in {AREA} from $150 – biweekly too`

```text
Need a regular clean? {BRAND} does standard cleaning for houses and condos in {AREA}, one time or every two weeks.

Standard clean, flat price:
- 1 bedroom from $150
- 2 bedrooms from $180
- 3 bedrooms from $220

Start with one visit. If you like it, we set a biweekly day and time that suits you.

Estimate: {SITE}
Call or text {PHONE}
Korean spoken · 한국어 가능
```

### C-KO-1 · 입주·이사 청소
**제목:** `{AREA} 입주·이사 청소, 침실 1개 $260부터`

```text
이사 나가시거나 새집에 들어가시나요? {BRAND}에서 빈집과 콘도를 청소해 드립니다.

집 크기별 정액 요금:
- 침실 1개 $260부터
- 침실 2개 $300부터
- 침실 3개 $360부터
오븐 내부 +$40 · 냉장고 내부 +$35 · 빈 수납장 내부 +$40

{SITE}에서 바로 예상 가격을 확인하실 수 있어요. 최종 가격은 사진이나 현장 확인 후 정해집니다. 문의만 하셔도 괜찮습니다.

열쇠는 따로 보관하지 않습니다. 고객님이나 부동산 중개인이 문을 열어 주시거나, 고객님이 준비하신 락박스를 이용합니다.

전화·문자: {PHONE}
```

### C-KO-2 · 딥클린(대청소)
**제목:** `{AREA} 딥클린(대청소) 정액 $230부터`

```text
주방, 욕실, 바닥, 방마다 먼지까지 꼼꼼하게 청소해 드립니다. 자세한 청소 항목은 웹사이트에서 보실 수 있어요.

딥클린 정액 요금:
- 침실 1개 $230부터
- 침실 2개 $270부터
- 침실 3개 $320부터
욕실 추가 1개당 +$30 · 24시간 이내, 주말, 공휴일 +15%

예상 가격: {SITE}
최종 가격은 사진이나 현장 확인 후 정해집니다. 부담 없이 문의하세요.

{BRAND}
전화·문자: {PHONE}
```

### C-KO-3 · 일반 청소와 2주 정기 청소
**제목:** `{AREA} 집 청소 $150부터 · 2주 정기 청소 가능`

```text
바쁘셔서 청소할 시간이 없으신가요? {BRAND}에서 집과 콘도를 한 번 또는 2주마다 청소해 드립니다.

일반 청소 정액 요금:
- 침실 1개 $150부터
- 침실 2개 $180부터
- 침실 3개 $220부터

처음에 한 번 받아 보시고 마음에 드시면, 2주마다 편하신 요일과 시간으로 정해 드려요.

예상 가격: {SITE}
전화·문자: {PHONE} (한국어로 편하게 문의하세요)
```

---

## 6. Posts: Gutters (Track B, only under the G1 rule in 1.1)

Scope is **gutters only**: no windows, no pressure washing (memo section 3). Cleaning is by hand and scoop from a ladder. Paid on completion.
3-storey homes are **declined by default**. `config/business.ts` sets `gutterMaxStoreys` to 2 unless `NEXT_PUBLIC_GUTTER_MAX_STOREYS=3`, so the website calculator and the printed price sheet show 1 and 2 storeys only. The ladder go/no-go checklist (`business/checklists/04-ladder-go-no-go.md`, row 11) says never go alone on 3 storeys. No helpers are hired in the first 30 days (memo section 3). So the posts below list 1 and 2 storeys only.
**Add a 3-storey line (`- 3 storeys from $300` / `- 3층 $300부터`) only when `gutterMaxStoreys` is 3.** Set it to 3 only when a second person is present and your broker has confirmed that the policy covers the work (checklist 04, row 11; not researched).

**The posts below are written for the stage before G1 passes**, which is when most gutter posts go up (1.1):
- Each post says the booking is provisional, in the same words as door scripts 1B and 1D: dates after mid-October, confirmed only once insurance and ladder are in place by Oct 9, otherwise cancelled with nothing owed.
- Each post sends people to your phone, not to a website estimate. The website shows no gutter option until `NEXT_PUBLIC_ENABLE_GUTTERS=1`, which you set only after G1 passes (`business/08-배포-가이드.md` section 5-1).
- **After G1 passes and gutters are ON:** delete the sentence(s) about the date being confirmed by Oct 9, and you may add `Estimate: {SITE}` / `예상 가격: {SITE}` above the phone line.

### G-EN-1 · Price by height
**Title:** `Gutter cleaning in {AREA} – bungalow from $175`

```text
Leaves down? {BRAND} cleans eavestroughs by hand, from a ladder, before the snow.

Flat price by height:
- Bungalow / 1 storey from $175
- 2 storeys from $225
Downspout flush +$70

Gutters only: no windows, no pressure washing, no roof repairs.
You pay when the job is done.

Taking bookings now for dates after mid-October. Your date is confirmed only once our insurance and ladder are in place (by Oct 9). If not, we'll contact you to cancel, and you owe nothing.

Call or text {PHONE}
```

### G-EN-2 · Timing
**Title:** `Eavestrough cleaning before the snow – from $175`

```text
Book your fall gutter cleaning: after the leaves drop, before the snow.

{BRAND} is now booking dates after mid-October in {AREA}.
- 1 storey from $175
- 2 storeys from $225
- Downspout flush +$70

Hand cleaning from a ladder. Gutters only: we don't do windows or pressure washing.
No payment until the work is done.

Your date is confirmed only once our insurance and ladder are in place (by Oct 9). If not, we'll contact you to cancel, and you owe nothing.

To pick a date, call or text {PHONE}
```

### G-EN-3 · Neighbours
**Title:** `Neighbours in {AREA}: gutter cleaning from $175`

```text
{BRAND} is booking gutter cleaning on streets in {AREA} this fall. Ask if we are already booked on your street; we will try to do yours the same day.

Price by height:
- Bungalow from $175
- 2 storeys from $225
Downspout flush +$70

A photo of the front of your house helps us confirm the price. Pay when done.

Dates are after mid-October. Your date is confirmed only once our insurance and ladder are in place (by Oct 9). If not, we'll contact you to cancel, and you owe nothing.

Call or text {PHONE}
```

### G-KO-1 · 높이별 요금
**제목:** `{AREA} 홈통(처마 물받이) 청소 단층 $175부터`

```text
낙엽이 다 떨어졌나요? 눈 오기 전에 {BRAND}에서 홈통(처마 물받이)을 깨끗이 비워 드립니다. 사다리에 올라 손으로 직접 청소합니다.

높이별 정액 요금:
- 단층(방갈로) $175부터
- 2층 $225부터
- 배수관(다운스파우트) 청소 +$70

홈통 청소만 합니다. 창문 청소, 고압 세척, 지붕 수리는 하지 않습니다.
작업이 끝난 뒤에 결제하시면 됩니다.

10월 중순 이후 날짜로 예약을 받고 있습니다. 보험과 사다리 준비가 10월 9일까지 끝나야 날짜가 확정됩니다. 준비가 안 되면 연락드려 예약을 취소하며, 내실 돈은 없습니다.

전화·문자: {PHONE}
```

### G-KO-2 · 시기
**제목:** `눈 오기 전 홈통 청소 · {AREA} $175부터`

```text
홈통(처마 물받이) 청소는 낙엽이 다 떨어진 뒤, 눈이 오기 전에 하시는 게 좋습니다.

{BRAND}에서 {AREA} 10월 중순 이후 날짜로 예약을 받고 있습니다.
- 단층 $175부터
- 2층 $225부터
- 배수관(다운스파우트) 청소 +$70

사다리에 올라 손으로 청소합니다. 창문 청소와 고압 세척은 하지 않습니다.
작업이 끝나기 전에는 돈을 받지 않습니다.

보험과 사다리 준비가 10월 9일까지 끝나야 날짜가 확정됩니다. 준비가 안 되면 연락드려 예약을 취소하며, 내실 돈은 없습니다.

날짜 문의(전화·문자): {PHONE}
```

### G-KO-3 · 이웃
**제목:** `{AREA} 이웃분들, 홈통 청소 예약 받습니다`

```text
{BRAND}에서 이번 가을 {AREA} 여러 거리의 홈통(처마 물받이) 청소 예약을 받고 있습니다. 같은 거리에 이미 예약된 집이 있는지 물어봐 주세요. 가능하면 같은 날 해 드리겠습니다.

높이별 요금:
- 단층 $175부터
- 2층 $225부터
- 배수관(다운스파우트) 청소 +$70

집 앞면 사진을 보내 주시면 가격 확인이 빨라요. 작업이 끝난 뒤 결제하시면 됩니다.

작업 날짜는 10월 중순 이후입니다. 보험과 사다리 준비가 10월 9일까지 끝나야 날짜가 확정됩니다. 준비가 안 되면 연락드려 예약을 취소하며, 내실 돈은 없습니다.

전화·문자: {PHONE}
```

---

## 7. Posts: Snow (Track B, only after Gate S)

These terms come from memo sections 2 and 6 and must match your signed snow agreement (build item 5):
- The season runs **Dec 1 – Mar 31**. The season price, confirmed on site, is split into **4 equal instalments billed Dec 1, Jan 1, Feb 1 and Mar 1**. Posts show the smallest instalment as "from $X" (single driveway: from $125), as the website calculator does.
- **No payment is taken before Dec 1.**
- November snow is **optional**: the per-visit rate ($60) applies only if the customer ticks it in the agreement, and only to snowfalls at or above the trigger depth from the day you confirm the agreement is going ahead (you tell customers by Nov 21, after the Nov 20 condition) until Nov 30. It is **billed with the Dec 1 instalment; nothing is collected before Dec 1** (snow agreement, "November snow" clause). Never write just "November storms: $60 per visit" in a post.
- **Contracts go ahead only if your minimum number of snow contracts, all areas combined, is signed by Nov 20. Otherwise every contract is void and nothing is owed.**
- Snow is **never pushed onto the road** (Ontario HTA s.181 and Toronto Municipal Code 743-9, memo F34).
- **Ontario: an agreement signed at the customer's home can be cancelled within 10 days after the customer receives a copy of the signed agreement, and any refund is due within 15 days after the cancellation notice** (memo F32, [ontario.ca](https://www.ontario.ca/page/your-rights-when-signing-or-cancelling-contract), search snippet). This file is not legal advice.
- The only equipment is a walk-behind snowblower or a shovel, with no truck plow. **Car-less owners using a shovel only: at most 10 driveways (assumed cap)** until you have measured your time per driveway (memo section 9).

### S-EN-1 · Season price
**Title:** `Seasonal snow clearing, {AREA} – from $500/season`

```text
Driveway snow clearing for the whole season, Dec 1 – Mar 31, with a {SNOW_EQUIPMENT}. No truck plow.

Season price:
- Single driveway (1–2 cars) from $500 (4 instalments from $125)
- Double driveway (3–4 cars) from $650
- Large driveway (5–6 cars) from $800
- Front walkway and steps +$100 · salting +$100

Pay in 4 instalments: Dec 1, Jan 1, Feb 1, Mar 1. Nothing to pay before Dec 1.
November snow (optional, tick it in your agreement): $60 per visit for snowfalls of {TRIGGER_DEPTH} or more, once your contract is confirmed, billed with your Dec 1 instalment.
We never push snow onto the road.

{BRAND}
Call or text {PHONE} · {SITE}
```

### S-EN-2 · No prepayment
**Title:** `Snow removal – no payment before Dec 1 – from $500`

```text
With {BRAND}, you pay nothing for snow clearing before Dec 1.

- Season: Dec 1 – Mar 31
- 4 payments: Dec 1, Jan 1, Feb 1, Mar 1
- Single driveway from $500 (4 instalments from $125)
- We come when snow reaches {TRIGGER_DEPTH}

Season contracts go ahead only if we sign our minimum number of snow contracts (all areas combined) by Nov 20; if not, the agreement is void and you owe nothing.

Ontario: if you sign at your home, you can cancel within 10 days after you receive a copy of the signed agreement, and we refund you within 15 days after your cancellation notice.

Call or text {PHONE}
{SITE}
```

### S-EN-3 · Street route
**Title:** `Snow clearing on your street in {AREA} – from $500/season`

```text
{BRAND} keeps a small route of nearby driveways in {AREA}, cleared with a {SNOW_EQUIPMENT}.

- Single driveway: from $500 for the season (4 instalments, from $125 each; Dec 1 – Mar 1)
- Double driveway: from $650 · Large: from $800
- Walkway and steps +$100 · Salting +$100
- November snow (optional, tick it in your agreement): $60 per visit for snowfalls of {TRIGGER_DEPTH} or more, once your contract is confirmed, billed with your Dec 1 instalment

Nothing is charged before Dec 1. The written agreement says when we come, what happens in a low-snow winter, and that snow never goes onto the road.

Call or text {PHONE}
{SITE}
```

### S-KO-1 · 시즌 요금
**제목:** `{AREA} 겨울 시즌 제설, $500부터`

```text
12월 1일부터 3월 31일까지 한 시즌 동안 진입로 눈을 치워 드립니다. 트럭 제설은 하지 않습니다.
작업 장비: {SNOW_EQUIPMENT_KO}

시즌 요금:
- 진입로(차 1–2대) $500부터 (4회 분할, 회당 $125부터)
- 진입로(차 3–4대) $650부터
- 진입로(차 5–6대) $800부터
- 현관 보도·계단 +$100 · 제빙(소금) +$100

12월 1일, 1월 1일, 2월 1일, 3월 1일, 4번에 나눠 내시면 됩니다. 12월 1일 전에는 돈을 받지 않습니다.
11월 눈(선택, 계약서에서 선택 시): 계약 확정 후 {TRIGGER_DEPTH} 이상 내린 눈 1회 $60, 12월 1일 첫 분할금과 함께 청구.
치운 눈은 절대 도로로 밀어내지 않습니다.

{BRAND}
전화·문자: {PHONE} · {SITE}
```

### S-KO-2 · 선불 없음
**제목:** `12월 1일 전 선불 없는 제설 계약 · $500부터`

```text
{BRAND}에서는 12월 1일이 되기 전에 제설 비용을 한 푼도 받지 않습니다.

- 시즌: 12월 1일 – 3월 31일
- 4번 나눠 결제: 12월 1일, 1월 1일, 2월 1일, 3월 1일
- 진입로(차 1–2대) $500부터 (4회 분할, 회당 $125부터)
- 눈이 {TRIGGER_DEPTH} 이상 쌓이면 출동합니다

11월 20일까지 전체 제설 계약(모든 지역 합산)이 최소 건수에 이르지 않으면 계약은 무효이고 내실 돈은 없습니다.

온타리오주: 댁에서 계약하신 경우, 계약서 사본을 받으신 다음 날부터 10일 안에 취소하실 수 있고, 취소 통지를 받은 다음 날부터 15일 안에 환불해 드립니다.

전화·문자: {PHONE}
{SITE}
```

### S-KO-3 · 우리 거리 루트
**제목:** `{AREA} 우리 거리 제설 · 시즌 $500부터`

```text
{BRAND}에서 {AREA} 가까운 집들만 모아 작은 제설 루트를 운영합니다.
작업 장비: {SNOW_EQUIPMENT_KO}

- 진입로(차 1–2대): 시즌 $500부터, 4회 분할(회당 $125부터) (12월 1일 – 3월 1일)
- 차 3–4대: $650부터 · 차 5–6대: $800부터
- 현관 보도·계단 +$100 · 제빙(소금) +$100
- 11월 눈(선택, 계약서에서 선택 시): 계약 확정 후 {TRIGGER_DEPTH} 이상 내린 눈 1회 $60, 12월 1일 첫 분할금과 함께 청구

12월 1일 전에는 아무것도 청구하지 않습니다. 언제 오는지, 눈이 적게 온 겨울엔 어떻게 하는지, 눈을 도로에 버리지 않는다는 내용까지 서면 계약서에 모두 적어 드립니다.

전화·문자: {PHONE}
{SITE}
```

> **Korean particle note:** the KO posts always write "{BRAND}에서", which reads correctly whatever the brand name ends with. If you rewrite a sentence as "{BRAND}은/는" or "{BRAND}이/가", choose the particle by hand after you fill in the brand.

---

## 8. Sources used in this file

- Decision memo: `business/research/decision-memo.md` (gates: section 2; do-not-do: section 3; F11, F12, F32, F34; compliance: section 6; cadence: section 7; build items: section 10)
- Price book: `config/prices.ts` (`PRICE_BOOKS.gta`); switches: `config/business.ts`
- Platform-rule gap: `business/research/dossiers/cross_tooling.json` ("unknowns")
- Ontario cancellation rights: <https://www.ontario.ca/page/your-rights-when-signing-or-cancelling-contract> (snippet, memo F32)
- Snow onto road: <https://defendcharges.ca/EN/provincial-offences2/municipal-bylaw-offences/deposit-of-snow-on-roadway> (snippet, memo F34)
- CASL: <https://github.com/justicecanada/laws-lois-xml/blob/main/eng/acts/E-1.6.xml> (memo F11); SOR/2013-221: <https://github.com/justicecanada/laws-lois-xml/blob/main/eng/regulations/SOR-2013-221.xml> (memo F12)
