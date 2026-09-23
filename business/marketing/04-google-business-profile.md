# Google Business Profile copy (EN + KO)

Build item 17 in the decision memo (`business/research/decision-memo.md`, section 10). The memo calls it a "later channel": "The owner verifies. **Not counted on for October** (F38)."

The owner creates and verifies the profile. The AI cannot open ID-verified accounts or post on the owner's behalf. **Every field limit, category name and policy below was not researched unless a source is given, so check each one on screen.**

> **사장님께 (한국어 요약)**
> - 구글 비즈니스 프로필은 **10월 수입에 기대지 않는** 채널입니다. 인증 심사에 최대 5영업일, 우편 엽서에 최대 14일이 걸린다는 자료가 있습니다(memo F38, 2차 자료).
> - 아래 설명문(2번)과 서비스 목록(3번)을 붙여 넣고, 질문·답변 10개(4번)는 프로필 Q&A 기능이 있으면 쓰고, 없으면 웹사이트 FAQ에 씁니다.
> - 설명문 글자 수 제한은 750자로 알려져 있지만 **조사로 확인한 것은 아닙니다.** 화면의 글자 수 표시를 보세요.
> - 가게 이름은 전단지·웹사이트와 똑같이 씁니다. 상호를 인쇄하기 전에 ServiceOntario에 상호 등록이 필요한지 먼저 확인하세요(memo section 6).
> - 후기는 실제 고객에게만 부탁합니다. 가짜 후기를 쓰거나 사지 마세요.

---

## 1. Before you start

- [ ] **Business name:** use exactly the name on your door hangers and website (`{BRAND}`). Whether you must register a business name in Ontario was **not verified**, so check with ServiceOntario before printing or publishing a brand name (memo section 6). Google's own naming rules were not researched; read them on screen.
- [ ] **Type of business:** you go to customers, so set it up as a **service-area business** with the street address hidden (see section 5).
- [ ] **Category:** category names were not researched. Choose the closest match to home or house cleaning on screen. Add gutter or snow categories only while those services are enabled in `config/business.ts`.
- [ ] **Hours:** list only the hours you actually answer the phone (from your day-1 intake, question 12).
- [ ] **Phone and website:** `{PHONE}` and `{SITE}`, the same as on your flyers.
- [ ] **Photos:** follow the shot list in `01-kijiji-facebook-posts.md` section 4. **No client homes without the separate written photo opt-in.**
- [ ] **Insurance:** do not mention insurance anywhere on the profile until your liability policy is bound and `NEXT_PUBLIC_INSURED=true`.

---

## 2. Business description

Keep it **750 characters or fewer, and check the counter on screen** (the limit was not researched). The base text below plus all three optional sentences is under 750 characters with the default English brand and a 15-character area name. Google's rules on what a description may contain (links, prices, promotions) were not researched, so this text leaves out links and prices.

### 2.1 English (main)

Base text (always):

```text
{BRAND} is a home cleaning service for {AREA}. We do standard cleans, deep cleans and move-in/move-out cleans for houses, townhouses and condos, one time or every two weeks. Prices are flat by home size: get an instant estimate on our website, and we confirm the final price from photos or on site. We follow a written room-by-room checklist. We don't hold keys; you, your realtor or your lockbox lets us in. Korean-speaking service is available.
```

Add at the end **only while the matching switch is on**:

| Switch | Sentence to add |
|---|---|
| `services.gutters` = true | `In late fall we also clean gutters by hand (gutters only: no windows or pressure washing).` |
| `services.snow` = true | `In winter we clear driveways with a {SNOW_EQUIPMENT} under seasonal agreements, with no payment before Dec 1.` |
| `insured` = true | `We carry liability insurance.` |

`{SNOW_EQUIPMENT}` is "walk-behind snowblower" or "shovel": only the equipment you actually use.

### 2.2 Korean (reference)

Whether a profile can show a second-language description was **not researched.** Use this text on the Korean website page or in Korean posts, or in the profile if the screen allows it.

```text
{BRAND}에서는 {AREA} 지역의 집 청소를 합니다. 일반 청소, 딥클린(대청소), 입주·이사 청소를 한 번 또는 2주마다 해 드리며, 단독주택, 타운하우스, 콘도 모두 가능합니다. 가격은 집 크기별 정액이고, 웹사이트에서 바로 예상 가격을 보실 수 있습니다. 최종 가격은 사진이나 현장 확인 후 정해집니다. 방마다 체크리스트대로 청소합니다. 열쇠는 보관하지 않습니다. 한국어로 편하게 상담하세요.
```

Optional additions:
- Gutters on: `늦가을에는 홈통(처마 물받이) 청소도 손으로 해 드립니다. 홈통만 청소하고 창문 청소나 고압 세척은 하지 않습니다.`
- Snow on: `겨울에는 제설 시즌 계약으로 진입로 눈을 치워 드리며, 12월 1일 전에는 돈을 받지 않습니다.`
- Insured on: `배상책임보험에 가입되어 있습니다.`

---

## 3. Services list

If you enter prices on the profile, they **must match `config/prices.ts` (GTA defaults shown). Update them whenever the price book changes.** Leaving prices blank is also fine. Do not add "+ HST" until you are registered (`salesTaxRegistered`).

| Service (EN) | 서비스 (KO) | Short description (EN) | Price (GTA default) | Show when |
|---|---|---|---|---|
| Standard clean | 일반 청소 | Regular clean of kitchen, bathrooms, floors and dusting, by checklist | from $150 (1 bedroom) | always |
| Deep clean | 딥클린(대청소) | Thorough top-to-bottom clean, by checklist | from $230 (1 bedroom) | always |
| Move-in / move-out clean | 입주·이사 청소 | Empty-home clean before or after a move | from $260 (1 bedroom) | always |
| Biweekly cleaning | 2주 정기 청소 | A standard clean every two weeks on a set day | from $150 per visit (standard price) | always |
| Extra bathroom / inside oven / inside fridge / inside empty cabinets | 욕실 추가 / 오븐 내부 / 냉장고 내부 / 빈 수납장 내부 | Add-ons | $30 / $40 / $35 / $40 | always |
| Gutter cleaning | 홈통(처마 물받이) 청소 | Gutters only, cleaned by hand from a ladder; paid on completion | from $175 (1 storey), $225 (2 storeys) | `services.gutters` |
| Downspout flush | 배수관(다운스파우트) 청소 | Add-on to gutter cleaning | $70 | `services.gutters` |
| Seasonal snow clearing | 시즌 제설 | Driveway, Dec 1 – Mar 31; season price confirmed on site, billed in 4 equal instalments (Dec 1, Jan 1, Feb 1, Mar 1); no payment before Dec 1 | from $500 per season (single driveway) | `services.snow` |
| Walkway and steps / salting | 현관 보도·계단 / 제빙(소금) | Snow add-ons, per season | $100 / $100 | `services.snow` |
| November snow visit | 11월 눈 1회(선택) | Optional (ticked in the agreement), after the contract is confirmed; billed with the Dec 1 instalment | $60 per visit | `services.snow` |

- **3-storey gutters are not listed by default.** Add "$300 (3 storeys)" only when `NEXT_PUBLIC_GUTTER_MAX_STOREYS=3`, which you set only when a second person is present and your broker has confirmed cover (`business/checklists/04-ladder-go-no-go.md` row 11; not researched). While you work alone, 3-storey jobs are declined.
- **November snow:** the customer ticks it in the snow agreement. It runs only from the day you confirm the agreement is going ahead (by Nov 21) to Nov 30, and it is billed with the Dec 1 instalment, never before (snow agreement, "November snow" clause).

Price-book fields: `cleaning.tiers`, `cleaning.extraBathroom`, `cleaning.addOns`, `gutters.byStoreys`, `gutters.downspoutFlush`, `snow.driveway`, `snow.walkwayAndSteps`, `snow.salting`, `snow.perVisit`, `snow.instalments`.

---

## 4. Ten Q&A seeds (EN + KO)

These come from the FAQ themes in memo build item 13: insurance, what's included, payment, cancellation rights, snow road rules and the snow void condition. Whether Google still offers a Q&A feature on profiles, and whether owners may post their own questions, was **not researched.** If you can't use them on the profile, use them in the website FAQ and in replies.

Only post seeds 8–10 while the matching service is enabled.

**1. What's included in a standard, deep or move-out clean?**
- EN: Each type follows a written room-by-room checklist, which is on our website ({SITE}). Inside the oven, inside the fridge and inside empty cabinets are add-ons.
- KO: 청소 종류마다 방별 체크리스트가 있고, 웹사이트({SITE})에서 보실 수 있습니다. 오븐 내부, 냉장고 내부, 빈 수납장 내부는 추가 항목입니다.

**2. How much does it cost?**
- EN: Prices are flat by home size. For example, a standard clean for a 1-bedroom starts at $150, a deep clean at $230 and a move-out clean at $260. Our website gives an instant estimate, and we confirm the final price from photos or on site.
- KO: 집 크기별 정액입니다. 예를 들어 침실 1개 기준으로 일반 청소 $150부터, 대청소 $230부터, 이사 청소 $260부터입니다. 웹사이트에서 바로 예상 가격을 보실 수 있고, 최종 가격은 사진이나 현장 확인 후 정해집니다.
- *(Prices must match `config/prices.ts`.)*

**3. Are you insured?** Use only the version that is true today.
- *Not yet bound:* EN: We are arranging liability insurance and don't take direct cleaning jobs until it is in place. KO: 배상책임보험 가입을 진행 중이며, 가입이 끝나기 전에는 직접 청소 예약을 받지 않습니다.
- *Bound (`insured` = true):* EN: Yes, we carry liability insurance. Ask us for a copy of the certificate. KO: 네, 배상책임보험에 가입되어 있습니다. 증서 사본이 필요하시면 말씀해 주세요.

**4. Do I need to be home? Do you keep keys?**
- EN: We don't hold keys. You, your realtor or a lockbox you arrange lets us in.
- KO: 열쇠는 보관하지 않습니다. 고객님이나 부동산 중개인이 문을 열어 주시거나, 고객님이 준비하신 락박스를 이용합니다.

**5. How do I pay?**
- EN: By Interac e-Transfer. Banks set their own transfer limits, often around $2,000–3,000, so a larger amount may be split into two transfers.
- KO: 인터랙 이트랜스퍼(e-Transfer)로 받습니다. 은행마다 이체 한도가 있어서(보통 $2,000–3,000 정도), 금액이 크면 두 번에 나눠 보내실 수 있습니다.
- *(Source: memo F36, secondary. Card payment is not set up in this plan.)*

**6. Can I cancel?**
- EN: Yes. Our cancellation terms are in your service agreement. In Ontario, if you sign an agreement with us at your home, you can cancel within 10 days of receiving your copy, and any refund is due within 15 days.
- KO: 네. 취소 조건은 서비스 계약서에 적혀 있습니다. 온타리오주에서는 댁에서 계약서에 서명하신 경우, 사본을 받으신 날부터 10일 안에 취소하실 수 있고 환불은 15일 안에 해 드립니다.
- *(Source: memo F32, [ontario.ca](https://www.ontario.ca/page/your-rights-when-signing-or-cancelling-contract), snippet. Not legal advice.)*

**7. Do you speak Korean?**
- EN: Yes, Korean-speaking service is available by phone, text and in person.
- KO: 네, 전화, 문자, 방문 모두 한국어로 상담하실 수 있습니다.

**8. [Gutters] Do you also clean windows or pressure-wash?**
- EN: No. We clean gutters only, by hand from a ladder. You pay when the job is done.
- KO: 아니요. 처마 물받이만 사다리에 올라 손으로 청소합니다. 작업이 끝난 뒤 결제하시면 됩니다.

**9. [Snow] When do I pay, and what happens if not enough contracts are signed?**
- EN: Nothing is paid before Dec 1. The season (Dec 1 – Mar 31) is billed in 4 instalments on Dec 1, Jan 1, Feb 1 and Mar 1. If we have not signed our minimum number of snow contracts (all areas combined) by Nov 20, every season agreement is void and you owe nothing. We'll tell you by Nov 21 whether it goes ahead.
- KO: 12월 1일 전에는 돈을 받지 않습니다. 시즌(12월 1일 – 3월 31일) 요금은 12월 1일, 1월 1일, 2월 1일, 3월 1일에 4번 나눠 내십니다. 11월 20일까지 전체 제설 계약(모든 지역 합계)이 최소 건수에 이르지 않으면 모든 시즌 계약은 무효가 되고, 내실 돈은 없습니다. 진행 여부는 11월 21일까지 알려 드립니다.
- *(Source: snow agreement, "Minimum-contract condition (November 20)" clause, `content/agreements.ts`.)*

**10. [Snow] Where does the snow go?**
- EN: On your property, never onto the road. Pushing snow onto the road is against Ontario's Highway Traffic Act (s.181) and Toronto's Municipal Code (743-9).
- KO: 고객님 대지 안에 쌓아 두고, 절대 도로로 밀어내지 않습니다. 눈을 도로로 밀어내는 것은 온타리오 도로교통법(HTA 181조)과 토론토 시 조례(743-9) 위반입니다.
- *(Source: memo F34, [defendcharges](https://defendcharges.ca/EN/provincial-offences2/municipal-bylaw-offences/deposit-of-snow-on-roadway), snippet. Outside Toronto, check your own city's rule.)*

---

## 5. Verification notes

| Point | Detail | Source / status |
|---|---|---|
| Review time | "Once you submit, review can take **up to five business days**." | memo F38; [MrBigleg playbook](https://github.com/MrBigleg/okf-local-seo/blob/128c1744cf4c8cd87ab2fbe04cc18ab6d6316810/bundles/local-seo/gbp/verification.md), SECONDARY (dated 2026-07-06, marked stale after 2026-10-06) |
| Postcard | "Most codes arrive **within 14 days**." Codes expire after 30 days. | same, SECONDARY |
| Method | Google **assigns** the verification method (video recording, phone or text, email, live video call, postcard, Search Console). You do not choose it. | same, SECONDARY |
| Video verification | One continuous live mobile recording of at least 30 seconds. It shows the location, business evidence (for service-area businesses: tools, equipment, branded vehicle or clothing) and **proof of management** (for example a business licence or a utility bill). | same, SECONDARY. Prepare a branded shirt, your kit and a door hanger before you start. |
| Service-area business | Remove the street address. List up to 20 service areas (city or postal code), within about 2 hours' driving. | same, SECONDARY. Keep to your real cluster. |
| Edits | Edits can take up to 48 hours to appear. | same, SECONDARY |
| Planning | **Not counted on for October** (memo build item 17). You may start in week 1, as the tooling dossier suggests, but start only after the business-name check. | memo; `business/research/dossiers/cross_tooling.json` |

Google's official help pages were not opened by the research ("not verified directly (secondary playbook dated 2026-07-06 only)", tooling dossier). Follow the on-screen steps if they differ.

---

## 6. Reviews and updates

- Ask only real, paying clients for a review, using the review-request script (build item 7). A text or email asking for a review must carry your business name, mailing address, a contact and an unsubscribe line (memo F11, F13).
- **Never** write, buy or swap reviews. Offer no discounts or gifts for reviews. Google's review policy was not researched, so stay on the safe side.
- Reply to reviews briefly and politely, and never reveal a client's address or details.
- If the profile offers "updates" or posts, you can reuse the texts in `01-kijiji-facebook-posts.md`. The rules for profile posts were not researched.

---

## 7. Sources

- Decision memo: `business/research/decision-memo.md` (F11, F13, F32, F34, F36, F38; section 6; build items 13 and 17)
- Tooling dossier: `business/research/dossiers/cross_tooling.json` (verification details, unknowns)
- Price book: `config/prices.ts`; switches: `config/business.ts`
- This file is not legal advice.
