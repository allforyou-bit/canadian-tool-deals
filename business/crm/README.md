# CRM·재무 워크북 사용 안내 (crm.xlsx)

{BRAND}의 고객·작업·돈 기록을 한 파일에서 관리하는 엑셀 워크북입니다. 결정 메모(`business/research/decision-memo.md`) §10의 item 11(CRM + DAILY 이메일), item 15(재무·규정 점검), item 16(인보이스)에 해당합니다.

- 브랜드 이름은 `config/business.ts`에서, 가격은 `config/prices.ts`(가격표)에서 가져옵니다. 기본 도시는 GTA입니다.
- "가정", "추정(ESTIMATE)"이라고 적힌 숫자는 근거 자료가 없는 값입니다. "확인 필요"는 연구에서 확인하지 못한 내용입니다.
- 이 파일은 법률·세무 자문이 아닙니다. EI(고용보험)에 대한 최종 판단은 Service Canada가 합니다.
- 어떤 숫자도 소득을 보장하지 않습니다.

---

## 1. 폴더에 있는 파일

| 파일 | 내용 |
|---|---|
| `crm.xlsx` | 워크북 (시트 13개, 수식·목록·고정 머리글 포함) |
| `csv/doors.csv` | 문 두드리기 기록 템플릿 |
| `csv/quotes.csv` | 견적 기록 템플릿 |
| `csv/jobs.csv` | 완료 작업 기록 템플릿 |
| `csv/payments.csv` | 입금 기록 템플릿 |
| `csv/followups.csv` | 후속 연락 기록 템플릿 |
| `csv/ei-weekly.csv` | EI 주간 신고 기록 템플릿 |
| `README.md` | 이 안내서 |

CSV마다 머리글 1줄과 **가짜 예시 2줄**(`EXAMPLE`이라고 적힘)이 들어 있습니다. 실제로 쓰기 전에 예시 줄은 지우세요.

---

## 2. 워크북 만들기 / 다시 만들기

저장소 폴더에서 아래 명령을 실행합니다 (Node 22.18 이상).

```bash
node scripts/build-crm.mjs
```

- 다른 도시 기본값으로 만들기: `node scripts/build-crm.mjs --city=ottawa` (`gta`, `ottawa`, `calgary`, `vancouver`, `montreal`)
- 연락처를 미리 넣으려면 환경 변수 `NEXT_PUBLIC_MAILING_ADDRESS`, `NEXT_PUBLIC_PHONE`, `NEXT_PUBLIC_EMAIL`, `NEXT_PUBLIC_SITE_URL`을 설정하고 실행합니다. 없으면 `{MAILING_ADDRESS}`, `{PHONE}`, `{EMAIL}`, `{WEBSITE}`가 그대로 보이니, 설정 시트에서 직접 고치세요.
- **가격을 바꾸려면** `config/prices.ts`를 고친 뒤 다시 만드세요. 그래야 웹사이트·계산기·전단지와 같은 가격이 됩니다. 워크북 안의 가격표는 참고용 복사본입니다.

**덮어쓰기 주의**

- `crm.xlsx`는 빈 템플릿입니다. 실제 기록은 **복사본**(예: `내-CRM.xlsx`)이나 Google Sheets에서 하세요.
- 스크립트는 `crm.xlsx`에 이미 데이터 줄이 있으면 덮어쓰지 않고 멈춥니다. 예시가 아닌 줄이 들어 있는 CSV도 건너뜁니다.
- 정말 빈 템플릿으로 바꾸려면 `--force`를 붙입니다. 이때 설정 시트에서 바꾼 값도 모두 초기화됩니다.

---

## 3. 여는 방법

### Excel (Windows / Mac)
1. `crm.xlsx`를 더블클릭합니다.
2. 열 때 수식이 자동으로 다시 계산됩니다.
3. 휴대폰 미리보기나 일부 뷰어에서는 숫자가 비어 보일 수 있습니다. 그럴 때는 Excel이나 Google Sheets에서 여세요.

### Google Sheets
1. Google Drive에 `crm.xlsx`를 올립니다.
2. 파일을 열고 **파일 → Google Sheets로 저장**을 누릅니다. 이후에는 변환된 사본에서 작업합니다.
3. 목록(드롭다운), 조건부 색, 고정 머리글, 수식이 함께 옮겨집니다.

### CSV 가져오기
CSV는 **새 시트로 가져온 뒤, 데이터 줄만 복사**해서 붙입니다. 워크북 시트에 바로 가져오면 머리글 줄까지 들어가고, 그 줄을 지우다가 수식 칸이 함께 지워질 수 있습니다.

1. **Google Sheets:** **파일 → 가져오기 → 업로드**에서 CSV를 고르고, 가져오기 위치를 **"새 시트 삽입"**으로 선택합니다.
   **Excel:** **데이터 → 텍스트/CSV에서**를 누르고, 파일 원본을 **65001: 유니코드(UTF-8)**로 고릅니다. 그래야 한글이 깨지지 않습니다.
2. 새 시트에서 머리글 줄과 EXAMPLE 줄을 뺀 **데이터 줄만** 복사합니다.
3. 같은 이름의 워크북 시트 **A3 칸(또는 첫 빈 줄의 A열)**에 붙여 넣습니다. CSV의 열 순서는 각 시트의 **입력 열(파란 머리글) 순서와 같습니다.**
4. 다 붙였으면 가져온 새 시트는 지웁니다.

---

## 4. 칸과 줄 규칙

| 표시 | 뜻 |
|---|---|
| 노란 칸 (파란 글씨) | 직접 입력하는 칸 (설정, EI, 인보이스 시트) |
| 회색 칸 | 자동 계산. 고치지 마세요 |
| 파란 머리글 | 입력 열 |
| 회색 머리글 | 자동 계산 열 |
| 2행 (회색 기울임) | **예시 행.** 계산에서 빠집니다. 참고만 하세요 |
| 3행부터 | 실제 기록. 빈 줄 없이 위에서부터 채웁니다 |

- 코드 칸(결과, 상태, 서비스 등)은 목록에서 고르세요. 목록에 없는 값은 막힙니다.
- 날짜는 `2026-10-05`처럼 입력합니다.
- 금액은 세금을 뺀 금액(세전)으로 적습니다. 지출 시트만 세금이 포함된 금액을 적습니다.
- 머리글 칸에 마우스를 올리면 설명 메모가 보입니다.

---

## 5. 시트 설명

| # | 시트 | 하는 일 | 언제 입력 |
|---|---|---|---|
| 1 | 설정 Settings | 브랜드·연락처, 소비자 계약·CASL 기간(10일 취소, 6개월 문의 동의 등), HST 등록 여부(YES/NO), EI 금액, 퍼널(방문→대화→견적→계약) 가정(응답 35%·견적 10%·계약 40%, memo A8–A10), 비용 가정, 손익분기 입력, 관문(Gates) 상태, 중단 기준(Kill criteria), 서비스 코드, 주별 목표, 가격표(읽기 전용) | 처음 한 번, 상태가 바뀔 때 |
| 2 | 문 두드리기 Doors | 문 한 번 두드릴 때마다 한 줄 (날짜, 거리, 집 번호, 시도 #, 결과 코드, 메모, 클러스터) | 매일 |
| 3 | 견적 Quotes | 견적 요청 한 건에 한 줄. 상태는 OPEN/WON/LOST. 방문 계약이면 취소 가능 기한(추정)이 자동으로 나옵니다 | 요청을 받을 때, 결과가 났을 때 |
| 4 | 작업 Jobs | 끝낸 유료 작업 한 건에 한 줄 (완료일, 서비스, 금액, 직접비). 순이익·입금 합계·미수금·인보이스 번호는 자동 | 작업이 끝난 날 |
| 5 | 입금 Payments | 받은 돈 한 번에 한 줄 (방법: e-Transfer, 현금, 카드, 수표, 플랫폼). $2,000가 넘으면 나눠 받기 안내가 뜹니다 | 입금을 확인할 때 |
| 6 | 후속 Follow-ups | 다시 연락할 일 한 건에 한 줄. 지난 일은 "지남 OVERDUE"로 표시되고, 문자·이메일은 CASL 확인 칸이 채워집니다 | 수시로 |
| 7 | 지표 Dashboard | 전환율, 다음 주 문 목표, 남은 가구와 클러스터 #2 신호, 최근 7일 run-rate, 중단 기준(Kill criteria) 결과, DAILY 제목 줄 | 입력 없음 |
| 8 | EI 주간신고 | 일요일 시작 주마다 총수입·운영비·순수입, EI 공제·수령 추정, Path A/B 비교 | 경로(A/B), 신고함(Y), 신고일 |
| 9 | 세금 Tax | 분기별 과세매출, 4분기 합계와 경고($25,000 / 단일 분기 $20,000), 입금 대조, CPP 11.9% 적립, T2125 지출 분류 | 입력 없음 |
| 10 | 손익분기 Break-even | 홈통(10건 / 보수 13건)과 제설(제설기 6 / 12, 삽만 3 / 6) 손익분기, 실제 계약 수 | 입력 없음 (실제 견적은 설정 시트) |
| 11 | 인보이스 Invoice | 작업 ID를 넣으면 인보이스가 채워지고, 다 받으면 영수증으로 바뀝니다 | 작업 ID, 추가 항목 |
| 12 | 지출 Expenses | 영수증 한 장에 한 줄, T2125 분류 선택 | 돈을 쓸 때 |
| 13 | 주행 Mileage | 업무 운행 기록 (날짜, 출발, 도착, 목적, km) | 운행할 때 |

### 알아 둘 계산 규칙
- **시도(attempt):** NA+NI+Q+B+CB. 같은 집에 다시 가면 그때마다 1회씩 따로 셉니다. NS(방문판매 금지 표시)는 두드리지 않으므로 빠집니다.
- **측정값과 가정:** 시도가 30회(설정에서 변경 가능) 이상이 되면 응답률·견적률·계약률에 실제 측정값을 씁니다. 측정값이 0인 비율은 가정값을 그대로 씁니다. 견적이 10건 미만이면 계약률은 흔들림이 큽니다.
- **다음 주 문 목표** = 다음 주 필요 계약 수 ÷ (응답률 × 견적률 × 계약률). 필요 계약 수는 설정 시트의 주별 목표표에서 "그다음 주 완료 목표"를 가져옵니다 (memo §7). 1월 이후 목표는 직접 입력하세요.
- **클러스터 #2:** 남은 가구가 문 목표의 2배보다 적으면 "클러스터 #2 열기"가 뜹니다. 남은 가구 = 클러스터 가구 수 − 최종 결과(NI, Q, B, NS)가 난 집.
- **run-rate:** 최근 7일 동안 완료한 작업의 순이익 합입니다. 설비비와 연 보험료는 빠집니다 (memo §8).
- **직접비:** 작업 시트에서 비워 두면 추정 비율을 씁니다 (청소 20%, 홈통 건당 $20, 제설 15%, 플랫폼 10% — 가정 A2–A6). 세금과 EI 계산에는 지출 시트의 실제 영수증만 씁니다.
- **HST:** 설정 시트의 "GST/HST 등록?"이 YES일 때만 인보이스에 세금 줄이 생깁니다. 등록 전에는 세금을 받지 않습니다.

---

## 6. 코드표

**문 두드리기 결과 (Doors)**

| 코드 | 뜻 | 다음에 할 일 |
|---|---|---|
| NA | 부재 (no answer) | 문고리 광고지를 두고 나중에 다시 (시도 # +1) |
| NI | 관심 없음 (not interested) | 끝. 다시 두드리지 않기 |
| Q | 견적 요청 (quote requested) | 견적 시트에 한 줄 (출처 DOOR) |
| B | 그 자리에서 예약 (booked) | 견적 시트에 WON + 방문 계약 Y. 10일 취소권 안내 |
| CB | 다시 연락 (call back) | 후속 시트에 한 줄 |
| NS | 방문판매 금지 표시 (no soliciting sign) | 두드리지 않음 |

**견적 상태:** `OPEN` 답 기다림 · `WON` 계약 성사 · `LOST` 안 됨

**출처:** `DOOR` 문 두드리기 · `KIJIJI` · `FACEBOOK` · `KOREAN` 한인 커뮤니티 · `REFERRAL` 소개 · `B2B` 부동산·관리회사 · `WEB` 웹사이트 · `PHONE` 전화 문의 · `PLATFORM` TaskRabbit/Jiffy · `REPEAT` 기존 고객 · `OTHER`

**서비스:** `CL-STD` 일반 청소 · `CL-DEEP` 딥클린 · `CL-MOVE` 입주·이사 청소 · `CL-RECUR` 정기 청소(격주) · `GUT` 홈통 청소 · `SNOW` 제설 시즌 계약 · `SNOW-VISIT` 11월 제설 1회 · `PLAT` 플랫폼 작업 · `OTHER` 기타

- 제설 시즌 계약(`SNOW`)은 견적 시트에는 **시즌 총액**으로 한 줄 적습니다.
- 작업 시트에는 **할부 1회마다** 한 줄씩 적습니다 (12/1, 1/1, 2/1, 3/1).
- 할부금을 EI에서 어느 주에 배분할지는 Service Canada에 확인하세요 (일한 주에 배분, EI Regs s.36(6)).

**입금 방법:** `ETRANSFER` · `CASH` · `CARD` · `CHEQUE` · `PLATFORM`

**후속 유형:** `QUOTE` 견적 후속 · `CALLBACK` 다시 연락 · `RECURRING` 정기 청소 제안 · `REFERRAL` 소개 부탁 · `REVIEW` 후기 부탁 · `SNOW` 제설 안내 · `OTHER`

**동의 근거 (문자·이메일일 때 필수, CASL):**

| 코드 | 뜻 |
|---|---|
| `EXPRESS` | 고객이 따로 체크해서 동의함 |
| `INQUIRY` | 고객이 먼저 문의함. 문의일부터 6개월 (CASL s.10(10)) |
| `REPLY` | 문의에 대한 직접 답장 (SOR/2013-221 s.3(b)) |
| `REFERRAL` | 소개받음. 첫 메시지에 소개자 이름을 넣어야 함 (s.4(1)) |
| `NONE` | 근거 없음 → 전화나 방문만 |

---

## 7. 하루 흐름

1. 문을 두드릴 때마다 **Doors**에 한 줄씩 적습니다. 종이에 적었다가 저녁에 옮겨도 됩니다.
2. Q·B가 나오면 **Quotes**에 한 줄 적습니다. CB는 **Follow-ups**에 적습니다.
3. 작업을 끝내면 **Jobs**에, 돈을 받으면 **Payments**에 적습니다.
4. 돈을 쓰면 **Expenses**에, 차로 이동했으면 **Mileage**에 적습니다.
5. 저녁에 **지표 Dashboard** 6번 칸의 제목 줄을 복사해서 본인에게 이메일로 보냅니다 (아래 8번).
6. 점검일에는 Dashboard 5번 **중단 기준**(시트 표시: Kill criteria)을 봅니다: 10/4, 10/7, 10/9, 10/11, 10/18, 10/25, 10/27, 11/20.

---

## 8. DAILY 이메일 형식

매일 저녁, **본인 이메일로** 제목 한 줄짜리 메일을 보냅니다. 저녁 Routine(memo item 18)이 Gmail에서 이 메일을 찾아 숫자를 읽고, 보고서 초안을 만듭니다. Routine은 아직 한 번도 테스트하지 않았습니다.

**제목 형식 (정확히 이대로):**

```
DAILY YYYY-MM-DD doors=_ answers=_ quotes=_ closes=_ completed=_ net=_
```

**예시 (가짜 숫자):**

```
DAILY 2026-09-30 doors=40 answers=12 quotes=1 closes=0 completed=0 net=0
```

| 키 | 뜻 | 워크북 계산 |
|---|---|---|
| `YYYY-MM-DD` | **일한 날짜** (보내는 날이 아님) | 설정 시트 기준일 |
| `doors` | 그날 시도 수 (NS 제외) | Doors: NA+NI+Q+B+CB |
| `answers` | 문을 연 수 | Doors: NI+Q+B+CB |
| `quotes` | 그날 새로 받은 견적 요청 수 (모든 출처) | Quotes: 요청일 = 그날 |
| `closes` | 그날 성사된 계약 수 | Quotes: WON + 계약일 = 그날 |
| `completed` | 그날 끝낸 유료 작업 수 | Jobs: 완료일 = 그날 |
| `net` | 그날 완료 작업의 순이익 (금액 − 직접비), 달러 반올림 | Jobs: 순이익 합 |

**규칙**
- 제목만 쓰면 됩니다. 본문은 비워도 됩니다.
- 키는 영어 소문자이고, 위 순서를 지킵니다. 칸 사이는 공백 한 칸이고, `=` 앞뒤에는 공백을 넣지 않습니다.
- 숫자만 씁니다. 콤마, `$`, 소수점은 넣지 않습니다. 손해면 `net=-20`처럼 씁니다.
- 쉬는 날에는 모두 0으로 보내면 기록이 끊기지 않습니다.
- 잘못 보냈으면 같은 날짜로 한 번 더 보내세요. Routine이 가장 최근 메일을 쓰도록 설정되어 있는지는 item 18에서 확인해야 합니다.
- **고객 이름, 주소, 전화번호는 절대 넣지 마세요.** 숫자만 보냅니다.
- 워크북의 설정 시트에서 기준일을 그날로 두면 Dashboard 6번 칸에 제목 줄이 완성되어 나옵니다. 그대로 복사하면 됩니다.

---

## 9. 매주 할 일과 EI 신고

- **EI 주간신고 시트**는 일요일부터 토요일까지를 한 주로 봅니다 (EI Act s.10(1)).
- 순수입 = 총수입 − 운영비 (EI Regs s.35(10)(c))입니다. 수입은 **일한 주**에 넣습니다 (s.36(6)). 받은 돈은 모두 신고합니다 (F4).
- 공제 추정 = 순수입의 50% (주당 보험가입소득의 90%까지) + 그 위는 100%. EI 수령 추정 = B − 공제.
- **Path B 전환선** = (B − 0.5A + 0.881A) ÷ 0.881입니다 (A = Path A 주간 순수입, memo 5.4).
  - 최대 EI(B = $729)와 A = $400이면 약 $1,000/주가 됩니다 (F5, 2차 자료·추정. 실제 B는 Service Canada 금액으로 교체).
  - 본인의 실제 B와 주당 보험가입소득(설정 시트 표시: Weekly insurable earnings)을 설정 시트에 넣으면 다시 계산됩니다.
- 판단 칸은 "지난 2주 완료 + 앞으로 2주 예약 순이익 ÷ 4주"를 전환선과 비교합니다. 이것은 memo 5.4 규칙 3을 해석한 **추정**입니다.
- 사업이 "경미한 정도(minor extent)"를 넘는지는 **Service Canada가 결정**합니다. 10월 기본값은 Path A입니다. 먼저 전화로 문의하세요.
- EI 신청 마감은 **2026-10-10(토)**입니다 (F1).
- 신고한 주에는 "신고함 Y"와 신고일을 적어 기록을 남기세요. `csv/ei-weekly.csv`는 같은 내용을 따로 보관하는 기록용입니다.

---

## 10. CSV 템플릿 열

| 파일 | 열 (순서대로) |
|---|---|
| `doors.csv` | date, street, house_no, attempt_no, outcome, notes, cluster |
| `quotes.csv` | quote_id, request_date, source, name, address, contact, service, quote_price, status, won_date, scheduled_date, door_signed, marketing_optin, notes |
| `jobs.csv` | job_id, quote_id, completed_date, name, address, service, source, price, direct_costs_actual, door_signed, notes |
| `payments.csv` | date, job_id, amount, method, reference, notes |
| `followups.csv` | created_date, name, related_id, type, channel, due_date, done, consent_basis, unsubscribed, result, notes |
| `ei-weekly.csv` | week_start, week_end, gross, operating_expenses, net, path, ei_deduction_est, ei_paid_est, declared, declared_on, notes |

- 날짜는 `YYYY-MM-DD`, 금액은 숫자만, Y/N 칸은 `Y` 또는 `N`입니다.
- 예시 가격은 `config/prices.ts`의 GTA 기본값에서 가져옵니다 (딥클린 침실 2개, 입주·이사 침실 2개, 일반 침실 1개). 실제 가격표와 같아야 합니다.
- `ei-weekly.csv` 예시의 EI 숫자는 최대 EI($729) 기준 **추정**입니다.

---

## 11. 인보이스 보내기

1. **인보이스 Invoice** 시트의 노란 칸 B6에 작업 ID(예: `J-001`)를 넣습니다.
2. 고객, 주소, 서비스, 금액, 입금액, 잔액이 자동으로 채워집니다. 인보이스 번호는 `INV-작업ID`입니다.
3. 추가 항목은 13–15행에 적습니다. 금액은 가격표와 같게 씁니다.
4. 설정 시트에서 HST 등록이 YES일 때만 세금 줄이 나타납니다.
5. 조건에 따라 아래 안내가 자동으로 붙습니다.
   - 방문 계약(Y): 온타리오 10일 취소권 + 15일 내 환불 (F32)
   - 제설 계약: 4회 분할 일정(12/1, 1/1, 2/1, 3/1), 12/1 전 결제 없음, 11/20 무효 조건
   - $2,000 초과: e-Transfer 나눠 받기 안내
6. 인쇄하거나 PDF로 저장합니다 (Letter 한 장, A–F열).

**이메일로 보낼 때 본문 예시** — 이름, 우편 주소, 연락처, 수신거부 문구를 반드시 넣습니다 (CASL, F11·F13).

```
제목: {BRAND} 인보이스 {INVOICE_NO}

안녕하세요, {CUSTOMER_NAME}님.
{SERVICE_DATE}에 해 드린 작업의 인보이스를 첨부합니다. 금액은 {TOTAL}입니다.
Interac e-Transfer는 {ETRANSFER_EMAIL}로 보내 주시고, 메시지에 {INVOICE_NO}를 적어 주세요.
감사합니다.

{BRAND} · {MAILING_ADDRESS} · {PHONE} · {EMAIL}
이런 메일을 더 받고 싶지 않으시면 "수신거부"라고 답장해 주세요.
```

```
Subject: {BRAND} invoice {INVOICE_NO}

Hi {CUSTOMER_NAME},
Your invoice for the work on {SERVICE_DATE} is attached. The total is {TOTAL}.
Please send an Interac e-Transfer to {ETRANSFER_EMAIL} and put {INVOICE_NO} in the message.
Thank you!

{BRAND} · {MAILING_ADDRESS} · {PHONE} · {EMAIL}
To stop getting these emails, reply "unsubscribe".
```

**문자로 보낼 때**

```
{BRAND}: 인보이스 {INVOICE_NO}, {TOTAL}. e-Transfer는 {ETRANSFER_EMAIL}로 보내 주시고 메시지에 {INVOICE_NO}를 적어 주세요. {MAILING_ADDRESS} · {PHONE}. Reply STOP to opt out.
```

```
{BRAND}: Invoice {INVOICE_NO}, {TOTAL}. Please e-Transfer to {ETRANSFER_EMAIL} with {INVOICE_NO} in the message. {MAILING_ADDRESS} · {PHONE}. Reply STOP to opt out.
```

- 수신거부를 받으면 후속 시트에서 "수신거부? Y"로 바꾸고, **10영업일 안에** 처리합니다. 수신거부 방법은 60일 동안 유효해야 합니다 (F11).
- 모르는 소비자에게 먼저 이메일이나 문자를 보내면 안 됩니다 (memo §3). AI는 메시지를 보내지 않습니다. 보내는 것은 항상 본인입니다.

---

## 12. 개인정보와 보안

- 워크북에는 고객 이름, 주소, 연락처가 들어갑니다. **본인만 볼 수 있는 곳**에 보관하세요 (개인 Google Drive, 암호가 걸린 컴퓨터).
- **실제 고객 정보가 든 파일은 GitHub 저장소에 올리지 마세요.** 저장소에는 빈 템플릿과 숫자만 있는 기록만 둡니다. DAILY 이메일에도 숫자만 넣습니다.
- 온타리오 개인정보는 PIPEDA가 적용됩니다. 정보 유출이 생기면 유출 기록을 24개월 보관해야 합니다 (SOR/2018-64, memo §6).
- 고객 집 사진을 홍보에 쓰려면 고객이 따로 서면으로 동의해야 합니다 (memo §6).

---

## 13. 한계와 확인할 것

- 문 두드리기 응답률·견적률·계약률(35% / 10% / 40%)은 **가정**입니다. 근거 자료를 찾지 못했습니다 (F45). 가능한 한 빨리 측정값으로 바꾸세요.
- 모든 시장 가격은 검색 요약(snippet)에서 가져왔습니다. 첫 주에 동네 경쟁업체 가격 5–10개를 직접 확인하세요.
- **T2125 지출 분류 목록은 연구 자료에 없습니다.** 최신 CRA T2125 양식에서 줄 번호와 이름을 확인하세요.
- 방문 계약의 10일 취소 기간 안에 작업을 해 버린 경우의 효과는 조사하지 않았습니다. 확인할 때까지 그 돈은 환불될 수 있다고 보세요 (memo 5.3).
- 플랫폼(TaskRabbit, Jiffy) 수입이 본인의 과세매출에 들어가는지는 확인하지 못했습니다 (설정 시트에서 스위치로 조정).
- CASL 우편 주소로 사서함(PO box)을 써도 되는지는 규정에 없습니다 (F13).
- 카드 수수료(2.9% + $0.30)는 Stripe 캐나다 기준 2차 자료입니다 (F37). e-Transfer 한도는 은행마다 다릅니다 (F36).
- 소득세율과 소득세 적립액은 연구 범위 밖이라 워크북에 없습니다.
- 차량 비용을 km당 얼마로 계산하는지는 조사하지 않았습니다. 주행 시트에는 기록만 남깁니다.
