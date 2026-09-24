# 오너 설정 체크리스트: Maple Practice Coach

> **근거:** `business/online/decision-memo.md`(이하 "메모") §1.3 관문, §4.1 1회 설정, §4.2 주간 업무, §6 중단 규칙을 그대로 옮겼어요. 새 전략은 없어요.
>
> **표시 규칙**
> - **추정**: 메모의 계산값이에요. 실제 결과가 아니에요.
> - **[미확인]**: 여기서 직접 확인하지 못한 내용이에요(화면 메뉴 이름, 외부 서비스 정책 등). 직접 보고 다르면 AI에게 알려 주세요.
> - 시간은 모두 메모 §4.1의 **추정**이에요.
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

### Gate B: Anthropic 이용 정책(AUP). 상태: **미해결**

AI는 보관본(2025-09-15 시행, OpenTermsArchive)만 읽었어요. 보관본에는 이렇게 적혀 있어요(메모 §1.3 인용):

- 고위험 사용으로 "Academic testing, accreditation and admissions: Use cases related to standardized testing companies that administer school admissions …, language proficiency, or professional certification exams"를 들어요.
- 고위험 사용은 배포 전에 "qualified professional"의 검토를 요구해요.

**출시 전에 할 일 (2번 작업, 1일차, 0.25시간):**

1. 브라우저로 `anthropic.com/legal/aup`를 열어 **현재 문구 전체**를 복사해 저장소 이슈에 붙여 넣어요(AI는 여기서 anthropic.com에 접속할 수 없어요).
2. AI가 보관본과 비교해요. 특히 고위험 목록의 **academic testing / language proficiency** 문구와 "qualified professional" 검토 요건이 바뀌었는지 봐요.
3. AI가 쓴 설명문으로 Anthropic의 이용 정책 담당 연락처에 이메일을 보내요. 답장은 보장되지 않아요.

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
| 2 | **Gate B** | 0.25시간 | 현재 AUP 문구를 이슈에 붙여 넣기, AI가 쓴 이메일 보내기, 위 "위험 수용" 서명 |
| 3 | **저장소 비공개** | 0.1시간 | 0단계에서 이미 했으면 건너뛰어요 |
| 4 | 사업용 Google 계정과 이메일 | 0.5시간 | 개인 계정과 분리해요. Google Ads 보고서도 이 계정으로 받아요 |
| 5 | **Claude Pro** 유지 또는 구입 | 0.5시간 | 환경 설정에서 `api.stripe.com`, `api.cloudflare.com`, `api.resend.com`을 허용하거나, 실제 운영 작업은 Actions에서만 돈다는 것을 받아들여요. Routine에 Gmail을 연결해요 |
| 6 | **Anthropic Console** | 0.5시간 | 아래 2-1 |
| 7 | **Cloudflare** | 1.0시간 | 아래 2-2, 2-3 |
| 8 | **EI 신청** (자영업 활동 신고) | 1.0시간 | **10월 10일(토)까지**. EI Act s.38(1)(c) |
| 9 | **Service Canada 전화** | 0.5–1.5시간 | Gate 0 참고. **11번(Stripe)과 15번(Google Ads)은 이 통화 뒤에만** 해요. 대기 시간 [미확인] |
| 10 | ServiceOntario 사업자명 등록 | 0–0.5시간 | "Maple Practice Coach" 이름으로 영업할 때만. 아니면 모든 곳에 법적 실명을 써요(0시간). 등록 규칙 [미확인] |
| 11 | **Stripe Canada** | 1.5시간 | 아래 2-4. **9번 통화 뒤에만** |
| 12 | **Resend** | 0.5시간 | 아래 2-5 |
| 13 | 사서함 또는 PO Box | 0.75시간 | CASL 이메일과 개인정보 처리방침에 들어갈 주소. PO Box로 충분한지는 명시돼 있지 않아요(메모 F13). 주소는 변수 `MPC_MAILING_ADDRESS`에 넣어요 |
| 14 | **법률 페이지와 제품 페이지 검토·승인** | 1.0시간 | 아래 2-8 |
| 15 | **Google Ads** (Gate C 통과 시에만) | 1.65시간 | 아래 2-9. **9번 통화 뒤에만** |
| 16 | Search Console 인증 | 0.15시간 | AI가 DNS 레코드를 준비하면 오너가 인증을 눌러요. Bing은 나중에 |
| 17 | **출시일 점검** | 0.35시간 | 아래 2-10: 실제 카드로 C$39 구매와 셀프 환불, iPhone으로 말하기 과제 녹음 |

**합계(추정):** 11.0–12.0시간으로 예산 약 10시간을 넘어요. 1, 8, 9번(1.75–2.75시간)은 소득 기반 작업이라 이 제품 몫은 약 9.25시간이에요. 모두 세고 10시간 아래로 줄이려면 법적 실명으로 영업하고(−0.5시간) Google Ads를 빼요(−1.65시간, 광고 없는 운영). **설정이 12시간을 넘으면 K2가 발동해요.**

### 2-1. Anthropic Console (6번)

1. API 키를 만들어 GitHub 비밀 `ANTHROPIC_API_KEY`에 넣어요(2-6).
2. **월 사용 한도 US$150**과 알림을 설정해요(메모 §3.4). 한도 설정 방식은 [미확인]이에요.
3. 설정한 금액을 `ops/config/anthropic-limit.json`의 `monthlyLimitUsd`에 적고 `confirmedByOwner`를 `true`로 바꿔 커밋해요. 이후 KPI Routine이 L = max(US$150, 최근 30일 매출(USD)의 30%)이 이 값을 넘으면 인상 PR을 올려요. 오너가 Console을 바꾸고 PR을 병합해요.

**채점 모델 선택 (`GRADER_MODEL`)**

기본값은 `claude-opus-5`예요. 저장소 변수 `MPC_GRADER_MODEL`에 `claude-sonnet-5`를 넣으면 토큰당 단가가 더 낮은 모델로 채점해요. 단가는 `products/clb/shared/config.ts`의 `MODELS`(공식 100만 토큰당 가격, 2026-06-24 캐시) 그대로예요.

| 모델 | 입력 (100만 토큰당) | 출력 (100만 토큰당) |
|---|---|---|
| `claude-opus-5` (기본) | US$5 | US$25 |
| `claude-sonnet-5` | US$2 | US$10 |

`claude-sonnet-5`의 단가는 입력·출력 모두 `claude-opus-5`의 40%예요. 과제 한 번당 비용은 실제 토큰 수에 따라 달라서 여기서는 적지 않아요. 바꾼 뒤에는 **Grading eval** 워크플로를 한 번 돌려 품질 기준을 통과하는지 확인해요.

### 2-2. Cloudflare 계정과 API 토큰 (7번)

1. 계정을 만들고 **Workers Paid(US$5/월)**로 올려요(메모 §3.3). 도메인을 사면 Cloudflare에 연결해요(약 C$20/년, [미확인]). 상업적 사용 약관을 읽어요(decision-memo.md F40).
2. **API 토큰:** 대시보드 → My Profile → API Tokens → Create Token [미확인: 메뉴]. "Edit Cloudflare Workers" 템플릿에서 시작해 **D1 편집**과 **Workers KV 편집** 권한이 있는지 확인해요. Worker가 Workers AI(받아쓰기)를 쓰므로 그 권한도 필요할 수 있어요 [미확인: 템플릿과 권한 이름]. 토큰은 GitHub 비밀 `CLOUDFLARE_API_TOKEN`, 계정 ID는 `CLOUDFLARE_ACCOUNT_ID`에 넣어요.
3. **Turnstile 위젯:** Cloudflare 대시보드의 Turnstile에서 사이트 주소(호스트 이름)로 위젯을 만들어요 [미확인: 메뉴]. **사이트 키**는 변수 `MPC_TURNSTILE_SITE_KEY`, **비밀 키**는 비밀 `TURNSTILE_SECRET`에 넣어요. 사이트 키가 없으면 사이트가 Cloudflare 테스트 키(항상 통과)로 빌드돼요.
4. (선택) Web Analytics 토큰은 변수 `MPC_CF_BEACON_TOKEN`에 넣어요 [미확인: 발급 위치].

### 2-3. D1 데이터베이스와 KV 만들기 (7번, 명령어)

Node 22와 저장소 복제본이 있는 컴퓨터에서 실행해요. 명령과 옵션은 wrangler 4.137.0의 `--help`로 확인했어요.

```bash
cd products/clb
npm ci
npx wrangler login                               # 브라우저로 Cloudflare 로그인
npx wrangler d1 create mpc --location enam       # enam = 북미 동부(위치 힌트). 출력의 database_id를 복사
npx wrangler kv namespace create FLAGS           # 출력의 id를 복사
```

`--location enam`은 사용자가 캐나다에 있어서 고른 힌트예요. 메모가 정한 값은 아니에요. 로컬 도구 없이 Cloudflare 대시보드에서 만들어도 돼요 [미확인: 화면].

그다음 `products/clb/worker/wrangler.jsonc`에서 두 곳을 이렇게 바꿔요(주석 `//`을 지우고 복사한 ID를 넣어요. `"binding": "FLAGS"` 뒤에 **쉼표**를 꼭 붙여요):

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

GitHub 웹에서 파일을 고쳐 `master`에 커밋해도 돼요. 테이블은 배포 워크플로가 `wrangler d1 migrations apply DB --remote`로 만들어요.

### 2-4. Stripe Canada (11번, Service Canada 통화 뒤에만)

1. 본인 인증, 은행 계좌, SIN을 등록해요.
2. **제한된 키(restricted key)**를 테스트용과 실사용용으로 하나씩 만들어요. 코드가 쓰는 API는 Checkout Sessions(생성·조회), PaymentIntents(조회, 최신 결제 포함), Refunds(생성)예요 [미확인: 권한 이름]. 쓰는 키를 비밀 `STRIPE_SECRET_KEY`에 넣어요. 처음에는 **테스트 키**로 시작해요.
3. **웹훅 엔드포인트:** `<사이트 주소>/api/stripe/webhook`, 이벤트는 `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`, `charge.dispute.created`. 서명 비밀을 비밀 `STRIPE_WEBHOOK_SECRET`에 넣어요. 테스트와 실사용은 엔드포인트와 비밀이 따로예요.
4. 가능하면 캐나다 외 카드를 막는 Radar 규칙을 추가해요 [미확인: 사용 가능 여부]. 없어도 서버가 결제 전후에 국가를 확인해요(메모 B6).
5. 테스트 모드로 결제해 볼 때는 **캐나다 발행 테스트 카드**를 써요. 캐나다 외 카드는 결제 후 자동 환불돼요(메모 B6). 테스트 카드 번호는 Stripe 문서에서 확인해요 [미확인].

### 2-5. Resend (12번)

1. 계정을 만들고 보낼 도메인을 인증해요. Resend가 보여 주는 DNS 레코드를 Cloudflare DNS에 추가해요(`api.cloudflare.com`이 허용돼 있으면 AI가 해요, 메모 §4.1).
2. API 키를 비밀 `RESEND_API_KEY`에 넣어요.
3. 보내는 주소를 변수 `MPC_FROM_EMAIL`에 넣어요. 예: `Maple Practice Coach <coach@도메인>`.
4. 무료 한도는 [미확인]이에요(메모 §8).

### 2-6. GitHub 비밀과 변수 (이름만)

저장소 → **Settings** → **Secrets and variables** → **Actions** [미확인: 메뉴]. 값은 여기에만 넣고 파일에는 절대 쓰지 않아요.

**비밀(Secrets)**

| 이름 | 내용 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | 2-2의 API 토큰 |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 계정 ID |
| `ANTHROPIC_API_KEY` | 2-1 |
| `STRIPE_SECRET_KEY` | 2-4 (테스트 → 출시 때 실사용 키로 교체) |
| `STRIPE_WEBHOOK_SECRET` | 2-4 |
| `RESEND_API_KEY` | 2-5 |
| `TURNSTILE_SECRET` | 2-2 |
| `HASH_SALT` | 무작위 긴 문자열. 예: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` 출력값. **한 번 정하면 바꾸지 마세요.** 바꾸면 모든 로그인이 끊기고, "이메일당 한 번" 환불 규칙이 이전 기록과 맞지 않게 돼요 |

**변수(Variables)**

| 이름 | 내용 |
|---|---|
| `MPC_SITE_URL` | 사이트 주소, `https://`로 시작. 도메인을 연결하지 않았다면 Worker의 `workers.dev` 주소예요 [미확인: 주소 형식] |
| `MPC_MAILING_ADDRESS` | 13번의 우편 주소(CASL). 사이트와 이메일에 표시돼요 |
| `MPC_FROM_EMAIL` | 2-5의 보내는 주소 |
| `MPC_OWNER_EMAIL` | 알림과 지원 티켓을 받을 사업용 이메일 |
| `MPC_SUPPORT_EMAIL` | (선택) 사이트의 법률·도움말 페이지에 공개할 지원 이메일. 비우면 계정 페이지의 문의 양식과 우편 주소를 안내해요 |
| `MPC_TURNSTILE_SITE_KEY` | 2-2의 사이트 키 |
| `MPC_GRADER_MODEL` | (선택) `claude-sonnet-5`. 비우면 `claude-opus-5` |
| `MPC_CF_BEACON_TOKEN` | (선택) Web Analytics |
| `MPC_GADS_SEND_TO` | (15번 뒤) Google Ads 전환 태그의 send-to 값 |
| `MPC_EVAL_LIMIT` | (선택) 주간 평가에서 채점할 연습 샘플 수 상한(비용 조절). 비우면 전부(120개) |
| `MPC_DEPLOY` | 위 준비가 끝나면 `true`. 그 전에는 비워 두면 배포가 돌지 않아요 |

배포할 때 `MPC_SITE_URL`, `MPC_MAILING_ADDRESS`, `MPC_FROM_EMAIL`, `MPC_OWNER_EMAIL`, `MPC_GRADER_MODEL`은 Worker의 `SITE_URL`, `MAILING_ADDRESS`, `FROM_EMAIL`, `OWNER_EMAIL`, `GRADER_MODEL`로 들어가요. `wrangler.jsonc`의 자리표시 값은 고치지 않아도 돼요.

### 2-7. 첫 배포

1. 2-3의 ID 커밋, 2-6의 비밀과 변수를 모두 넣어요(`HASH_SALT`는 첫 배포에 **반드시** 필요해요).
2. 변수 `MPC_DEPLOY`를 `true`로 바꿔요.
3. **Actions** → **Deploy practice coach** → **Run workflow**. 테스트 → 사이트 빌드 → 콘텐츠 검사 → D1 테이블 생성 → 배포 → 점검(`/api/health`가 이 커밋의 버전을 돌려주고 `/`가 200인지) 순서로 돌아요. 점검에 실패하면 이전 버전으로 자동 롤백해요(D1 변경은 롤백되지 않아요).
4. 이후에는 `products/clb/**`가 `master`에 바뀔 때마다 자동으로 배포돼요.
5. **결제는 꺼진 상태로 시작해요**(`checkout_enabled` 기본값 false). 17번 전에는 켜지 않아요.

### 2-8. 법률 페이지와 제품 페이지 검토 (14번)

오너가 PIPEDA상 책임자예요(Sched. 1, 4.8.2). 배포된 사이트에서 직접 읽고 승인해요. 한국어 요약이 제공돼요.

- `/legal/privacy/`: 처리자(Anthropic, Cloudflare, Stripe, Resend, Google Ads 전환 태그), 책임자인 오너 이름, 우편 주소, 90일 보관 후 삭제, 삭제 버튼, 18세 이상.
- `/legal/terms/`: **"Not available in Quebec"** 포함.
- `/legal/refunds/`: 구매 후 14일 이내, 채점 5회 이하, 이메일·카드당 한 번.
- `/legal/ai-disclosure/`, `/legal/not-affiliated/`, 그리고 제품 페이지 8–10개(`/`, `/ko/`, `/pricing/`, `/formats/`, `/help/` 등).
- 점수·레벨 예측, "공식", "보장" 같은 표현이 보이면 승인하지 말고 알려 주세요. CI의 콘텐츠 검사가 막지만 사람이 한 번 더 봐요.

### 2-9. Google Ads (15번, Gate C 통과 + Service Canada 통화 뒤에만)

`ops/ads/README.md`를 따라 손으로 입력해요.

- 검색 캠페인 1개, 지역 **캐나다(퀘벡 제외)**, 일 예산 **C$20**, 시작 **2026-10-26**, **종료일 2026-11-08**(아무도 손대지 않아도 멈춰요).
- 키워드·광고 문구·제외 키워드는 `ops/ads/google.csv`. `YOUR-DOMAIN`을 실제 도메인으로 바꿔요. Ads Editor 가져오기 형식은 확인하지 못해서 손 입력 절차를 적어 두었어요.
- 전환: `/checkout/success/`에서 **구매** 1개. 전환 태그의 send-to 값을 변수 `MPC_GADS_SEND_TO`에 넣고 다시 배포해요.
- **매일 성과 보고서 이메일**을 사업용 Gmail로 예약해요(일, 비용, 클릭, 노출, 전환) [미확인: 예약 보고서 기능]. 일일 Routine이 이것으로 `ops/metrics/ads.json`을 채워요. 읽지 못하면 주 1회 CSV를 `ops/ads/reports/`에 올려요(약 5분).
- 광고주 인증 소요 시간은 찾지 못했어요.

### 2-10. 출시일 점검 (17번, W4 소프트 런칭)

1. `STRIPE_SECRET_KEY`와 `STRIPE_WEBHOOK_SECRET`를 **실사용** 값으로 바꾸고 다시 배포해요.
2. **결제 켜기:** **Actions** → **Set a kill switch** → **Run workflow** → `flag`: `checkout_enabled`, `value`: `true`. GitHub 모바일 앱의 Actions 탭에서도 돼요 [미확인: 앱 화면]. 끌 때는 `false`예요. 배너는 `banner`에 한 줄 문구를 넣고, 비우면 지워져요.
3. **실제 카드로 C$39(30일 이용권) 구매:** 캐나다 발행 카드, 퀘벡 외 청구 주소. 계정 페이지에 이용권이 보이는지 확인해요.
4. **셀프 환불:** 계정 페이지에서 환불해요(14일 이내, 채점 5회 이하). Stripe에 환불이 보이고 이용권이 사라지는지 확인해요. 이 이메일과 카드로는 셀프 환불을 다시 할 수 없어요.
5. 다음 날 **Reconcile payments** 워크플로가 불일치 0건인지 확인해요.
6. **iPhone 말하기 점검:** iPhone Safari에서 말하기 과제 하나를 약 60초 녹음해 제출하고, 받아쓰기와 피드백이 오는지 봐요. 실패하면 iOS 버전과 증상만 AI에게 알려 주세요(녹음 파일은 보내지 않아요).

### 2-11. Routine 켜기

프롬프트는 `ops/routines/`에 있어요(`daily`, `kpi`, `eval`, `books`, `nov30`, `day90`). **오너가 "예"라고 한 뒤에만** AI가 Routine을 만들어요(메모 §5.1). Routine 실행 한도(하루 5회 또는 15회)는 2차 자료라 [미확인]이에요.

---

## 3. 주간 업무 (메모 §4.2, 목표 180분 이하)

| 업무 | 분/주(추정) |
|---|---|
| 월요일 KPI·비용 요약(한국어·영어) 읽고 제안마다 예/아니오 답하기(이슈 "KPI digest …"에 댓글) | 20 |
| 광고: AI가 고친 CSV 반영, 상한 변경 승인·거절(광고가 도는 동안만) | 0–20 |
| 에스컬레이션: 정책 밖 환불, 분쟁(Stripe 증빙 제출), 법률 관련 표시 건 | 10–30 |
| Routine이 만든 지원 답장 초안 검토 후 보내기(초안당 약 1분, 10–30개) | 10–30 |
| AI의 주간 순이익으로 EI 격주 보고(2주마다 10분, `ops/books/ei/`) | 5 |
| Stripe 입금이 은행에 들어왔는지 확인(금액을 `ops/books/payouts.json`에 한 줄 추가) | 5–10 |
| 월간 장부 확인(월 15분, `ops/books/`) | 4 |
| 플랫폼 이의 제기: Ads 정책, Stripe 요청(문제 있는 주만) | 0–30 |
| (선택) 채점 결과 5개 확인(영어가 되면) | 0–20 |
| **합계** | **54–169분 (0.9–2.8시간)** |

(선택, 1분) 이 제품에 쓴 시간을 `ops/owner/hours.json`에 `{"week": "2026-W44", "hours": 2.5}` 형식으로 한 줄씩 적으면 KPI Routine이 K2를 자동으로 평가해요. 없으면 K2는 "오너 확인 필요"로 표시돼요.

---

## 4. 중단 규칙과 확장 규칙 (메모 §6 요약)

KPI Routine이 매주 평가하고 오너가 확정해요. 정확한 계산식은 `ops/routines/kpi.md`에 있어요.

| 규칙 | 조건 | 조치 |
|---|---|---|
| K1 일정 | 11월 1일(일)까지 결제가 열리지 않음 | 중단하고 decision-memo.md로 돌아가요 |
| K2 오너 시간 | 두 주 이상 주 3시간 초과, 또는 설정 12시간 초과 | 핵심만 남김: 광고 없이 운영 |
| K3 상단 퍼널 | 광고비 C$280을 쓴 뒤 유료 클릭에서 시작된 무료 샘플이 10개 미만 | 광고 끔(랜딩 수정 1회와 C$140 이하 재시험 1회 허용) |
| K4 CAC | 최근 14일 CAC가 실측 첫 판매 순이익(계획 C$27.7–34.9)보다 큼 | 광고 끔 |
| K5 11월 15일 | 전체 채널 무료 샘플 100개 미만 | 한도 안에서 키워드 교체. 30개 미만이면 11월 30일 틈새 재검토 |
| K6 11월 30일 | 11월 순이익 C$500 미만이고 주간 성장 없음 | 모든 지출 중단, 유지 모드, **두 번째 제품 없음** |
| K7 환불·분쟁 | (판매 20건 이상에서) 환불 10% 초과, 또는 분쟁 0.75% 초과 [기준 미확인] | 결제와 광고 일시 중지, 채점 검토 |
| K8 API 비용 | 7일 동안 API 비용이 매출의 20% 초과 | 사용자별 한도 강화 |
| K9 플랫폼 | Google Ads 정지, Stripe 보류·거절 | 광고 없이 운영. 두 번째 플랫폼 문제면 중단 |
| K10 손실 한도 | 누적 순손실(고정비 + 광고 + API − 매출) C$1,500 초과 | 중단 |
| K11 12월 26일·1월 31일 | 최근 30일 순이익 C$0 미만 | 정리(결제·광고·Routine 끄기, Claude Pro 해지. 남은 이용권이 끝날 때까지 채점은 유지하거나 기간 비례 환불). C$0–1,000은 유지(광고 없음), C$1,000 이상은 계속 |

**확장 규칙:** 1월 31일까지 광고비 총액은 C$1,200이 상한이고, 올리려면 `ops/config/ad-cap.json`을 고치는 PR을 오너가 병합해야 해요. S0: CAC C$15~첫 판매 순이익이면 C$20/일 유지. S1: CAC C$9–15면 C$30/일까지. S2: 구매 20건 이상에서 CAC가 첫 판매 순이익 ÷ 3(약 C$9.2) 이하면 C$60/일까지 올릴 수 있음(매주 재확인). S3: 월 30명 이상이 광고 없이 구매하면 자격 있는 검토자(공인 ESL·시험 대비 강사, 비용 미확인)를 고용해 안내 페이지를 다시 시작할 수 있음.

---

## 5. 참고: 세금과 개인정보 (메모 §4.1)

- GST/HST는 등록하지 않아요. 네 분기 합계 과세 공급이 C$30,000을 넘으면 30일 안에 등록해야 해요(ETA s.148, s.240(2.1)). `books` Routine이 80%에서 이슈를 열어요.
- 소득은 T2125로 신고해요(2027-06-15까지 신고, 2027-04-30까지 납부). 영수증을 보관해요(보관 기간 6년은 [미확인]).
- 사용자 글, 받아쓰기, 이메일은 **git, 로그, 지표 파일, Routine 프롬프트에 절대 들어가지 않아요.** `ops/metrics/`의 개인정보 검사가 매일 확인해요. 녹음은 받아쓰기 후 바로 버려요.
