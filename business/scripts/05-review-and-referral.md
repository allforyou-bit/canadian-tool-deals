# 05 · Reviews, referrals and biweekly cleaning / 후기·소개·2주 정기 청소

> **Draft v1, 2026-09-23.** The owner approves the Korean before use (memo §10, item 7). Scripts and templates are ≤ 120 words per language. The owner sends every message; the AI never sends.
> 초안입니다. 사장님이 한국어 문구를 확인·승인한 뒤 사용하세요.

| Placeholder | Meaning | 뜻 |
|---|---|---|
| `{BRAND}` `{NAME}` `{AREA}` | Business name in the message's language, your first name, your cluster | 상호, 사장님 이름, 영업 구역 |
| `{CUSTOMER}` | The person you are talking or writing to | 말하거나 메시지를 받는 사람 이름 |
| `{REFERRER_FULL_NAME}` | **Full name** of the client who referred them (required by SOR/2013-221 s.4(1)) | 소개해 준 고객의 **성과 이름 전체** |
| `{REVIEW_LINK}` | Link to a real review page you control (for example your Google Business Profile, once verified) | 실제 후기 페이지 링크 |
| `{LOW}`–`{HIGH}` | Range from the calculator on `{SITE}`, with $ | 사이트 계산기 금액 범위($ 포함) |
| `{MAILING_ADDRESS}` `{PHONE}` `{SITE}` | CASL ID details (config `contact`, `siteUrl`) | CASL 발신자 정보 |

---

## 5A. Review request after a completed job / 작업 완료 후 후기 요청

| EN | KO |
|---|---|
| Ask in person at the end of the job. Send the link by text only under the consent rule below. | 작업이 끝나면 먼저 직접 부탁하세요. 링크 문자는 아래 동의 규칙에 맞을 때만 보내세요. |
| Ask for an **honest** review. Never offer money, a discount, a gift or a prize draw for a review, and never ask only the happy customers: ask everyone the same way. | **솔직한** 후기를 부탁하세요. 후기 대가로 돈·할인·선물·추첨을 주지 마세요. 만족한 고객만 골라서 부탁하지 말고 모두에게 똑같이 부탁하세요. |
| Never write, edit or post a review yourself, and never ask family or friends to post one. | 후기를 직접 쓰거나 고치거나 올리지 말고, 가족·지인에게 써 달라고 하지도 마세요. |
| Review-platform rules (Google and others) and the Competition Act on reviews were **not researched** (확인 필요). The rules above are this business's own policy. | 구글 등 플랫폼의 후기 정책과 경쟁법(Competition Act)상 후기 규정은 **조사되지 않았어요(확인 필요)**. 위 규칙은 우리 가게 자체 방침이에요. |
| Send only when `{REVIEW_LINK}` exists. Google Business Profile verification can take up to 5 business days, or up to 14 days by postcard (memo F38, secondary source); it is not counted on for October. | 후기 페이지가 생긴 뒤에만 보내세요. 구글 비즈니스 프로필 인증은 최대 영업일 5일, 우편 인증은 최대 14일 걸릴 수 있어요(2차 자료). |
| **Consent rule for texts.** Send the text versions (5A review link, 5D biweekly pitch) only if the client ticked the marketing opt-in box on the site's quote form, or asked you in person at the end of the job to text it (a message sent at the client's request: SOR/2013-221 s.3(b), memo F12; log the date and their words in the CRM). Otherwise ask in person only. The agreement has no marketing tick box: it only says we message clients if they agree separately. Why: CASL alone would allow 2 years of implied consent after a purchase ([CASL s.10(10)](https://github.com/justicecanada/laws-lois-xml/blob/main/eng/acts/E-1.6.xml)), but our privacy notice, FAQ and agreement promise no marketing messages without a separate opt-in, and we keep that promise. Every text keeps the ID and opt-out lines. | **문자 동의 규칙.** 문자(5A 후기 링크, 5D 2주 정기 청소 제안)는 고객이 사이트 견적 양식에서 마케팅 수신 동의란에 체크했거나, 작업이 끝날 때 직접 "문자로 보내 달라"고 하신 경우에만 보내세요(고객 요청에 따른 메시지: SOR/2013-221 s.3(b), 메모 F12. 날짜와 고객이 하신 말을 CRM에 적어 두세요). 그 밖의 경우에는 직접 말로만 부탁하세요. 계약서에는 마케팅 수신 체크란이 없고, "따로 동의하신 경우에만 보낸다"고만 적혀 있어요. 이유: CASL만 보면 구매 고객은 2년간 묵시적 동의가 있지만(CASL s.10(10)), 저희 개인정보 안내·FAQ·계약서에서 따로 동의한 분께만 마케팅 메시지를 보낸다고 약속했으니 그 약속을 지켜야 해요. 문자에는 발신자 정보와 수신거부 문구를 꼭 넣으세요. |
| Before/after photos of a client's home go into marketing only with their separate written photo opt-in (memo §6). | 고객 집 전후 사진은 고객이 따로 서면 동의한 경우에만 홍보에 써요. |

> **Send only with consent / 동의가 있을 때만:** see the consent rule above. 위 문자 동의 규칙에 맞을 때만 보내세요.

**EN**
```sms
Hi {CUSTOMER}, {NAME} from {BRAND}. Thank you for having me today! If you have a minute, would you leave an honest review? Good or bad, it helps me improve and helps your neighbours decide: {REVIEW_LINK}
{BRAND}, {MAILING_ADDRESS}, {PHONE}, {SITE}
Reply STOP to opt out.
```

**KO**
```sms
안녕하세요 {CUSTOMER}님, {BRAND} {NAME}입니다. 오늘 맡겨 주셔서 감사합니다! 잠깐 시간 되시면 솔직한 후기 부탁드려도 될까요? 좋은 점이든 아쉬운 점이든 제가 더 잘하는 데, 그리고 이웃분들이 고르시는 데 도움이 돼요. {REVIEW_LINK}
{BRAND}, {MAILING_ADDRESS}, {PHONE}, {SITE}
수신을 원치 않으시면 STOP이라고 답장해 주세요.
```

---

## 5B. Asking a client for a referral (in person) / 소개 부탁 (직접 말하기)

**EN**
```say
Thanks again, {CUSTOMER}. I'm hoping to grow by word of mouth here in {AREA}. If a friend or neighbour needs a clean, would you pass on my card? Or, if they're happy for you to, you can give me their number or email, and I'll tell them you suggested it.
```

**KO**
```say
다시 한번 감사합니다. 저는 {AREA}에서 입소문으로 조금씩 일을 늘려 가고 싶어요. 혹시 주변에 청소가 필요한 분이 계시면 제 안내지를 전해 주시겠어요? 그분이 괜찮다고 하시면 연락처나 이메일을 주셔도 돼요. 연락드릴 때 {CUSTOMER}님이 소개해 주셨다고 꼭 말씀드릴게요.
```

| EN | KO |
|---|---|
| Ask the client to check with their friend first. Write down the referrer's **full name**, the friend's contact, and the date. | 고객이 먼저 친구분께 물어보도록 부탁하세요. 소개해 준 분의 **성과 이름 전체**, 친구분 연락처, 날짜를 적어 두세요. |
| The referral exemption covers only the **first** message, and only when the referrer has a relationship with both you and the friend ([SOR/2013-221 s.4(1)](https://github.com/justicecanada/laws-lois-xml/blob/main/eng/regulations/SOR-2013-221.xml), memo F12). No reply means no second message. | 소개 예외는 **첫 메시지 한 번**에만, 그리고 소개한 분이 사장님과 친구분 모두와 아는 사이일 때만 적용돼요. 답이 없으면 두 번째 메시지는 보내지 마세요. |
| No reward is offered for referrals unless the owner adds one to the price book. | 소개 보상은 사장님이 가격표에 추가하지 않는 한 약속하지 마세요. |

## 5C. First message to a referred person / 소개받은 분께 보내는 첫 메시지

The message must give the referrer's full name and say it is sent because of the referral (SOR/2013-221 s.4(1)).
소개한 분의 성과 이름 전체를 밝히고, 소개 때문에 연락한다고 말해야 해요.

**EN**
```sms
Hi {CUSTOMER}, this is {NAME} from {BRAND}. I'm writing because {REFERRER_FULL_NAME} referred you and gave me your number. I clean homes in {AREA}: deep, move-in/out and regular cleans. If you'd like a price, just reply here or try {SITE}. If not, I won't message again.
{BRAND}, {MAILING_ADDRESS}, {PHONE}
Reply STOP to opt out.
```

**KO**
```sms
안녕하세요 {CUSTOMER}님, {BRAND} {NAME}입니다. {REFERRER_FULL_NAME}님이 소개해 주시면서 연락처를 알려 주셔서 연락드려요. 저는 {AREA}에서 딥클린(대청소), 입주·이사 청소, 정기 청소를 하고 있어요. 가격이 궁금하시면 여기로 답장 주시거나 {SITE}에서 확인해 보세요. 필요 없으시면 다시 연락드리지 않을게요.
{BRAND}, {MAILING_ADDRESS}, {PHONE}
수신을 원치 않으시면 STOP이라고 답장해 주세요.
```

**EN (email)**
```email
Subject: {REFERRER_FULL_NAME} suggested I get in touch

Hi {CUSTOMER},

I'm {NAME} from {BRAND}. I'm writing because {REFERRER_FULL_NAME} referred you and gave me your email. I clean homes in {AREA}: deep cleans, move-in/out cleans and regular cleaning, at a flat price you know before I start.

If you'd like a price, reply here or get an instant estimate at {SITE}. If not, I won't write again.

{NAME}
{BRAND} · {MAILING_ADDRESS} · {PHONE} · {SITE}
To stop getting emails from us, reply "unsubscribe".
```

**KO (email)**
```email
제목: {REFERRER_FULL_NAME}님 소개로 연락드립니다

{CUSTOMER}님, 안녕하세요.

{BRAND}의 {NAME}입니다. {REFERRER_FULL_NAME}님이 소개해 주시면서 이메일 주소를 알려 주셔서 연락드려요. 저는 {AREA}에서 딥클린(대청소), 입주·이사 청소, 정기 청소를 하고 있고, 가격은 작업 전에 미리 정해서 알려 드려요.

가격이 궁금하시면 답장 주시거나 {SITE}에서 바로 예상 금액을 확인해 보세요. 필요 없으시면 다시 연락드리지 않을게요.

{NAME} 드림
{BRAND} · {MAILING_ADDRESS} · {PHONE} · {SITE}
이메일 수신을 원치 않으시면 '수신거부'라고 답장해 주세요.
```

---

## 5D. Biweekly recurring pitch / 2주 정기 청소 제안

| EN | KO |
|---|---|
| Pitch at the end of a first deep or move-in clean, in person. Use the text version only if you didn't get to ask **and** the consent rule in 5A allows it. | 첫 딥클린이나 입주·이사 청소가 끝날 때 직접 제안하세요. 직접 못 물어봤고 **5A의 문자 동의 규칙에도 맞을 때만** 문자를 쓰세요. |
| Price = the price book's **standard** clean for their home (GTA default, 2 bed: $180–$210; must match the live price book). `config/prices.ts` has no recurring discount, so don't offer one unless the owner adds it there first. | 가격은 가격표의 **일반 청소** 금액이에요(GTA 기본 침실 2개: $180–$210, 현재 가격표와 같아야 함). 가격표에 정기 할인이 없으니, 먼저 가격표에 넣기 전에는 할인을 약속하지 마세요. |
| Skip, reschedule and cancel terms: say them exactly as your cleaning agreement states (memo §10, item 5). | 건너뛰기·일정 변경·해지 조건은 청소 계약서에 적힌 그대로 말하세요. |
| No key custody in month 1: the client is home or uses a lockbox they control (memo §2). | 첫 달에는 열쇠를 맡지 않아요. 고객이 집에 있거나 고객이 관리하는 키박스를 써요. |
| If they say no, don't pitch again by text. | 거절하면 문자로 다시 제안하지 마세요. |

**EN (in person)**
```say
Thanks, {CUSTOMER}! Now that the deep clean is done, a regular clean keeps it this way. I could come every two weeks for a standard clean, on the same day each time. For your home, that's {LOW} to {HIGH} a visit. Would you like to try it? I can pencil in a day.
```

**KO (직접 말하기)**
```say
감사합니다, {CUSTOMER}님! 이번에 딥클린을 해 두셨으니 이제 정기적으로 관리하시면 이 상태를 유지하기 쉬워요. 2주에 한 번, 매번 같은 요일에 와서 일반 청소를 해 드릴 수 있어요. 댁은 1회에 {LOW}–{HIGH}이에요. 한번 해 보시겠어요? 원하시면 날짜를 잡아 둘게요.
```

> **Send only with consent / 동의가 있을 때만:** the client ticked the site's marketing opt-in box, or asked you in person to text it (date and words logged). Otherwise don't text; our privacy notice and agreement promise no marketing messages without a separate opt-in. 고객이 사이트에서 마케팅 수신 동의란에 체크했거나, 직접 문자로 보내 달라고 하신 경우(날짜와 하신 말 기록)에만 보내세요. 그 밖에는 문자를 보내지 마세요. 개인정보 안내와 계약서에서 따로 동의한 분께만 마케팅 메시지를 보낸다고 약속했어요.

**EN (text)**
```sms
Hi {CUSTOMER}, {NAME} from {BRAND}. Thanks again for today! If you'd like to keep your place this way, I can come every two weeks for a standard clean, on the same day each time: {LOW}–{HIGH} per visit. Want me to hold a day for you?
{BRAND}, {MAILING_ADDRESS}, {PHONE}, {SITE}
Reply STOP to opt out.
```

**KO (문자)** (위와 같은 동의 조건: 마케팅 수신 동의란 체크, 또는 고객이 직접 문자로 보내 달라고 하신 경우에만)
```sms
안녕하세요 {CUSTOMER}님, {BRAND} {NAME}입니다. 오늘 다시 한번 감사드려요! 지금 상태를 계속 유지하고 싶으시면 2주에 한 번, 매번 같은 요일에 일반 청소를 해 드릴 수 있어요. 1회 {LOW}–{HIGH}이에요. 날짜를 잡아 드릴까요?
{BRAND}, {MAILING_ADDRESS}, {PHONE}, {SITE}
수신을 원치 않으시면 STOP이라고 답장해 주세요.
```

**Sources / 출처:** decision memo §2, §6, §7 (week 3: referral names the referrer), §10 and F11, F12, F38; `business/research/dossiers/cross_compliance.json` (SOR/2013-221 s.4(1) wording; CASL s.10(10)); `config/prices.ts`; the opt-in promise in `components/PrivacyNotice.tsx`, `content/faq.ts` (privacy) and `content/agreements.ts` (PRIVACY).
