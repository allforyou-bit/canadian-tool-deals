# 04 · Quote follow-up / 견적 후속 연락

> Not legal advice. The rules cited here come from the decision memo (business/research/decision-memo.md); check them before relying on them. / 법률 자문이 아닙니다. 여기 인용한 규정은 결정 메모에서 가져온 것이니, 따르기 전에 확인하세요.

> **Draft v1, 2026-09-23.** The owner approves the Korean before use (memo §10, item 7). Templates are ≤ 120 words per language, including the ID and opt-out lines. The owner sends every message; the AI never sends.
> 초안입니다. 사장님이 한국어 문구를 확인·승인한 뒤 사용하세요.

**Placeholders / 자리표시자:** `{BRAND}` business name in the message's language · `{NAME}` your first name · `{CUSTOMER}` customer's name · `{SERVICE}` what you quoted · `{LOW}`–`{HIGH}` the same range you quoted · `{MAILING_ADDRESS}` `{PHONE}` `{SITE}` CASL ID details (config `contact`, `siteUrl`).
상호 · 사장님 이름 · 고객 이름 · 견적 낸 서비스 · 보냈던 금액 그대로 · CASL 발신자 정보.

## Rules: two follow-ups, then stop / 규칙: 두 번만, 그다음엔 끝

| EN | KO |
|---|---|
| Only for people who asked you for a quote. | 견적을 요청한 사람에게만 보내세요. |
| Day 2 and day 7 after you sent the quote. Then **stop**. No third message unless they write back. | 견적을 보낸 날부터 2일째, 7일째에 한 번씩. 그다음엔 **끝**이에요. 고객이 먼저 연락하지 않으면 세 번째는 없어요. |
| Skip the follow-up if they already said no, booked, or replied STOP or "unsubscribe". | 이미 거절했거나 예약했거나 STOP·수신거부를 보냈으면 보내지 마세요. |
| Use the same channel (text or email) and the same range you quoted. | 처음 견적을 보낸 방법(문자/이메일)과 같은 금액으로 보내세요. |
| Consent: an inquiry gives 6 months of implied consent ([CASL s.10(10)](https://github.com/justicecanada/laws-lois-xml/blob/main/eng/acts/E-1.6.xml)). Every message still needs sender ID and an unsubscribe (CASL s.6(2); [SOR/2012-36 s.2(1)(d)](https://github.com/justicecanada/laws-lois-xml/blob/main/eng/regulations/SOR-2012-36.xml); memo F11, F13). | 문의하면 6개월간 묵시적 동의가 생겨요. 그래도 모든 메시지에 발신자 정보와 수신거부 문구가 필요해요. |
| Opt-outs: stop at once; the legal maximum is 10 business days, and the opt-out must keep working for 60 days (memo F11). | 수신거부는 즉시 처리하세요(법정 최대 영업일 10일, 수신거부 방법은 60일간 유지). |
| Log each follow-up in the CRM follow-ups tab: date, channel, day 2 or day 7. | CRM 후속 연락 탭에 날짜, 방법, 2일째/7일째를 기록하세요. |

---

## 4A. Day 2 — SMS / 2일째 — 문자

**EN**
```sms
Hi {CUSTOMER}, {NAME} from {BRAND}. Just checking you got my estimate for the {SERVICE} ({LOW}–{HIGH}). Any questions? I'm happy to hold one of the dates for you.
{BRAND}, {MAILING_ADDRESS}, {PHONE}, {SITE}
Reply STOP to opt out.
```

**KO**
```sms
안녕하세요 {CUSTOMER}님, {BRAND} {NAME}입니다. 보내 드린 {SERVICE} 견적({LOW}–{HIGH}) 잘 받으셨는지 확인차 연락드려요. 궁금한 점 있으시면 편하게 물어보세요. 원하시면 날짜도 잡아 둘게요.
{BRAND}, {MAILING_ADDRESS}, {PHONE}, {SITE}
수신을 원치 않으시면 STOP이라고 답장해 주세요.
```

## 4B. Day 2 — email / 2일째 — 이메일

**EN**
```email
Subject: Checking in on your {SERVICE} estimate

Hi {CUSTOMER},

Just checking that you got my estimate for the {SERVICE}: {LOW}–{HIGH}, confirmed on site before I start. If you have any questions, or would like me to hold a date, just reply or call {PHONE}.

{NAME}
{BRAND} · {MAILING_ADDRESS} · {PHONE} · {SITE}
To stop getting emails from us, reply "unsubscribe".
```

**KO**
```email
제목: {SERVICE} 견적 확인차 연락드려요

{CUSTOMER}님, 안녕하세요.

보내 드린 {SERVICE} 견적({LOW}–{HIGH}, 작업 전 현장 확인 후 확정) 잘 받으셨는지 확인차 연락드립니다. 궁금한 점이 있으시거나 날짜를 잡아 두길 원하시면 답장 주시거나 {PHONE}으로 연락 주세요.

{NAME} 드림
{BRAND} · {MAILING_ADDRESS} · {PHONE} · {SITE}
이메일 수신을 원치 않으시면 '수신거부'라고 답장해 주세요.
```

## 4C. Day 7 — SMS (last one) / 7일째 — 문자 (마지막)

**EN**
```sms
Hi {CUSTOMER}, {NAME} from {BRAND}. This is my last message about your {SERVICE} estimate ({LOW}–{HIGH}). If now isn't the right time, no problem. I won't follow up again. If you need a hand later, just text {PHONE}.
{BRAND}, {MAILING_ADDRESS}, {SITE}
Reply STOP to opt out.
```

**KO**
```sms
안녕하세요 {CUSTOMER}님, {BRAND} {NAME}입니다. {SERVICE} 견적({LOW}–{HIGH}) 관련해서 마지막으로 연락드려요. 지금은 때가 아니시면 괜찮아요. 더 이상 따로 연락드리지 않을게요. 나중에 필요하시면 {PHONE}으로 문자 주세요.
{BRAND}, {MAILING_ADDRESS}, {SITE}
수신을 원치 않으시면 STOP이라고 답장해 주세요.
```

## 4D. Day 7 — email (last one) / 7일째 — 이메일 (마지막)

**EN**
```email
Subject: Last note about your {SERVICE} estimate

Hi {CUSTOMER},

This is my last note about your {SERVICE} estimate ({LOW}–{HIGH}). If the timing isn't right, no problem. I won't follow up again. If you need a hand later, just reply to this email or call {PHONE}.

{NAME}
{BRAND} · {MAILING_ADDRESS} · {PHONE} · {SITE}
To stop getting emails from us, reply "unsubscribe".
```

**KO**
```email
제목: {SERVICE} 견적 관련 마지막 안내

{CUSTOMER}님, 안녕하세요.

{SERVICE} 견적({LOW}–{HIGH}) 관련해서 마지막으로 연락드립니다. 지금은 때가 아니시면 괜찮아요. 더 이상 따로 연락드리지 않을게요. 나중에 필요하시면 이 이메일로 답장 주시거나 {PHONE}으로 전화 주세요.

{NAME} 드림
{BRAND} · {MAILING_ADDRESS} · {PHONE} · {SITE}
이메일 수신을 원치 않으시면 '수신거부'라고 답장해 주세요.
```

**Sources / 출처:** decision memo §6 (Marketing) and F11–F13; `business/research/dossiers/cross_compliance.json` (CASL s.10(10), s.13).
