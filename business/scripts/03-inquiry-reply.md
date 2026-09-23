# 03 · Replying to inquiries / 문의 답장

> **Draft v1, 2026-09-23.** The owner approves the Korean before use (memo §10, item 7). Templates are ≤ 120 words per language, including the ID and opt-out lines. The owner sends every message; the AI never sends.
> 초안입니다. 사장님이 한국어 문구를 확인·승인한 뒤 사용하세요. 메시지는 사장님이 직접 보내요.
>
> Not legal advice. The CASL points come from the decision memo (F11–F13); check with a lawyer if unsure.
> 법률 자문이 아닙니다. CASL 관련 내용은 결정 메모(F11–F13)에서 가져왔어요. 확실하지 않으면 변호사에게 확인하세요.

| Placeholder | Meaning | 뜻 |
|---|---|---|
| `{BRAND}` | Business name in the message's language (config `business.brand`) | 메시지 언어의 상호 |
| `{NAME}` | Your first name | 사장님 이름 |
| `{CUSTOMER}` | The customer's name | 고객 이름 |
| `{SERVICE}` | What they asked for, e.g. "2-bedroom deep clean" / "침실 2개 딥클린" | 요청한 서비스 |
| `{LOW}`–`{HIGH}` | Range from the calculator on `{SITE}`, with $ | 사이트 계산기 금액 범위($ 포함) |
| `{DATES}` | 2–3 open dates you can offer | 가능한 날짜 2–3개 |
| `{PER_VISIT}` | November snow per-visit rate, config `snow.perVisit` (GTA default $60; must match the live price book) | 11월 제설 1회 요금 (GTA 기본 $60) |
| `{MAILING_ADDRESS}` `{PHONE}` `{SITE}` | CASL mailing address (config `contact.mailingAddress`), business phone, website | CASL 우편 주소, 사업용 전화, 웹사이트 |

## Rules / 규칙

| EN | KO |
|---|---|
| Reply within 1 hour when you can (memo §7). | 가능하면 1시간 안에 답장하세요. |
| Get `{LOW}`–`{HIGH}` by entering the customer's details in the calculator on `{SITE}`, and copy the range exactly. GTA defaults are in the price card in file 02. Never quote below the price book. | 고객 정보를 `{SITE}` 계산기에 넣고 나온 금액을 그대로 쓰세요. GTA 기본값은 02번 파일 가격표에 있어요. 가격표보다 싸게 부르지 마세요. |
| Tax: while `salesTaxRegistered` is OFF, don't mention HST. Once it is ON, add "+ HST" after the range. | 세금: `salesTaxRegistered`가 꺼져 있으면 HST를 언급하지 마세요. 켜지면 금액 뒤에 "+ HST"를 붙이세요. |
| Every message keeps the ID line (`{BRAND}`, `{MAILING_ADDRESS}`, `{PHONE}`/`{SITE}`) and the opt-out line. A reply to an inquiry is excluded from CASL s.6 ([SOR/2013-221 s.3(b)](https://github.com/justicecanada/laws-lois-xml/blob/main/eng/regulations/SOR-2013-221.xml)), and a requested quote is exempt from consent only, so ID and unsubscribe still apply ([CASL s.6(6), s.6(1)(b)](https://github.com/justicecanada/laws-lois-xml/blob/main/eng/acts/E-1.6.xml); memo F11–F12). | 모든 메시지에 발신자 정보 줄(상호, 우편 주소, 전화/웹사이트)과 수신거부 문구를 넣으세요. 문의에 대한 답장은 CASL s.6 적용 제외지만, 요청받은 견적도 동의만 면제될 뿐 발신자 정보와 수신거부는 여전히 필요해요. |
| The mailing address follows [SOR/2012-36 s.2(1)(d)](https://github.com/justicecanada/laws-lois-xml/blob/main/eng/regulations/SOR-2012-36.xml). Whether a PO box is enough is **not stated** (확인 필요, memo F13). | 우편 주소 요건: 사서함(PO Box)으로 충분한지는 **명시되어 있지 않아요(확인 필요)**. |
| Keep the inquiry (screenshot or email). An inquiry gives 6 months of implied consent (CASL s.10(10)), and the sender must prove consent (s.13). | 문의 내용은 캡처하거나 보관하세요. 문의하면 6개월간 묵시적 동의가 생기고, 동의 증명 책임은 보낸 사람에게 있어요. |
| STOP or "unsubscribe": stop at once and log it in the CRM. The law allows at most 10 business days, and the opt-out must keep working for 60 days (memo F11). | STOP이나 '수신거부'가 오면 즉시 중단하고 CRM에 기록하세요. 법정 기한은 최대 영업일 10일이고, 수신거부 방법은 60일간 유지돼야 해요. |
| Never text or email someone who didn't contact you first (no cold messages to consumers, memo §3). | 먼저 연락하지 않은 사람에게는 문자·이메일을 보내지 마세요. |
| The site has no photo upload; customers can text photos to `{PHONE}` (memo §10, item 4). | 사이트에는 사진 업로드가 없어요. 사진은 문자로 받으세요. |

---

## 3A. SMS — estimate / 문자 — 견적

**EN**
```sms
Hi {CUSTOMER}, this is {NAME} from {BRAND}. Thanks for your message! For a {SERVICE}, the estimate is {LOW}–{HIGH}. I confirm the final price on site before I start. Open dates: {DATES}. Would one of those work?
{BRAND}, {MAILING_ADDRESS}, {PHONE}, {SITE}
Reply STOP to opt out.
```

**KO**
```sms
안녕하세요 {CUSTOMER}님, {BRAND} {NAME}입니다. 문의 감사합니다! 문의하신 {SERVICE} 예상 금액은 {LOW}–{HIGH}이에요. 최종 금액은 작업 전에 현장에서 확인하고 확정해 드려요. 가능한 날짜는 {DATES}인데, 편하신 날 있으세요?
{BRAND}, {MAILING_ADDRESS}, {PHONE}, {SITE}
수신을 원치 않으시면 STOP이라고 답장해 주세요.
```

## 3B. SMS — need details first / 문자 — 정보가 더 필요할 때

**EN**
```sms
Hi {CUSTOMER}, {NAME} from {BRAND} here. Thanks for reaching out! To give you a price, could you tell me which clean you need (standard, deep or move-in/out), how many bedrooms and bathrooms, and your preferred dates? You can also get an instant estimate at {SITE}.
{BRAND}, {MAILING_ADDRESS}, {PHONE}
Reply STOP to opt out.
```

**KO**
```sms
안녕하세요 {CUSTOMER}님, {BRAND} {NAME}입니다. 연락 주셔서 감사합니다! 가격을 알려 드리려면 몇 가지만 여쭤볼게요. 어떤 청소(일반 청소, 딥클린, 입주·이사 청소)인지, 침실과 욕실은 몇 개인지, 원하시는 날짜를 알려 주세요. {SITE}에서 바로 예상 가격을 보실 수도 있어요.
{BRAND}, {MAILING_ADDRESS}, {PHONE}
수신을 원치 않으시면 STOP이라고 답장해 주세요.
```

## 3C. Email — estimate / 이메일 — 견적

**EN**
```email
Subject: Your estimate from {BRAND}

Hi {CUSTOMER},

Thanks for getting in touch. For a {SERVICE}, the estimate is {LOW}–{HIGH}. I confirm the final price on site before I start.

Open dates: {DATES}. Just reply with the one that suits you, or call or text {PHONE}. You can also check the estimate yourself at {SITE}.

{NAME}
{BRAND} · {MAILING_ADDRESS} · {PHONE} · {SITE}
To stop getting emails from us, reply "unsubscribe".
```

**KO**
```email
제목: {BRAND} 견적 안내

{CUSTOMER}님, 안녕하세요.

문의해 주셔서 감사합니다. 문의하신 {SERVICE} 예상 금액은 {LOW}–{HIGH}입니다. 최종 금액은 작업 전에 현장에서 확인하고 확정해 드립니다.

가능한 날짜: {DATES}. 편하신 날짜를 답장으로 알려 주시거나 {PHONE}으로 전화·문자 주세요. {SITE}에서 예상 금액을 직접 확인하실 수도 있습니다.

{NAME} 드림
{BRAND} · {MAILING_ADDRESS} · {PHONE} · {SITE}
이메일 수신을 원치 않으시면 '수신거부'라고 답장해 주세요.
```

## 3D. SMS — snow estimate (only when snow is ON) / 문자 — 제설 견적 (제설 운영 시만)

Use only after Gate S passes (written snow insurance). 제설 보험을 서면으로 받은 뒤(관문 S 통과)에만 쓰세요.

**EN**
```sms
Hi {CUSTOMER}, {NAME} from {BRAND}. Thanks for asking about snow clearing! Your season price (Dec 1 – Mar 31) is {LOW}–{HIGH}, confirmed on site and billed in 4 equal instalments on Dec 1, Jan 1, Feb 1 and Mar 1. Nothing is paid before Dec 1. November snow is optional: if you tick it in the agreement, each snowfall at or above the trigger depth, from the day we confirm your contract (by Nov 21) to Nov 30, is {PER_VISIT} per visit, billed with your Dec 1 instalment. If we haven't signed our minimum number of snow contracts (all areas combined) by Nov 20, the agreement is void and you owe nothing.
{BRAND}, {MAILING_ADDRESS}, {PHONE}, {SITE}
Reply STOP to opt out.
```

**KO**
```sms
안녕하세요 {CUSTOMER}님, {BRAND} {NAME}입니다. 제설 문의 감사합니다! 시즌(12월 1일–3월 31일) 요금은 {LOW}–{HIGH}이고, 현장에서 확정한 금액을 12월 1일, 1월 1일, 2월 1일, 3월 1일에 4번 똑같이 나눠 청구해요. 12월 1일 전에는 어떤 돈도 받지 않아요. 11월 눈은 선택 사항이에요. 계약서에서 선택하시면, 계약 진행을 확인해 드린 날(11월 21일까지 알려 드려요)부터 11월 30일까지 출동 기준 이상 내린 눈을 1회 {PER_VISIT}에 치우고, 12월 1일 첫 분할금과 함께 청구해요. 11월 20일까지 전체 제설 계약(모든 지역 합산)이 최소 건수에 이르지 않으면 계약은 무효이고 내실 돈은 없어요.
{BRAND}, {MAILING_ADDRESS}, {PHONE}, {SITE}
수신을 원치 않으시면 STOP이라고 답장해 주세요.
```

**Sources / 출처:** decision memo §3, §6, §7, §10 and F11–F13; `config/prices.ts`; `lib/quote.ts`; snow wording matches the snow agreement in `content/agreements.ts` (November snow clause, payment clause, November 20 condition) / 제설 문구는 제설 계약서와 같은 조건입니다.
