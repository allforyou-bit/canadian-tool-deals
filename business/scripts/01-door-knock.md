# 01 · Door-knocking / 방문(도어 노킹) 영업

> **Draft v1, 2026-09-23.** The owner reads and approves the Korean before use (memo §10, item 7). Not legal advice.
> 초안입니다. 사장님이 한국어 문구를 직접 확인·승인한 뒤 사용하세요. 법률 자문이 아닙니다.
>
> Each script is shown in English, then in Korean for Korean-speaking homeowners. Scripts are ≤ 120 words per language; openers are about 20 seconds (≈ 55 words).
> 각 스크립트는 영어 → 한국어(한국어를 쓰시는 집주인용) 순서입니다.

| Placeholder | Meaning | 뜻 |
|---|---|---|
| `{BRAND}` | Business name in the language you are speaking (config `business.brand.en` / `.ko`) | 말하는 언어의 상호 (설정 `business.brand`) |
| `{NAME}` | Your first name | 사장님 이름 |
| `{AREA}` | Your one neighbourhood cluster (config `serviceArea`) | 영업 구역 이름 |
| `{PHONE}` `{SITE}` | Business phone, website | 사업용 전화번호, 웹사이트 |
| `{LOW}`–`{HIGH}` | Range from the calculator on `{SITE}`, with $ (price card: file 02) | 사이트 계산기 금액 범위($ 포함, 가격표는 02번 파일) |
| `{PER_VISIT}` | November snow per-visit rate, config `snow.perVisit` (GTA default $60; must match the live price book) | 11월 제설 1회 요금 (GTA 기본 $60, 현재 가격표와 같아야 함) |

---

## Before your first shift / 첫 방문 전에

| EN | KO |
|---|---|
| Gate 0 is done: you confirmed from your own IRCC documents that you may be self-employed (memo §2). | Gate 0 완료: 본인 IRCC 서류로 자영업이 가능한 신분인지 확인했어요. |
| Door-to-door selling rules in your city (municipal soliciting bylaws) were **not researched**. Check the city website or call 311 before the first shift. | 시(市)의 방문판매 조례는 **조사되지 않았어요(확인 필요)**. 첫 방문 전에 시청 웹사이트나 311에서 확인하세요. |
| Book work dates only **after** your liability insurance starts. No direct-client work before the policy is bound (memo §6, §7). | 작업 날짜는 배상책임보험 시작일 **이후**로만 잡으세요. 보험 가입 전에는 직접 고객 작업을 하지 않아요. |
| Bring: door hangers with this cluster's QR code, blank service agreements with the Ontario 10-day notice, the door log, a pen, your phone with `{SITE}` open. | 준비물: 이 구역 전용 QR이 있는 도어행어, 온타리오 10일 취소 안내가 들어간 계약서, 방문 기록지, 펜, `{SITE}`를 열어 둔 휴대폰. |
| Daylight only; check today's sunset time (October sunset times were not researched). At most 40 doors on a day you also have a job. No knocking on Thanksgiving Monday, Oct 12 (memo §7). | 해가 있을 때만 방문하세요(10월 일몰 시간은 조사 안 됨, 매일 확인). 작업이 있는 날은 최대 40집. 추수감사절 월요일(10/12)에는 방문하지 않아요. |

---

## 1A. 20-second opener — cleaning only / 20초 첫인사 — 청소만

**EN**
```say
Hi, sorry to bother you! I'm {NAME} with {BRAND}. I clean homes here in {AREA}: deep cleans, move-in and move-out cleans, and regular cleaning. It's a flat price, and you know it before I start. Is a deep clean or a move-out clean something you might need this fall? If not, can I leave this with you?
```

**KO**
```say
안녕하세요, 갑자기 찾아와서 죄송해요. 저는 {BRAND}의 {NAME}입니다. 여기 {AREA}에서 집 청소를 하고 있어요. 대청소, 입주·이사 청소, 정기 청소를 하는데, 가격은 작업 전에 미리 정해서 알려 드려요. 혹시 올가을에 대청소나 이사 청소 하실 계획 있으세요? 아니시면 안내지만 하나 드리고 갈게요.
```

## 1B. 20-second opener — when Track B is ON / 20초 첫인사 — 트랙 B 운영 시

Say the `[GUTTERS]` part only if gutters are ON in config (Gate G1 passed), and the `[SNOW]` part only if snow is ON (Gate S passed: written snow insurance in hand).
`[GUTTERS]`는 설정에서 홈통 청소가 켜져 있을 때(G1 통과)만, `[SNOW]`는 제설이 켜져 있을 때(Gate S 통과, 제설 보험 서면 확인)만 말하세요.

**EN**
```say
Hi, sorry to bother you! I'm {NAME} with {BRAND}, here in {AREA}. I do house cleaning. [GUTTERS] This fall I also clean gutters by hand, once the leaves are down. [SNOW] And I'm signing up homes on this street for snow clearing this winter. No payment for the season before December 1. Could any of that help you? If not, can I leave this with you?
```

**KO**
```say
안녕하세요, 갑자기 죄송해요. 저는 {AREA}에서 일하는 {BRAND}의 {NAME}입니다. 집 청소를 하고 있고요, [GUTTERS] 올가을에는 낙엽이 다 떨어진 뒤에 홈통(처마 물받이) 청소도 손으로 해 드려요. [SNOW] 그리고 이 거리 댁들을 대상으로 올겨울 제설 신청도 받고 있어요. 시즌 요금은 12월 1일 전에는 받지 않아요. 혹시 필요하신 게 있을까요? 아니시면 안내지만 드리고 갈게요.
```

## 1C. If they're interested / 관심을 보이면

**EN**
```say
Great! How many bedrooms and bathrooms, and when would you like it done? … For your home, that's {LOW} to {HIGH}. I confirm the exact price when I see the home, before I start. Would you like to book a date now, or should I text you the estimate?
```

**KO**
```say
좋아요! 침실과 욕실이 몇 개인지, 언제쯤 원하시는지 여쭤봐도 될까요? … 그러면 예상 금액은 {LOW}–{HIGH}이에요. 정확한 금액은 작업 전에 집을 보고 확정해 드려요. 지금 날짜를 잡아 드릴까요, 아니면 견적을 문자로 보내 드릴까요?
```

Text them only if they say yes; write down their number and "asked for estimate at door, date" (code **Q**). 고객이 좋다고 할 때만 문자를 보내고, 번호와 "방문 시 견적 요청, 날짜"를 기록하세요(**Q**).

## 1D. If they ask about gutters (Track B ON) / 홈통 청소를 물어보면

**EN**
```say
I clean the gutters by hand, with a scoop, from a ladder. Gutters only: no windows and no pressure washing. For your house it's {LOW} to {HIGH}, and you pay when the job is done. If the weather isn't safe for a ladder that day, we pick another date.
```

**KO**
```say
사다리에 올라가서 홈통을 손과 스쿱으로 직접 청소해 드려요. 홈통만 하고, 창문 청소나 압력 세척은 하지 않아요. 댁은 {LOW}–{HIGH}이고, 작업이 끝난 뒤에 결제하시면 돼요. 그날 날씨 때문에 사다리 작업이 위험하면 날짜를 다시 잡아요.
```

## 1E. If they ask about snow (Track B ON) / 제설을 물어보면

**EN**
```say
It's a season contract, December 1 to March 31, for your driveway, with a shovel or a walk-behind snowblower. Snow never goes onto the road. The season is {LOW} to {HIGH}, paid in 4 monthly instalments, December 1 to March 1. No payment for the season before December 1. If it snows in November, each visit is {PER_VISIT}. The snow depth that starts a visit is in the agreement. The contract only goes ahead if enough neighbours sign by November 20. If not, it's cancelled and you owe nothing.
```

**KO**
```say
시즌 계약이고 기간은 12월 1일부터 3월 31일까지예요. 진입로 눈을 삽이나 밀고 다니는 제설기로 치워 드리고, 눈을 도로로 밀어내는 일은 절대 없어요. 시즌 요금은 {LOW}–{HIGH}이고, 12월 1일부터 3월 1일까지 매달 한 번씩 4번 나눠 내시면 돼요. 12월 1일 전에는 시즌 요금을 받지 않아요. 11월에 눈이 오면 1회에 {PER_VISIT}이에요. 눈이 몇 cm 오면 출동하는지는 계약서에 적혀 있어요. 그리고 11월 20일까지 이웃 신청이 충분히 모여야 계약이 시작되고, 안 모이면 취소되니까 내실 돈은 없어요.
```

Bill November visits as the snow agreement says (build item 5). 11월 1회 요금의 청구 시점은 제설 계약서(빌드 항목 5)대로 하세요.

## 1F. When a job is signed at the door — Ontario 10-day line / 방문 계약 시 — 온타리오 10일 취소 안내

Say this every time a customer signs at their home in Ontario. 온타리오에서 고객 집에서 계약할 때마다 꼭 말하세요.

**EN**
```say
Because we're signing this at your home, you can cancel within 10 days after you get your signed copy, for any reason. Just contact me using the details on your copy. If you've paid anything, I refund all of it within 15 days. It's written on your copy too.
```

**KO**
```say
댁에서 계약하시는 거라서, 서명한 계약서 사본을 받으신 날부터 10일 안에는 이유 없이 취소하실 수 있어요. 사본에 있는 연락처로 알려 주시기만 하면 돼요. 이미 내신 돈이 있으면 15일 안에 전액 돌려드려요. 사본에도 똑같이 적혀 있어요.
```

| EN | KO |
|---|---|
| Hand over the signed copy on the spot. The 10 days start when the customer receives it; refund within 15 days of the cancellation ([ontario.ca](https://www.ontario.ca/page/your-rights-when-signing-or-cancelling-contract), search snippet, memo F32). | 서명한 사본은 그 자리에서 드리세요. 10일은 고객이 사본을 받은 날부터 계산하고, 환불은 취소 통지 후 15일 안에 해야 해요(메모 F32). |
| Whether doing the work inside the 10 days changes this was **not researched**. Until Consumer Protection Ontario confirms, treat money for a door-signed job done within 10 days as refundable (memo §5.3), and offer dates after day 10 when you can. | 10일 안에 작업을 해 버린 경우 어떻게 되는지는 **조사되지 않았어요(확인 필요)**. 온타리오 소비자보호국(Consumer Protection Ontario)에 확인하기 전까지는, 10일 안에 한 방문 계약 작업의 돈은 환불될 수 있다고 보고, 가능하면 10일 이후로 날짜를 잡으세요. |
| Ontario only (GTA, Ottawa). Other provinces were not researched for this; check before selling at the door there. | 온타리오(GTA, 오타와)만 해당해요. 다른 주는 조사되지 않았으니 방문 판매 전에 확인하세요. |

---

## 2. Leaving a door hanger / 도어행어 거는 법

| EN | KO |
|---|---|
| No answer: knock or ring once, wait about 20 seconds, then leave a hanger. | 응답이 없으면 한 번만 노크(또는 벨)하고 20초쯤 기다린 뒤 도어행어를 걸어 두세요. |
| Hang it on the door handle, printed side out. Not in the mailbox or mail slot, not taped to the door, not on cars or on the ground. | 문 손잡이에 인쇄면이 밖으로 보이게 거세요. 우편함·우편 투입구에 넣거나, 테이프로 붙이거나, 차나 바닥에 두지 마세요. |
| A "No soliciting", "No flyers" or "No junk mail" sign means no knock and no hanger. Log **NS**. | '방문판매 사절', '전단지 사절' 표시가 있으면 노크도, 도어행어도 하지 마세요. **NS**로 기록하세요. |
| Use only hangers with this cluster's QR code, so inquiries can be traced to the cluster (memo §10, item 6). | 이 구역 전용 QR이 찍힌 도어행어만 쓰세요. 그래야 어느 구역에서 문의가 왔는지 알 수 있어요. |
| Someone answers but is busy: hand it over, say thanks, and go. | 사람이 나왔는데 바쁘면 직접 건네고 인사한 뒤 바로 가세요. |
| Re-knock hanger doors on a later day; each re-knock is a new attempt. How well re-knocking works is unknown, so measure it (memo §7). | 도어행어를 건 집은 다른 날 다시 방문해도 돼요. 재방문은 새 시도로 기록해요. 효과는 알려진 자료가 없으니 직접 측정하세요. |

## 3. What to record in the CRM door log / 방문 기록지에 적을 것

One row per attempt: date, time, street, house number, attempt #, outcome code, service asked about, notes. 시도마다 한 줄: 날짜, 시간, 거리, 집 번호, 시도 번호, 결과 코드, 관심 서비스, 메모.

| Code | EN | KO | Next step / 다음 할 일 |
|---|---|---|---|
| **NA** | No answer, hanger left | 부재, 도어행어 걸어 둠 | Re-knock another day (new attempt) / 다른 날 재방문(새 시도) |
| **NI** | Not interested | 관심 없음 | Final. Don't knock again. / 종료. 다시 가지 않음 |
| **Q** | Asked for a price or info | 가격·정보 요청 | Send what they asked for the same day (file 03), then follow up per file 04 / 당일 03번으로 답장, 이후 04번 규칙대로 |
| **B** | Booked | 예약 완료 | Service, date, price range, agreement signed, date the copy was given (10-day count) / 서비스, 날짜, 금액, 계약서 서명, 사본 준 날짜(10일 계산용) |
| **CB** | Come back or call back at a time they chose | 다시 오라거나 전화 달라고 함 | Write the date and time they gave; contact them only then / 고객이 정한 날짜·시간을 적고 그때만 연락 |
| **NS** | No-soliciting or no-flyers sign | 방문판매·전단지 사절 표시 | Final. Skip, no hanger. / 종료. 건너뛰고 도어행어도 안 걸어요 |

| EN | KO |
|---|---|
| Write down contact details only if they gave them, plus how they want to be contacted (text, email, call) and the date. This is your consent evidence: under CASL the sender must prove consent (s.13, memo F11). | 연락처는 고객이 직접 준 경우에만 적고, 원하는 연락 방법(문자·이메일·전화)과 날짜도 함께 적으세요. CASL에서는 보낸 사람이 동의를 증명해야 해서(s.13) 이 기록이 증거가 돼요. |
| Record only what you need. No notes about people's looks, age or background (privacy, PIPEDA, memo §6). | 필요한 것만 적으세요. 외모·나이·출신 같은 개인에 대한 메모는 적지 마세요(개인정보, PIPEDA). |
| At day's end, put the totals in the DAILY email subject: `DAILY YYYY-MM-DD doors=_ answers=_ quotes=_ closes=_ completed=_ net=_` (memo §10, item 11). "answers" = someone came to the door (NI, Q, B, CB). | 하루가 끝나면 합계를 DAILY 이메일 제목에 적으세요. "answers"는 사람이 나온 경우(NI, Q, B, CB)예요. |

## 4. Safety and courtesy / 안전과 예절

| EN | KO |
|---|---|
| Respect every "No soliciting" sign. A "no" ends the conversation: thank them and leave. Never argue. | '방문판매 사절' 표시는 반드시 지키세요. 거절하면 대화는 끝이에요. 감사 인사하고 떠나세요. 절대 따지지 마세요. |
| Stay on the path or driveway. Don't cross lawns or gardens, look in windows, or open gates to back yards. | 보도나 진입로로만 다니세요. 잔디·화단을 가로지르거나, 창문을 들여다보거나, 뒷마당 문을 열지 마세요. |
| After knocking, step back from the door. Never go inside during a knock; book a separate time to see the home. | 노크한 뒤에는 문에서 한 걸음 물러서세요. 방문 중에 집 안으로 들어가지 마세요. 집을 봐야 하면 따로 시간을 잡으세요. |
| Leave right away if there's a loose dog, someone is upset, or you feel unsafe. Note it in the log. | 풀어 놓은 개가 있거나, 상대가 화를 내거나, 불안하면 바로 떠나고 기록에 남기세요. |
| Tell someone your route and finish time. Keep your phone charged. | 누군가에게 방문 경로와 끝나는 시간을 알려 두세요. 휴대폰은 충전해 두세요. |
| Say only what is true. Don't say "insured" until the policy is bound. No made-up reviews, customer numbers, awards, licences or "since 20XX". No promises about results or savings. | 사실만 말하세요. 보험 가입 전에는 '보험 있다'고 하지 마세요. 후기·고객 수·수상·면허·'20XX년부터' 같은 말을 지어내지 말고, 결과나 절약을 장담하지 마세요. |
| No snow money before December 1. Gutters are paid when the job is done. | 제설 요금은 12월 1일 전에 받지 않아요. 홈통 청소는 작업이 끝난 뒤에 받아요. |
| Don't text or email anyone who didn't ask you to (CASL, memo F11). Phone: only call back people who asked; phone-outreach (DNCL) rules were not verified (memo §6). | 요청하지 않은 사람에게 문자·이메일을 보내지 마세요(CASL). 전화는 요청한 사람에게만 다시 거세요. 전화 영업(DNCL) 규정은 확인되지 않았어요. |

**Sources / 출처:** decision memo §2, §5.3, §6, §7, §10 and F11, F32 (`business/research/decision-memo.md`). Door-knock response and close rates: not found (F45).
