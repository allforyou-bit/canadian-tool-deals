# Door hanger and flyer text (EN + KO)

Text for build item 6 in the decision memo (`business/research/decision-memo.md`, section 10): "Up to 3 offers, toggled by config; QR code to the quote tool; 'no obligation' line." Print requirements: letter size, 2-up and 4-up; the QR code must resolve; a unique QR code per cluster.

Door hangers and printed flyers are not electronic messages, so CASL does not apply to them (memo section 6). The Ontario cancellation line still appears, because door-knocking can lead to agreements signed at the customer's home (memo F32).

> **사장님께 (한국어 요약)**
> - 문고리 전단(도어행어)은 문을 두드렸는데 **안 계신 집마다** 하나씩 걸어 두는 것입니다(memo section 7).
> - 광고 3칸은 켜 둔 서비스에 따라 바뀝니다(2번 표). 처음에는 청소만 켜져 있으니 세 칸 모두 청소 광고입니다.
> - 가격은 `config/prices.ts`의 GTA 기본값입니다. **가격표를 바꾸면 인쇄 전에 이 파일의 숫자도 고쳐야 합니다.**
> - 상호를 인쇄하기 전에 ServiceOntario에 상호 등록이 필요한지 먼저 확인하세요(memo section 6).
> - 인쇄비는 조사되지 않았습니다. 1주일 분량씩 조금씩 뽑으세요. 가격이나 서비스가 바뀌면 남은 전단을 버려야 하기 때문입니다.

---

## 1. Placeholders

| Placeholder | Fill with | Config source |
|---|---|---|
| `{BRAND}` | EN side: English brand; KO side: Korean brand | `business.brand.en` / `.ko` |
| `{AREA}` | Your cluster name | `business.serviceArea.en` / `.ko` |
| `{PHONE}` | Business phone, formatted | `business.contact.phone` |
| `{SITE}` | Website address | `business.siteUrl` |
| `{OWNER_NAME}` | Your first name (optional) | — |
| `{QR_URL}` | The quote-page link **for this cluster**, printed as a QR code and also as short text under it | see section 6 |
| `{SNOW_EQUIPMENT}` / `{SNOW_EQUIPMENT_KO}` | "walk-behind snowblower" / "shovel"; "소형 제설기" / "삽". Only what you actually use. | Gate S |

**Price sync:** every $ figure below is a GTA default from `PRICE_BOOKS.gta` in `config/prices.ts`. **If the price book changes, or you switch city, fix every figure here before printing.** No "+ HST" while `salesTaxRegistered` is false. Once registered, add "+ HST" after each price.

**Never print:** reviews, star ratings, customer counts, "since 20XX", years in business, "licensed", "bonded", "certified", "guaranteed", "#1", "best", or "insured" (except the conditional line in section 4).

---

## 2. Which offers print (the 3 slots)

| `services.gutters` | `services.snow` | Slot 1 | Slot 2 | Slot 3 |
|---|---|---|---|---|
| off | off | **A1** Standard & biweekly | **A2** Deep clean | **A3** Move-in / move-out |
| on | off | **A4** Cleaning (standard + deep) | **B** Gutters | **A3** Move-in / move-out |
| off | on | **A4** Cleaning (standard + deep) | **A3** Move-in / move-out | **C** Snow |
| on | on | **A5** All cleaning | **B** Gutters | **C** Snow |

The switches are in `config/business.ts`. Gutters stay off until Gate G1 passes; snow stays off until Gate S passes (memo section 2).

---

## 3. Door hanger text

A door hanger goes on the handle of a door where **nobody answered** (memo section 7).

### 3.1 Headline

| | EN | KO |
|---|---|---|
| Headline | **Sorry we missed you!** | **안녕하세요, 댁에 안 계셔서 두고 갑니다** |
| Sub-headline | Home cleaning in {AREA} | {AREA} 집 청소 |
| Intro (1 line) | I'm {OWNER_NAME} from {BRAND}. I stopped by today. | {BRAND} {OWNER_NAME}입니다. 오늘 들렀다 갑니다. |

If `{OWNER_NAME}` is left blank, print the intro as: "{BRAND} stopped by today." / "{BRAND}에서 오늘 들렀다 갑니다."

Once Track B is on, change the sub-headline to "Home care in {AREA}" / "{AREA} 홈케어".

### 3.2 Offer blocks

Each block has a heading and one or two short lines. Print the blocks chosen in section 2.

**A1 · Standard & biweekly clean**
- EN: **Home cleaning from $150** · One-time or every two weeks · 1 bedroom $150 · 2 bedrooms $180 · 3 bedrooms $220
- KO: **집 청소 $150부터** · 한 번 또는 2주마다 · 침실 1개 $150 · 2개 $180 · 3개 $220

**A2 · Deep clean**
- EN: **Deep clean from $230** · Top-to-bottom, by checklist · 1 bedroom $230 · 2 bedrooms $270 · 3 bedrooms $320
- KO: **딥클린(대청소) $230부터** · 체크리스트대로 구석구석 · 침실 1개 $230 · 2개 $270 · 3개 $320

**A3 · Move-in / move-out clean**
- EN: **Move-in / move-out from $260** · Empty homes and condos · 1 bedroom $260 · 2 bedrooms $300 · 3 bedrooms $360
- KO: **입주·이사 청소 $260부터** · 빈집·콘도 · 침실 1개 $260 · 2개 $300 · 3개 $360

**A4 · Cleaning (standard + deep)**
- EN: **Home cleaning from $150** · Deep clean from $230 · One-time or every two weeks
- KO: **집 청소 $150부터** · 딥클린(대청소) $230부터 · 한 번 또는 2주마다

**A5 · All cleaning**
- EN: **Home cleaning from $150** · Deep clean from $230 · Move-in / move-out from $260
- KO: **집 청소 $150부터** · 딥클린(대청소) $230부터 · 입주·이사 청소 $260부터

**B · Gutters** (only when `services.gutters` is on)
- EN: **Gutter cleaning from $175** · Bungalow $175 · 2 storeys $225 · Gutters only, by hand · Pay when done
- KO: **홈통(처마 물받이) 청소 $175부터** · 단층 $175 · 2층 $225 · 홈통만, 손으로 청소 · 작업 후 결제

**C · Snow season** (only when `services.snow` is on)
- EN: **Snow clearing from $500/season** · Single driveway, 4 instalments from $125 (Dec 1 – Mar 1) · Nothing to pay before Dec 1 · {SNOW_EQUIPMENT}, no truck
- KO: **시즌 제설 $500부터** · 진입로(차 1–2대), 4회 분할(회당 $125부터) (12월 1일 – 3월 1일) · 12월 1일 전 결제 없음 · {SNOW_EQUIPMENT_KO}, 트럭 없음

### 3.3 No-obligation line

- EN: **Free estimate. No obligation.**
- KO: **견적은 무료이고, 문의만 하셔도 괜찮습니다.**

### 3.4 QR call-to-action

- EN: **Scan for your instant estimate** · or visit {QR_URL}
- KO: **QR코드를 찍으시면 바로 예상 가격을 보실 수 있어요** · 또는 {QR_URL}

### 3.5 Contact line

- EN: **Call or text {PHONE}** · {SITE} · 한국어 상담 가능
- KO: **전화·문자 {PHONE}** · {SITE} · 한국어로 편하게 문의하세요

### 3.6 Fine print (small type at the bottom)

Print the lines that apply:

1. Always:
   - EN: Prices shown are starting prices for each home size. The final price is confirmed from photos or on site.
   - KO: 표시된 가격은 집 크기별 시작 가격입니다. 최종 가격은 사진이나 현장 확인 후 정해집니다.
2. Ontario clusters, always:
   - EN: Ontario: if you sign an agreement with us at your home, you may cancel within 10 days after receiving a copy of the signed agreement. Any refund is due within 15 days after your cancellation notice.
   - KO: 온타리오주: 댁에서 저희와 계약서에 서명하신 경우, 계약서 사본을 받으신 후 10일 이내에 취소하실 수 있고, 취소 통지를 받은 후 15일 이내에 환불해 드립니다.
   - Source: memo F32, [ontario.ca](https://www.ontario.ca/page/your-rights-when-signing-or-cancelling-contract) (snippet). For clusters outside Ontario, this rule was not researched; the Montreal/Quebec version is not supported (see `config/prices.ts` city notes).
3. When block C prints:
   - EN: Snow: season Dec 1 – Mar 31. Season contracts go ahead only if we sign our minimum number of snow contracts (all areas combined) by Nov 20; if not, the agreement is void and you owe nothing. Snow is never pushed onto the road. November snow (optional, if ticked in your agreement): $60 per visit for snowfalls at or above the trigger depth once your contract is confirmed, billed with the Dec 1 instalment.
   - KO: 제설: 시즌은 12월 1일 – 3월 31일입니다. 11월 20일까지 전체 제설 계약(모든 지역 합산)이 최소 건수에 이르지 않으면 계약은 무효이고 내실 돈은 없습니다. 눈은 절대 도로로 밀어내지 않습니다. 11월 눈(선택, 계약서에서 선택 시): 계약 확정 후 출동 기준 이상 내린 눈 1회 $60, 12월 1일 첫 분할금과 함께 청구.
4. When block B prints:
   - EN: Gutters: no windows, no pressure washing.
   - KO: 홈통 청소: 창문 청소와 고압 세척은 하지 않습니다.

---

## 4. Flyer text (letter page or half page)

A flyer has more room than a hanger. Use it at the door when someone answers, as a leave-behind, or on community boards where the owner of the board allows it (board rules were not researched; ask first).

### 4.1 Headline and intro

| | EN | KO |
|---|---|---|
| Headline | **Home care for {AREA} neighbours** | **{AREA} 이웃을 위한 홈케어** |
| Intro | {BRAND} cleans homes and condos in {AREA}. Flat prices by home size, and an instant estimate online. | {BRAND}에서 {AREA}의 집과 콘도를 청소해 드립니다. 집 크기별 정액 요금이고, 온라인으로 바로 예상 가격을 보실 수 있습니다. |

### 4.2 Price table (print the rows for the enabled services)

**Cleaning, flat price by bedrooms (always)**

| EN | 1 bedroom | 2 bedrooms | 3 bedrooms |
|---|---|---|---|
| Standard clean | $150 | $180 | $220 |
| Deep clean | $230 | $270 | $320 |
| Move-in / move-out | $260 | $300 | $360 |

| KO | 침실 1개 | 침실 2개 | 침실 3개 |
|---|---|---|---|
| 일반 청소 | $150 | $180 | $220 |
| 딥클린(대청소) | $230 | $270 | $320 |
| 입주·이사 청소 | $260 | $300 | $360 |

Add-ons: extra bathroom $30 · inside oven $40 · inside fridge $35 · inside empty cabinets $40 · within 24 h, weekend or statutory holiday +15%.
추가 항목: 욕실 추가 $30 · 오븐 내부 $40 · 냉장고 내부 $35 · 빈 수납장 내부 $40 · 24시간 이내, 주말, 공휴일 +15%

(4- and 5-bedroom prices are in the price book and the online calculator.)

**Gutters (only when `services.gutters` is on)**
- EN: Bungalow / 1 storey $175 · 2 storeys $225 · Downspout flush +$70 · Gutters only, by hand from a ladder · Pay when the job is done
- KO: 단층 $175 · 2층 $225 · 배수관(다운스파우트) 청소 +$70 · 홈통만 손으로 청소 · 작업이 끝난 뒤 결제
- Add "3 storeys from $300" / "3층 $300부터" only when `NEXT_PUBLIC_GUTTER_MAX_STOREYS=3` (a second person is present and the broker has confirmed cover; checklist 04 row 11; cover not researched). 3-storey jobs are declined by default (`gutterMaxStoreys` is 2), so the default flyer lists 1 and 2 storeys only.
  (3층은 기본적으로 거절합니다. 두 번째 사람이 함께 있고 브로커가 보험 적용을 확인해 준 뒤(보험 적용 여부는 조사되지 않음) `NEXT_PUBLIC_GUTTER_MAX_STOREYS=3`으로 바꿨을 때만 "3층 $300부터"를 넣으세요. 체크리스트 04, 11번 항목.)

**Snow season (only when `services.snow` is on)**
- EN: Single driveway (1–2 cars) $500 · Double (3–4 cars) $650 · Large (5–6 cars) $800 · Walkway and steps +$100 · Salting +$100 · Paid in 4 instalments on Dec 1, Jan 1, Feb 1 and Mar 1 · Nothing paid before Dec 1 · November snow (optional, if ticked in your agreement) $60 per visit, billed with the Dec 1 instalment
- KO: 진입로(차 1–2대) $500 · 차 3–4대 $650 · 차 5–6대 $800 · 현관 보도·계단 +$100 · 제빙(소금) +$100 · 12월 1일, 1월 1일, 2월 1일, 3월 1일 4번 분할 결제 · 12월 1일 전 결제 없음 · 11월 눈(선택, 계약서에서 선택 시) 1회 $60, 12월 1일 첫 분할금과 함께 청구

### 4.3 How it works

| EN | KO |
|---|---|
| 1. Scan the QR code or call for an estimate. | 1. QR코드를 찍거나 전화로 예상 가격을 확인하세요. |
| 2. Send photos, or we take a quick look, and we confirm the price. | 2. 사진을 보내 주시거나 잠깐 둘러본 뒤 가격을 확정합니다. |
| 3. We come on the date you choose. We don't hold keys. | 3. 정하신 날짜에 방문합니다. 열쇠는 보관하지 않습니다. |

### 4.4 Closing lines

Use the same no-obligation line (3.3), QR call-to-action (3.4), contact line (3.5) and fine print (3.6) as the door hanger.

**Optional insurance line: print ONLY after the policy is bound and `NEXT_PUBLIC_INSURED=true`:**
- EN: Liability insured.
- KO: 배상책임보험에 가입되어 있습니다.

---

## 5. Layout suggestions (not researched; for the PDF builder and the owner)

- **Order on a hanger, top to bottom:** headline → intro → 3 offer blocks → no-obligation line → QR code with its call-to-action → contact line → fine print.
- **Language:** either EN on the front and KO on the back, or one language per cluster. You decide based on the street.
- Leave the space for the doorknob hole empty at the top.
- Phone number: the biggest text after the headline.

---

## 6. QR code and attribution

- **One QR link per cluster** (memo build item 6), so the CRM can tell which streets bring leads. The print generator (`components/Printables.tsx`, `lib/site.ts`) builds these links for you: `{SITE}/quote/?src=c1` for cluster 1, `?src=c2` for cluster 2 and `?src=c3` for cluster 3 (Korean prints use `{SITE}/ko/quote/?src=c1` and so on; see `business/08-배포-가이드.md`). **Confirm that the link opens the quote tool before printing.**
- Test every new QR code with **two different phones** before printing a batch.
- Print the short link as text under the QR code for people who don't scan.

---

## 7. Printing tips

| Topic | Tip | Status |
|---|---|---|
| Paper size | **Letter (8.5 × 11 in)** | memo build item 6 |
| **2-up door hangers** | Two door hangers per Letter sheet, each **3.7 × 10.1 in**, with a dashed doorknob circle at the top (`/print/door-hanger/c1/`, `c2`, `c3`) | what the site's print generator builds (`components/Printables.tsx`) |
| **2-up flyers** | Two half-page flyers per Letter sheet, each 7.5 × 4.9 in (`/print/flyer/c1/`, `c2`, `c3`) | what the print generator builds |
| Price list | One Letter page (`/print/price-sheet/`) | what the print generator builds |
| Which files to print | Real prints come only from `{SITE}/print/` (Korean: `{SITE}/ko/print/`) on the deployed site, after your settings are filled in. The PDFs in `business/print/` are SAMPLES with a watermark until then: never hand them out. | what the print generator builds (`business/print/README.md`) |
| 1-up / **4-up** | **Not built yet.** Memo item 6 asks for 2-up and 4-up; the 4-up sheet is still open, and there is no 1-up full-page flyer either. | memo item 6 open |
| Scale | Print at **100% / "Actual size"**, not "Fit to page", so the cut lines and QR code keep their size | suggestion |
| Paper | Heavier paper or cardstock holds up better on a doorknob. Check what your printer can feed. | suggestion, not researched |
| Doorknob hole | Cut a hole with a slit for the doorknob. Test on your own door before cutting a batch. | suggestion |
| Where to print | Your own printer, a public library, **Staples Canada, VistaPrint Canada** or a local print shop. **Prices were not researched** ("Door-hanger printing costs at Staples Canada or VistaPrint Canada: not found", tooling dossier). Get two quotes before a large order. | not researched |
| Budget | The memo's overhead line is $200/month for phone, printing and ads together (A7, unsourced ESTIMATE). | ESTIMATE |
| Batch size | Print about **one week at a time**, because prices and service switches change (gutters end for the season, snow starts after Gate S). | suggestion |
| Weekly quantity | Roughly one hanger per unanswered door. At the memo's **assumed** 35% answer rate (A8), about 65% of doors get one: 150 doors ≈ 98 hangers; 230 doors ≈ 150; 400 doors (Track B weeks) ≈ 260. **Replace 35% with your measured answer rate from day 5.** | ESTIMATE |
| Re-knocks | When you re-knock a door that already got a hanger, don't leave a second one if the first is still there. | suggestion |

### Before you hand out anything

- [ ] **Business-name check** with ServiceOntario done before printing a brand name (memo section 6).
- [ ] Prices match `config/prices.ts`, and "+ HST" is shown only if you are registered.
- [ ] The Ontario 10-day line is present (Ontario clusters).
- [ ] The QR code opens the right page on two phones.
- [ ] Municipal door-to-door soliciting bylaws for your cluster's city were **not researched**. Check with the city (memo section 6).
- [ ] Respect "No soliciting" or "No flyers" signs. This is a courtesy; its legal effect was not researched.
- [ ] Knock and hang in daylight; October sunset times were not researched (memo section 7). At most 40 doors on a job day.
- [ ] Hang on the door handle only. Rules for putting items in mailboxes were not researched.

---

## 8. Sources

- Decision memo: `business/research/decision-memo.md` (sections 2, 6 and 7; F32; A7, A8; build item 6)
- Price book: `config/prices.ts` (`PRICE_BOOKS.gta`); switches: `config/business.ts`
- Tooling dossier: `business/research/dossiers/cross_tooling.json` (printing costs not found)
- This file is not legal advice.
