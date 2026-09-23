# 02 · Handling objections / 거절·반대 의견 대응

> **Draft v1, 2026-09-23.** The owner approves the Korean before use (memo §10, item 7). Each answer is ≤ 120 words per language. Say only what is true.
> 초안입니다. 사장님이 한국어 문구를 확인·승인한 뒤 사용하세요. 사실만 말하세요.

| Placeholder | Meaning | 뜻 |
|---|---|---|
| `{BRAND}` `{NAME}` `{AREA}` `{PHONE}` | Business name (config `business.brand`), your first name, your cluster, business phone | 상호, 사장님 이름, 영업 구역, 사업용 전화 |
| `{LOW}`–`{HIGH}` | Range from the calculator on `{SITE}`, with $ | 사이트 계산기 금액 범위($ 포함) |

---

## Price card (GTA defaults) / 가격표 (GTA 기본값)

> Worked out with `lib/quote.ts` from `config/prices.ts` (GTA) on 2026-09-23. **These must match the live price book.** If the price book or the city changes, use the calculator on `{SITE}` instead. Every range is an estimate, confirmed on site. No HST is shown while `salesTaxRegistered` is OFF.
> 2026-09-23 기준 GTA 기본값입니다. **현재 가격표와 반드시 같아야 해요.** 가격표나 도시가 바뀌면 `{SITE}` 계산기를 쓰세요. 모든 금액은 예상 금액이고 현장에서 확정해요.

| Service / 서비스 | 1 bed / 침실 1 (1 bath) | 2 bed (1 bath) | 3 bed (2 baths) | 4 bed (2 baths) |
|---|---|---|---|---|
| Standard / 일반 청소 | $150–$175 | $180–$210 | $220–$255 | $260–$300 |
| Deep / 딥클린(대청소) | $230–$265 | $270–$315 | $320–$370 | $370–$430 |
| Move-in/out / 입주·이사 청소 | $260–$300 | $300–$345 | $360–$415 | $420–$485 |

Extras change the range; run the calculator: extra bathroom $30, inside oven $40, inside fridge $35, inside empty cabinets $40, within 24 h / weekend / holiday +15%. Track B, only when ON: gutters 1 storey $175–$205, 2 storeys $225–$260, 3 storeys $300–$345, downspout flush +$70; snow, single driveway $500–$575 per season in 4 instalments; November visit $60.
추가 항목이 있으면 금액이 바뀌니 계산기를 쓰세요.

---

## 2.1 "That's too expensive." / "너무 비싸요."

**EN**
```say
I understand. It's a flat price, so you know the total before I start, with no hourly surprises. For your home it's {LOW} to {HIGH}, and I confirm it when I see the home. If you'd like to spend less, a standard clean costs less than a deep clean, or we can skip the extras. It's fine to compare, too. Can I leave this with you so you can decide later?
```

**KO**
```say
네, 이해해요. 정해진 가격이라 작업 전에 총액을 먼저 아시고, 시간이 늘어나서 돈이 더 나오는 일은 없어요. 댁은 {LOW}–{HIGH} 정도이고, 집을 본 뒤 작업 전에 확정해 드려요. 부담되시면 대청소 대신 일반 청소로 하시거나 추가 항목을 빼셔도 돼요. 다른 곳과 비교해 보셔도 괜찮아요. 안내지 드릴 테니 천천히 생각해 보세요.
```

| EN | KO |
|---|---|
| Never quote below the price book on the spot. Change the price book first if you decide to change prices. | 그 자리에서 가격표보다 싸게 부르지 마세요. 가격을 바꾸려면 가격표부터 고치세요. |
| Never criticise other cleaners or quote their prices. Every market price in the research is an unopened search snippet (memo §8). | 다른 업체를 깎아내리거나 그 가격을 말하지 마세요. 조사한 시장 가격은 모두 검색 요약일 뿐이에요. |

## 2.2 "Are you insured?" / "보험 있으세요?"

Use **A** only when the liability policy is bound (config `insured` = true). Otherwise use **B**. Never say "insured", "bonded" or "licensed" unless it is true.
배상책임보험이 실제로 가입된 경우(설정 `insured` = true)에만 **A**를 쓰고, 아니면 **B**를 쓰세요. 사실이 아니면 '보험', '본딩', '면허'라는 말을 하지 마세요.

**EN — A (policy bound)**
```say
Yes. I have general liability insurance, and I can show you proof. I don't keep keys: you're home while I work, or you use a lockbox you control. If anything is damaged, tell me within 24 hours with photos. That's in the agreement you'll get.
```

**KO — A (보험 가입됨)**
```say
네, 배상책임보험에 가입되어 있고 증명서를 보여 드릴 수 있어요. 열쇠는 맡지 않아요. 댁에 계실 때 작업하거나, 고객님이 관리하시는 키박스를 쓰시면 돼요. 혹시 파손된 게 있으면 24시간 안에 사진과 함께 알려 주세요. 받으실 계약서에도 적혀 있어요.
```

**EN — B (not bound yet)**
```say
Not yet. My liability insurance is being set up, and I won't do any work in your home until it's in place. I'll show you proof before your date. I'm new in {AREA}, so I don't have many reviews yet. You're welcome to be home while I work.
```

**KO — B (아직 가입 전)**
```say
아직은 아니에요. 배상책임보험 가입을 진행하고 있고, 보험이 시작되기 전에는 댁에서 어떤 작업도 하지 않아요. 작업 날 전에 증명서를 보여 드릴게요. {AREA}에서 새로 시작해서 아직 후기가 많지 않아요. 작업하는 동안 집에 계셔도 괜찮아요.
```

**If asked "Are you bonded?" / "본딩(보증보험) 있어요?"**

**EN**
```say
No, I'm not bonded. That's why I don't hold keys.
```

**KO**
```say
보증보험(본딩)은 없어요. 그래서 열쇠는 맡지 않아요.
```

| EN | KO |
|---|---|
| The damage-report rule (24 h, photos) must match your signed cleaning agreement (memo §10, item 5). | 파손 신고 규칙(24시간, 사진)은 실제 청소 계약서 내용과 같아야 해요. |
| If the policy isn't bound by the booked date, move the job. No direct-client work before binding (memo §6). Bonding norms were not researched; no key custody in month 1 (memo §2). | 예약일까지 보험이 시작되지 않으면 날짜를 옮기세요. 본딩 관행은 조사되지 않았고, 첫 달에는 열쇠를 맡지 않아요. |

## 2.3 "Not now." / "지금은 아니에요." (timing / 시기)

**EN**
```say
No problem. When would suit you better: before a move, before the holidays, or in the spring? I can note it and come back then, or you can text me any time at {PHONE}. The card has a QR code that gives you an instant price.
[SNOW, if ON] For snow, signing now costs nothing before December 1, and the contract is cancelled if not enough neighbours sign by November 20.
```

**KO**
```say
괜찮아요. 언제가 더 좋으실까요? 이사 전이나 연말 전, 아니면 봄? 적어 두었다가 그때 다시 들를게요. 아니면 언제든 {PHONE}으로 문자 주세요. 안내지 QR코드를 찍으면 바로 가격을 보실 수 있어요.
[SNOW, 제설 운영 시] 제설은 지금 신청하셔도 12월 1일 전에는 돈이 나가지 않고, 11월 20일까지 이웃 신청이 충분하지 않으면 계약은 취소돼요.
```

If they name a time, log **CB** with that date and come back only then. Don't text them unless they asked. 고객이 시간을 정하면 **CB**로 날짜를 적고 그때만 다시 가세요. 요청이 없으면 문자하지 마세요.

## 2.4 "I already have someone." / "이미 쓰는 분이 있어요."

**EN**
```say
That's great. If you're happy with them, keep them! If you ever need a one-time deep clean or a move-out clean, or they're away, I'm nearby. Can I leave this with you?
```

**KO**
```say
잘됐네요. 만족하시면 계속 쓰시는 게 좋죠! 혹시 한 번 대청소나 이사 청소가 필요하시거나, 그분이 못 오실 때 연락 주세요. 가까이 있어요. 안내지 하나 드려도 될까요?
```

Never criticise their cleaner or ask what they pay. Log **NI** (or **CB** if they ask you to come back). 지금 쓰는 분을 흉보거나 얼마 내는지 묻지 마세요.

## 2.5 "Just send me something." / "그냥 뭐 좀 보내 주세요."

**EN**
```say
Sure! Would a text or an email be better for you? I'll send the price range and my contact details. Here's the card too. The QR code gives you an instant price.
```

**KO**
```say
네, 그럼요! 문자랑 이메일 중에 뭐가 편하세요? 예상 가격이랑 제 연락처를 보내 드릴게요. 안내지도 드릴게요. QR코드를 찍으면 바로 가격이 나와요.
```

| EN | KO |
|---|---|
| Write down the number or email, that they asked for information, and the date: this is your consent evidence (CASL s.13). Log **Q**. | 번호나 이메일, 정보 요청을 받았다는 사실, 날짜를 적으세요. 동의 증거가 돼요(CASL s.13). **Q**로 기록하세요. |
| Send the file 03 reply the same day, with the CASL ID and opt-out lines. Follow-ups: file 04 only. | 당일 03번 템플릿(발신자 정보·수신거부 문구 포함)으로 보내고, 후속 연락은 04번 규칙만 따르세요. |
| If they won't give contact details, just leave the hanger. | 연락처를 주지 않으면 도어행어만 드리고 끝내세요. |

**Sources / 출처:** `config/prices.ts`, `lib/quote.ts`; decision memo §2, §6, §8, §10 and F11. Insurance status is set by `business.insured` in `config/business.ts`.
