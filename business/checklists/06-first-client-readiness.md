# Checklist 06: First Off-Platform Client, Readiness (첫 직접 고객 준비 점검)

Go through this **once, before the first job you book directly** (door-knock, ad, website, referral or B2B, not TaskRabbit or Jiffy). Every box must be ticked. The memo's target is to bind the cleaning CGL **by Wed Oct 7, 2026** and take **no direct clients before it is bound** (memo §7, week 2; §8, day 10) (플랫폼이 아닌 **첫 직접 고객 작업 전에 한 번** 점검합니다. 모든 칸에 표시가 되어야 합니다. 메모의 목표는 **10/7(수)까지** 청소용 CGL 가입이며 **가입 전에는 직접 고객을 받지 않습니다**).

Labels (표시): **ASSUMPTION/가정**, **NOT VERIFIED/확인 필요**, **GENERAL PRACTICE/일반 수칙** (common practice, not from the research). "Memo" = `business/research/decision-memo.md`. Not legal advice (법률 자문이 아닙니다).

---

## 1. Status and tax (신분과 세금)

- [ ] **Gate 0:** you have confirmed from your own IRCC documents that you may be self-employed in Canada. If not, stop (memo §2) (**관문 0:** 본인 IRCC 서류로 자영업이 가능한지 확인. 아니면 중단)
- [ ] On EI: you know whether you are on Path A or Path B (memo §5.4) and you will **declare every dollar**, as net = gross − operating expenses, in the week the work was done (memo F4) (EI 수급 중: Path A/B 중 어느 쪽인지 알고, 작업한 주에 순소득(총수입 − 영업비용)을 **한 푼도 빠짐없이 신고**)
- [ ] Business name: before printing {BRAND} on anything, check with ServiceOntario whether you must register it. Ontario fee and process were **not found**; whether trading under your own legal name avoids registration is **NOT VERIFIED** (memo §6) (상호: {BRAND}를 인쇄하기 전에 ServiceOntario에 등록 필요 여부 확인. 비용·절차 확인 필요)
- [ ] GST/HST: you stay a small supplier while taxable revenue is $30,000 or less over four calendar quarters; there is also a single-quarter test (memo F7). Track revenue by calendar quarter. **No HST line on quotes or receipts** while `NEXT_PUBLIC_TAX_REGISTERED` is off (GST/HST: 4분기 합계 과세 매출이 $30,000 이하면 소규모 사업자이며, 한 분기 기준 테스트도 따로 있습니다. 분기별로 매출을 기록하고, 등록 전에는 견적서·영수증에 **HST 줄 없음**)
- [ ] Set aside 11.9% of net for CPP (memo F9) (순이익의 11.9%를 CPP용으로 따로 모으기)

## 2. Insurance (보험)

- [ ] **Cleaning CGL bound**: policy document and certificate saved as PDF on your phone and in your own backup. "Can start at $500" is a snippet with uncertain attribution (memo F23); your real premium is the written quote (**청소용 CGL 가입 완료**: 증권과 가입증명서 PDF를 휴대폰과 개인 백업에 저장. "$500부터"는 출처가 불확실한 검색 요약이며 실제 보험료는 서면 견적 기준)
- [ ] You asked the broker about damage, theft allegations and key exclusions, and wrote down the answers (memo §6) (파손, 도난 의심, 열쇠 관련 면책을 브로커에게 묻고 답을 적어 둠)
- [ ] `NEXT_PUBLIC_INSURED` set to true **only now**, after binding, so the site's "Insured" line is true (`config/business.ts`) (가입한 **지금에서야** `NEXT_PUBLIC_INSURED`를 true로. 그래야 사이트의 "보험 가입" 문구가 사실이 됩니다)
- [ ] Track B only: gutters need the broker's **written** ladder/eavestrough confirmation (G1); snow needs **written** snow cover including slip-and-fall before any contract (Gate S) (memo §6) (트랙 B만: 홈통(처마 물받이) 청소는 사다리 작업 서면 확인(관문 G1), 제설은 계약 전 미끄러짐 포함 서면 보험(관문 S))
- [ ] You know there is no income cover if you are injured; WSIB for an independent operator was **not researched** (memo §6) (다쳤을 때 소득 보장이 없다는 점을 알고 있음. 자영업자 WSIB는 확인 필요)

## 3. Paperwork (서류)

- [ ] Service agreement printed, **2 copies per job** (one for the client). Cleaning version covers scope, lockout fee, damage claims within 24 h with photos, cancellation, photo-consent opt-in and no key custody (memo §10, item 5). Marked "not legal advice". Print it from `/print/` (or `/ko/print/`) on your deployed site after your settings are filled in; the PDFs in `business/print/` are watermarked samples. The gutter and snow agreements appear there only when those services are switched on (서비스 계약서 **작업당 2부** 인쇄. 법률 자문 아님 표시. 설정을 모두 넣고 배포한 사이트의 `/print/`(한국어는 `/ko/print/`)에서 인쇄합니다. `business/print/`의 PDF는 워터마크가 찍힌 샘플입니다. 홈통 청소·제설 계약서는 그 서비스를 켰을 때만 나옵니다)
- [ ] **Ontario, signed at the client's home:** the agreement states that the client can cancel within **10 days** after receiving a copy of the signed agreement, and is refunded within **15 days** after the cancellation notice ([ontario.ca](https://www.ontario.ca/page/your-rights-when-signing-or-cancelling-contract), memo F32, snippet). The effect of doing the job inside those 10 days is **not researched**: until you confirm with Consumer Protection Ontario, treat that money as refundable (memo §5.3, §6) (**온타리오, 고객 집에서 서명:** 계약서에 "계약서 사본을 받으신 후 10일 이내에 취소하실 수 있고, 취소 통지를 받은 후 15일 이내에 환불해 드립니다."라는 안내가 들어 있음(검색 요약). 10일 안에 작업한 경우의 효과는 확인 필요. 온타리오 소비자보호국(Consumer Protection Ontario)에 확인하기 전까지는 환불될 수 있는 돈으로 봅니다)
- [ ] Separate photo-permission slip printed (`03-photo-protocol.md`, section 5) (별도 사진 사용 동의서 인쇄)
- [ ] Numbered receipt or invoice template ready; no HST line while unregistered (memo §10, item 16) (번호 매긴 영수증·청구서 양식. 미등록 상태에서는 HST 줄 없음)
- [ ] The written quote shows a **range labelled "estimate, confirmed on site"** from the calculator, and it matches `config/prices.ts` (memo §10, item 3) (견적은 계산기의 **"추정, 현장에서 확정"** 범위이며 가격표와 일치)

## 4. Getting paid (결제)

- [ ] e-Transfer set up on your bank account. Limits are set per bank, typically $2,000–3,000; an Oakville contractor had a payment delayed by a limit. **Split large payments** (memo F36) (e-Transfer 설정. 한도는 은행마다 다르며 보통 $2,000–3,000. **큰 금액은 나눠 받기**)
- [ ] Card (optional): Stripe Canada is 2.9% + C$0.30 per charge (memo F37, secondary source). Add the fee to your records (카드 결제(선택): Stripe 수수료 2.9% + C$0.30(2차 출처))
- [ ] Cash: always give a numbered receipt and log it the same day (현금: 항상 번호 매긴 영수증을 주고 당일 기록)
- [ ] Payment is due **on completion** for cleaning and gutters. Snow: **nothing before Dec 1** (memo §2) (청소·홈통 청소는 **작업 완료 시** 결제. 제설은 **12/1 전에 받지 않음**)
- [ ] CRM payments tab ready; every payment gets a line (CRM 결제 탭 준비, 모든 결제를 한 줄씩)

## 5. Phone and messages (전화와 메시지)

- [ ] Voicemail greeting says {BRAND} and asks for name, phone number and service only — not a home address (script 06 6B) (음성사서함 인사말에 {BRAND}, 이름·전화번호·서비스만 남겨 달라는 안내 — 집 주소는 받지 않음)
- [ ] Saved text templates carry {BRAND}, {MAILING_ADDRESS}, a phone/email/web contact and "Reply STOP to opt out" (CASL, memo F11, F13). Whether a PO box counts as "the mailing address" is **not stated** in SOR/2012-36 (저장한 문자 양식에 상호, 우편 주소, 연락처, "STOP으로 수신 거부"가 들어 있음. 사서함 주소 인정 여부는 확인 필요)
- [ ] A quote you send because someone asked for it is exempt from consent **only**; it still needs your ID and an opt-out (CASL s.6(6), memo F11) (요청받아 보내는 견적은 동의 요건만 면제이고, 신원 표시와 수신 거부는 여전히 필요)
- [ ] Opt-outs honoured **within 10 business days** and logged in your single private opt-out list (a copy of `business/b2b/unsubscribe-log.csv` kept OUTSIDE the repo folder, or inside `private/`, which git ignores — never write customer phone numbers or emails into files that are committed) (memo F11). Check that list before every text or email. (수신 거부는 **10영업일 안에** 처리하고 하나뿐인 비공개 수신거부 목록(`business/b2b/unsubscribe-log.csv`를 저장소 폴더 밖이나 git이 무시하는 `private/` 폴더에 복사한 파일)에 기록합니다. 문자·이메일을 보내기 전에 항상 이 목록을 확인합니다.)
- [ ] **No cold texts or emails to consumers.** Phone: inbound calls and callbacks only; National DNCL rules were **not verified** (memo §6) (**소비자에게 먼저 문자·이메일 보내지 않기.** 전화는 걸려 온 전화와 회신만)
- [ ] Target: reply to every inquiry within 1 hour (memo §7) (목표: 모든 문의에 1시간 안에 답장)

## 6. Supplies and route (준비물과 경로)

- [ ] Portable kit packed and tested: `01-standard-and-deep-clean.md` section 5; move-out extras in `02-move-out-clean.md` section 5 (준비물 챙기고 점검)
- [ ] Transit or driving route checked; travel time written on the job sheet; downtown parking cost noted (memo F18) (대중교통·운전 경로 확인, 이동 시간 기록, 도심 주차비 확인)
- [ ] Plan for running late: text the client before the start time (늦을 경우: 시작 시각 전에 고객에게 문자)
- [ ] Printed: this job's checklist (01 or 02), time log, photo protocol (인쇄물: 해당 체크리스트, 시간 기록표, 사진 규칙)

## 7. Scope and safety rules for the first month (첫 달 작업 범위와 안전 규칙)

- [ ] **No key custody**: the client is home or a lockbox is the client's responsibility; bonding norms were not researched (memo §2, §6) (**열쇠 보관 안 함**: 고객이 있거나 고객 책임의 키박스)
- [ ] No plumbing, gas or in-wall electrical work of any kind (memo §3) (배관·가스·벽 속 전기 작업 일체 안 함)
- [ ] No helpers in the first 30 days; employment standards and WSIB were not researched (memo §3) (첫 30일은 도우미 없음)
- [ ] No claims you cannot prove: no reviews, testimonials, customer counts, awards, licences or "since 20XX" (증명할 수 없는 문구 금지: 후기, 고객 수, 수상, 면허, "20XX년부터")

## 8. After the first job (첫 작업 후)

- [ ] Payment received, receipt given, CRM updated the same day (결제·영수증·CRM 당일 기록)
- [ ] Time log compared with the 5 h assumption (A1) (시간 기록을 5시간 가정(A1)과 비교)
- [ ] Offered biweekly recurring; asked for a referral (referral messages name the referrer, memo F12) (격주 정기 청소 제안, 소개 부탁)
- [ ] Photos filed per `03-photo-protocol.md` (사진은 사진 규칙대로 보관)
- [ ] Daily numbers email sent with the fixed subject `DAILY YYYY-MM-DD doors=_ answers=_ quotes=_ closes=_ completed=_ net=_` (memo §10, item 11) (정해진 제목으로 일일 숫자 이메일 발송)

---

Sources: memo §2 (Gate 0, scope, no key custody, snow payment rule), §3, §5.3–5.4, §6 (compliance checklist), §7 (CGL by Oct 7; 1 h reply target), §8 (day 10), §10 items 3, 5, 11, 16; F4, F7, F9, F11, F12, F13, F18, F23, F32, F36, F37. Settings: `config/business.ts`. Prices: `config/prices.ts`.
