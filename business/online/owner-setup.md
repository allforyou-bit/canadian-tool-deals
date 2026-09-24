# 오너 설정 체크리스트: Maple Practice Coach

> **근거:** `business/online/decision-memo.md`(이하 "메모") §1.3 관문, §4.1 1회 설정, §4.2 주간 업무, §6 중단 규칙,
> §7.1 수정 사항(2026-09-24)을 옮겼어요. 리뷰 1차(2026-09-24) 뒤 통합 담당이 정한 결정은 "(결정 N)"으로 표시했어요. 결정 내용은 대부분 메모 §7.1에 요약돼 있고, 오너에게 필요한 부분은 이 문서에 그대로 적었어요. 새 전략은 없어요.
>
> **표시 규칙**
> - **추정**: 메모나 리뷰의 계산값이에요. 실제 결과가 아니에요.
> - **[미확인]**: 여기서 직접 확인하지 못한 내용이에요(화면 메뉴 이름, 외부 서비스 정책 등). 직접 보고 다르면 AI에게 알려 주세요.
> - 시간은 모두 메모 §4.1의 **추정**이에요.
>
> **함께 쓰는 문서**
> - `business/online/gate-b-anthropic-email.md`: Gate B에 보낼 영어 이메일 초안(한국어 설명 포함).
> - `business/online/legal-summary-ko.md`: 법률 페이지 5개의 한국어 요약. **기준은 영어 페이지**예요.
>
> 법률·세무 자문이 아니에요. 계정 가입, 본인 인증, 결제, 전화, 서명은 **오너가 직접** 해요. AI는 코드와 문서를 만들고, 돈을 쓰거나 가격·광고·환불을 바꾸지 않아요(메모 §1.4).

---

## 0. 가장 먼저: GitHub 저장소를 비공개로 (0.1시간)

메모 §4.1의 3번 작업이지만 **다른 무엇보다 먼저** 하세요. 저장소는 지금 공개 상태이고 `business/03-EI-결정규칙.md`가 드러나 있어요(메모 §4.1). 채점 프롬프트와 운영 파일도 사업 자산이에요(메모 §5.1).

1. GitHub에서 저장소 `canadian-tool-deals` → **Settings** → 맨 아래 **Danger Zone** → **Change repository visibility** → **Make private** [미확인: 메뉴 이름].
2. 비공개 저장소는 Actions 무료 사용 시간이 월 2,000분이에요(메모 §4.1, github/docs 인용).
3. 지금까지 올라간 커밋에는 비밀 키나 사용자 데이터가 없어요(메모 §5.1 푸시 규칙).

---

## 1. 관문 (메모 §1.3)

관문을 통과하지 못하면 다음 단계로 가지 않아요.

### Gate 0: 법적 권리, EI, 오너 시간 (1일차 – 10월 9일 금)

- IRCC 서류로 **자영업을 해도 되는지** 확인해요. 안 되면 **중단**이에요.
- **설정 첫 주부터** 자영업 활동을 EI 신청서와 격주 보고서에 신고해요(첫 판매부터가 아니에요). EI Regs s.30(1)은 누가 일을 하든 "사업을 운영하는" 주에 적용돼요(메모 §1.3).
- **10월 9일(금)까지 Service Canada에 전화**해요. 홈서비스(decision-memo.md Path A)와 이 온라인 제품을 **함께** 설명하고, 시간과 자본(광고 상한 C$1,200 + 월 고정비 약 C$100)을 말한 뒤, 둘을 합쳐도 "minor in extent"(EI Regs s.30(2)–(3))인지 물어요.
- **이 통화 전에는 Stripe 계정을 열지 않고 광고도 사지 않아요.**
- Service Canada가 "minor가 아니다"라고 하면 **EI를 받는 동안 유료 판매는 하지 않아요.** 답을 받지 못하면 decision-memo.md §5.4를 따르고 매주 순이익을 신고해요.
- **시간 규칙:** EI 수급 중이면 홈서비스 + 이 제품이 **주 15시간 이하**(추정 기준, 법적 기준 아님)일 때만 진행해요. EI가 아니면 합계 주 45시간 이하일 때만 진행해요. 충돌하면 **홈서비스가 우선**이에요.
- EI 격주 보고 날짜를 알게 되면 `ops/config/ei-schedule.json`의 `anchorMonday`를 실제 보고 월요일로 바꾸고 `confirmedByOwner`를 `true`로 바꿔 커밋해요. `books` Routine이 이 날짜로 2주마다 EI용 순이익을 써요(지금 값 2026-10-05는 자리표시예요).

### Gate B: Anthropic 이용 정책(AUP). 상태: **미해결**

AI는 보관본(2025-09-15 시행, OpenTermsArchive)만 읽었어요. 보관본에는 이렇게 적혀 있어요(메모 §1.3 인용):

- 고위험 사용으로 "Academic testing, accreditation and admissions: Use cases related to standardized testing companies that administer school admissions …, language proficiency, or professional certification exams"를 들어요.
- 고위험 사용은 배포 전에 "qualified professional"의 검토를 요구해요.

**출시 전에 할 일 (2번 작업, 1일차, 0.25시간):**

1. 브라우저로 `anthropic.com/legal/aup`를 열어 **현재 문구 전체**를 복사해 저장소 이슈에 붙여 넣어요(AI는 여기서 anthropic.com에 접속할 수 없어요).
2. AI가 보관본과 비교해요. 특히 고위험 목록의 **academic testing / language proficiency** 문구와 "qualified professional" 검토 요건이 바뀌었는지 봐요.
3. `business/online/gate-b-anthropic-email.md`의 **영어 초안**을 Anthropic에 보내요. 파일 안의 `[대괄호]` 칸을 채우고, 현재 문구가 보관본과 다르면 질문의 인용문을 현재 문구로 바꿔요. **받는 곳은 [미확인]**이에요: 현재 AUP 페이지에 적힌 이용 정책 문의 연락처(또는 그 페이지가 안내하는 창구)를 써요. 답장은 보장되지 않아요. 보낸 날짜를 이슈에 댓글로 남겨요.

**규칙 (메모 §1.3):**

- 현재 문구가 연습 도구를 **분명히 포함**하면 → **채점 기능을 출시하지 않아요.** Judge 2의 Apify PPE 계획(광고 없음)으로 바꾸거나, 중단하고 소득 기반(EI·홈서비스)에 기대요.
- **21일차(10월 18일 일)까지 답이 없으면** → "writing and speaking practice feedback"으로만 출시해요. 어떤 출력이나 광고에도 **CLB, band, level, score 표현을 쓰지 않아요.**
- 아래 **"위험 수용"**에 서명해요.

### Gate C: 광고비 (7일차)

- 1월 31일까지 광고비 **C$1,200**을 잃어도 월세나 식비에 영향이 없는지 확인해요(고정비와 별도).
- 아니면 광고 없이 운영해요. 그러면 결과는 보수적 시나리오 이하일 가능성이 커요.
- 통과하면 `ops/config/ad-cap.json`의 `"confirmedByOwner"`를 `true`로 바꾸는 PR을 **직접 병합**해요. 이 병합이 메모가 말하는 서면 확인이에요.

---

## 위험 수용

메모의 해당 문장(원문 그대로):

> "The owner signs a written risk acceptance in the checklist (`business/online/owner-setup.md`, section "위험 수용")."

메모 §1.3이 이 서명의 근거로 든 문장(원문 그대로):

> "**The AI's reading.** A third-party practice tool that neither administers a test nor feeds an official decision is *probably* outside. But "related to" is broad, and a grader for language-proficiency-style tasks is plausibly inside. "Probably outside" is not a pass. **This cannot be guaranteed.**"

메모에는 서명할 문장이 따로 적혀 있지 않아요. 아래 문장은 메모 §1.3의 내용을 옮긴 것이에요. 읽고 동의하면 서명해요.

> 나는 Anthropic 이용 정책의 고위험 항목(academic testing, language proficiency)이 이 연습 도구에 적용되는지 **확정되지 않았다**는 것을 이해해요. AI의 판단("아마 해당하지 않음")은 통과가 아니며 보장되지 않아요. Anthropic의 답이 없으면 "writing and speaking practice feedback"으로만 출시하고, 어떤 출력과 광고에도 CLB·band·level·score 표현을 쓰지 않아요. 현재 정책 문구가 연습 도구를 분명히 포함하면 채점 기능을 출시하지 않아요. 이 위험은 내가 부담해요.
>
> 서명: ____________________  날짜: ____________

---

## 2. 1회 설정 (메모 §4.1 순서대로)

| # | 작업 | 시간(추정) | 할 일 |
|---|---|---|---|
| 1 | **Gate 0:** 자영업 권리 확인 | 0.25시간 | IRCC 서류 확인. 안 되면 중단 |
| 2 | **Gate B** | 0.25시간 | 현재 AUP 문구를 이슈에 붙여 넣기, `gate-b-anthropic-email.md`의 이메일 보내기, 위 "위험 수용" 서명 |
| 3 | **저장소 비공개** | 0.1시간 | 0단계에서 이미 했으면 건너뛰어요 |
| 4 | 사업용 Google 계정과 이메일 | 0.5시간 | 개인 계정과 분리해요. Google Ads 보고서와 지원 메일도 이 계정으로 받아요 |
| 5 | **Claude Pro** 유지 또는 구입 | 0.5시간 | 환경 설정에서 `api.stripe.com`, `api.cloudflare.com`, `api.resend.com`을 허용하거나, 실제 운영 작업은 Actions에서만 돈다는 것을 받아들여요. Routine에 Gmail을 연결해요 |
| 6 | **Anthropic Console** | 0.5시간 | 아래 2-1: 운영용 키와 **평가용 키를 따로**, 각각 월 한도, 채점 모델 선택 |
| 7 | **Cloudflare** | 1.0시간 | 아래 2-2(도메인 연결 포함), 2-3(운영과 스테이징 데이터베이스) |
| 8 | **EI 신청** (자영업 활동 신고) | 1.0시간 | **10월 10일(토)까지**. EI Act s.38(1)(c) |
| 9 | **Service Canada 전화** | 0.5–1.5시간 | Gate 0 참고. **11번(Stripe)과 15번(Google Ads)은 이 통화 뒤에만** 해요. 대기 시간 [미확인] |
| 10 | **ServiceOntario 사업자명 등록 (필수, 결정 17)** | 0.5시간 | "Maple Practice Coach" 이름을 등록해요. 코드는 모든 페이지, 이메일 발신자, 마케팅 동의 문구, 약관의 계약 당사자에 이 이름을 써요. 법적 실명으로 바꾸는 설정은 없어요. CASL 규정(SOR/2012-36 s.2(1)(a))은 이메일에 "영업에 쓰는 이름"을 적게 해요. 온타리오 Business Names Act의 정확한 등록 규칙과 수수료는 [미확인]이에요(메모 §8 10번) |
| 11 | **Stripe Canada** | 1.5시간 | 아래 2-4. **9번 통화 뒤에만**. 카드 외 결제수단 끄기, 웹훅 이벤트 5개 |
| 12 | **Resend** | 0.5시간 | 아래 2-5 |
| 13 | 사서함 또는 PO Box (**필수**) | 0.75시간 | CASL 이메일과 개인정보 처리방침에 들어갈 주소. 변수 `MPC_MAILING_ADDRESS`에 넣어요. **이 변수가 없으면 배포가 실패해요**(결정 16). PO Box로 충분한지는 명시돼 있지 않아요(메모 F13) |
| 14 | **법률 페이지와 제품 페이지 검토·승인** | 1.0시간 | 아래 2-8. 한국어 요약: `legal-summary-ko.md` |
| 15 | **Google Ads** (Gate C 통과 시에만) | 1.65시간 | 아래 2-9. **9번 통화 뒤에만** |
| 16 | Search Console 인증 | 0.15시간 | AI가 DNS 레코드를 준비하면 오너가 인증을 눌러요. Bing은 나중에 |
| 17 | **출시일 점검** | 0.35시간 | 아래 2-10: 실제 카드로 C$39 구매와 셀프 환불, iPhone으로 말하기 과제 녹음 |

**합계(추정):** 11.0–12.0시간으로 예산 약 10시간을 넘어요(메모 §4.1은 10번을 이미 0.5시간으로 셌어요). 1, 8, 9번(1.75–2.75시간)은 소득 기반 작업이라 이 제품 몫은 약 9.25시간이에요. 사업자명 등록이 필수가 되어(결정 17) "법적 실명으로 영업해 0.5시간 줄이기"는 더 이상 쓸 수 없어요. 모두 세고 줄이려면 Google Ads를 빼는 것(−1.65시간, 광고 없는 운영)만 남고, 그러면 9.35–10.35시간이에요. **설정이 12시간을 넘으면 K2가 발동해요.**

**리뷰 뒤 추가된 설정(시간 추정 없음):** 평가용 Anthropic 키(2-1), 도메인을 Worker에 연결(2-2), 스테이징 환경(2-3, 2-7), Stripe 결제수단 끄기와 웹훅 이벤트 추가(2-4). 메모 §4.1의 시간 추정에는 없어요. 실제로 걸린 설정 시간을 `ops/owner/hours.json`에 `{"setupHours": 9.5}`처럼 적으면 KPI Routine이 K2에 써요.

### 2-1. Anthropic Console (6번)

**키와 한도 (결정 1, 메모 §3.4, §7.1 B10)**

1. Console에서 **작업 공간(workspace)을 두 개** 써요: 운영용(예: `production`)과 평가용(예: `eval`). 작업 공간별 월 지출 한도가 있다는 것은 Claude API 안내(`shared/cost-optimization.md`: "a workspace spend limit is the final backstop on the whole workspace")에서 확인했어요. 화면 메뉴 이름과 설정 방법은 [미확인]이에요.
2. **운영용 작업 공간:** API 키를 만들어 GitHub 비밀 `ANTHROPIC_API_KEY`에 넣어요(2-6). **월 지출 한도 US$150**과 알림을 설정해요(메모 §3.4).
3. **평가용 작업 공간:** API 키를 따로 만들어 GitHub 비밀 `ANTHROPIC_EVAL_API_KEY`에 넣어요. 스테이징 Worker의 채점도 이 키를 써요(2-7). 월 한도는 메모 §3.3의 개발·평가 몫인 **약 US$30**으로 설정해요. 주간 평가(`Grading eval` 워크플로)와 프롬프트 PR 평가는 이 키로 돌아서, 운영 한도를 쓰지 않아요. 이 비밀이 없으면 평가가 운영 키 `ANTHROPIC_API_KEY`로 돌고 경고를 보여 줘요(운영 한도를 써요). 한 번 돌릴 때 비용 상한은 변수 `MPC_EVAL_BUDGET_USD`(비우면 US$60, 스크립트 실행 1회당)예요: 모든 요청이 출력 상한까지 쓴다고 가정한 최악 비용이 이 값을 넘으면 아무것도 보내지 않고 실패해요(2-6). 리뷰 추정으로 전체 평가 1회(샘플 120개와 점검 항목, 각 3회)는 Opus 5에서 약 US$13–27이라, 매주 돌리면 한 달에 약 US$57–116이에요(추정). US$30 한도로는 부족하니 한도를 올리거나(고정비 F가 늘어요) `MPC_EVAL_LIMIT`로 샘플 수를 줄여요. PR 평가는 `MPC_EVAL_PR_LIMIT`(비우면 20개)만 채점해요. 평가 작업 공간이 한도에 닿으면 그달 남은 평가만 실패하고, 운영 채점에는 영향이 없어요.
4. 운영 한도와 **같은 숫자**를 `ops/config/anthropic-limit.json`의 `monthlyLimitUsd`에 적고(기본 150), `confirmedByOwner`를 `true`로 바꿔 커밋해요. 평가용 한도는 같은 파일의 `evalMonthlyLimitUsd`에 기록용으로 적어요. 배포 워크플로가 `monthlyLimitUsd`를 Worker의 `ANTHROPIC_MONTHLY_LIMIT_USD`로 넣고, Worker의 지출 단계(70%에서 무료 샘플 끄기, 95%에서 알림, 하루 지출이 비정상적으로 크면 채점 일시 중지)는 **메모 공식 L과 이 값 중 작은 쪽**을 기준으로 해요(`worker/src/lib/spend.ts`, 메모 §7.1 B10). 그래서 Console 한도보다 먼저 무료 샘플이 꺼져요. `confirmedByOwner`가 `false`인 동안에는 배포할 때마다 "확인되지 않음" 경고가 나와요. KPI Routine도 이 파일을 읽어요.
5. **한도를 올릴 때(순서대로):** ① Console에서 **먼저** 운영 작업 공간 한도를 올려요, ② KPI Routine의 인상 PR을 병합하거나 `monthlyLimitUsd`를 같은 숫자로 고쳐 `master`에 커밋해요. 이 파일이 바뀌면 배포 워크플로가 **자동으로 다시 배포**해서 Worker가 새 값을 써요. 순서를 거꾸로 하면 Worker가 Console보다 큰 한도를 믿게 돼요. KPI Routine은 L이 설정값을 넘거나, 이번 달 채점 비용이 설정값의 95% 이상이면 인상을 제안해요(`ops/routines/kpi.md`).

**채점 모델 선택 (`MPC_GRADER_MODEL`, 결정 1 — 오너가 정해요)**

기본값은 `claude-opus-5`예요. Claude API 안내는 비용 때문에 모델을 몰래 낮추지 말라고 해서 코드는 기본값을 바꾸지 않았어요. 저장소 변수 `MPC_GRADER_MODEL`에 `claude-sonnet-5`를 넣으면 토큰당 단가가 더 낮은 모델로 채점해요. 단가는 `products/clb/shared/config.ts`의 `MODELS`(공식 100만 토큰당 가격, 2026-06-24 캐시) 그대로예요.

| 모델 | 입력 (100만 토큰당) | 출력 (100만 토큰당) | 쓰기 채점 1회 비용 (**추정**) |
|---|---|---|---|
| `claude-opus-5` (기본) | US$5 | US$25 | 약 US$0.043 (캐시 있음) / 약 US$0.054 (캐시 없음) |
| `claude-sonnet-5` | US$2 | US$10 | 약 US$0.017 (캐시 있음) |

- 채점 1회 비용은 **추정**이에요. 리뷰가 저장소의 테스트용 예시(짧은 글)의 토큰 수로 계산했어요: 캐시된 지시문 약 1,950 + 입력 약 527 + 출력 약 1,576 토큰(생각 토큰 포함). 실제 글은 더 길어서 비용이 더 클 가능성이 커요(메모 §3.1 수정 주석). 캐시 읽기는 입력 단가의 0.1배, 캐시 쓰기(5분)는 1.25배예요(`MODELS`).
- 같은 추정으로 30일 이용권 사용자 한 명(메모의 120회 가정)은 Opus 5에서 약 US$5.2–6.5예요(메모 §3.1 수정 주석, 추정). 공정 사용 상한(30일 150회)을 다 쓰면 150 × 0.054 ≈ US$8.1(약 C$11, 추정)이에요.
- 메모 §3.4의 한도 공식(매출의 30%)은 Sonnet 5 비용으로 정한 값이에요. Opus 5로 쓰면 많이 쓰는 사용자의 비용이 커서 한도에 더 빨리 닿을 수 있어요. 한도에 가까워지면 무료 샘플이 먼저 꺼져요(메모 B10).
- 바꾼 뒤에는 다시 배포하고, **Grading eval** 워크플로를 한 번 돌려 품질 기준을 통과하는지 확인해요(평가도 `MPC_GRADER_MODEL`을 따라요).

**선택 조정 변수 (결정 1):** 평가로 품질이 유지되는 것을 확인한 뒤에만 바꿔요.

- `MPC_GRADER_EFFORT`: `low`, `medium`, `high`, `xhigh`, `max` 중 하나. 비우면 `high`. 낮출수록 비용이 줄지만 품질이 떨어질 수 있어요.
- `MPC_GRADER_MAX_TOKENS`: 1024–20000 사이 정수. 비우면 8000. 생각 토큰과 답을 합친 출력 상한이에요.
- 잘못된 값(오타, 범위 밖)은 Worker가 무시하고 기본값을 써요(`worker/src/grading/claude.ts`).

### 2-2. Cloudflare 계정, API 토큰, 도메인 (7번)

1. 계정을 만들고 **Workers Paid(US$5/월)**로 올려요(메모 §3.3). 상업적 사용 약관을 읽어요(decision-memo.md F40).
2. **API 토큰:** 대시보드 → My Profile → API Tokens → Create Token [미확인: 메뉴]. "Edit Cloudflare Workers" 템플릿에서 시작해 **D1 편집**과 **Workers KV 편집** 권한이 있는지 확인해요. Worker가 Workers AI(받아쓰기)를 쓰므로 그 권한도 필요할 수 있어요. 도메인을 Worker에 붙이려면 그 도메인(zone)의 **Workers Routes 편집**과 **DNS 편집** 권한도 필요할 수 있어요 [미확인: 템플릿과 권한 이름]. 토큰은 GitHub 비밀 `CLOUDFLARE_API_TOKEN`, 계정 ID는 `CLOUDFLARE_ACCOUNT_ID`에 넣어요.
3. **도메인 연결:** 도메인을 사면(약 C$20/년, [미확인]) Cloudflare에 사이트로 추가하고 등록 업체에서 네임서버를 Cloudflare로 바꿔요 [미확인: 화면]. 그다음 변수 `MPC_SITE_URL`을 `https://도메인`으로 넣어요(경로 없이, 예: `https://example.ca`. 경로나 포트가 있으면 배포 전 검사에서 멈춰요). 배포 워크플로가 이 주소가 `workers.dev`가 아니면 Worker에 그 도메인을 **사용자 지정 도메인**으로 붙여요(wrangler 4.137 `deploy --domain`, `--help`로 확인). 도메인을 붙이지 않으면 Worker 주소(`workers.dev`)를 `MPC_SITE_URL`에 넣어요. 사이트 주소는 Stripe 웹훅, Turnstile, Resend, 광고 최종 URL에 모두 쓰이니 **먼저 정하고 바꾸지 않는 것**이 좋아요.
4. **Turnstile 위젯:** Cloudflare 대시보드의 Turnstile에서 사이트 주소(호스트 이름)로 위젯을 만들어요 [미확인: 메뉴]. **사이트 키**는 변수 `MPC_TURNSTILE_SITE_KEY`, **비밀 키**는 비밀 `TURNSTILE_SECRET`에 넣어요. 사이트 키가 없으면 사이트가 Cloudflare 테스트 키(항상 통과)로 빌드돼요. 스테이징은 배포 워크플로가 항상 Cloudflare 테스트 키를 쓰니 따로 만들 필요가 없어요.
5. (선택) Web Analytics 토큰은 변수 `MPC_CF_BEACON_TOKEN`에 넣어요 [미확인: 발급 위치].

### 2-3. D1 데이터베이스와 KV 만들기 (7번, 명령어)

Node 22와 저장소 복제본이 있는 컴퓨터에서 실행해요. 명령과 옵션은 wrangler 4.137.0의 `--help`로 확인했어요.

```bash
cd products/clb
npm ci
npx wrangler login                                  # 브라우저로 Cloudflare 로그인
npx wrangler d1 create mpc --location enam          # 운영용. 출력의 database_id를 복사
npx wrangler kv namespace create FLAGS              # 운영용. 출력의 id를 복사
npx wrangler d1 create mpc-staging --location enam  # 스테이징용. 출력의 database_id를 복사
npx wrangler kv namespace create FLAGS_STAGING      # 스테이징용. 출력의 id를 복사
```

`--location enam`(북미 동부)은 사용자가 캐나다에 있어서 고른 힌트예요. 메모가 정한 값은 아니에요. 로컬 도구 없이 Cloudflare 대시보드에서 만들어도 돼요 [미확인: 화면]. **운영과 스테이징은 반드시 다른 데이터베이스와 KV**를 써요. 스테이징 결제 시험이 운영 데이터에 섞이지 않게 하려는 거예요.

그다음 `products/clb/worker/wrangler.jsonc`에서 운영용 두 곳을 이렇게 바꿔요(주석 `//`을 지우고 복사한 ID를 넣어요. `"binding": "FLAGS"` 뒤에 **쉼표**를 꼭 붙여요):

```jsonc
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "mpc",
      "database_id": "여기에-d1-create가-출력한-ID",
      "migrations_dir": "migrations"
    }
  ],
  "kv_namespaces": [
    {
      "binding": "FLAGS",
      "id": "여기에-kv-namespace-create가-출력한-ID"
    }
  ],
```

스테이징 ID는 같은 파일의 `"env"` → `"staging"` 부분에 있는 `d1_databases`와 `kv_namespaces`에 같은 방식으로 넣어요(`d1 create`에 쓴 이름이 그 부분의 `database_name`과 같아야 해요. 예: `mpc-staging`). KV 이름은 아무거나 괜찮고 ID만 맞으면 돼요. wrangler 설정에서 `d1_databases`, `kv_namespaces`, `vars`는 환경마다 따로 적어야 해요(`config-schema.json`: "not automatically inherited"). 그 부분이 파일에 아직 없으면 AI에게 알려 주세요(파일은 통합 담당이 고쳐요).

GitHub 웹에서 파일을 고쳐 `master`에 커밋해도 돼요. 테이블은 배포 워크플로가 `wrangler d1 migrations apply DB --remote`로 만들어요.

### 2-4. Stripe Canada (11번, Service Canada 통화 뒤에만)

1. 본인 인증, 은행 계좌, SIN을 등록해요.
2. **제한된 키(restricted key)**를 테스트용과 실사용용으로 하나씩 만들어요. 코드가 부르는 API는 Checkout Sessions(생성, 목록 — 목록은 Reconcile 워크플로), PaymentIntents(조회, 최신 결제 포함), Refunds(생성, 목록)예요 [미확인: 권한 이름]. 실사용 키는 비밀 `STRIPE_SECRET_KEY`, 테스트 키는 스테이징용 비밀 `STRIPE_TEST_SECRET_KEY`에 넣어요(2-6). 운영 Worker에도 처음에는 테스트 키로 시작하고 출시일(2-10)에 바꿔도 돼요.
3. **웹훅 엔드포인트:** `<사이트 주소>/api/stripe/webhook`, 이벤트 **5개**: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`, `charge.dispute.created`, **`refund.failed`**(결정 13, 이벤트 이름은 Stripe OpenAPI 명세 `2026-09-30.endive`로 확인). 서명 비밀을 비밀 `STRIPE_WEBHOOK_SECRET`에 넣어요. 테스트와 실사용은 엔드포인트와 비밀이 따로예요. 스테이징에는 테스트 모드에서 `<스테이징 주소>/api/stripe/webhook`로 엔드포인트를 하나 더 만들고 비밀을 `STRIPE_TEST_WEBHOOK_SECRET`에 넣어요.
4. **카드만 받아요 (결정 13):** Checkout은 코드에서 카드만 요청해요(Stripe API 버전 `2026-08-26.dahlia`로 고정, `payment_method_types: ['card']`). 그래도 대시보드의 결제수단 설정에서 **Link와 후불 결제(Klarna, Afterpay/Clearpay, Affirm 등)를 꺼요** [미확인: 메뉴 이름, 예: Settings → Payment methods]. 카드가 아닌 결제는 카드 발행국을 확인할 수 없어서 지역 규칙으로 **자동 환불**되고, 수수료는 돌려받지 못해요(메모 §3.2). 그런 결제가 오면 `[MPC] Non-card payment refunded` 알림이 와요 → 결제수단 설정을 다시 확인해요.
5. 가능하면 캐나다 외 카드를 막는 Radar 규칙을 추가해요 [미확인: 사용 가능 여부]. 없어도 서버가 결제 전후에 국가를 확인해요(메모 B6).
6. 테스트 모드로 결제해 볼 때는 **캐나다 발행 테스트 카드**를 써요. 캐나다 외 카드는 결제 후 자동 환불돼요(메모 B6). 테스트 카드 번호는 Stripe 문서에서 확인해요 [미확인].

**부분 환불과 남은 날짜 환불 (결정 13):** 약관은 몇몇 경우(서비스 종료, 공정 사용 한도 축소, 오너 사유 해지, 중대한 약관 변경) **남은 날짜를 일 단위로 계산해 환불**하고 **이용권을 끝낸다**고 약속해요(`legal-summary-ko.md`).

- 금액: 가격 × 남은 일수 ÷ 이용권 일수(30 또는 90). 예: C$39 30일 이용권의 남은 12일 → 39 × 12 ÷ 30 = C$15.60.
- Stripe 대시보드에서 해당 결제를 찾아 그 금액만 **부분 환불**하고, 환불에 **메타데이터 `end_pass` = `true`**를 붙여요. 대시보드 환불 화면에서 메타데이터를 넣을 수 있는지는 [미확인]이에요. 안 되면 Stripe API로 해요(매개변수 `payment_intent`, `amount`, `metadata`는 Stripe OpenAPI 명세 `2026-09-30.endive`의 `POST /v1/refunds`로 확인):

  ```bash
  curl https://api.stripe.com/v1/refunds -u "<실사용 비밀 또는 제한 키>:" \
    -d payment_intent=<pi_로 시작하는 결제 ID> -d amount=1560 -d "metadata[end_pass]=true"
  ```

  `amount`는 센트 단위예요(C$15.60 → 1560). 키는 명령을 친 뒤 터미널 기록에서 지워요.
- Worker가 웹훅으로 환불 금액의 차이를 `owner` 환불로 기록하고, **전액 환불이거나 `end_pass=true`일 때만** 이용권을 끝내요. `end_pass` 없이 부분 환불하면(예: 선의의 일부 환불) 이용권은 그대로예요.
- 정책 밖 전액 환불은 대시보드에서 전액 환불하면 이용권이 자동으로 끝나요.

**환불 실패 (결정 13):** 카드 해지 등으로 환불이 나중에 실패하면 `[MPC] Refund failed` 알림이 와요. 알림에 구매 번호와 실패 사유가 있어요. 구매자는 돈을 받지 못한 상태예요(셀프 환불이었다면 이용권은 이미 끝났어요). Stripe 대시보드에서 결제를 찾아 구매자와 다른 환불 방법을 정해요. Worker는 알림만 보내고 다른 일은 하지 않아요.

### 2-5. Resend (12번)

1. 계정을 만들고 보낼 도메인을 인증해요. Resend가 보여 주는 DNS 레코드를 Cloudflare DNS에 추가해요(`api.cloudflare.com`이 허용돼 있으면 AI가 해요, 메모 §4.1).
2. API 키를 비밀 `RESEND_API_KEY`에 넣어요.
3. 보내는 주소를 변수 `MPC_FROM_EMAIL`에 넣어요. 예: `Maple Practice Coach <coach@도메인>`.
4. 무료 한도는 [미확인]이에요(메모 §8). 지원 메일 전달은 하루 30통으로 제한돼서(결정 7) 로그인 링크 발송 몫을 다 쓰지 않아요.

### 2-6. GitHub 비밀과 변수 (이름만)

저장소 → **Settings** → **Secrets and variables** → **Actions** [미확인: 메뉴]. 값은 여기에만 넣고 파일에는 절대 쓰지 않아요.

**비밀(Secrets)**

| 이름 | 내용 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | 2-2의 API 토큰 |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 계정 ID |
| `ANTHROPIC_API_KEY` | 2-1 운영용 작업 공간의 키 (운영 Worker) |
| `ANTHROPIC_EVAL_API_KEY` | 2-1 평가용 작업 공간의 키 (`Grading eval` 워크플로와 스테이징 Worker) |
| `STRIPE_SECRET_KEY` | 2-4 운영용 (테스트 키로 시작하면 출시 때 실사용 키로 교체) |
| `STRIPE_WEBHOOK_SECRET` | 2-4 운영 엔드포인트의 서명 비밀 |
| `STRIPE_TEST_SECRET_KEY` | 2-4 테스트 키 (스테이징) |
| `STRIPE_TEST_WEBHOOK_SECRET` | 2-4 스테이징 엔드포인트의 서명 비밀 (테스트 모드) |
| `RESEND_API_KEY` | 2-5 |
| `TURNSTILE_SECRET` | 2-2 |
| `HASH_SALT` | 무작위 긴 문자열. 예: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` 출력값. **한 번 정하면 바꾸지 마세요.** 바꾸면 모든 로그인이 끊기고, "이메일당 한 번" 환불 규칙과 수신 거부 링크가 이전 기록과 맞지 않게 돼요 |

**변수(Variables)**

| 이름 | 내용 |
|---|---|
| `MPC_SITE_URL` | 사이트 주소, `https://`로 시작(2-2). 도메인을 붙이지 않으면 Worker의 `workers.dev` 주소예요 [미확인: 주소 형식] |
| `MPC_MAILING_ADDRESS` | **필수.** 13번의 우편 주소(CASL). 사이트, 이메일, 마케팅 동의 문구에 표시돼요. **없으면 배포가 실패해요**(결정 16). 비어 있거나 자리표시(`SET-BEFORE-LAUNCH…`)인 동안 Worker는 마케팅 수신 동의를 기록하지 않아요(결정 10) |
| `MPC_FROM_EMAIL` | 2-5의 보내는 주소 |
| `MPC_OWNER_EMAIL` | 알림과 지원 티켓을 받을 사업용 이메일(Gmail) |
| `MPC_SUPPORT_EMAIL` | (선택) 사이트의 법률·도움말 페이지에 공개할 지원 이메일. 비우면 계정 페이지의 문의 양식(로그인 필요)과 우편 주소를 안내해요 |
| `MPC_TURNSTILE_SITE_KEY` | 2-2의 사이트 키 |
| `MPC_GRADER_MODEL` | (선택) `claude-sonnet-5`. 비우면 `claude-opus-5` (2-1) |
| `MPC_GRADER_EFFORT` | (선택) 2-1. 비우면 `high` |
| `MPC_GRADER_MAX_TOKENS` | (선택) 2-1. 비우면 8000 |
| `MPC_EVAL_LIMIT` | (선택) 주간·수동 평가에서 채점할 연습 샘플 수 상한(비용 조절). 비우거나 0이면 전부(120개) |
| `MPC_EVAL_PR_LIMIT` | (선택) 프롬프트 PR 평가에서 채점할 연습 샘플 수. 비우면 20 |
| `MPC_EVAL_BUDGET_USD` | (선택) 평가 스크립트 실행 1회의 최악 예상 비용 상한(USD). 비우면 60. 넘으면 아무것도 보내지 않고 실패해요 |
| `MPC_CF_BEACON_TOKEN` | (선택) Web Analytics |
| `MPC_GADS_SEND_TO` | (15번 뒤) Google Ads 전환 태그의 send-to 값 |
| `MPC_INDEXNOW_KEY` | (선택) IndexNow 키(메모 B9): 영문자·숫자·`-`로 된 8–128자 무작위 문자열. 예: `node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"`. 비밀이 아니에요(검색엔진이 사이트에서 읽어요). 넣으면 운영 배포 뒤 검색엔진에 새 페이지를 알려요. 비우면 건너뛰어요 |
| `MPC_STAGING` | 스테이징 준비(2-3의 스테이징 ID, `STRIPE_TEST_*` 비밀)가 끝나면 `true`. 이 저장소의 PR마다 스테이징 Worker에 배포하고 점검해요 |
| `MPC_STAGING_SITE_URL` | 스테이징 Worker 주소, `https://`로 시작(`workers.dev` 주소) [미확인: 주소 형식] |
| `MPC_DEPLOY` | 위 준비가 끝나면 `true`. 그 전에는 비워 두면 운영 배포가 돌지 않아요 |

배포할 때 `MPC_SITE_URL`(스테이징은 `MPC_STAGING_SITE_URL`), `MPC_MAILING_ADDRESS`, `MPC_FROM_EMAIL`, `MPC_OWNER_EMAIL`, `MPC_GRADER_MODEL`, `MPC_GRADER_EFFORT`, `MPC_GRADER_MAX_TOKENS`는 Worker의 `SITE_URL`, `MAILING_ADDRESS`, `FROM_EMAIL`, `OWNER_EMAIL`, `GRADER_MODEL`, `GRADER_EFFORT`, `GRADER_MAX_TOKENS`로 들어가요. `ANTHROPIC_MONTHLY_LIMIT_USD`는 변수가 아니라 `ops/config/anthropic-limit.json`에서 와요(2-1). `wrangler.jsonc`의 자리표시 값은 고치지 않아도 돼요. 변수를 바꾸면 **다시 배포해야**(Actions → Deploy practice coach → Run workflow) Worker에 반영돼요. 잘못된 모델·effort·max tokens 값이나 빠진 우편 주소는 배포 전에 오류로 멈춰요.

### 2-7. 첫 배포와 스테이징

1. 2-3의 ID 커밋, 2-6의 비밀과 변수를 모두 넣어요(`HASH_SALT`는 첫 배포에 **반드시** 필요하고, `MPC_MAILING_ADDRESS`가 없으면 배포가 실패해요).
2. 변수 `MPC_DEPLOY`를 `true`로 바꿔요.
3. **Actions** → **Deploy practice coach** → **Run workflow**. 설정 검사(우편 주소, 모델 값, D1·KV ID) → 테스트 → 사이트 빌드 → 콘텐츠 검사(우편 주소 자리표시가 남아 있으면 실패) → D1 테이블 생성 → 배포(도메인 연결 포함) → 점검(`/api/health`가 이 커밋의 버전을 돌려주는지, 주요 페이지가 열리는지, `/api/me` 형식) → `MPC_INDEXNOW_KEY`가 있으면 IndexNow 알림(실패해도 배포는 성공) 순서로 돌아요. 점검에 실패하면 이전 버전으로 자동 롤백해요(D1 변경은 롤백되지 않아요). 첫 배포는 되돌릴 이전 버전이 없어서, 도메인이 아직 Worker에 연결되지 않았으면 점검이 실패할 수 있어요 → 2-2의 3번을 확인해요.
4. 이후에는 `products/clb/**`나 `ops/config/anthropic-limit.json`이 `master`에 바뀔 때마다 자동으로 배포돼요.
5. **결제는 꺼진 상태로 시작해요**(`checkout_enabled` 기본값 false). 17번 전에는 켜지 않아요.
6. **스테이징(메모 §5.2 "staging on PR", B0·B6·B15의 B단계 점검):** 2-3의 스테이징 ID, `STRIPE_TEST_SECRET_KEY`, `STRIPE_TEST_WEBHOOK_SECRET`, `MPC_STAGING_SITE_URL`을 넣고 `MPC_STAGING`을 `true`로 바꿔요. 그러면 이 저장소에서 연 PR 중 `products/clb/**`를 바꾸는 PR마다(그리고 **Deploy practice coach**를 `target`=`staging`으로 수동 실행하면) 같은 워크플로가 스테이징 Worker에 배포하고 점검해요. 스테이징은:
   - Stripe **테스트 키만** 받아요(실사용 키를 넣으면 배포가 멈춰요).
   - Turnstile은 Cloudflare 테스트 키, Web Analytics와 광고 태그는 없고, 검색엔진 수집을 막는 `robots.txt`를 써요.
   - 채점은 `ANTHROPIC_EVAL_API_KEY`(평가용 작업 공간)가 있으면 그 키를 써요. 없으면 운영 키를 쓰고 경고가 나와요.
   - `HASH_SALT`는 첫 배포 때 따로 무작위로 만들어서 운영과 섞이지 않아요.
   - 이메일은 운영과 같은 Resend 키로 **실제로 발송**돼요. 시험할 때는 본인 이메일만 써요.
   - 스테이징의 킬 스위치는 `Set a kill switch` 워크플로에서 `target`을 `staging`으로 골라요(스테이징도 `checkout_enabled`는 처음에 꺼져 있어요).
   Day-21 관문의 "B단계 점검 통과"는 ① 스테이징 배포와 점검이 초록색인지, ② **Actions → Level-B checks → Run workflow**(`target`=`staging`)가 초록색인지(점검 + 프롬프트 캐시 확인. 유료 채점 2회, Opus 5에서 약 US$0.05–0.15, 추정)로 확인해요. 메모 B6의 Stripe CLI 테스트 이벤트와 스테이징 대상 E2E는 자동화되지 않았어요. 스테이징에서 캐나다 테스트 카드로 구매·셀프 환불을 한 번 직접 해 봐요(2-4의 6번). 어떤 워크플로가 어떤 점검을 하는지는 `ops/README.md`의 표를 보세요.

### 2-8. 법률 페이지와 제품 페이지 검토 (14번)

오너가 PIPEDA상 책임자예요(Sched. 1, 4.8.2). 배포된 사이트에서 **영어 원문**을 직접 읽고 승인해요. 한국어 요약은 `business/online/legal-summary-ko.md`에 있어요. **요약은 이해를 돕는 용도이고, 기준은 영어 페이지예요.**

- `/legal/privacy/`: 처리자(Anthropic, Cloudflare, Stripe, Resend, Google), **책임자 직함(오너)과 우편 주소**(페이지에 오너의 이름은 나오지 않아요), 90일 보관 후 삭제, 삭제 버튼, 18세 이상. 그리고 새로 적힌 약속: 지원 메시지는 **사업용 Gmail로 전달**되고 **AI 도우미(Anthropic의 Claude)가 답장 초안**을 쓰며 오너가 검토해 보내요. **메일함 사본은 90일 뒤와 계정 삭제 때 오너가 지워요**(3-2). 계정을 지우면 답과 피드백은 지워지고, 사람과 연결되지 않은 사용·비용 기록은 남아요(결정 5, 7).
- `/legal/terms/`: 1조에 **"Passes are not sold in Quebec."**가 있어요(결정 15. 서비스는 어디서나 쓸 수 있고 이용권만 퀘벡 판매 제외). 5조: 카드 결제만, 일시 중지 시 이용권 연장. 구매 버튼 옆에서 약관·환불 정책 동의를 확인하고 그 버전이 구매에 저장돼요(결정 13).
- `/legal/refunds/`: 구매 후 14일 이내, 채점 5회 이하, 이메일·카드당 한 번. 남은 날짜 환불은 부분 환불이고 이용권이 끝나요(2-4).
- `/legal/ai-disclosure/`, `/legal/not-affiliated/`, 그리고 제품 페이지 8–10개(`/`, `/ko/`, `/pricing/`, `/formats/`, `/help/` 등).
- 점수·레벨 예측, "공식", "보장" 같은 표현이 보이면 승인하지 말고 알려 주세요. CI의 콘텐츠 검사가 막지만 사람이 한 번 더 봐요.
- 약관이나 환불 정책의 문장을 바꾸면 `TERMS_VERSION`(`shared/config.ts`, 통합 담당 파일)이 바뀌어야 해요. 구매 때 저장되는 버전이에요.

### 2-9. Google Ads (15번, Gate C 통과 + Service Canada 통화 뒤에만)

`ops/ads/README.md`를 따라 손으로 입력해요.

- 검색 캠페인 1개, 지역 **캐나다(퀘벡 제외)**, 일 예산 **C$20**, 시작 **2026-10-26**, **종료일 2026-11-08**(아무도 손대지 않아도 멈춰요).
- 키워드·광고 문구·제외 키워드는 `ops/ads/google.csv`. `YOUR-DOMAIN`을 실제 도메인(2-2)으로 바꿔요. Ads Editor 가져오기 형식은 확인하지 못해서 손 입력 절차를 적어 두었어요.
- 전환: `/checkout/success/`에서 **구매** 1개. 전환 태그의 send-to 값을 변수 `MPC_GADS_SEND_TO`에 넣고 다시 배포해요.
- **매일 성과 보고서 이메일**을 사업용 Gmail로 예약해요(일, 비용, 클릭, 노출, 전환) [미확인: 예약 보고서 기능]. 일일 Routine이 이것으로 `ops/metrics/ads.json`을 채워요. 읽지 못하면 주 1회 CSV를 `ops/ads/reports/`에 올려요(약 5분).
- 광고주 인증 소요 시간은 찾지 못했어요.

### 2-10. 출시일 점검 (17번, W4 소프트 런칭)

1. 운영 Worker가 테스트 키로 시작했다면 `STRIPE_SECRET_KEY`와 `STRIPE_WEBHOOK_SECRET`를 **실사용** 값으로 바꾸고 다시 배포해요.
2. **결제 켜기:** **Actions** → **Set a kill switch** → **Run workflow** → `flag`: `checkout_enabled`, `value`: `true`(`target`은 `production`). GitHub 모바일 앱의 Actions 탭에서도 돼요 [미확인: 앱 화면]. 끌 때는 `false`예요. 배너는 `banner`에 한 줄 문구를 넣고, 비우면 지워져요.
3. **실제 카드로 C$39(30일 이용권) 구매:** 캐나다 발행 카드, 퀘벡 외 청구 주소. 결제 화면에 **카드만** 보이는지 확인해요(2-4의 4번). 구매 버튼 옆에 약관·환불 정책 동의 문구가 보이는지 확인해요. 계정 페이지에 이용권이 보이는지 확인해요.
4. **셀프 환불:** 계정 페이지에서 환불해요(14일 이내, 채점 5회 이하). Stripe에 환불이 보이고 이용권이 사라지는지 확인해요. 이 이메일과 카드로는 셀프 환불을 다시 할 수 없어요(계정을 지우고 다시 가입해도 마찬가지예요, 결정 9).
5. 다음 날 **Reconcile payments** 워크플로가 불일치 0건인지 확인해요. 테스트 키 시절의 테스트 구매(`cs_test_…`)는 실사용 키로 바꾼 뒤 비교에서 빠져요(키 종류에 맞는 구매만 비교). 그래도 테스트 구매가 "missing in Stripe"로 나오면 AI에게 알려 주세요.
6. **iPhone 말하기 점검:** iPhone Safari에서 말하기 과제 하나를 약 60초 녹음해 제출하고, 받아쓰기와 피드백이 오는지 봐요. 실패하면 iOS 버전과 증상만 AI에게 알려 주세요(녹음 파일은 보내지 않아요).

### 2-11. Routine 켜기

프롬프트는 `ops/routines/`에 있어요(`daily`, `kpi`, `eval`, `books`, `nov30`, `day90`). **오너가 "예"라고 한 뒤에만** AI가 Routine을 만들어요(메모 §5.1). Routine 실행 한도(하루 5회 또는 15회)는 2차 자료라 [미확인]이에요.

- `daily`는 Gmail 안에서만 `[MPC] Support ticket` 메일을 읽어 **답장 초안**을 만들어요(보내지 않아요). 연습 답(글·받아쓰기)은 읽지 않아요. 메모 §7.1(B14 수정)과 개인정보 처리방침에 적힌 예외예요(결정 7).
- `books`는 **매주 월요일과 매월 1일**에 돌게 만들고, `ops/config/ei-schedule.json`의 날짜로 EI 주인지 스스로 판단해요.
- `nov30`은 **2026-12-01 12:00 UTC 이후** 한 번 돌아요. 11월 지표 파일이 다 없으면 쓰지 않고 이슈를 열어요.

---

## 3. 주간 업무 (메모 §4.2, 목표 180분 이하)

| 업무 | 분/주(추정) |
|---|---|
| 월요일 KPI·비용 요약(한국어·영어) 읽고 제안마다 예/아니오 답하기(이슈 "KPI digest …"에 댓글) | 20 |
| 광고: AI가 고친 CSV 반영, 상한 변경 승인·거절(광고가 도는 동안만) | 0–20 |
| 에스컬레이션: 정책 밖 환불, 분쟁(Stripe 증빙 제출), 법률 관련 표시 건, **개인정보 요청**(3-2) | 10–30 |
| Routine이 만든 지원 답장 초안 검토 후 보내기(초안당 약 1분, 10–30개) | 10–30 |
| AI의 주간 순이익으로 EI 격주 보고(2주마다 10분, `ops/books/ei/`) | 5 |
| Stripe 입금이 은행에 들어왔는지 확인(금액을 `ops/books/payouts.json`에 한 줄 추가) | 5–10 |
| 월간 장부 확인(월 15분, `ops/books/`). 평가용 Anthropic 작업 공간 청구액은 지표에 없으니 `ops/books/expenses.json`에 적어요 | 4 |
| 플랫폼 이의 제기: Ads 정책, Stripe 요청(문제 있는 주만) | 0–30 |
| (선택) 채점 결과 5개 확인(영어가 되면) | 0–20 |
| **합계** | **54–169분 (0.9–2.8시간)** |

**메모 추정에 없는 주간 업무(시간 추정 없음):** 지원 메일함 정리(3-2). 일일 Routine이 90일 지난 지원 메일이 있으면 이슈 "Support mailbox: delete tickets older than 90 days"로 알려 줘요.

(선택, 1분) 이 제품에 쓴 시간을 `ops/owner/hours.json`에 `{"week": "2026-W44", "hours": 2.5}` 형식으로 한 줄씩 적으면 KPI Routine이 K2를 자동으로 평가해요. 없으면 K2는 "오너 확인 필요"로 표시돼요.

### 3-1. 킬 스위치와 일시 중지 (결정 12)

- **Actions → Set a kill switch**로 `checkout_enabled`, `grading_enabled`, `free_enabled`, `banner`를 바꿔요.
- `free_enabled`나 `grading_enabled`를 바꾸면 워크플로가 **오너 표시**(KV `owner:<스위치>` = 값)도 함께 써요. 오너가 `false`로 끈 스위치는 Worker의 지출 감시(15분마다)가 **절대 다시 켜지 않아요.** 다시 켜려면 오너가 같은 워크플로로 `true`를 넣어야 해요. 오너가 `true`로 둔 스위치는 지출 단계를 넘으면 Worker가 끌 수 있어요.
- **채점이 멈춘 모든 기간**(오너가 끈 경우, 지출 감시가 끈 경우 모두)은 이용 중인 이용권을 **멈춘 시간만큼 연장**해요. 대기 중인 다음 이용권도 그만큼 뒤로 밀려요. 시작 시각은 KV `pause:started_at`에 기록되고, 채점이 다시 켜지면 Worker가 한 번만 연장해요. 페이지 문구: "If feedback is paused, active passes are extended by the length of the pause."
- 그래서 `grading_enabled`를 끄면 모든 이용 중 사용자의 기간이 늘어나요. 꼭 필요할 때만 끄고, 할 일이 끝나면 바로 켜요.
- `checkout_enabled`를 꺼도 이미 산 이용권에는 영향이 없어요. 꺼져 있을 때 사이트는 "Passes are not available to buy right now." / "지금은 이용권을 구매할 수 없어요."라고 보여요(결정 14).

### 3-2. 지원 메일, 개인정보 요청, 메일함 정리 (결정 7, PIPEDA)

**지원 메일의 흐름**

- 지원 양식은 **로그인한 사용자만** 쓸 수 있어요. Worker가 티켓을 저장하고 `MPC_OWNER_EMAIL`로 `[MPC] Support ticket <번호>` 메일을 보내요(보낸 사람 이메일과 내용 포함).
- 하루(UTC) **30통**까지만 메일로 보내요. 넘으면 티켓은 데이터베이스에만 저장되고 `[MPC] Support forwarding limit reached (<날짜>)` 알림이 한 번 와요. 그 티켓은 Routine이 읽을 수 없으니 오너가 직접 봐요(자기 컴퓨터에서, `products/clb`에서):

  ```bash
  npx wrangler d1 execute DB --remote -c worker/wrangler.jsonc --command "SELECT t.id, t.lang, t.created_at, u.email, t.message FROM support_tickets t LEFT JOIN users u ON u.id = t.user_id WHERE t.forwarded = 0 AND t.created_at >= '<날짜>'"
  ```

  출력에는 개인정보가 있어요. 저장소, 이슈, AI 대화에 붙여 넣지 않아요.
- 일일 Routine이 Gmail 안에서 답장 **초안**을 만들어요. 오너가 읽고 고쳐서 보내요. `[OWNER: …]`로 시작하는 줄은 오너에게 하는 말이니 보내기 전에 지워요.
- `MPC_SUPPORT_EMAIL`을 공개했다면 그 주소로 온 메일도 지원 메시지예요. 같은 보관·삭제 규칙을 따라요.

**메일함 사본 삭제 (개인정보 처리방침의 약속)**

1. **매주:** Gmail에서 `[MPC] Support ticket` 메일 중 받은 지 **90일이 지난 것**과 그 답장 스레드를 지워요. 검색 예: `subject:"[MPC] Support ticket" older_than:90d` [미확인: Gmail 검색 연산자]. 지운 메일이 휴지통에 남는 기간은 [미확인]이에요. 휴지통도 비워요.
2. **계정 삭제 때:** 사용자가 계정을 지우면(그 사용자가 보낸 티켓이 메일로 전달된 적이 있으면) `[MPC] Account deleted: remove its support emails` 알림이 와요. 알림에 적힌 **티켓 번호마다** Gmail에서 검색해 그 메일과 답장을 지우고, 알림 메일도 지워요.
3. 개인정보 요청이 이메일(`MPC_SUPPORT_EMAIL`)로 왔다면 처리한 뒤 90일 규칙으로 지워요.

**개인정보 요청 처리 절차** (개인정보 처리방침 "Your rights"; PIPEDA s.8, 법 조문은 justicecanada/laws-lois-xml에서 확인)

일일 Routine은 열람, 정정, 삭제, 동의 철회, 개인정보 불만 요청을 답하지 않고 `[OWNER: needs your decision]`과 **답변 기한**을 적어 둬요.

1. **본인 확인:** 로그인한 지원 양식으로 온 요청만 처리해요(티켓에 그 계정의 이메일이 적혀 있어요). 다른 경로(일반 이메일 등)로 오면 "계정에 로그인해 계정 페이지의 지원 양식으로 다시 보내 달라"고 답해요. 요청은 서면이어야 해요(s.8(1)). 요청서를 쓰는 데 도움이 필요하다고 하면 도와야 해요(s.8(2)).
2. **기한:** 요청을 받은 날부터 **30일 안에** 답해요(s.8(3)). 기한 안에 답하지 않으면 거절한 것으로 봐요(s.8(5)).
3. **연장:** 최대 30일 더 연장할 수 있는 경우는 (a) 기한을 지키면 사업 활동에 불합리한 지장이 있거나 필요한 협의 때문에 기한을 지키기 어려운 경우, 또는 (b) 정보를 다른 형식으로 바꾸는 데 필요한 기간이에요(s.8(4)). 연장하려면 **요청 후 30일 안에** 사용자에게 ① 새 기한, ② 연장 이유, ③ 연장에 대해 개인정보보호위원회에 불만을 제기할 권리를 알려야 해요.
4. **열람 요청:** 저장된 답과 피드백은 계정 페이지에서 볼 수 있다고 알려 줘요. 보유 정보 전체 사본을 원하면 계정·구매·과제 기록을 데이터베이스에서 꺼내 보내야 해요. 꺼내는 방법은 AI에게 요청하되 **결과(개인정보)는 AI 대화에 붙여 넣지 않아요.**
5. **삭제 요청:** 계정 페이지의 삭제 버튼 사용법을 안내해요. 그다음 메일함 사본을 지워요(위 2번).
6. **기록:** 요청 날짜, 답한 날짜, 연장 여부를 git 밖(예: 사업용 Google 계정의 비공개 문서)에 적어 둬요. 내용은 적지 않아요.

### 3-3. 이메일 수신 거부와 마케팅 동의 (결정 9–11)

- 사용자에게 가는 **모든 이메일**(로그인 링크, 구매·환불 확인 포함, 오너 알림 제외) 끝에 수신 거부 링크(`<사이트>/unsubscribe/#h=…&s=…`)가 붙어요. 누르면 로그인 없이 **마케팅 이메일 수신 동의를 철회**해요(`marketing_opt_in`=0, 철회 시각 기록). 링크는 만료되지 않고 바로 반영돼요. CASL은 링크가 보낸 뒤 최소 60일 유효하고(s.11(2)) 늦어도 10영업일 안에 반영될 것(s.11(3))을 요구해요.
- 수신 거부는 **마케팅만** 멈춰요. 로그인 링크와 이용권·환불 안내는 계속 가요.
- 마케팅 동의는 세 조건이 모두 맞을 때만 기록돼요: 사용자가 본 동의 문구가 서버의 문구와 정확히 같고, `MPC_MAILING_ADDRESS`가 설정돼 있고, 로그인 링크를 **요청한 기기에서** 열었을 때. 아니면 로그인은 되지만 동의는 기록되지 않아요(결정 10).
- 지금 코드에는 마케팅 이메일을 보내는 기능이 없어요. 나중에 보낼 때는 동의한 사람(`marketing_opt_in`=1)에게만, 사업자명·우편 주소·수신 거부 방법을 넣어 보내야 해요(CASL 규정 SOR/2012-36 s.2(1), s.3).
- 계정을 지워도 같은 이메일의 로그인 링크 요청 제한(시간당 3회)은 남고, 다시 가입해도 무료 말하기 과제와 셀프 환불은 다시 생기지 않아요(결정 9). 지원 답장에서 "다시 가입하면 다시 받을 수 있다"고 말하지 않아요.

---

## 4. 중단 규칙과 확장 규칙 (메모 §6 요약)

KPI Routine이 매주 평가하고 오너가 확정해요. 정확한 계산식은 `ops/routines/kpi.md`에 있어요.

| 규칙 | 조건 | 조치 |
|---|---|---|
| K1 일정 | 11월 1일(일)까지 결제가 열리지 않음 | 중단하고 decision-memo.md로 돌아가요 |
| K2 오너 시간 | 두 주 이상 주 3시간 초과, 또는 설정 12시간 초과 | 핵심만 남김: 광고 없이 운영 |
| K3 상단 퍼널 | 광고비 C$280을 쓴 뒤 유료 클릭에서 시작된 무료 샘플이 10개 미만(유료 클릭 샘플이 0이면 발동) | 광고 끔(랜딩 수정 1회와 C$140 이하 재시험 1회 허용) |
| K4 CAC | 최근 14일 CAC가 실측 첫 판매 순이익(계획 C$27.7–34.9)보다 큼 | 광고 끔 |
| K5 11월 15일 | 전체 채널 무료 샘플 100개 미만 | 한도 안에서 키워드 교체. 30개 미만이면 11월 30일 틈새 재검토 |
| K6 11월 30일 | 11월 순이익 C$500 미만이고 주간 성장 없음 | 모든 지출 중단, 유지 모드, **두 번째 제품 없음** |
| K7 환불·분쟁 | (판매 20건 이상에서) 환불 10% 초과, 또는 분쟁 0.75% 초과 [기준 미확인] | 결제와 광고 일시 중지, 채점 검토 |
| K8 API 비용 | 7일 동안 API 비용이 매출의 20% 초과 | 사용자별 한도 강화 |
| K9 플랫폼 | Google Ads 정지, Stripe 보류·거절 | 광고 없이 운영. 두 번째 플랫폼 문제면 중단 |
| K10 손실 한도 | 누적 순손실(고정비 + 광고 + API − 매출) C$1,500 초과 | 중단 |
| K11 12월 26일·1월 31일 | 최근 30일 순이익 C$0 미만 | 정리(결제·광고·Routine 끄기, Claude Pro 해지. 남은 이용권이 끝날 때까지 채점은 유지하거나 기간 비례 환불 — 2-4의 `end_pass` 방법). C$0–1,000은 유지(광고 없음), C$1,000 이상은 계속 |

**확장 규칙:** 1월 31일까지 광고비 총액은 C$1,200이 상한이고, 올리려면 `ops/config/ad-cap.json`을 고치는 PR을 오너가 병합해야 해요. S0: CAC C$15~첫 판매 순이익이면 C$20/일 유지. S1: CAC C$9–15면 C$30/일까지. S2: 구매 20건 이상에서 CAC가 첫 판매 순이익 ÷ 3(약 C$9.2) 이하면 C$60/일까지 올릴 수 있음(매주 재확인). S3: 월 30명 이상이 광고 없이 구매하면 자격 있는 검토자(공인 ESL·시험 대비 강사, 비용 미확인)를 고용해 안내 페이지를 다시 시작할 수 있음.

---

## 5. 참고: 세금과 개인정보 (메모 §4.1)

- GST/HST는 등록하지 않아요. 네 분기 합계 과세 공급이 C$30,000을 넘으면 30일 안에 등록해야 해요(ETA s.148, s.240(2.1)). `books` Routine이 80%에서 이슈를 열어요.
- 소득은 T2125로 신고해요(2027-06-15까지 신고, 2027-04-30까지 납부). 영수증을 보관해요(보관 기간 6년은 [미확인]).
- 사용자 글과 받아쓰기는 **git, 로그, 지표 파일, Routine 프롬프트에 절대 들어가지 않아요.** `ops/metrics/`의 개인정보 검사가 매일 확인해요. 녹음은 받아쓰기 후 바로 버려요. **예외 하나:** 일일 Routine은 답장 초안을 쓰려고 **Gmail 안에서만** 지원 메일(사용자 이메일 주소 포함)을 읽어요. 그 내용은 Gmail 밖으로 나가지 않아요(메모 §7.1 B14, 개인정보 처리방침에 공개, 결정 7).

**개인정보 유출 기록과 보고 (PIPEDA s.10.1, s.10.3; 유출 규정 SOR/2018-64. 조문은 justicecanada/laws-lois-xml에서 확인)**

- **기록은 git 밖에** 둬요(예: 사업용 Google 계정의 비공개 문서). 저장소에는 절대 적지 않아요.
- 보호 조치 위반(유출, 잘못된 접근, 분실 등)이 **모두** 기록 대상이에요(위험이 낮아도). 항목마다: 알게 된 날짜, 일어난 날짜 또는 기간, 무슨 일이 있었는지, 관련된 개인정보 종류, 영향받은 사람 수(모르면 대략), 한 조치, **실질적인 중대한 피해 위험(RROSH) 판단**과 그 이유, 보고·통지 여부와 날짜.
- **보관:** 유출이 있었다고 판단한 날부터 **24개월**(SOR/2018-64 s.6(1)). 기록은 위원회가 보고·통지 의무를 지켰는지 확인할 수 있을 만큼 자세해야 해요(s.6(2)). 위원회가 요청하면 보여 줘야 해요(PIPEDA s.10.3(2)).
- **RROSH 판단:** 중대한 피해에는 신체 피해, 굴욕, 평판·관계 손상, 고용·사업 기회 상실, 금전 손실, 신원 도용, 신용 기록 악영향, 재산 손상이 포함돼요(s.10.1(7)). 판단 요소는 정보의 민감도와 오용될 가능성이에요(s.10.1(8)).
- **RROSH가 있으면:** ① 가능한 한 빨리 **개인정보보호위원회(OPC)에 서면 보고**해요(s.10.1(1)–(2)). 보고 내용: 경위와 원인, 날짜나 기간, 관련 개인정보, 영향받은 사람 수, 피해를 줄이려고 한 조치, 사용자 통지 방법, 위원회 질문에 답할 사람의 연락처(SOR/2018-64 s.2(1)). 보고 양식과 제출 방법은 [미확인]이에요. ② **영향받은 사용자에게 직접, 가능한 한 빨리** 알려요(s.10.1(3), (5)–(6)). 사용자가 의미를 이해하고 피해를 줄일 수 있을 만큼 알려야 해요(s.10.1(4)).
- 유출이 의심되면 AI에게 알리되 개인정보는 붙여 넣지 말고, 필요하면 킬 스위치로 기능을 멈춰요(3-1: 채점을 끄면 이용권이 연장돼요).

---

## 6. 오너가 정해야 할 것

| 항목 | 지금 상태 | 오너의 선택 |
|---|---|---|
| 채점 모델 (결정 1) | 기본 `claude-opus-5` | 2-1의 단가와 추정 비용을 보고 그대로 두거나 `MPC_GRADER_MODEL`=`claude-sonnet-5`. 바꾸면 평가를 돌려 확인 |
| 루트 사이트(홈서비스)의 Next.js 16.2.3 보안 권고 (결정 18) | 바꾸지 않았어요. 메모 B16은 루트 사이트 출력(`out/`)을 그대로 두라고 해요. 주간 `Dependency audit` 워크플로는 연습 코치(`products/clb`)는 실패로, 루트는 **알림(notice)**으로만 보고해요. 이유: 루트는 정적 내보내기(`output: 'export'`)이고, 권고들은 정적 사이트가 돌리지 않는 Next.js 서버 기능(미들웨어·프록시, 이미지 최적화, 서버 액션 등)을 대상으로 해요 | (a) 그대로 두고 알림을 받아들이기, 또는 (b) 루트 Next.js를 16.3.6 이상으로 올리는 별도 PR을 승인하기. (b)는 루트 `out/` 파일이 바뀌니 홈서비스 사이트를 다시 확인해야 해요. 연습 코치는 이미 16.3.6이에요(메모 §7.1 B0) |
| 평가 비용 (2-1) | 평가는 별도 작업 공간·키 | 평가용 월 한도(약 US$30)와 `MPC_EVAL_BUDGET_USD`, `MPC_EVAL_LIMIT` 값 |
| EI 보고 날짜 | `ops/config/ei-schedule.json` 자리표시 | 실제 보고 월요일로 바꾸기 |
