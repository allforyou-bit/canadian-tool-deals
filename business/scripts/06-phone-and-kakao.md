# 06 · Phone calls and Korean-community chat / 전화 응대와 한인 커뮤니티 채팅

> **Draft v1, 2026-09-23.** The owner approves the Korean before use (memo §10, item 7). Scripts and templates are ≤ 120 words per language. **The owner posts and replies from their own accounts; the AI never posts, sends or phones.**
> 초안입니다. 사장님이 한국어 문구를 확인·승인한 뒤 사용하세요. **게시·답장·전화는 모두 사장님이 직접 해요. AI는 초안만 만들어요.**

| Placeholder | Meaning | 뜻 |
|---|---|---|
| `{BRAND}` `{NAME}` `{AREA}` | Business name in the language you're using, your first name, your cluster | 상호, 사장님 이름, 영업 구역 |
| `{CUSTOMER}` `{SERVICE}` `{DATES}` | Customer's name, what they asked for, 2–3 open dates | 고객 이름, 요청 서비스, 가능한 날짜 |
| `{LOW}`–`{HIGH}` | Range from the calculator on `{SITE}`, with $ (GTA price card: file 02) | 사이트 계산기 금액 범위($ 포함) |
| `{MAILING_ADDRESS}` `{PHONE}` `{SITE}` | CASL ID details (config `contact`, `siteUrl`) | CASL 발신자 정보 |

---

## 6A. Answering a call / 전화 받기

**EN**
```say
Good morning, {BRAND}, this is {NAME}.
May I have your name? … Which area are you in? The nearest main intersection is fine. … Which service do you need? … How many bedrooms and bathrooms? [Gutters: how many storeys? Snow: how big is the driveway?] … When would you like it done? … And how did you hear about us?
For that, the estimate is {LOW} to {HIGH}. I confirm the final price on site before I start. Would you like to book a date? And may I text you the estimate with my details?
```

**KO**
```say
안녕하세요, {BRAND} {NAME}입니다.
성함이 어떻게 되세요? … 어느 동네세요? 가까운 큰 교차로만 알려 주셔도 돼요. … 어떤 서비스가 필요하세요? … 침실이랑 욕실은 몇 개예요? [홈통: 몇 층 집이에요? 제설: 진입로는 차 몇 대 크기예요?] … 언제쯤 원하세요? … 저희는 어떻게 알게 되셨어요?
그러면 예상 금액은 {LOW}–{HIGH}이에요. 최종 금액은 작업 전에 현장에서 확인하고 확정해 드려요. 날짜 잡아 드릴까요? 견적이랑 제 연락처를 문자로 보내 드려도 될까요?
```

## 6B. Voicemail greeting / 음성사서함 인사말

Record English first, then Korean, in one greeting. 영어 → 한국어 순서로 한 번에 녹음하세요.

**EN**
```say
Hi, you've reached {NAME} at {BRAND}. I'm probably on a job right now. Please leave your name, your number and the service you need, or send a text to this number. I'll get back to you as soon as I can. Thank you!
```

**KO**
```say
안녕하세요, {BRAND} {NAME}입니다. 지금은 전화를 받을 수 없어요. 작업 중일 수 있어요. 성함, 연락처, 필요하신 서비스를 남겨 주시거나 이 번호로 문자 주세요. 최대한 빨리 연락드릴게요. 감사합니다!
```

## 6C. If a call in English gets hard / 영어 통화가 어려울 때

Say the English line to the caller. The Korean is its meaning, for you. 영어 문장을 고객에게 말하고, 한국어는 뜻 참고용이에요.

**EN**
```say
Sorry, I'm more comfortable with English in writing. Could you text me the details at this number? I'll reply by text shortly. Thank you!
```

**KO (meaning / 뜻)**
```say
죄송하지만 영어는 글로 하는 게 더 편해요. 이 번호로 내용을 문자로 보내 주시겠어요? 곧 문자로 답장드릴게요. 감사합니다!
```

## Phone rules / 전화 규칙

| EN | KO |
|---|---|
| Live voice calls are excluded from CASL (s.6(8)(a), memo F11), but National Do Not Call List rules were **not verified**. Answer inbound calls and call back only people who asked. No cold calls. | 실시간 음성 통화는 CASL 적용 제외지만, 전화 영업 금지 목록(DNCL) 규정은 **확인되지 않았어요**. 걸려 온 전화에 답하고, 요청한 사람에게만 다시 거세요. 모르는 사람에게 영업 전화 금지. |
| Text the estimate only if they said yes, using file 03. | 고객이 좋다고 한 경우에만 03번 템플릿으로 견적 문자를 보내세요. |
| Outside `{AREA}`, or a job you don't do (in-wall electrical, plumbing, gas, windows, pressure washing in Toronto; memo §3): say so politely and decline. | 서비스 지역 밖이거나 하지 않는 일(벽 속 전기, 배관, 가스, 창문, 토론토에서의 고압 세척)은 정중하게 거절하세요. |
| Log every call in the CRM: source "phone", how they heard about you, outcome. | 모든 통화를 CRM에 기록하세요: 출처 "전화", 알게 된 경로, 결과. |

---

## 6D. KakaoTalk and community boards: etiquette / 카카오톡·교민 게시판 예절

| EN | KO |
|---|---|
| You post and reply from your own account. The AI drafts only. For post text, use the post pack (memo §10, item 9). | 게시와 답장은 사장님 계정으로 직접 하세요. AI는 초안만 만들어요. 게시글 문구는 게시글 모음(빌드 항목 9)을 쓰세요. |
| Read each chat's or board's rules first. Post only where business posts are allowed (for example a classifieds or ads section); if unsure, ask the admin. Commercial-post rules for KakaoTalk open chats, Naver cafés and community classifieds were **not verified**: posts may be removed or accounts banned (korean dossier). | 먼저 각 방·게시판 규칙을 읽으세요. 홍보가 허용된 곳(광고·벼룩시장 게시판 등)에만 올리고, 애매하면 방장·운영자에게 물어보세요. 카톡 오픈채팅·네이버 카페·교민 게시판의 홍보 규정은 **확인되지 않았어요**. 글이 삭제되거나 계정이 정지될 수 있어요. |
| One post per board; repost only as often as the board allows. Never paste the same ad into many chats at once. | 게시판마다 한 번만 올리고, 재게시는 게시판 규칙이 허용하는 만큼만 하세요. 같은 광고를 여러 방에 한꺼번에 뿌리지 마세요. |
| Say clearly that it's your business. No fake reviews, no posting as a "happy customer", no second accounts. | 본인 사업이라고 분명히 밝히세요. 가짜 후기, 고객인 척 추천하는 글, 부계정은 금지예요. |
| Facts only: services, area, prices from the price book, contact. No "insured" until the policy is bound; no licences, awards, customer counts or "since 20XX". | 사실만 쓰세요: 서비스, 지역, 가격표 기준 가격, 연락처. 보험 가입 전에는 '보험 가입'이라고 쓰지 말고, 면허·수상·고객 수·'20XX년부터' 같은 말도 쓰지 마세요. |
| Photos: your own only. A client's home only with their separate written photo opt-in (memo §6). No addresses or faces in any photo. | 사진은 직접 찍은 것만 쓰세요. 고객 집 사진은 고객이 따로 서면 동의한 경우에만. 주소나 얼굴이 보이면 안 돼요. |
| No private messages to people who didn't contact you first. CASL covers instant-messaging accounts too (s.1(1), cross_compliance dossier), and cold messages to consumers are not allowed (memo §3). | 먼저 연락하지 않은 사람에게 1:1 메시지를 보내지 마세요. CASL은 메신저 계정에도 적용되고, 모르는 소비자에게 먼저 홍보 메시지를 보내면 안 돼요. |
| Someone asks in public: reply briefly in public (6E) and invite them to message you. Never ask for or post addresses or phone numbers in public. | 공개 댓글로 물어보면 짧게 공개 답글(6E)을 달고 1:1로 연락 달라고 하세요. 주소·전화번호는 공개적으로 묻거나 올리지 마세요. |
| Screenshot each inquiry and keep it: it is your consent evidence (CASL s.13). Reply within 1 hour when you can (memo §7). | 문의 내용은 캡처해서 보관하세요(동의 증거, CASL s.13). 가능하면 1시간 안에 답하세요. |

## 6E. Public comment reply / 공개 댓글 답글

**EN**
```post
Thanks for asking! Our prices are on {SITE}. Send me a message any time and I'll send you an estimate for your home. ({BRAND})
```

**KO**
```post
관심 가져 주셔서 감사해요! 기본 가격은 {SITE}에서 보실 수 있어요. 1:1 메시지 주시면 댁에 맞는 견적을 보내 드릴게요. ({BRAND})
```

## 6F. Private chat reply to an inquiry (KakaoTalk 1:1, board message) / 1:1 채팅 답장 (카톡, 쪽지)

Treat this like a text message: keep the ID and opt-out lines. 문자처럼 발신자 정보와 수신거부 문구를 꼭 넣으세요.

**KO**
```chat
안녕하세요 {CUSTOMER}님, {BRAND} {NAME}입니다. 문의 감사합니다! 문의하신 {SERVICE} 예상 금액은 {LOW}–{HIGH}이에요. 최종 금액은 작업 전에 현장에서 확인하고 확정해 드려요. 가능한 날짜는 {DATES}인데, 편하신 날 알려 주세요.
{BRAND}, {MAILING_ADDRESS}, {PHONE}, {SITE}
더 이상 메시지를 원치 않으시면 '중지' 또는 STOP이라고 보내 주세요.
```

**EN**
```chat
Hi {CUSTOMER}, this is {NAME} from {BRAND}. Thanks for your message! For a {SERVICE}, the estimate is {LOW}–{HIGH}. I confirm the final price on site before I start. Open dates: {DATES}. Let me know which one suits you.
{BRAND}, {MAILING_ADDRESS}, {PHONE}, {SITE}
Reply STOP to opt out.
```

**Sources / 출처:** decision memo §3, §6, §7, §9 (low-English branch), §10 and F11; `business/research/dossiers/cand_korean.json` (channel rules not verified); `business/research/dossiers/cross_compliance.json` (CASL s.1(1) electronic address includes instant messaging).
