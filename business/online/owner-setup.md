# Maple Practice Coach 오너 설정 안내서 (처음 하는 분을 위한 단계별 수업)

> 이 문서는 **오너가 직접 해야 하는 일**을 처음부터 끝까지 순서대로 알려 주는 수업 자료예요.
> GitHub, Claude, Cloudflare 같은 도구를 한 번도 써 본 적이 없어도 따라 할 수 있게 썼어요.
> 한 번에 다 하지 않아도 돼요. 한 단계를 끝내면 잠깐 쉬었다가 다음 단계로 가세요.
>
> **근거:** `business/online/decision-memo.md`(이하 "메모") §0, §1.3(관문), §4, §6, §7.1, §7.2(무자본 출시).
> 이 안내서는 새 전략을 만들지 않아요. 메모의 결정을 오너가 따라 할 수 있는 절차로 옮긴 거예요.
> 법률·세무 자문이 아니에요.

---

## 솔직한 기대치 (먼저 꼭 읽어 주세요)

1. 이 제품으로 **한 달 평균 C$5,000**에 닿을 가능성은 **1%보다 훨씬 낮아요**(판단, 메모 §0·§7.2). 이 제품을 소득원으로 생각하지 마세요.
2. 광고 없이 가장 그럴듯한 결과는 10월–1월 **4개월 합계 약 +C$8(판매 0건일 확률 약 75%)에서 +C$66**(1월에 판매 1건 정도)이에요. 운이 아주 좋으면 약 +C$1,820이에요(모두 **추정**, 메모 §7.2 표).
3. 잃을 수 있는 현금은 **약 C$15–100**이에요(대부분 Anthropic 선불 크레딧). 판매 수입을 빼고도 C$100을 넘게 쓰면 **멈춰요**(중단 규칙 K10).

---

## 이 안내서 읽는 법

**표시 규칙**

- **[미확인: …]** 화면의 메뉴나 버튼 이름을 공식 문서로 확인하지 못했다는 뜻이에요. 화면이 조금 달라도 괜찮아요. 괄호 안에 적은 "대신 찾을 것"을 보고 비슷한 이름을 찾으세요.
- **(추정)** 계산해서 나온 값이에요. 실제 결과가 아니에요.
- 화면에 보이는 영어 이름은 **"큰따옴표"** 안에 그대로 적었어요. 예: "Settings" → "Danger Zone".

**모든 단계에 있는 네 가지 상자**

> ✅ **이렇게 보이면 성공:** 제대로 됐는지 확인하는 방법이에요.
>
> ⚠️ **자주 하는 실수:** 처음 하는 분들이 자주 걸리는 곳이에요.
>
> 💬 **막히면 Claude에게 이렇게 말하세요:** "…" 이 문장을 그대로 복사해 Claude 대화창에 붙여 넣으면 돼요.
>
> **비용:** 그 단계에서 돈이 드는지 적었어요. 대부분 **0원**이에요.

**가장 중요한 규칙 하나**

> 🔒 **키, 토큰, 비밀번호, 비밀 값은 절대 Claude 대화창에 붙여 넣지 마세요.**
> 이슈, 이메일, 메모 파일, 스크린샷에도 넣지 않아요. 비밀 값은 딱 한 곳, **GitHub의 비밀(Secrets) 칸**에만 넣어요(5단계).
> Claude에게 보내도 되는 것은 **비밀이 아닌 값**뿐이에요: 사이트 주소, 데이터베이스 ID(6단계 결과), Google Client ID, Turnstile 사이트 키, 오류 문장, 실행 링크.
> 헷갈리면 보내기 전에 "이거 보내도 되는 값이야?"라고 먼저 물어보세요(값은 붙이지 말고 이름만).

---

## 용어 사전 (처음 한 번 읽어 두세요)

어려운 말은 여기 모아 두었어요. 본문에서 처음 나올 때도 짧게 다시 설명해요.

| 용어 | 쉬운 뜻 | 이 프로젝트에서는 |
|---|---|---|
| **GitHub** | 코드와 문서를 보관하는 웹사이트예요. 여러 사람(와 AI)이 같이 고칠 수 있어요. | 제품의 모든 코드와 이 안내서가 있어요. |
| **저장소 (repository)** | GitHub 안의 "프로젝트 폴더" 하나예요. | `canadian-tool-deals` 저장소 하나를 써요. |
| **공개 / 비공개 (public / private)** | 공개는 누구나 볼 수 있고, 비공개는 나와 내가 허락한 사람(와 앱)만 볼 수 있어요. | 지금은 공개예요. 1단계에서 **비공개**로 바꿔요. |
| **브랜치 (branch)** | 원본을 건드리지 않고 고칠 수 있게 만든 "복사본 줄기"예요. | Claude는 `claude/…` 브랜치에서 일해요. 원본 줄기는 `master`예요. |
| **PR (Pull Request)과 병합 (merge)** | PR은 "이 브랜치의 변경을 원본에 합쳐 주세요"라는 **요청서**예요. 병합은 그 요청을 받아들여 **원본(master)에 합치는 것**이에요. | 2단계에서 처음 해요. 돈이나 약속에 관한 PR은 오너가 직접 병합해요. |
| **이슈 (issue)** | 저장소 안의 **게시판 글**이에요. 할 일, 질문, 알림을 적어요. 댓글을 달 수 있어요. | 매주 "KPI digest …" 이슈가 열리고, 오너는 댓글로 답해요. |
| **Actions / 워크플로 (workflow)** | GitHub가 대신 실행해 주는 **자동 작업 목록**이에요. 버튼("Run workflow")을 눌러 실행하거나, 정해진 시간에 저절로 돌아요. | 배포, 킬 스위치, 점검이 모두 워크플로예요. 이름은 "Deploy practice coach"처럼 영어예요. |
| **변수 (variable)와 비밀 (secret)** | 워크플로가 읽는 **설정 값**이에요. 변수는 화면과 실행 기록에 그대로 보이는 값(예: 사이트 주소), 비밀은 저장하면 다시 볼 수 없게 잠기는 값(예: 키)이에요. | 5단계에서 GitHub에 넣어요. 이름은 `MPC_SITE_URL`처럼 대문자예요. |
| **Cloudflare** | 웹사이트를 인터넷에 올려 주는 회사예요. | 무료 요금제로 사이트와 데이터베이스를 돌려요. |
| **Worker (워커)** | Cloudflare 위에서 도는 **우리 프로그램**이에요. | `maple-practice-coach`(운영)와 `maple-practice-coach-staging`(스테이징) 두 개예요. |
| **workers.dev 주소** | Cloudflare가 무료로 주는 웹 주소예요. | 사이트 주소가 `https://maple-practice-coach.<내 서브도메인>.workers.dev`가 돼요. 도메인을 사지 않아요. |
| **D1 / KV** | D1은 Cloudflare의 **데이터베이스**(표 모음), KV는 아주 작은 **설정 보관함**이에요. | D1에는 계정·구매 기록, KV에는 킬 스위치 값이 있어요. 6단계에서 워크플로가 만들어요. |
| **API 키 / 토큰** | 프로그램이 서비스에 로그인할 때 쓰는 **긴 비밀번호**예요. | 모두 **비밀**이에요. GitHub 비밀 칸에만 넣어요. |
| **Turnstile** | Cloudflare의 무료 **로봇 확인** 기능이에요("사람인가요?"). | 로그인과 무료 체험에 써요. 4-1에서 만들어요. |
| **Stripe** | 카드 결제를 처리하는 회사예요. | 이용권(C$39, C$79) 결제와 환불을 해요. |
| **웹훅 (webhook)** | 한 서비스가 다른 서비스에 "방금 이런 일이 있었어요"라고 **자동으로 알려 주는 연락**이에요. | Stripe가 결제·환불이 생길 때마다 우리 Worker에 알려요. |
| **Anthropic Console** | Claude를 만든 회사(Anthropic)의 **API 관리 화면**이에요. 이 대화창(Claude)과는 다른 곳이에요. | 사이트가 쓰는 AI 피드백의 키와 크레딧을 여기서 관리해요. |
| **크레딧 (credits)** | Anthropic API를 쓰려고 **미리 사 두는 금액**이에요(선불 충전). | 약 US$10을 한 번 사요. 자동 충전은 꺼요. |
| **Resend** | 이메일을 보내 주는 서비스예요. | **오너에게 오는 알림 메일**만 보내요. 학습자에게는 이메일을 보내지 않아요. |
| **스테이징 (staging)** | 진짜 사이트와 똑같지만 **오너만 쓰는 시험용 사이트**예요. | `maple-practice-coach-staging` Worker. 시험용 카드로 결제를 시험해요. |
| **운영 (production)** | 학습자가 실제로 쓰는 **진짜 사이트**예요. | `maple-practice-coach` Worker. |
| **배포 (deploy)** | 새 코드를 사이트에 **올려서 실제로 보이게 하는 것**이에요. | "Deploy practice coach" 워크플로가 해요. |
| **킬 스위치 (kill switch)** | 문제가 생기면 기능을 **바로 끄는 스위치**예요. | 결제, AI 피드백, 무료 체험, 배너를 켜고 꺼요(9-4). |
| **Routine (루틴)** | 정해진 시간에 Claude가 **스스로 일을 하는 예약 작업**이에요. | 매일 알림 정리, 매주 KPI 보고서를 써요. 출시 뒤에 켜요(10단계). |
| **CI** | PR이 생길 때마다 GitHub가 저절로 돌리는 **자동 점검**(테스트)이에요. | 워크플로 이름도 "CI"예요. 빨간색이면 Claude가 고쳐요. |
| **스모크 테스트 (smoke test)** | 배포 직후 사이트가 **제대로 열리는지 빠르게 확인**하는 자동 점검이에요. | 실패하면 배포 워크플로가 이전 버전으로 되돌려요(롤백). |
| **B단계 점검** | 메모가 정한 **출시 전 점검 목록**(B0–B16)이에요. 일부는 자동, 일부는 오너가 직접 해요. | 7단계에서 10월 18일까지 해요. |
| **메타데이터 (metadata)** | 결제나 환불에 붙이는 **작은 메모**(이름 = 값)예요. | 남은 날짜 환불에 `end_pass` = `true`를 붙여요(9-8). |

---

## 0. 시작 전에 알아둘 것

시간: 약 10분 (읽기)

### 0-1. 누가 무엇을 하나요

| 오너가 하는 일 | Claude가 하는 일 |
|---|---|
| 계정 가입, 본인 인증, 전화, 서명 | 코드와 문서를 만들고 고쳐요 |
| 돈이 드는 일(크레딧 구매) | PR을 만들고, 오너가 부탁하면 병합해요 |
| 비밀 값을 GitHub 비밀 칸에 넣기 | 워크플로 결과를 읽고 다음 할 일을 알려 줘요 |
| 워크플로 실행 버튼 누르기(배포, 킬 스위치) | 오너가 보낸 ID를 설정 파일에 넣어요 |
| 법률 페이지 읽고 승인 | 커뮤니티 글, 지원 답장 **초안**을 만들어요 |
| 커뮤니티에 글 올리기, 지원 답장 보내기 | 매일·매주 보고서를 써요(루틴) |
| "돈·약속"에 관한 PR 병합 | 모르는 것을 설명해 줘요 |

**Claude가 절대 하지 않는 일:** 비밀 값 보기, 돈 쓰기, 가격 바꾸기, 광고 사기(광고는 아예 하지 않아요), 어디에 글 올리기, 학습자에게 이메일 보내기, 정책 밖 환불(메모 §1.4).

**Claude가 못 하는 일:** 이 작업 환경에서는 `anthropic.com`, Stripe, Cloudflare 같은 일부 사이트에 직접 들어갈 수 없어요. 그래서 그런 화면은 오너가 보고 알려 줘야 해요.

### 0-2. 돈은 얼마나 드나요

| 항목 | 비용 |
|---|---|
| GitHub (Free 요금제, 결제수단 없음) | **0원** |
| Cloudflare (Workers Free, workers.dev 주소) | **0원** |
| Google 로그인 설정 (Google Cloud) | **0원** (결제 계정을 만들지 않아요) |
| Resend (무료, 오너 알림만) | **0원** |
| Stripe 계정 | **0원** (월 요금 없음). 판매할 때마다 수수료 약 2.9% + C$0.30 (추정, 2차 자료) |
| **Anthropic 선불 크레딧** | **약 US$10 (약 C$13.70) 한 번.** 이게 **유일한 필수 지출**이에요. 자동 충전은 꺼요. 세금이 붙을 수 있어요 [미확인] |
| 출시일 실제 카드 시험 결제(8-6) | 환불해도 돌려받지 못하는 Stripe 수수료 약 C$0.30–1.50 (추정) |
| ServiceOntario 사업자명 등록 | **ServiceOntario가 필요하다고 할 때만.** 약 C$60 [미확인] (9-9) |
| 광고 | **없어요.** 광고는 하지 않아요 |

크레딧이 모자라면 나중에 조금 더 살 수 있어요(9-3). 그래도 **판매 수입을 빼고 C$100이 넘으면 멈춰요**(K10).

### 0-3. 시간은 얼마나 걸리나요 (모두 추정)

| 단계 | 시간 |
|---|---|
| 0. 읽기 | 10분 |
| 1. GitHub 비공개와 알림 | 15분 |
| 2. master에 합치기 | 5분 (+ Claude 작업 시간) |
| 3. 관문 (Gate B 확인, 이메일, 서명) | 30분 |
| 3. 관문 중 EI 관련 일 (EI를 받는 경우만) | 2–3시간 |
| 4. 무료 계정 만들기 (다섯 과목) | 3–3.5시간 |
| 5. GitHub에 비밀과 변수 넣기 | 30분 |
| 6. Cloudflare 한 번 설정 | 15분 |
| 7. 스테이징 배포와 B단계 점검 | 1.5–2시간 |
| 8. 운영 배포와 결제 켜기 (법률 페이지 읽기 포함) | 2시간 |
| 9. 출시 직후 한 번 (커뮤니티 글, ServiceOntario 전화) | 1시간 |
| 10. 루틴 켜기 | 5분 |
| **합계** | **약 9.5–10.5시간** (EI 관련 일 제외) |

메모의 규칙 K2: 설정이 **12시간을 넘으면** 핵심만 남기고 줄여요. 걸린 시간을 적어 두었다가, 첫 "KPI digest" 이슈에 `설정 9.5시간`처럼 댓글로 알려 주세요(9-2).

**권장 일정 (Day 1 = 9월 28일 월)**

| 주 | 할 일 |
|---|---|
| 1주 (9/28–10/4) | 1, 2, 3단계(Gate B 날짜 확인, 서명), 4-1, 4-2, 4-3, 4-5 |
| 2주 (10/5–10/11) | Service Canada 전화(EI를 받으면 **10/9 금까지**), EI 신청(**10/10 토까지**), 그 뒤 4-4 Stripe, 5, 6단계 |
| 3주 (10/12–10/18) | 7단계 B단계 점검 (**10/18 일까지**). Gate B 답이 없으면 10/18에 결정 |
| 4주 (10/19–10/25) | 8단계 운영 배포와 결제 켜기, 9단계 시작 |
| 늦어도 11/1 (일) | 결제가 열려 있어야 해요(K1). 아니면 중단하고 홈서비스 계획으로 돌아가요 |

### 0-4. 비밀 값은 어디로 가나요

1. 서비스(Cloudflare, Stripe 등)에서 키를 만들면 **바로 복사**해요. 많은 키가 **한 번만** 보여요.
2. 브라우저에서 **탭을 두 개** 열어 두면 편해요: 하나는 그 서비스, 하나는 GitHub의 비밀 칸(5단계 방법).
3. 복사한 키를 GitHub의 "New repository secret"에 **바로 붙여 넣고** 저장해요. 다른 곳(메모장, 채팅, 이메일)에는 적지 않아요.
4. 키를 잃어버려도 괜찮아요. 서비스에서 **새로 만들고** GitHub 값을 바꾸면 돼요(Claude에게 "○○ 키를 새로 바꾸고 싶어"라고 물어보세요).

### 0-5. 준비물

- 컴퓨터 한 대(Chrome 브라우저 권장)와 휴대폰(iPhone이면 7단계 점검에 좋아요).
- **사업용 Google 계정(Gmail) 하나.** 개인 계정과 **따로** 만들어요. 한 서비스에 문제가 생겨도 개인 계정이 안전해요(메모 §4.1). **비용: 0원.**
  - 이 주소를 **모든 곳에 똑같이** 써요: Resend 가입, Google Cloud, Anthropic Console, Stripe, 그리고 GitHub 변수 `MPC_OWNER_EMAIL`.
  - 왜 같아야 하나요? 알림 메일을 보내는 Resend 무료 발신 주소는 **Resend 가입 주소로만** 메일을 보낼 수 있어요. 주소가 다르면 알림이 오지 않아요.
- GitHub 계정(이미 있어요: 저장소 주인 계정).

---

## 1. GitHub 저장소를 비공개로 + 사용량 알림 켜기 + 결제수단 등록하지 않기

시간: 약 15분 · **비용: 0원**

**왜 하나요?** 저장소가 지금 **공개**라서 누구나 사업 문서를 볼 수 있어요(메모 §4.1). 비공개로 바꾸면 무료 요금제에서 GitHub Actions를 **한 달 2,000분**까지 쓸 수 있어요. 카드를 등록하지 않으면 2,000분을 다 써도 **돈이 청구되지 않고** 작업이 잠시 멈출 뿐이에요.

### 1-1. 저장소를 비공개로 바꾸기 (5분)

컴퓨터나 휴대폰의 **웹 브라우저**로 해요. GitHub 앱은 필요 없어요.

1. `https://github.com`에 로그인하고, 저장소 `canadian-tool-deals` 첫 화면을 열어요.
2. 저장소 이름 아래의 **"Settings"**(톱니바퀴)를 눌러요. 안 보이면 **"..."** 메뉴를 누르고 "**Settings**"를 눌러요.
3. 화면 **맨 아래**의 빨간 상자 "**Danger Zone**"까지 내려가요.
4. **"Change repository visibility"** 옆의 "**Change visibility**"를 눌러요.
5. "**Private**"를 골라요.
6. 맞는 저장소인지 확인하는 창이 나와요. 이름이 `canadian-tool-deals`인지 보고 확인을 눌러요.
7. "**I have read and understand these effects**"를 눌러요.
8. "**Make this repository private**"를 눌러요.
9. 비밀번호나 2단계 인증 코드를 물으면 넣어요. 보안을 위한 평범한 재확인이에요.

> ✅ **이렇게 보이면 성공:** 저장소 이름 옆에 **"Private"** 표시가 보여요. 잃는 것은 없어요(별 0개, 포크 0개, GitHub Pages 없음).
>
> ⚠️ **자주 하는 실수:** 내 프로필의 "Settings"로 들어가는 것. **저장소 화면 위쪽**의 "Settings"여야 해요.
>
> 💬 **막히면 Claude에게 이렇게 말하세요:** "저장소를 비공개로 바꾸는 화면에서 막혔어. 지금 화면에 보이는 버튼 이름은 ○○야."

홈서비스 웹사이트가 이 저장소에서 자동으로 배포되고 있다면(예: Cloudflare Pages 연결), 비공개로 바꾼 뒤 그 사이트가 **그대로 열리는지** 한 번 확인해요. 안 열리면 Claude에게 알려 주세요.

### 1-2. 카드를 등록하지 않기, 유료로 올리지 않기 (0분)

- GitHub에 **결제수단(카드)을 등록하지 마세요.** **GitHub Pro로 올리지도 마세요.**
- 이유: 카드가 없으면 GitHub는 무료 2,000분을 다 쓴 달에 Actions를 **멈출 뿐** 돈을 받을 수 없어요. 다음 달 1일에 다시 돌아요.
- 멈추는 동안에도 사이트는 계속 열려 있어요. 지출 감시도 Cloudflare 안에서 계속 돌아요. 멈추는 것은 배포, 킬 스위치 워크플로, 매일 보고 같은 GitHub 작업이에요(대신 쓰는 방법: 9-4).

### 1-3. "무료 사용량 거의 다 씀" 알림 켜기 (2분)

1. 오른쪽 위 **프로필 사진** → "**Settings**"를 눌러요.
2. 왼쪽 메뉴에서 "**Billing and licensing**"을 열어요. (또는 주소창에 `https://github.com/settings/billing`)
3. "**Budgets and alerts**"를 눌러요.
4. **"Included usage alerts"** 아래의 "**Receive alerts when my included usage reaches 90% and 100%**"에 체크해요.

> ✅ **이렇게 보이면 성공:** 체크가 되어 있어요. 앞으로 90%(약 1,800분)와 100%에서 이메일이 와요.
>
> ⚠️ **자주 하는 실수:** "Budgets"(예산)를 새로 만드는 것. 예산은 돈을 쓸 때의 기능이라 **만들 필요 없어요.** 알림 체크만 해요.
>
> 💬 **막히면 Claude에게 이렇게 말하세요:** "GitHub 사용량 알림 체크 상자를 못 찾겠어."

### 1-4. 실패한 작업을 이메일로 받기 (2분)

**왜 하나요?** 매일 도는 점검이 실패하면 이메일로 알아야 해요(B단계 점검 B11의 일부).

1. 주소창에 `https://github.com/settings/notifications`를 열어요.
2. **"System"** 아래의 "**Actions**"에서 드롭다운(처음에는 **"Don't notify"**)을 눌러요.
3. "**Email**"을 고르고, "**Only notify for failed workflows**"도 골라요.
4. "**Save**"를 눌러요.

> ✅ **이렇게 보이면 성공:** "Actions" 칸에 Email과 실패만 알림이 선택돼 있어요.
>
> ⚠️ **자주 하는 실수:** 저장소를 "Watch"하지 않으면 알림이 오지 않을 수 있어요. 저장소 첫 화면 위쪽의 **"Watch"** 버튼이 켜져 있는지도 봐요 [미확인: 버튼 이름 — 저장소 이름 오른쪽의 눈 모양 버튼].
>
> 💬 **막히면 Claude에게 이렇게 말하세요:** "GitHub 알림 설정에서 Actions 항목을 못 찾겠어."

### 1-5. 오래된 "Daily Price Scrape" 끄기 (1분)

**왜 하나요?** 예전 가격 수집 작업이 매일 약 10분씩 써요. 비공개가 되면 한 달에 약 300분이에요. 2단계에서 합치면 없어지지만, 그 전에 꺼 두면 아껴요.

1. 저장소 → 위쪽 **"Actions"** 탭을 눌러요.
2. 왼쪽 목록에서 "**Daily Price Scrape**"를 눌러요.
3. 오른쪽의 **"..."** 버튼 → "**Disable workflow**"를 눌러요.

> ✅ **이렇게 보이면 성공:** 그 워크플로에 "disabled"(꺼짐) 표시가 보여요.
>
> ⚠️ **자주 하는 실수:** 목록에 없으면 이미 없어진 거예요. 걱정하지 않아도 돼요.
>
> 💬 **막히면 Claude에게 이렇게 말하세요:** "Actions 목록에 Daily Price Scrape가 안 보여. 괜찮은 거야?"

### 1-6. Claude가 비공개 저장소를 계속 볼 수 있는지 확인 (3분)

1. 프로필 사진 → **"Settings"** → 왼쪽 **"Integrations"** 아래 **"Applications"** → **"Installed GitHub Apps"** 탭을 열어요.
2. Claude 앱을 찾아 "**Configure**"를 눌러요.
3. "**Repository access**"에서 "**All repositories**"가 선택돼 있거나, **"Only select repositories"** 목록에 `canadian-tool-deals`가 있는지 봐요. 없으면 넣고 "**Save**"를 눌러요.
4. Claude 대화창에서 "저장소의 README 파일 첫 줄 읽어줘"라고 해 봐요.

> ✅ **이렇게 보이면 성공:** Claude가 파일 내용을 읽어 줘요.
>
> ⚠️ **자주 하는 실수:** 목록에 Claude 앱이 없는 경우. `https://claude.ai/connect-github`에서 GitHub를 다시 연결해요.
>
> 💬 **막히면 Claude에게 이렇게 말하세요:** "저장소를 비공개로 바꿨는데 네가 저장소를 읽을 수 있는지 확인해줘."

---

## 2. 작업을 master에 합치기

시간: 약 5분 (+ Claude 작업 시간) · **비용: 0원**

**무엇인가요?** Claude는 지금까지 모든 작업을 `claude/…`라는 **브랜치**(원본을 건드리지 않는 복사본 줄기)에서 했어요. 원본 줄기인 `master`에는 아직 없어요.

**왜 필요해요?** GitHub는 **`master`에 있는 워크플로만** "Run workflow" 버튼으로 실행하고, 정해진 시간에 자동으로 돌려요. 그래서 3단계 이후의 모든 일(Cloudflare 설정, 배포, 킬 스위치)은 합친 뒤에만 할 수 있어요.

**PR과 병합이란?** PR(Pull Request)은 "이 변경을 master에 합쳐 주세요"라는 **요청서**예요. 무엇이 바뀌는지 한 화면에서 볼 수 있어요. 병합(merge)은 그 요청서를 받아들여 **실제로 합치는 것**이에요.

### 2-1. Claude에게 부탁하기

1. Claude 대화창에 이렇게 써요: **"PR 만들고 master에 합쳐줘"**
2. Claude가 PR을 만들고, 자동 점검(CI)을 확인한 뒤 합쳐요. 몇 분에서 한 시간 정도 걸릴 수 있어요.
3. 합치면 운영 배포가 저절로 시작될까 걱정하지 않아도 돼요. 변수 `MPC_DEPLOY`가 아직 없어서 배포는 **건너뛰어요.**

> ✅ **이렇게 보이면 성공:** 저장소 → **"Pull requests"** 탭 → **"Closed"** 목록에서 그 PR에 보라색 **"Merged"** 표시가 있어요. **"Actions"** 탭 왼쪽 목록에 "Deploy practice coach", "Set a kill switch", "Set up Cloudflare (one time)", "Level-B checks" 같은 이름이 보여요.
>
> ⚠️ **자주 하는 실수:** CI(자동 점검)가 빨간색이면 Claude가 먼저 고쳐야 해요. 오너가 억지로 합치지 않아요.
>
> 💬 **막히면 Claude에게 이렇게 말하세요:** "PR 합친 거 확인해줘. Actions 목록에 Set up Cloudflare (one time)가 보여야 해."

### 2-2. 오너가 직접 병합하는 법 (앞으로 여러 번 써요)

돈이나 약속에 관한 PR(예: 크레딧 금액을 적는 파일)은 **오너가 직접** 병합해요. 오너의 병합이 메모가 말하는 "**서면 확인**"이에요.

1. 저장소 → **"Pull requests"** 탭 → 목록에서 그 PR을 눌러요.
2. 무엇이 바뀌는지 읽어요. **"Files changed"** 탭에서 바뀐 줄을 볼 수 있어요. 모르겠으면 Claude에게 "PR #번호 쉽게 설명해줘"라고 해요.
3. 화면 아래로 내려가 "**Merge pull request**"를 눌러요.
4. "**Confirm merge**"를 눌러요.

> ✅ **이렇게 보이면 성공:** 보라색 **"Merged"** 표시가 보여요.
>
> ⚠️ **자주 하는 실수:** 이해하지 못한 PR을 합치는 것. 모르면 합치지 말고 먼저 물어보세요.
>
> 💬 **막히면 Claude에게 이렇게 말하세요:** "PR #번호가 무엇을 바꾸는지 한국어로 설명해줘. 합쳐도 돼?"

### 2-3. 이슈에 댓글 달기 (앞으로 여러 번 써요)

1. 저장소 → **"Issues"** 탭 → 그 이슈를 눌러요.
2. 맨 아래 댓글 칸에 써요.
3. 댓글 칸 아래 초록색 **"Comment"** 버튼을 눌러요 [미확인: 버튼 이름 — 댓글 칸 바로 아래 초록색 버튼].

---

## 3. 관문(Gate) 통과하기

**관문이란?** 다음 단계로 가기 전에 반드시 확인해야 하는 **조건**이에요. 통과하지 못하면 멈춰요(메모 §1.3). 광고를 하지 않아서, 광고와 관련된 관문은 없어요.

### 3-1. Gate 0: 자영업 권리와 EI

시간: 15분 (+ EI를 받으면 2–3시간) · **비용: 0원**

**① 자영업을 해도 되는지 (모든 오너)**

1. IRCC 서류(체류 신분 서류)를 보고 **자영업을 해도 되는지** 확인해요.
2. 안 되면 **여기서 멈춰요.** 이 제품을 하지 않아요.

**② EI(고용보험)를 받고 있거나 신청할 예정이면**

EI 규정 s.30(1)은 매출이 없어도 **사업을 운영하는 주**에 적용돼요. 그래서 이렇게 해요.

1. **설정 첫 주부터** 이 활동을 EI 신청서와 격주 보고서에 신고해요. 첫 판매부터가 아니에요.
2. **EI 신청은 10월 10일(토)까지** 해요(메모 §0).
3. **10월 9일(금)까지 Service Canada에 전화**해요. 대기 시간은 [미확인]이에요. 이렇게 말하면 돼요(영어로 말하기 어려우면 통역을 요청해요 [미확인: 통역 서비스 여부]):

   > "I am setting up a small online practice-feedback website that runs mostly by software. I spend about ○ hours a week on it (more during setup). I spend **no money on advertising**. My only cost is a one-time prepaid API credit of about US$10, and there are no monthly fixed costs. I also do home services, about ○ hours a week. Would this combination be minor in extent under section 30 of the EI Regulations?"

   (뜻: "주로 소프트웨어로 돌아가는 작은 연습 피드백 웹사이트를 준비하고 있어요. 일주일에 약 ○시간 써요(설정 기간에는 더 많아요). 광고에는 돈을 쓰지 않아요. 비용은 약 US$10의 선불 API 크레딧 한 번뿐이고 월 고정비는 없어요. 홈서비스도 일주일에 약 ○시간 해요. 이 둘을 합쳐도 EI 규정 30조의 'minor in extent(아주 작은 정도)'인가요?")
4. **이 전화를 하기 전에는 Stripe 계정을 열지 않아요**(4-4는 전화 뒤에).
5. "minor가 아니다"라는 답이면 **EI를 받는 동안 유료 판매를 하지 않아요.** 답을 받지 못하면 매주 순이익을 신고해요(decision-memo.md §5.4).
6. **시간 규칙:** EI를 받는 동안에는 홈서비스와 이 제품을 합쳐 **주 15시간 이하**일 때만 진행해요(추정 기준, 법적 기준 아님). EI가 아니면 합계 주 45시간 이하. 부딪히면 **홈서비스가 먼저**예요.
7. 통화 날짜, 상담원 이름(성 빼고), 답을 적어 두고, Claude에게 "Gate 0 이슈 만들어줘"라고 한 뒤 그 이슈에 **날짜와 결론만** 댓글로 남겨요.
8. EI 격주 보고 월요일을 알게 되면 Claude에게 "**EI 보고 월요일은 2026-10-12야**"처럼 알려 주세요. Claude가 `ops/config/ei-schedule.json`을 고치는 PR을 만들면 **오너가 직접 병합**해요(2-2).

> ✅ **이렇게 보이면 성공:** IRCC 확인 끝, (EI면) 신청 완료와 통화 결론이 이슈에 한 줄씩 있어요.
>
> ⚠️ **자주 하는 실수:** "아직 매출이 없으니 신고 안 해도 되겠지"라고 생각하는 것. **설정하는 주부터** 신고해요.
>
> 💬 **막히면 Claude에게 이렇게 말하세요:** "Service Canada 통화에서 이렇게 답을 들었어: (답 요약). 다음에 뭘 해야 해?" (개인 번호 SIN 같은 것은 적지 않아요.)

### 3-2. Gate B: Anthropic 이용 정책 확인과 문의

시간: 날짜 확인 5분 + 이메일 10분 (이메일은 4-5를 끝낸 뒤) · **비용: 0원** · 상태: **미해결**

**무엇이 문제인가요?** Anthropic 이용 정책(AUP)의 "고위험 사용" 목록에 "language proficiency(언어 능력) 시험과 **관련된** 사용"이 있어요. 고위험이면 **자격 있는 전문가가 모든 피드백을 미리 검토**해야 해요. 우리 제품은 시험을 치르거나 점수를 주지 않아서 **아마 해당하지 않지만, 확실하지 않아요.** "아마"는 통과가 아니에요(메모 §1.3).

**① 정책 날짜 확인 (5분, 1주차)**

1. 컴퓨터 브라우저 주소창에 `www.anthropic.com/legal/aup`를 넣고 Enter를 눌러요.
2. 큰 제목 **"Usage Policy"** 아래에서 "**Effective**"로 시작하는 작은 줄을 찾아요.
3. "**Effective September 15, 2025**"이면 Claude가 읽은 문구와 같아요. Claude에게 "Gate B 이슈 만들어줘"라고 한 뒤, 그 이슈에 `AUP 날짜 그대로 September 15, 2025`라고 댓글을 달아요.
4. 날짜가 **다르면** 페이지 전체를 선택(Ctrl+A, Mac은 Cmd+A)·복사(Ctrl+C)해서 Gate B 이슈 댓글에 붙여 넣어요(Ctrl+V). 정책 문구는 비밀이 아니에요. Claude가 새 문구와 비교해요.

**② 문의 이메일 보내기 (10분, 4-5에서 Console 계정을 만든 뒤)**

1. `business/online/gate-b-anthropic-email.md`를 열어요. 영어 본문이 실제로 보낼 글이고, 한국어는 설명이에요.
2. `[대괄호]` 칸을 채워요: Console 조직 이름, 법적 이름, Console 계정 이메일.
3. **받는 곳:** AUP 본문의 `usersafety@anthropic.com`은 **해로운 답변 신고용**이라 쓰지 않아요. Anthropic Console 안의 **도움말(Help)·지원(Support)** 창구로 보내요 [미확인: 메뉴 위치 — Console 화면 구석의 물음표나 "Help", "Support" 글자].
4. 보낸 날짜를 Gate B 이슈에 댓글로 남겨요. 답장은 보장되지 않아요.

**규칙 (메모 §1.3)**

- 현재 정책이 연습 도구를 **분명히 포함**하면 → **AI 피드백 기능을 출시하지 않아요.** 모든 피드백을 전문가가 검토하려면 돈이 들어서 무자본으로는 지킬 수 없어요. AI 없는 무료 연습 모드만 남길지는 오너가 정해요.
- 답이 "해당하지 않는다"이면 → 답장을 보관하고 이슈에 날짜와 결론만 적어요.
- **10월 18일(일, 21일차)까지 답이 없으면** → "writing and speaking practice feedback"으로만 출시해요. 어떤 출력이나 페이지에도 **CLB, band, level, score 표현을 쓰지 않아요.** 그리고 아래 **위험 수용**에 서명해요.

> ✅ **이렇게 보이면 성공:** Gate B 이슈에 날짜 확인 댓글과 이메일 보낸 날짜 댓글이 있어요.
>
> ⚠️ **자주 하는 실수:** `usersafety@anthropic.com`으로 보내는 것. 그 주소는 신고용이에요.
>
> 💬 **막히면 Claude에게 이렇게 말하세요:** "AUP 페이지 날짜가 ○○로 바뀌어 있어. 페이지 내용은 Gate B 이슈에 붙였어. 비교해줘."

### 3-3. 위험 수용

시간: 5분 · **비용: 0원**

메모의 해당 문장(원문 그대로):

> "The owner signs a written risk acceptance in the checklist (`business/online/owner-setup.md`, section "위험 수용")."

메모 §1.3이 이 서명의 근거로 든 문장(원문 그대로):

> "**The AI's reading.** A third-party practice tool that neither administers a test nor feeds an official decision is *probably* outside. But "related to" is broad, and a grader for language-proficiency-style tasks is plausibly inside. "Probably outside" is not a pass. **This cannot be guaranteed.**"

메모에는 서명할 문장이 따로 적혀 있지 않아요. 아래 문장은 메모 §1.3의 내용을 옮긴 거예요. **읽고 동의할 때만** 서명해요.

> 나는 Anthropic 이용 정책의 고위험 항목(academic testing, language proficiency)이 이 연습 도구에 적용되는지 **확정되지 않았다**는 것을 이해해요. AI의 판단("아마 해당하지 않음")은 통과가 아니며 보장되지 않아요. Anthropic의 답이 없으면 "writing and speaking practice feedback"으로만 출시하고, 어떤 출력과 페이지에도 CLB·band·level·score 표현을 쓰지 않아요. 현재 정책 문구가 연습 도구를 분명히 포함하면 AI 피드백 기능을 출시하지 않아요. 이 위험은 내가 부담해요.
>
> 서명: ____________________  날짜: ____________

**서명하는 방법 (둘 중 하나)**

1. **Gate B 이슈에 댓글로:** 위 문장을 복사해 붙이고, 끝에 `서명: <법적 이름>, 날짜: 2026-10-18`처럼 써요. 댓글이 서면 기록이에요.
2. 또는 이 부분을 인쇄해 손으로 서명하고 사진을 개인 보관함에 두고, Gate B 이슈에는 `위험 수용 서명함 (날짜)`만 적어요.

> ✅ **이렇게 보이면 성공:** Gate B 이슈에 서명 댓글이 있어요.
>
> ⚠️ **자주 하는 실수:** 이해하지 못한 채 서명하는 것. 모르는 문장은 먼저 물어보세요.
>
> 💬 **막히면 Claude에게 이렇게 말하세요:** "위험 수용 문장을 더 쉽게 설명해줘. 서명하면 무엇을 약속하는 거야?"

---

## 4. 무료 계정 만들기 (한 과목씩)

순서대로 하면 편해요: 4-1 Cloudflare → 4-2 Google → 4-3 Resend → 4-5 Anthropic → (Service Canada 통화 뒤) 4-4 Stripe.
키는 만들자마자 GitHub 비밀 칸에 넣어요(방법은 5단계 "넣는 법"을 먼저 한 번 읽어 두세요).

### 4-1. Cloudflare: 사이트가 사는 곳

시간: 약 40분 · **비용: 0원** (Workers Free. 유료 "Workers Paid"로 올리지 않아요)

**무엇인가요?** 우리 사이트와 데이터베이스를 인터넷에 올려 주는 회사예요. 무료 요금제로 충분하게 코드를 맞춰 두었어요(메모 §7.2).

**① 가입 (10분)**

1. `https://dash.cloudflare.com/sign-up`을 열어요.
2. 사업용 Gmail과 새 비밀번호를 넣고 가입해요.
3. Cloudflare가 보낸 확인 메일의 링크를 눌러요.
4. 요금제를 고르라고 하면 **무료**(Free)를 골라요. **카드를 넣지 않아요.** 카드를 요구하는 화면이 나오면 멈추고 Claude에게 물어보세요 [미확인: 가입 때 카드 요구 여부].

**② 내 workers.dev 주소 정하기 (2분)**

1. 왼쪽 메뉴에서 "**Workers & Pages**"를 눌러요.
2. **"Your subdomain"** 옆의 "**Change**"를 누르고 짧은 영어 이름을 넣어요(예: `maplecoach`). 처음이면 서브도메인을 만들라는 화면이 먼저 나올 수 있어요 [미확인: 첫 화면 모양].
3. 이제 주소가 정해졌어요. **메모장에 적어 두세요(비밀 아님):**
   - 운영: `https://maple-practice-coach.<내 서브도메인>.workers.dev`
   - 스테이징: `https://maple-practice-coach-staging.<내 서브도메인>.workers.dev`
4. 이 주소는 Google, Stripe, Turnstile에 모두 들어가요. **한 번 정하면 바꾸지 않아요.**

**③ 계정 ID 복사 (2분)**

1. **"Workers & Pages"** 화면의 **"Account Details"** 부분에서 **"Account ID"** 옆의 복사 버튼을 눌러요. (또는 화면 위 "**Search**"에서 `Copy account ID`를 검색해요.)
2. GitHub 비밀 `CLOUDFLARE_ACCOUNT_ID`에 붙여 넣어요(5단계 방법).

**④ API 토큰 만들기 (10분)**

**API 토큰이란?** GitHub 워크플로가 내 Cloudflare 계정에서 일할 수 있게 해 주는 **긴 비밀번호**예요. 필요한 권한만 줘요.

1. 오른쪽 위 사람 아이콘 → **"My Profile"** → "**API Tokens**"를 열어요. (화면에 따라 **"Manage Account"** → "**API Tokens**"일 수 있어요.)
2. "**Create Token**"을 눌러요.
3. 템플릿 목록에서 **"Edit Cloudflare Workers"** 옆의 "**Use template**"을 눌러요 [미확인: 버튼 이름 — 템플릿 줄 오른쪽 버튼].
4. 권한(Permissions) 목록에 한 줄을 **더해요**: **"+ Add more"** [미확인: 버튼 이름 — 권한 목록 아래 추가 버튼] → 왼쪽 **"Account"**, 가운데 **"D1"**, 오른쪽 **"Edit"**. 왜? 6단계 워크플로가 데이터베이스(D1)를 만들어야 해서요.
5. "**Account Resources**"는 **"Include"** → 내 계정을 골라요. "**Zone Resources**"는 "**All zones**"로 둬요(도메인이 없어서 영향이 없어요) [미확인: 칸 이름].
6. **"Continue to summary"** → 요약을 보고 "**Create Token**"을 눌러요.
7. 토큰이 **한 번만** 보여요(보통 `cfut_`로 시작). 바로 복사해 GitHub 비밀 `CLOUDFLARE_API_TOKEN`에 붙여 넣어요.

**⑤ Turnstile 위젯 만들기 (5분)**

**Turnstile이란?** "로봇이 아닌지" 확인하는 무료 기능이에요. 로그인과 무료 체험을 봇이 남용하지 못하게 해요.

1. 왼쪽 메뉴에서 "**Turnstile**"을 열어요.
2. "**Add widget**"을 눌러요.
3. **"Widget name"**: `Maple Practice Coach`
4. **"Hostname management"**: 운영 주소의 호스트를 넣어요. `https://`와 끝의 `/` 없이, 예: `maple-practice-coach.maplecoach.workers.dev`. 스테이징은 자동으로 Cloudflare 시험용 키를 쓰니 넣지 않아도 돼요(넣어도 문제없어요).
5. **"Widget mode"**: **"Managed"**
6. "**Create**"를 눌러요.
7. 두 값이 나와요:
   - **Site key(사이트 키)** → GitHub **변수** `MPC_TURNSTILE_SITE_KEY` (비밀 아님, Claude에게 보여 줘도 돼요)
   - **Secret key(비밀 키)** → GitHub **비밀** `TURNSTILE_SECRET`

**⑥ (선택) Web Analytics (3분)** 방문 수를 보고 싶을 때만 해요. **"Analytics & Logs"** → **"Web Analytics"** → **"Add a site"** [미확인: 메뉴 이름] → workers.dev 주소 → 나온 토큰을 **변수** `MPC_CF_BEACON_TOKEN`에. 헷갈리면 건너뛰어요.

> ✅ **이렇게 보이면 성공:** 메모장에 두 주소가 있고, GitHub 비밀에 `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `TURNSTILE_SECRET`, 변수에 `MPC_TURNSTILE_SITE_KEY`가 있어요.
>
> ⚠️ **자주 하는 실수:**
> - "Workers Paid"(월 US$5)로 올리는 것. **올리지 않아요.** Claude가 필요하다고 말하기 전에는 무료로 둬요.
> - 토큰에 D1 권한을 빼먹는 것. 6단계가 "Authentication error"로 실패해요.
> - Turnstile 호스트에 `https://`까지 넣는 것.
> - Site key와 Secret key를 바꿔 넣는 것. 운영 배포 검사가 멈춰요.
>
> 💬 **막히면 Claude에게 이렇게 말하세요:** "Cloudflare API 토큰 만드는 화면에서 D1 권한 추가하는 곳을 못 찾겠어. 지금 보이는 버튼은 ○○야."

### 4-2. Google Cloud: "Google로 계속하기" 로그인 설정

시간: 약 40분 · **비용: 0원** (결제 계정·카드를 넣지 않아요)

**무엇인가요?** 학습자는 **"Continue with Google"** 버튼으로 로그인해요. 우리 사이트가 Google에 "이 사람의 이메일 주소를 확인해 주세요"라고 부탁하려면 Google에 앱을 등록해야 해요. 이메일을 보낼 도메인이 없어서 이 방법을 써요(메모 §7.2).

**이 수업의 화면 이름은 모두 [미확인]이에요.** Google 문서 사이트에 들어갈 수 없어서 다른 프로젝트의 기록(2차 자료)으로 적었어요. 이름이 조금 달라도 뜻이 같은 메뉴를 찾으세요.

**① 프로젝트 만들기 (8분)**

1. 사업용 Gmail로 로그인한 브라우저에서 `https://console.cloud.google.com`을 열어요.
2. 나라는 **Canada**, 약관에 동의해요.
3. **결제 계정(billing account)이나 카드를 요구하면 넣지 마세요.** 멈추고 Claude에게 화면 설명을 보내요.
4. 왼쪽 위 **"Google Cloud"** 로고 옆 프로젝트 선택 → **"New project"** → 이름 `maple-practice-coach` → **"Create"** [미확인].
5. 위쪽에 새 프로젝트 이름이 보이도록 선택해요.

**② 브랜딩 (동의 화면) (10분)**

1. 위쪽 검색창에 `Google Auth Platform`을 쳐서 열어요(예전 이름: "APIs & Services" → "OAuth consent screen") [미확인].
2. "**Get started**"가 보이면 눌러요 [미확인].
3. **"Branding"** [미확인]에 이렇게 넣어요:
   - App name: `Maple Practice Coach`
   - User support email: 사업용 Gmail
   - App home page: 운영 주소 (예: `https://maple-practice-coach.maplecoach.workers.dev`)
   - App privacy policy link: `<운영 주소>/legal/privacy/`
   - App terms of service link: `<운영 주소>/legal/terms/`
   - Authorized domains: `<내 서브도메인>.workers.dev` (앞의 `maple-practice-coach.`는 빼요. 예: `maplecoach.workers.dev`)
   - Developer contact: 사업용 Gmail
4. **로고는 올리지 않아요.** 로고를 올리면 Google 심사로 넘어가요.
5. "**Save**"를 눌러요.

**③ 대상 (Audience) (3분)**

1. 왼쪽 **"Audience"** [미확인] → User type: **"External"**(Google 계정이 있는 누구나).
2. **"Publishing status"** [미확인]에서 **"Publish app"** → "**Confirm**"을 눌러 "**In production**"이 되게 해요. 이메일 주소만 요청하니 보통 심사가 필요 없어요(2차 자료). 심사 준비 화면이 나오면 멈추고 알려 주세요.

**④ 권한 범위 (Data Access) (3분)**

1. 왼쪽 **"Data Access"** → **"Add or remove scopes"** [미확인].
2. `openid`와 **`.../auth/userinfo.email`**(설명: "See your primary Google Account email address") **두 개만** 체크해요.
3. **"Update"** → **"Save"** [미확인].

왜 두 개만? 우리 개인정보 처리방침이 "이메일 주소와 Google 계정 ID만 받는다"고 약속해요. 더 받으면 약속을 어겨요.

**⑤ 클라이언트 만들기 (5분)**

1. 왼쪽 **"Clients"** → **"Create client"** [미확인].
2. Application type: **"Web application"**, Name: `MPC web`.
3. "**Authorized redirect URIs**"에 "**Add URI**"를 두 번 눌러 정확히 이렇게 넣어요(끝에 `/` 없이):
   - `<운영 주소>/api/auth/google/callback`
   - `<스테이징 주소>/api/auth/google/callback`
4. "**Create**"를 눌러요.

**⑥ 두 값 저장하기 (3분)**

1. 창에 **Client ID**(끝이 `.apps.googleusercontent.com`)와 **Client secret**이 나와요.
2. **Client ID** → GitHub **변수** `MPC_GOOGLE_CLIENT_ID` (비밀 아님)
3. **Client secret** → GitHub **비밀** `GOOGLE_CLIENT_SECRET` (비밀번호처럼 다뤄요. 보통 `GOCSPX-`로 시작해요)
4. 비밀은 **한 번만** 전체가 보일 수 있어요(2차 자료). 잃어버리면 그 클라이언트 화면에서 새 비밀을 만들어요 [미확인].

> ✅ **이렇게 보이면 성공:** 클라이언트 목록에 `MPC web`이 있고, 상태가 "In production"이에요. GitHub에 `MPC_GOOGLE_CLIENT_ID`(변수)와 `GOOGLE_CLIENT_SECRET`(비밀)이 있어요. 실제 로그인 확인은 7단계에서 해요. Google 쪽 변경은 적용까지 5분에서 몇 시간 걸릴 수 있어요(2차 자료).
>
> ⚠️ **자주 하는 실수:**
> - Client secret을 **변수** 칸에 넣는 것. 변수는 잠기지 않아서 그대로 보여요. 배포 검사가 이걸 발견하면 멈추고 "비밀을 새로 만들라"고 해요.
> - 리디렉션 주소의 글자 하나라도 다른 것. 로그인할 때 "Error 400: redirect_uri_mismatch"가 나요.
> - 결제 계정을 만드는 것. 필요 없어요.
>
> 💬 **막히면 Claude에게 이렇게 말하세요:** "Google Cloud에서 Authorized domains에 workers.dev 주소를 넣었더니 오류가 나. 오류 문장은 ○○야."

### 4-3. Resend: 오너에게 오는 알림 메일

시간: 약 10분 · **비용: 0원**

**무엇인가요?** 사이트에 문제가 생기거나(예: 크레딧 부족, 환불 실패) 지원 문의가 오면 **오너에게** 이메일을 보내 주는 서비스예요. 학습자에게는 이메일을 보내지 않아요.

1. `https://resend.com`에서 **반드시 사업용 Gmail**(= `MPC_OWNER_EMAIL`로 쓸 주소)으로 가입해요.
   - 왜? 무료 발신 주소 `onboarding@resend.dev`는 **Resend 가입 주소로만** 메일을 보낼 수 있어요. 다른 주소로는 가지 않아요.
2. **"Add domain"(도메인 추가)은 건너뛰어요.** 도메인이 없어요.
3. 왼쪽 **"API Keys"** → **"Create API Key"** → 이름 `mpc-alerts` → 권한 **"Sending access"** → 만들기 버튼 [미확인: 버튼 이름 — "Add" 또는 "Create"].
4. 키(보통 `re_`로 시작)를 바로 복사해 GitHub **비밀** `RESEND_API_KEY`에 넣어요.
5. 변수 `MPC_FROM_EMAIL`은 **넣지 않아도 돼요.** 비워 두면 `Maple Practice Coach <onboarding@resend.dev>`로 보내요.

**알림이 스팸함에 빠지지 않게 (첫 알림을 받은 뒤, 5분)**

1. Gmail 검색창에 `from:onboarding@resend.dev`를 쳐요.
2. 검색창 오른쪽의 옵션 아이콘 → **"Create filter"** → "**Never send it to Spam**"과 라벨(예: `MPC alerts`) 체크 → **"Create filter"** [미확인: Gmail 메뉴 이름].
3. 스팸함에 있으면 "**Not spam**"을 눌러요.

> ✅ **이렇게 보이면 성공:** Resend에 가입한 주소가 사업용 Gmail이고, GitHub 비밀에 `RESEND_API_KEY`가 있어요.
>
> ⚠️ **자주 하는 실수:** 개인 이메일로 Resend에 가입하는 것. 그러면 알림이 사업용 Gmail로 오지 않아요.
>
> 💬 **막히면 Claude에게 이렇게 말하세요:** "알림 메일이 안 와. Resend 가입 주소와 MPC_OWNER_EMAIL이 같은지 어떻게 확인해?"

### 4-4. Stripe Canada: 카드 결제

시간: 약 60–90분 · **비용: 0원** (월 요금 없음. 판매할 때만 수수료, 2차 자료)

**EI를 받는다면 Service Canada 통화(3-1) 뒤에만** 시작해요.

**무엇인가요?** 학습자가 이용권을 카드로 사면 Stripe가 돈을 받아 내 은행 계좌로 보내 줘요. **시험 모드**(가짜 카드로 연습하는 모드)가 있어서, 진짜 돈 없이 먼저 시험해요. **실사용 키는 출시할 때(8-4)만** 넣어요.

**이 수업의 Stripe 화면 이름은 모두 [미확인]이에요.** Stripe 대시보드는 자주 바뀌어요. "Developers" 메뉴가 "Workbench"로 바뀌어 있을 수도 있어요.

**① 계정 열기 (30–45분)**

1. `https://stripe.com`에서 사업용 Gmail로 가입해요. 나라는 **Canada**.
2. 사업 형태를 물으면 **개인사업자**(Individual / Sole proprietor)를 골라요 [미확인: 선택지 이름].
3. 본인 인증, SIN, 은행 계좌를 넣어요. **이 정보는 Stripe에만** 넣고 다른 곳에 적지 않아요.
4. 사업 이름을 묻는 칸에는 **법적 이름**을 써요(판매자는 오너 개인이에요, 메모 §7.2). 웹사이트는 운영 주소, 설명은 `Online English writing and speaking practice feedback` 정도로 써요.
5. 유료 부가 기능(Stripe Tax, Billing, Invoicing)은 **켜지 않아요.**

**② 학습자에게 가는 Stripe 이메일 끄기: Customer emails OFF (2분)**

우리 개인정보 처리방침은 "학습자에게 이메일을 보내지 않는다"고 약속해요. 영수증은 계정 페이지의 **"View receipt"** 링크로 봐요.

1. **"Settings"** → **"Customer emails"** [미확인: 메뉴 이름 — "Emails" 또는 "Customer emails"가 들어간 설정].
2. **"Successful payments"**(결제 성공)와 **"Refunds"**(환불) 이메일을 **꺼요(OFF)**.

**③ 카드만 받기: Link와 후불 결제 끄기 (3분)**

1. **"Settings"** → **"Payment methods"** [미확인: 메뉴 이름].
2. **Link**와 후불 결제(**Klarna, Afterpay/Clearpay, Affirm** 등)를 **꺼요.**
3. 왜? 코드도 카드만 요청하지만, 카드가 아닌 결제는 발행 국가를 확인할 수 없어서 **자동 환불**되고 수수료를 잃어요. 그런 일이 생기면 `[MPC] Non-card payment refunded` 알림이 와요.

**④ 시험 모드 키 만들기 (스테이징용, 10분)**

1. 화면 위의 **"Test mode"**(또는 "Sandbox") 스위치를 켜요 [미확인].
2. **"Developers"** → **"API keys"** → **"Create restricted key"** [미확인]. **제한 키**(restricted key)는 필요한 권한만 가진 키예요. 새어 나가도 할 수 있는 일이 적어서 더 안전해요.
3. 이름 `mpc-staging`. 권한은 이렇게만 줘요 [미확인: 권한 이름]:
   - **Checkout Sessions: Write**
   - **PaymentIntents: Read**
   - **Charges: Read**
   - **Refunds: Write**
   - 나머지는 **None**
4. 만든 키(`rk_test_`로 시작)를 GitHub **비밀** `STRIPE_TEST_SECRET_KEY`에 넣어요.

**⑤ 시험 모드 웹훅 만들기 (스테이징용, 10분)**

**웹훅이란?** 결제가 끝나면 Stripe가 우리 Worker에 "결제 완료!"라고 자동으로 알리는 연락이에요.

1. 시험 모드에서 **"Developers"** → **"Webhooks"** → **"Add endpoint"**(또는 "Add destination") [미확인].
2. Endpoint URL: `<스테이징 주소>/api/stripe/webhook`
3. **API version**은 `2026-08-26.dahlia`를 골라요. 코드와 같아야 내용 형식이 맞아요.
4. 이벤트는 **정확히 5개**:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `charge.refunded`
   - `charge.dispute.created`
   - `refund.failed`
5. 저장한 뒤 **Signing secret**(보통 `whsec_`로 시작)을 보이게 해서 복사해 GitHub **비밀** `STRIPE_TEST_WEBHOOK_SECRET`에 넣어요. 이 비밀로 Worker가 "이 연락이 정말 Stripe에서 왔는지" 확인해요.

**⑥ 실사용 키는 지금 만들지 않아요.** 출시할 때(8-4) 같은 방법으로 **실사용 모드**에서 키와 운영 웹훅을 만들어요.

> ✅ **이렇게 보이면 성공:** GitHub 비밀에 `STRIPE_TEST_SECRET_KEY`와 `STRIPE_TEST_WEBHOOK_SECRET`이 있어요. Stripe 설정에서 Customer emails가 꺼져 있고, Link와 후불 결제가 꺼져 있어요.
>
> ⚠️ **자주 하는 실수:**
> - 시험 모드가 아닌 곳(실사용)에서 스테이징 키를 만드는 것. 스테이징은 **시험 키만** 받아요(실사용 키를 넣으면 배포가 멈춰요).
> - 웹훅 이벤트를 4개만 고르거나, API 버전을 기본값으로 두는 것.
> - "Secret key"(전체 권한 키)를 쓰는 것. **Restricted key**(제한 키)를 써요.
>
> 💬 **막히면 Claude에게 이렇게 말하세요:** "Stripe에서 restricted key 권한 목록에 Checkout Sessions가 안 보여. 지금 보이는 이름은 ○○, ○○야."

### 4-5. Anthropic Console: AI 피드백의 키와 크레딧

시간: 약 30분 · **비용: 약 US$10 (약 C$13.70) — 이 안내서에서 유일한 필수 지출.** 자동 충전은 **꺼요(OFF).**

**무엇인가요?** 사이트가 학습자의 글에 AI 피드백을 줄 때 Anthropic의 Claude API를 써요. API는 **선불**이라 크레딧을 먼저 사야 돌아요. 자동 충전을 끄면 **산 금액 이상으로는 절대 청구되지 않아요.**

**이 수업의 Console 화면 이름은 2차 자료예요 [미확인].**

**① 계정 만들기 (10분)**

1. `https://platform.claude.com`에서 사업용 Gmail로 가입해요.
2. 조직과 사용 목적을 물으면 한 문장으로 사실대로 써요: `Website giving AI practice feedback on English writing and speaking for adult learners; no test scores.`
3. 사기 전에 **"Settings"** → "**Billing**"에서 무료 크레딧이 이미 있는지 봐요. 있으면 사지 말고 Claude에게 금액을 알려 주세요.

**② 크레딧 사기 (5분)**

1. **"Settings"** → **"Billing"** → **"Buy credits"**.
2. **가장 작은 금액**을 넣어요. 화면 안내로는 잔액이 최소 US$5가 되어야 해요(2차 자료). **US$10을 권해요.**
3. **"Auto-reload"(자동 충전)가 꺼져 있는지(OFF)** 꼭 확인해요.
4. 알아 둘 것: 크레딧은 **환불되지 않고**, 산 뒤 **1년이 지나면 사라져요**(2차 자료). 세금이 붙을 수 있어요 [미확인].

**③ 작업 공간(workspace)과 한도 (5분)**

**작업 공간이란?** 키와 한도를 묶어 두는 **칸막이**예요. "Default"(기본) 칸에는 한도를 걸 수 없어서(2차 자료) 새로 만들어요.

1. **"Settings"** → **"Workspaces"** → 새 작업 공간 `production`을 만들어요 [미확인].
2. 그 작업 공간의 **월 사용 한도**(monthly spend limit)를 산 크레딧과 같게 해요(예: **US$10**). 메뉴는 **"Settings"** → **"Limits"** 또는 **"Billing"** 중 하나에 있어요 [미확인: 두 곳 다 봐요]. 알림 이메일 칸이 있으면 사업용 Gmail을 넣어요.
3. **(선택, 하지만 권장)** 작업 공간 `eval`을 하나 더 만들고 한도 **US$5**로 해요. 스테이징 사이트와 품질 점검("Grading eval")이 이 칸의 키를 써요. 없으면 7단계에서 **스테이징의 AI 피드백이 동작하지 않아요**(보안상 스테이징은 운영 키를 절대 받지 않아요). 같은 크레딧에서 쓰니 **추가 비용은 없어요.**

**④ API 키 만들기 (5분)**

1. **"Settings"** → **"API keys"** → **"Create key"** [미확인].
2. 작업 공간 **production**, 이름 `mpc-production` → 만들기. 키(`sk-ant-`로 시작)가 **한 번만** 보여요. 바로 GitHub **비밀** `ANTHROPIC_API_KEY`에 넣어요.
3. (eval을 만들었으면) 작업 공간 **eval**, 이름 `mpc-eval` → GitHub **비밀** `ANTHROPIC_EVAL_API_KEY`.

**⑤ Claude에게 금액 알려 주기 (2분)**

크레딧 금액과 한도는 **비밀이 아니에요.** Claude에게 이렇게 말해요:

> "크레딧 US$10 샀어. 오늘 날짜로. production 한도 US$10, eval 한도 US$5야."

Claude가 `ops/config/anthropic-limit.json`의 `prepaidUsd`, `prepaidSince`, `monthlyLimitUsd`, `evalMonthlyLimitUsd`, `confirmedByOwner`를 고치는 PR을 만들어요. **오너가 직접 병합**해요(2-2). 그러면 사이트가 스스로 지출을 세서, 크레딧의 **70%를** 쓰면 무료 체험을 끄고, **50%와 80%에서** 오너에게 알리고, **97%에서** AI 피드백을 잠시 멈춰요(도중에 실패하지 않게).

**⑥ AI 모델 고르기 (오너의 결정, 1분)**

기본은 `claude-opus-5`예요. 더 싼 `claude-sonnet-5`로 바꿀 수도 있어요. Claude는 비용 때문에 몰래 바꾸지 않아요. **오너가 정해요.**

| 모델 | 피드백 1회 비용 (추정) | 무료 체험 예산 US$5로 받을 수 있는 사람 (추정) | 품질 |
|---|---|---|---|
| `claude-opus-5` (기본) | 약 US$0.043–0.054 | 약 46명 | 가장 좋다고 안내돼요 |
| `claude-sonnet-5` | 약 US$0.017–0.022 | 약 113명 | 이 제품에서는 아직 재 보지 않았어요 |

- 그대로 두려면 아무것도 하지 않아요. 또는 Claude에게 **"Opus 5 유지"**.
- 바꾸려면 Claude에게 "**Sonnet 5로 바꿔 줘**"라고 하거나, GitHub **변수** `MPC_GRADER_MODEL`에 `claude-sonnet-5`를 넣고 다시 배포해요.
- 두 모델을 같은 문제로 비교해 보고 싶으면 7단계에서 "Grading eval"을 `compare` 체크로 한 번 돌려요(비용 약 2배, 추정).

> ✅ **이렇게 보이면 성공:** Console의 Billing에 잔액이 보이고 Auto-reload가 꺼져 있어요. GitHub 비밀에 `ANTHROPIC_API_KEY`(와 선택으로 `ANTHROPIC_EVAL_API_KEY`)가 있어요. 금액 PR을 병합했어요.
>
> ⚠️ **자주 하는 실수:**
> - "Default" 작업 공간에서 키를 만드는 것. 한도를 걸 수 없어요.
> - 자동 충전을 켜 두는 것. 산 금액보다 많이 청구될 수 있어요.
> - 이 대화창(Claude) 요금제와 Console 크레딧을 헷갈리는 것. **서로 다른 결제**예요.
>
> 💬 **막히면 Claude에게 이렇게 말하세요:** "Anthropic Console에서 작업 공간 한도 설정 메뉴를 못 찾겠어. Settings 아래에 보이는 메뉴는 ○○, ○○야."

Console 계정이 생겼으니 이제 **3-2의 Gate B 이메일**을 보내요.

---

## 5. GitHub에 비밀과 변수 넣기

시간: 약 30분 · **비용: 0원**

**변수와 비밀의 차이:** **변수**(Variables)는 화면과 실행 기록에 그대로 보이는 설정(예: 사이트 주소), **비밀**(Secrets)은 저장하면 **다시 볼 수 없게 잠기는** 값(예: 키)이에요. 워크플로는 이름으로 값을 찾아서, **이름이 한 글자라도 틀리면** 못 찾아요.

### 5-1. 넣는 법

**비밀 넣기**

1. 저장소 → **"Settings"**(저장소 위쪽 메뉴).
2. 왼쪽 **"Security"** 부분의 **"Secrets and variables"** → **"Actions"**.
3. **"Secrets"** 탭 → **"New repository secret"**.
4. **"Name"**: 아래 표의 이름을 **정확히** 써요(대문자, 숫자, 밑줄만. 띄어쓰기 없이).
5. **"Secret"**: 값을 붙여 넣어요. 앞뒤에 빈칸이나 줄바꿈이 없게 해요.
6. "**Add secret**"을 눌러요.

**변수 넣기**

1. 같은 화면에서 **"Variables"** 탭 → **"New repository variable"**.
2. "**Name**"과 "**Value**"를 넣고 "**Add variable**"을 눌러요.
3. 변수는 **잠기지 않는 값**이에요(화면과 실행 기록에 그대로 보여요). 키나 비밀번호를 절대 넣지 않아요.

**값 바꾸기:** 목록에서 그 이름 옆의 연필 아이콘(또는 "Update")을 눌러요 [미확인: 아이콘 모양]. 변수나 비밀을 바꾼 뒤에는 **다시 배포해야** 사이트에 반영돼요.

### 5-2. 비밀(Secrets) 표

| 이름 | 어디서 와요 | 필수? | 종류 |
|---|---|---|---|
| `CLOUDFLARE_API_TOKEN` | 4-1 ④ Cloudflare API 토큰 | **필수** | 비밀 |
| `CLOUDFLARE_ACCOUNT_ID` | 4-1 ③ Cloudflare 계정 ID | **필수** | 비밀 |
| `TURNSTILE_SECRET` | 4-1 ⑤ Turnstile Secret key | **필수(운영)** | 비밀 |
| `GOOGLE_CLIENT_SECRET` | 4-2 ⑥ Google Client secret | **필수(운영)** | 비밀 |
| `RESEND_API_KEY` | 4-3 Resend API 키 | **필수**(없으면 오너 알림이 안 와요) | 비밀 |
| `HASH_SALT` | 오너가 직접 만드는 긴 무작위 글자(아래 5-4) | **필수(첫 운영 배포)** | 비밀 |
| `ANTHROPIC_API_KEY` | 4-5 ④ production 작업 공간 키 | **필수**(AI 피드백) | 비밀 |
| `ANTHROPIC_EVAL_API_KEY` | 4-5 ④ eval 작업 공간 키 | 선택(권장: 스테이징 점검에 필요) | 비밀 |
| `STRIPE_TEST_SECRET_KEY` | 4-4 ④ 시험 모드 제한 키 | 스테이징 결제 점검에 필요 | 비밀 |
| `STRIPE_TEST_WEBHOOK_SECRET` | 4-4 ⑤ 시험 모드 웹훅 signing secret | 스테이징 결제 점검에 필요 | 비밀 |
| `STRIPE_SECRET_KEY` | 8-4 실사용 모드 제한 키 | 결제를 켤 때(8단계) | 비밀 |
| `STRIPE_WEBHOOK_SECRET` | 8-4 실사용 모드 웹훅 signing secret | 결제를 켤 때(8단계) | 비밀 |

### 5-3. 변수(Variables) 표

| 이름 | 값 / 어디서 와요 | 필수? | 종류 |
|---|---|---|---|
| `MPC_SITE_URL` | 운영 주소 (4-1 ②). `https://`로 시작, 끝에 `/` 없이 | **필수** | 변수 |
| `MPC_STAGING_SITE_URL` | 스테이징 주소 (4-1 ②) | **필수(스테이징)** | 변수 |
| `MPC_OWNER_EMAIL` | 사업용 Gmail = **Resend 가입 주소** | **필수** | 변수 |
| `MPC_LEGAL_NAME` | 정부 신분증에 있는 **법적 이름**. 사이트에 "Maple Practice Coach is sold by <이름>, a sole proprietor in Ontario"로 공개돼요 | **필수(운영)** | 변수 |
| `MPC_GOOGLE_CLIENT_ID` | 4-2 ⑥ Client ID | **필수(운영)** | 변수 |
| `MPC_TURNSTILE_SITE_KEY` | 4-1 ⑤ Site key | **필수(운영)** | 변수 |
| `MPC_DEPLOY` | `true` — **8단계에서** 넣어요. 운영 배포 스위치예요 | 운영 배포에 필수 | 변수 |
| `MPC_STAGING_ALLOWED_EMAILS` | 스테이징에 로그인할 수 있는 이메일(쉼표로 구분). 비우면 `MPC_OWNER_EMAIL` 하나만 | 선택 | 변수 |
| `MPC_MAILING_ADDRESS` | 우편 주소. 넣으면 개인정보 처리방침에 **공개**돼요. 비우면 지원 양식으로 안내해요(9-10) | 선택 | 변수 |
| `MPC_SUPPORT_EMAIL` | 사이트에 공개할 지원 이메일. 비우면 로그인한 사람만 쓰는 지원 양식 | 선택 | 변수 |
| `MPC_GRADER_MODEL` | `claude-sonnet-5`로 바꿀 때만 (4-5 ⑥). 비우면 `claude-opus-5` | 선택 | 변수 |
| `MPC_CF_BEACON_TOKEN` | 4-1 ⑥ Web Analytics 토큰 | 선택 | 변수 |
| `MPC_FROM_EMAIL` | **비워 두세요.** 비우면 Resend 무료 발신 주소 | 선택 | 변수 |
| `MPC_MAGIC_LINK` | **비워 두세요.** 이메일 로그인 링크는 오너 전용(`owner`) | 선택 | 변수 |
| `MPC_LEARNER_EMAIL` | **비워 두세요.** 학습자 이메일 끔(`off`) | 선택 | 변수 |
| `MPC_GRADER_EFFORT`, `MPC_GRADER_MAX_TOKENS` | **비워 두세요.** 품질 점검 뒤 Claude가 제안할 때만 | 선택 | 변수 |
| `MPC_INDEXNOW_KEY` | **비워 두세요.** 검색엔진에 새 페이지를 알릴 때 쓰는 키인데, 배포할 때 자동으로 만들어요 | 선택 | 변수 |
| `MPC_EVAL_LIMIT`, `MPC_EVAL_PR_LIMIT`, `MPC_EVAL_BUDGET_USD` | **비워 두세요.** 품질 점검의 표본 수(기본 5)와 1회 예산(기본 US$5) | 선택 | 변수 |

**Claude에게 보내도 되는 값:** 두 주소, Client ID, Turnstile Site key, 법적 이름을 넣었는지 여부. **보내면 안 되는 값:** 비밀 표의 모든 값.

### 5-4. `HASH_SALT` 만들기 (3분)

**무엇인가요?** 이메일이나 IP 주소를 그대로 저장하지 않고 **알아볼 수 없게 섞을 때** 쓰는 긴 무작위 글자예요. 로그인 비밀번호가 아니에요.

1. 쓰는 비밀번호 관리자(Google 비밀번호 관리자, iCloud 키체인, Bitwarden 등)가 있으면 "**비밀번호 생성**"으로 **32자 이상**을 만들어요.
2. 없으면 서로 관계없는 긴 문장 두 개에 숫자를 섞어 **40자 이상** 써요(예시를 그대로 쓰지 마세요).
3. GitHub **비밀** `HASH_SALT`에 넣어요. 어디에도 따로 적어 둘 필요 없어요.
4. **한 번 정하면 절대 바꾸지 않아요.** 바꾸면 모든 로그인이 끊기고 "이메일당 한 번" 환불 규칙이 예전 기록과 맞지 않게 돼요.

> ✅ **이렇게 보이면 성공:** "Secrets" 탭과 "Variables" 탭에 위 표의 이름이 보여요(비밀은 값이 안 보이는 게 정상이에요).
>
> ⚠️ **자주 하는 실수:**
> - 비밀을 변수 칸에 넣는 것(특히 Google Client secret).
> - 이름 오타(`MPC_SITE_URL`을 `MPC_SITE_URl`로). 배포 검사가 "없다"고 해요.
> - 주소 끝에 `/`를 붙이거나 `https://`를 빼는 것.
>
> 💬 **막히면 Claude에게 이렇게 말하세요:** "GitHub에 넣은 비밀과 변수 **이름 목록**이 맞는지 봐줘: (이름만 나열)." (값은 절대 붙이지 않아요.)

---

## 6. "Set up Cloudflare (one time)" 실행 후 결과를 Claude에게 보내기

시간: 약 15분 · **비용: 0원**

**무엇을 하나요?** 이 워크플로가 Cloudflare에 **데이터베이스**(D1)와 **스위치 저장소**(KV)를 운영용·스테이징용으로 하나씩 만들고, 데이터베이스 안의 표(테이블)도 만들어요. 오너는 버튼만 누르면 돼요. 터미널(검은 명령 창)은 필요 없어요.

**필요한 것:** 비밀 `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` (4-1). 토큰에 **D1 Edit** 권한이 있어야 해요(4-1 ④).

1. 저장소 → **"Actions"** 탭.
2. 왼쪽 목록에서 "**Set up Cloudflare (one time)**"를 눌러요.
3. 오른쪽 **"Run workflow"** 버튼을 눌러요.
4. 브랜치는 **`master`** 그대로, `target`은 **`both`**(운영과 스테이징 둘 다, 기본값)를 골라요.
5. 초록색 "**Run workflow**"를 눌러요.
6. 잠시 뒤 목록 맨 위에 새 실행이 생겨요. 그 이름을 눌러 **요약(Summary)** 화면을 열어요. 제목이 "**Set up Cloudflare (one time): 완료**"이면 잘된 거예요.
7. 요약의 **회색 상자** 안의 글을 **처음부터 끝까지 전부** 복사해요. 첫 줄이 `클라우드플레어 설정 결과야`예요(이미 들어 있어서 따로 쓰지 않아도 돼요).
8. Claude 대화창에 그대로 붙여 넣고 보내요. 이렇게 생겼어요:

   > 클라우드플레어 설정 결과야
   > workflow: Set up Cloudflare (one time), …
   > [production] Worker maple-practice-coach
   > D1 database: name=mpc database_id=…
   > (이어지는 줄 모두)

   이 ID들은 **비밀이 아니에요.** API 토큰은 이 화면 어디에도 나오지 않아요.
9. Claude가 ID를 설정 파일(`products/clb/worker/wrangler.jsonc`)에 넣는 PR을 만들어요. "**합쳐줘**"라고 하거나 직접 병합해요(2-2).

> ✅ **이렇게 보이면 성공:** 실행 옆에 초록색 체크(✓)가 있고, 요약 제목이 "완료"예요. 상자에 `[production]`과 `[staging]` 두 부분이 있어요. Claude의 PR이 병합됐어요.
>
> ⚠️ **자주 하는 실수:**
> - 요약 대신 로그(작업 이름을 눌렀을 때 나오는 긴 글)에서 ID를 찾는 것. **요약 화면**을 봐요.
> - 상자의 일부만 복사하는 것. **전부** 복사해요.
> - 제목이 "**끝나지 않았어요**"이면 상자 안에 `FAILED:` 줄이 있어요. 그래도 **상자 전체를 그대로** Claude에게 보내요. 가장 흔한 이유는 토큰에 D1 권한이 없는 거예요(4-1 ④).
> - "(one time)"은 보통 한 번이면 된다는 뜻이에요. 실패해서 고친 뒤 **다시 돌려도 안전해요**(있는 것은 다시 쓰고, 두 번 만들지 않아요).
>
> 💬 **막히면 Claude에게 이렇게 말하세요:** "Set up Cloudflare (one time) 요약 화면을 못 찾겠어. 실행 링크는 (주소창의 링크)야." (실행 링크는 보내도 돼요.)

나중에 배포 검사가 "…has no D1 database_id for DB yet…"라고 하면, 이 6단계의 PR이 아직 병합되지 않은 거예요.

**미리 알아 두기:** Cloudflare 비밀을 넣은 뒤부터 운영 배포(8단계) 전까지는 매일 도는 "**Daily metrics**"가 실패하고 "Metrics export failed"나 "Metrics snapshot missing" 이슈를 열 수 있어요. 사이트가 아직 지표를 쓰지 않아서 생기는 **정상**이에요. 실패 알림 이메일이 오는지 확인하는 기회로 써요(7-2의 B11). 운영 배포 다음 날 초록색이 되면 그 이슈를 닫아요.

---

## 7. 스테이징 배포와 B단계 점검

시간: 약 1.5–2시간 · **비용: 0원** (단, 스테이징의 AI 피드백과 품질 점검이 **크레딧을 약 US$1–5** 써요, 추정) · **마감: 10월 18일(일)**

**왜 하나요?** 진짜 사이트를 열기 전에, **오너만 들어갈 수 있는 시험용 사이트**(스테이징)에서 로그인, 결제, 환불, 말하기 녹음, 되돌리기(롤백)가 모두 되는지 확인해요. 메모는 21일차까지 "모든 B단계 점검이 초록색"이기를 요구해요(메모 §6 W3, §7.1).

**스테이징은 잠겨 있어요:** 허용된 이메일(`MPC_STAGING_ALLOWED_EMAILS`, 비우면 `MPC_OWNER_EMAIL`)만 로그인할 수 있고, 로그인하지 않은 AI 피드백은 꺼져 있어요. 운영용 Anthropic 키와 Stripe 실사용 키는 절대 받지 않아요. 보내는 알림 메일 이름 앞에 `STAGING - `가 붙어요.

### 7-1. 스테이징에 배포하기 (10분)

1. **"Actions"** → **"Deploy practice coach"** → **"Run workflow"**.
2. **`target`**: **`staging`**, **`rollback_drill`**: 체크하지 않음 → **"Run workflow"**.
3. 실행을 눌러 결과를 봐요.

> ✅ **이렇게 보이면 성공:** 초록색 ✓. 요약이나 경고 목록에 **"PLACEHOLDER Anthropic key"** 경고가 **없어요**. 스테이징 주소를 열면 사이트가 보여요.
>
> ⚠️ **자주 하는 실수:** "PLACEHOLDER Anthropic key" 경고가 있으면 `ANTHROPIC_EVAL_API_KEY`가 없는 거예요(4-5 ③④). 스테이징 AI 피드백이 모두 실패해요.
>
> 💬 **막히면 Claude에게 이렇게 말하세요:** "스테이징 배포가 실패했어. 실행 링크는 ○○야. 오류 문장은 ○○야." (오류 문장에는 비밀 값이 나오지 않아요. 복사해도 돼요.)

### 7-2. 자동 점검 (30분, 대부분 기다리는 시간)

| 메모 | 무엇을 | 어떻게 | 통과 기준 |
|---|---|---|---|
| B0 | 스테이징 배포 | 7-1 | 배포와 점검(스모크 테스트)이 초록색 |
| B1, B3 | 모바일 속도(Lighthouse라는 속도 측정 도구), 프롬프트 캐시(같은 지시문을 다시 보낼 때 싸게 처리되는지) | **"Actions"** → **"Level-B checks"** → **"Run workflow"** → `target`: `staging` (`cache_check`는 기본으로 켜져 있음) | `checks`와 `lighthouse` 작업이 모두 초록색. Lighthouse 모바일 성능 중앙값 85 이상. 유료 호출 2번(약 US$0.05–0.15, 추정) |
| B12 | AI 피드백 품질 점검 | **"Actions"** → **"Grading eval"** → **"Run workflow"** (칸은 모두 비워 둬요: 표본 5개, 예산 US$5) | 초록색 한 번 이상. 비용 보통 약 US$1–4 (추정). 결과를 Claude에게 "eval 결과 설명해줘"라고 물어봐요 |
| B16 | 홈서비스 사이트가 그대로인지 | **"CI"** (PR마다 자동) | 최근 PR의 CI가 초록색 |
| B8 | Stripe와 데이터베이스 대조 | **"Reconcile payments"** (매일 자동) | 출시 전에는 실사용 키가 없어서 "건너뜀" 안내가 정상이에요. 진짜 확인은 8-6 |
| B11 | 매일 지표가 없으면 알림 | **"Daily metrics"** (매일 자동) + 1-4의 실패 알림 이메일 | 운영 배포(8단계) 전에는 지표가 없어서, 이 워크플로가 실패하고 "Metrics snapshot missing"이나 "Metrics export failed" 이슈를 여는 게 **정상**이에요. 그 이슈와 실패 알림 이메일이 오면 "없으면 알림"이 동작하는 거예요(통과). 운영 배포 뒤에는 초록색이어야 해요 |

### 7-3. 수동 점검 (약 1시간)

**준비**

1. 스테이징 배포가 초록색이에요(7-1).
2. Stripe **시험 모드**에 스테이징 웹훅이 있어요(4-4 ⑤).
3. 스테이징 결제를 켜요: **"Actions"** → **"Set a kill switch"** → **"Run workflow"** → `flag`: `checkout_enabled`, `value`: `true`, `target`: `staging`.
4. 시험용 카드 번호는 Stripe 문서의 **캐나다 발행 시험 카드**를 써요 [미확인: 카드 번호 — Stripe 문서에서 "Canada" 시험 카드를 찾아요]. 분쟁(dispute) 시험 카드도 Stripe 문서에서 찾아요 [미확인].

**순서 (이 순서대로 해요: 말하기 피드백에는 이용권이 필요하고, 셀프 환불은 이용권을 끝내요)**

1. **[B15]** 로그인하지 **않고** 스테이징의 `/practice/`에서 쓰기 과제 하나를 열어요. **"Practise without feedback"**(피드백 없이 연습하기)으로 타이머와 단어 수가 되는지 봐요. 그다음 AI 피드백 제출을 시도해요.
2. **[B15]** `/login/`에서 "**Continue with Google**"을 눌러, **허용되지 않은** 다른 Google 계정으로 로그인해 봐요.
3. **[B15]** 허용된 계정(사업용 Gmail)으로 **"Continue with Google"** 로그인을 해요.
4. **[B6]** `/pricing/`에서 "**I live in Canada, outside Quebec**"에 체크하고 **30일 이용권**을 사요. 캐나다 시험 카드와 퀘벡이 아닌 주소(예: 온타리오)를 써요.
5. **[B15]** 쓰기 과제 하나를 AI 피드백으로 제출해요.
6. **[B4]** 컴퓨터 **Chrome**에서 말하기 과제 하나를 약 60초 녹음해 제출해요. 제출을 누른 순간부터 피드백이 나올 때까지 휴대폰 스톱워치로 재요.
7. **[B4]** **실제 iPhone의 Safari**에서 같은 계정으로 로그인하고 6번을 똑같이 해요.
8. **[B15]** 계정 페이지(`/account/`)의 기록에서 채점 하나를 열어요. **"View receipt"** 링크도 눌러 봐요.
9. **[B6]** 계정 페이지에서 **"Request a refund"**(셀프 환불)를 해요. 지금까지 AI 피드백 3–5회라 조건 안이에요. **5회를 넘기지 마세요.**
10. **[B6]** 30일 이용권을 다시 사되, 이번에는 **분쟁 시험 카드**로 결제해요.
11. **[B15]** 로그아웃했다가 다시 로그인해요.
12. 스테이징 결제를 다시 꺼요: **"Set a kill switch"** → `checkout_enabled`, `false`, `staging`.

**통과 기준**

| 메모 | 점검 | 통과 기준 |
|---|---|---|
| B15 | 스테이징 한 바퀴 (Google 로그인) | 1: 연습 모드가 로그인 없이 되고, 제출 전에 AI 안내("You are getting feedback from an AI (Claude by Anthropic). …")가 보이고, 로그인 없이는 AI 피드백이 거절돼요. 2: 거절 메시지가 나오고 로그인되지 않아요. 3: 계정 페이지로 들어가져요. 5: 피드백이 오고 점수·밴드·레벨·"official" 같은 표현이 없어요. 8: 저장된 답과 피드백이 열려요. 11: 문제없이 돼요. **어디서든 오류 화면이 나오면 실패**예요 |
| B6 | 결제·환불·분쟁 (Stripe 시험 모드) | 4: `/checkout/success/`가 보이고, 계정 페이지에 이용권과 끝나는 날짜가 보이고, Stripe(시험 모드)의 웹훅 전송이 성공(2xx)이에요. 9: Stripe에 환불이 보이고 계정 페이지에서 이용권이 사라져요. 10: 사업용 Gmail에 `[MPC] Dispute opened` 알림(보낸 이름 `STAGING - …`)이 오고, 이용권이 없어요. 분쟁 카드가 캐나다 카드가 아니면 지역 규칙의 자동 환불 알림이 함께 올 수 있어요 [미확인]. `Dispute opened`가 안 오면 실패예요 |
| B4 | 60초 말하기 피드백이 20초 안에 (Chrome=webm, iPhone=mp4) | 6과 7 모두 **20초 미만**이고 받아쓰기와 피드백이 나와요. 넘으면 한 번 더 해 보고(9번의 5회 조건을 넘지 않게), 두 번 다 넘으면 기기, 브라우저, 걸린 초만 Claude에게 알려요. **녹음 파일은 보내지 않아요** |

셀프 환불은 같은 이메일, 같은 카드로 **한 번뿐**이에요. 다시 점검하려면 `MPC_STAGING_ALLOWED_EMAILS`에 다른 주소를 더하고 스테이징을 다시 배포한 뒤, 다른 시험 카드로 해요. 스테이징의 데이터베이스와 `HASH_SALT`는 운영과 따로라 운영의 출시일 셀프 환불(8-6)에는 영향이 없어요.

> ⚠️ **자주 하는 실수:** Google 로그인에서 "Error 400: redirect_uri_mismatch"가 나면 4-2 ⑤의 스테이징 주소가 `MPC_STAGING_SITE_URL`과 한 글자라도 달라요.
>
> 💬 **막히면 Claude에게 이렇게 말하세요:** "B단계 수동 점검 ○번에서 이런 화면이 나왔어: (화면 설명). 통과야 실패야?" (이메일 주소나 카드 번호는 적지 않아요.)

### 7-4. 롤백(되돌리기) 훈련 (10분)

**롤백이란?** 새 버전이 고장 나면 **바로 전 버전으로 자동으로 되돌리는 것**이에요. 실제 Cloudflare에서 한 번도 돌려 본 적이 없어서, 스테이징에서 **일부러 실패시켜** 되돌아가는지 봐요(B11).

1. 스테이징에 **이전 배포가 한 번 이상** 있어야 해요(7-1을 했으면 OK).
2. **"Actions"** → **"Deploy practice coach"** → **"Run workflow"** → `target`: **`staging`**, **`rollback_drill`**: **체크** → **"Run workflow"**.

> ✅ **이렇게 보이면 성공:** 실행이 **초록색**이고, 요약에 "**Rollback drill passed … rolled back to <버전>**"이 보여요.
>
> ⚠️ **자주 하는 실수:** `target`을 `production`으로 두는 것. 훈련은 스테이징에서만 돌아요(운영이면 워크플로가 거절해요).
>
> 💬 **막히면 Claude에게 이렇게 말하세요:** "롤백 훈련이 'inconclusive'로 끝났어. 실행 링크는 ○○야."

### 7-5. 결과 남기기 (5분)

Claude에게 "B단계 점검 이슈 만들어줘"라고 한 뒤, 그 이슈에 한 줄씩 적어요: 날짜, 점검 이름, 통과/실패, B4의 초. **이메일 주소나 카드 정보는 적지 않아요.**

---

## 8. 운영 배포와 결제 켜기

시간: 약 2시간 · **비용: 0원** (출시일 실제 카드 점검만 Stripe 수수료 약 C$0.30–1.50, 추정)

### 8-1. 법률 페이지 읽고 승인하기 (1시간)

**왜 하나요?** 캐나다 개인정보법(PIPEDA)에서 **오너가 책임자**예요. 사이트의 법률 페이지는 오너가 학습자와 하는 약속이에요.

1. 스테이징 주소(또는 8-2 뒤의 운영 주소)에서 **영어 원문**을 읽어요: `/legal/privacy/`, `/legal/terms/`, `/legal/refunds/`, `/legal/ai-disclosure/`, `/legal/not-affiliated/`, 그리고 `/`, `/ko/`, `/pricing/`, `/formats/`, `/help/` 같은 제품 페이지.
2. 한국어 요약은 `business/online/legal-summary-ko.md`에 있어요. **기준은 영어 페이지**예요.
3. 판매자 문장의 이름이 **정부 신분증의 법적 이름**과 같은지 봐요(`MPC_LEGAL_NAME`).
4. 개인정보 처리방침이 약속하는 **오너의 할 일**을 할 수 있는지 봐요: 지원 메일 90일 뒤 삭제(9-5), 30일 안 답변(9-6), 유출 기록(9-7). 못 하겠으면 승인하지 말고 알려 주세요.
5. 점수·레벨 예측, "official", "guaranteed" 같은 표현이 보이면 승인하지 말고 알려 주세요.
6. 아직 확인되지 않은 법적 질문 세 가지를 알고 승인해요 [미확인]: ① 법적 이름을 판매자로 적으면 사업자명 등록이 필요 없는지(9-9), ② 우편 주소 없이 지원 양식만으로 PIPEDA의 "책임자 주소" 요건을 채우는지(9-10), ③ 이메일을 보내지 않을 때 온타리오 소비자보호법의 온라인 계약서 사본 규칙을 계정 페이지와 약관 페이지로 채우는지. 가능하면 온타리오 변호사의 검토를 권해요(약관 초안의 메모).
7. 승인하면 Claude에게 "법률 페이지 승인했어"라고 알려 주세요.

> 💬 **막히면 Claude에게 이렇게 말하세요:** "privacy 페이지의 이 문장이 무슨 뜻이야? (영어 문장 붙여 넣기)"

### 8-2. 운영에 처음 배포하기 (15분)

1. 필수 값을 다시 확인해요: `MPC_SITE_URL`, `MPC_OWNER_EMAIL`, `MPC_LEGAL_NAME`, `MPC_GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `MPC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET`, `HASH_SALT`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, 그리고 6단계 PR 병합.
2. 변수 `MPC_DEPLOY`를 새로 만들고 값 `true`를 넣어요.
3. **"Actions"** → **"Deploy practice coach"** → **"Run workflow"** → `target`: **`production`** → **"Run workflow"**.
4. 설정 검사 → 테스트 → 빌드 → 데이터베이스 표 적용 → 배포 → 점검(스모크 테스트) 순서로 돌아요. 실패하면 **자동으로 이전 버전으로 되돌려요**(첫 배포는 되돌릴 버전이 없어요).
5. 이제부터는 코드가 `master`에 합쳐질 때마다 **자동으로 배포**돼요.
6. **결제는 꺼진 상태로 시작해요**(`checkout_enabled` 기본값 false). 무료 연습과 무료 체험만 열려요.

> ✅ **이렇게 보이면 성공:** 초록색 ✓. 운영 주소가 열리고, 휴대폰으로 **"Continue with Google"** 로그인이 돼요. 사업용 Gmail로 온 알림이 있으면 스팸함 필터도 설정해요(4-3).
>
> ⚠️ **자주 하는 실수:** 설정 검사 오류는 **빠진 값의 이름**을 알려 줘요(예: "Set the repository variable MPC_OWNER_EMAIL"). 그 이름을 5단계 표에서 찾아 넣고 다시 실행해요.
>
> 💬 **막히면 Claude에게 이렇게 말하세요:** "운영 배포 설정 검사에서 이 오류가 나: (오류 문장 복사)."

### 8-3. 결제를 켜기 전 체크리스트 (10분)

- [ ] 7단계 B단계 점검이 모두 통과했어요.
- [ ] Gate B 결론이 났거나, 10월 18일이 지나 **위험 수용**에 서명했어요(3-2, 3-3).
- [ ] (EI를 받으면) Service Canada 통화를 했고, 유료 판매를 해도 된다는 결론이에요(3-1).
- [ ] 법률 페이지를 승인했어요(8-1).
- [ ] **ServiceOntario에 전화**해서 사업자명 등록이 필요한지 물어봤어요(9-9). 필요하다고 했으면 등록을 마쳤어요.
- [ ] Stripe **Customer emails가 꺼져 있고**, Link와 후불 결제가 꺼져 있어요(4-4 ②③).
- [ ] 크레딧 금액 PR을 병합했어요(4-5 ⑤).

### 8-4. Stripe 실사용 키 넣기 (20분)

1. Stripe에서 **시험 모드를 꺼요**(실사용 모드). 본인 인증과 은행 등록이 끝나 있어야 해요.
2. 4-4 ④와 같은 방법으로 **실사용 제한 키**(`rk_live_`로 시작, 이름 `mpc-production`, 같은 권한)를 만들어 GitHub **비밀** `STRIPE_SECRET_KEY`에 넣어요.
3. 4-4 ⑤와 같은 방법으로 **실사용 웹훅**을 만들어요: 주소 `<운영 주소>/api/stripe/webhook`, API 버전 `2026-08-26.dahlia`, 이벤트 5개 그대로. Signing secret을 GitHub **비밀** `STRIPE_WEBHOOK_SECRET`에 넣어요.
4. 다시 배포해요: **"Deploy practice coach"** → `target`: `production`.

### 8-5. 결제 켜기 (5분, 휴대폰으로도 돼요)

**휴대폰에서는 GitHub 앱이 아니라 휴대폰의 웹 브라우저**(Safari, Chrome)로 `github.com`에 들어가서 해요. GitHub 앱에서 워크플로를 실행할 수 있는지는 공식 문서로 확인되지 않았어요 [미확인]. 출시 전에 한 번 연습해 두세요.

1. 저장소 → **"Actions"** → 왼쪽 **"Set a kill switch"** → **"Run workflow"**.
2. 브랜치 `master`, **`flag`**: **`checkout_enabled`**, **`value`**: **`true`**, **`target`**: **`production`**.
3. 초록색 "**Run workflow**"를 눌러요.

> ✅ **이렇게 보이면 성공:** 실행이 초록색이고, 요약에 "Set `flag:checkout_enabled` to `true` on the production Worker"가 보여요. 1–2분 뒤 `/pricing/`에서 구매 버튼이 보여요(퍼지는 데 잠깐 걸릴 수 있어요).
>
> ⚠️ **자주 하는 실수:** `value`에 `True`나 `켜기`를 쓰는 것. **`true`** 또는 `false`만 받아요.
>
> 💬 **막히면 Claude에게 이렇게 말하세요:** "결제 켜기 워크플로가 실패했어. 실행 링크는 ○○야."

### 8-6. 출시일 점검 (20분 + 다음 날 5분)

1. **실제 카드로 C$39(30일 이용권) 구매:** 캐나다 발행 카드, 퀘벡이 아닌 청구 주소. 결제 화면에 **카드만** 보이는지, 구매 버튼 옆에 약관·환불 정책 동의 문구가 보이는지, 계정 페이지에 이용권과 "**View receipt**"가 보이는지 확인해요.
2. **셀프 환불:** 계정 페이지 → **"Request a refund"**. Stripe에 환불이 보이고 이용권이 사라지는지 확인해요. 이 이메일과 카드로는 셀프 환불을 다시 할 수 없어요.
3. **iPhone 말하기:** iPhone Safari에서 말하기 과제 하나를 약 60초 녹음해 제출하고, 받아쓰기와 피드백이 오는지 봐요. 안 되면 iOS 버전과 증상만 Claude에게 알려요(녹음 파일은 보내지 않아요).
4. **다음 날:** **"Reconcile payments"** 최근 실행이 초록색(불일치 0건)인지 봐요.

> 💬 **막히면 Claude에게 이렇게 말하세요:** "Reconcile payments가 불일치를 보고했어. 이슈 번호는 #○○야."

---

## 9. 출시 후

### 9-1. 커뮤니티 글 올리기 (한 번, 글 하나에 10–15분)

1. `business/online/launch-kit-ko.md`의 체크리스트를 먼저 읽어요.
2. **결제가 켜진 뒤**, 휴대폰으로 "**피드백 없이 연습하기**"가 되는지 직접 해 본 다음 올려요.
3. 글 A·B·C 중 맞는 것을 골라 `{사이트 주소}`를 `MPC_SITE_URL` 값으로 바꿔요.
4. **이미 가입한 그룹에만, 그룹마다 한 번만,** 그룹 규칙이 허용할 때만 올려요. 2–3곳이면 충분해요.
5. 올린 뒤 그 주 "KPI digest …" 이슈에 `10/27 네이버 카페에 글 A 올림`처럼 댓글을 남겨요.
6. **광고는 하지 않아요.** 유료 홍보, 자동 게시, 가짜 후기도 하지 않아요.
7. 알아 둘 것: 카카오톡·네이버·페이스북 **앱 안에서** 링크를 열면, Google이 그 안의 브라우저에서는 로그인을 막아요("Error 403: disallowed_useragent") [미확인: Google 공식 문서로 확인 못 함]. 사이트가 그런 방문자에게 Chrome이나 Safari로 열라고 안내해요. "피드백 없이 연습하기"는 앱 안에서도 돼요. 댓글로 로그인이 안 된다는 말이 오면 "오른쪽 위 메뉴에서 '다른 브라우저로 열기'를 눌러 주세요"라고 답해요 [미확인: 앱마다 메뉴 이름이 달라요].

**비용: 0원.**

### 9-2. 매주 10–30분 루틴

**무엇인가요?** 출시 뒤에는 대부분 자동으로 돌아가요. 오너는 일주일에 한 번 보고서를 읽고, 제안에 예/아니오로 답하고, 지원 답장 초안을 보내면 돼요.

| 할 일 | 시간 | 방법 |
|---|---|---|
| 월요일 **"KPI digest …"** 이슈 읽기 | 5–10분 | 한국어 부분을 읽고, 제안마다 **예/아니오**를 댓글로 답해요 |
| 지난주 시간 답하기 | 1분 | 같은 이슈에 `5시간, 지원 0.5시간`처럼 댓글. 처음 한 번은 `설정 9.5시간`도 적어요 |
| 지원 답장 초안 검토 후 보내기 | 0–10분 | Gmail의 **임시보관함**(Drafts)에 Claude가 만든 초안이 있어요. `[OWNER: …]`로 시작하는 줄은 **지우고** 보내요 |
| 알림 메일 훑어보기 | 2분 | `[MPC] …` 제목의 메일. 모르는 알림은 11단계 표를 봐요 |
| GitHub 사용량 보기 | 1분 | `https://github.com/settings/billing`. 20일 전에 1,500분을 넘으면 Claude에게 알려요 |
| (판매가 있으면) Stripe 입금 확인 | 5분 | 은행에 들어온 금액을 Claude에게 "입금 확인: 날짜, 금액"으로 알려요 |
| (EI를 받으면) 격주 보고 | 2주마다 10분 | `ops/books/ei/`의 순이익 메모를 보고 신고해요 |

루틴(10단계)을 켜기 전에는 Claude에게 "이번 주 KPI 보고서 만들어줘"라고 부탁하면 돼요.

### 9-3. 크레딧 충전 (필요할 때, 10분)

사이트가 크레딧의 50%, 80%를 쓰면 `[MPC] Prepaid Anthropic credits 50% used`(또는 80%) 알림이 오고, 루틴이 **"Anthropic credits: top up"** 이슈를 열어요. 70%에서 무료 체험이 꺼지고, 97%가 되면 AI 피드백이 잠시 멈춰요(이용 중인 이용권은 멈춘 시간만큼 늘어나요).

크레딧은 운영 사이트만 쓰는 게 아니에요. 스테이징 점검, "Level-B checks"의 캐시 점검, "Grading eval"도 같은 크레딧을 써요. Claude가 AI 채점 코드를 고치는 PR을 열면 "Grading eval"이 **자동으로** 돌아서 한 번에 보통 약 US$1–4를 써요(추정, 1회 예산 상한 US$5). 사이트가 세는 지출에는 이 몫이 빠져 있으니, **진짜 잔액은 Console의 숫자**예요.

**순서가 중요해요:**

1. Anthropic Console → **"Settings"** → **"Billing"** → "**Buy credits**"로 크레딧을 사요. **자동 충전은 계속 꺼 둬요.** 이용권 하나(30일)당 약 US$7(Opus 5) 또는 약 US$3(Sonnet 5)이 필요해요(추정).
2. production 작업 공간의 월 한도를 **새 잔액 이상**으로 올려요.
3. "Anthropic credits: top up" 이슈에 이렇게 댓글을 달아요:
   - `잔액 US$12.30` (Console에 지금 보이는 잔액)
   - `구매 US$10 = C$14.20` (낸 금액)
   - `한도 US$20` (한도를 바꿨으면)
4. 루틴이 만든 PR을 **오너가 직접 병합**해요. 병합하면 사이트가 새 잔액으로 다시 배포돼요.

**크레딧이 완전히 떨어지면:** Anthropic이 채점을 거절하는 순간 사이트가 AI 피드백을 스스로 멈추고 `[MPC] Grading paused (Anthropic credits used up)` 알림을 하루 한 번 보내요. 학습자에게는 "잠시 멈춤" 안내가 보이고, 무료 체험 기회는 돌려받고, 이용권은 멈춘 시간만큼 늘어나요. 위 1–4번을 하면(새 잔액으로 다시 배포되면) 저절로 다시 켜져요. 충전하지 않기로 했다면 그대로 두면 돼요.

순서를 거꾸로 하면(파일 먼저, Console 나중) 사이트가 실제보다 여유가 있다고 믿게 돼요. **판매 수입을 빼고 쓴 돈이 C$100을 넘으면 멈춰요**(K10).

### 9-4. 킬 스위치 (긴급할 때 1–5분)

**무엇인가요?** 문제가 생겼을 때 결제, AI 피드백, 무료 체험을 **코드를 고치지 않고 바로 끄는 스위치**예요. 이미 산 이용권이나 저장된 기록은 지워지지 않아요.

**Actions로 끄고 켜기 (기본 방법)**

1. **"Actions"** → **"Set a kill switch"** → **"Run workflow"** (휴대폰은 웹 브라우저로).
2. `flag`를 골라요:

| `flag` | 끄면(`false`) | 언제 |
|---|---|---|
| `checkout_enabled` | 새 구매가 멈춰요. 이미 산 이용권은 그대로예요 | Stripe 문제, 환불·분쟁이 많을 때(K7) |
| `grading_enabled` | AI 피드백이 멈춰요. **이용 중인 모든 이용권이 멈춘 시간만큼 늘어나요** | 심각한 품질·비용 문제일 때만. 끝나면 바로 `true` |
| `free_enabled` | 무료 AI 체험이 멈춰요 | 비용이 이상하게 늘 때 |
| `banner` | `value`에 한 줄 안내 문구(200자 이하). 비우면 배너가 지워져요 | 점검 안내 등 |

3. `value`: `true` 또는 `false`, `target`: `production` → **"Run workflow"**.
4. 오너가 `false`로 끈 `free_enabled`, `grading_enabled`는 사이트의 자동 감시가 **절대 다시 켜지 않아요.** 다시 켜려면 오너가 `true`를 넣어요.

**Actions가 멈췄을 때 (예: 2,000분을 다 쓴 달) — Cloudflare 대시보드로**

1. Cloudflare 대시보드 → **"Storage & Databases"** → **"Workers KV"** [미확인: 메뉴 이름 — "KV"가 들어간 메뉴].
2. 운영용 KV를 열어요. 이름은 `maple-practice-coach-flags`예요(스테이징용은 `maple-practice-coach-staging-flags`라서 **아니에요**). 6단계 상자의 `[production]` 부분 `KV FLAGS: title=…`과 같은 이름이에요.
3. `free_enabled`나 `grading_enabled`를 끌 때는 **먼저** 키 `owner:grading_enabled`(또는 `owner:free_enabled`)에 값 `false`를 넣어요. 그다음 `flag:grading_enabled`에 `false`를 넣어요 [미확인: 키 추가 버튼 이름].
4. 결제만 끌 때는 `flag:checkout_enabled`에 `false`.
5. 켤 때는 같은 키에 `true`.

> 💬 **막히면 Claude에게 이렇게 말하세요:** "Actions가 멈춰서 Cloudflare 대시보드로 결제를 꺼야 해. KV 화면에서 막혔어."

### 9-5. 지원 메일함 정리 (매주 2분 + 알림이 올 때)

개인정보 처리방침은 "지원 메일 사본을 **90일 뒤**와 **계정 삭제 때** 지운다"고 약속해요. 코드가 아니라 **오너가** 해요.

1. **매주:** Gmail 검색창에 `subject:"[MPC] Support ticket" older_than:90d` [미확인: Gmail 검색 문법]를 쳐서 나온 메일과 그 답장 스레드를 지워요. **휴지통도 비워요.** 루틴이 **"Support mailbox: delete tickets older than 90 days"** 이슈로 알려 줘요.
2. **`[MPC] Account deleted: remove its support emails` 알림이 오면:** 알림에 적힌 **티켓 번호마다** Gmail에서 검색해 그 메일과 답장을 지우고, 알림 메일도 지워요.
3. **`[MPC] Support forwarding limit reached (<날짜>)` 알림이 오면(드물어요):** 그날 30통을 넘은 티켓은 메일로 오지 않고 데이터베이스에만 있어요. 알림 메일에 `SELECT`로 시작하는 줄(데이터베이스에 묻는 질문 문장, SQL)이 두 개 있어요. 한 줄씩 **줄 전체**를 복사해 Cloudflare 대시보드 → **"D1"** → 운영 데이터베이스 `mpc` → **"Console"** [미확인: 탭 이름 — 질문 문장을 넣는 칸이 있는 탭]에 붙여 넣어 실행해요. 첫 번째 결과에는 학습자 이메일이 있어서 답장할 수 있어요. 결과에는 개인정보가 있어요. **Claude, 이슈, 저장소에 붙여 넣지 않아요.**

### 9-6. 개인정보 요청 처리 (요청이 오면)

지원 답장 초안 맨 위에 `[OWNER: privacy request received <날짜>; reply due by <날짜>]`가 있으면 개인정보 요청이에요(열람, 정정, 삭제, 동의 철회, 불만). PIPEDA s.8.

1. **본인 확인:** 로그인한 지원 양식으로 온 요청만 처리해요(티켓에 계정 이메일이 있어요). 다른 경로로 오면 "계정에 로그인해 계정 페이지의 지원 양식으로 다시 보내 달라"고 답해요. 요청서 쓰는 걸 도와 달라고 하면 도와야 해요(s.8(2)).
2. **기한: 받은 날부터 30일 안에** 답해요(s.8(3)). 답하지 않으면 거절한 것으로 봐요(s.8(5)).
3. **연장:** 사업에 불합리한 지장이 있거나 협의가 필요하면, 또는 다른 형식으로 바꾸는 데 시간이 걸리면 최대 30일 더 연장할 수 있어요(s.8(4)). 연장하려면 **처음 30일 안에** ① 새 기한, ② 이유, ③ 연장에 대해 개인정보보호위원회에 불만을 낼 수 있다는 것을 알려요.
4. **열람:** 저장된 답과 피드백은 계정 페이지에서 볼 수 있다고 알려요. 전체 사본을 원하면 Claude에게 "개인정보 열람 요청이 왔어. 사본을 꺼내는 방법 알려줘"라고 물어요. **꺼낸 결과(개인정보)는 Claude에게 붙여 넣지 않아요.**
5. **삭제:** 계정 페이지의 삭제 버튼을 안내해요. 그다음 메일함 사본을 지워요(9-5 ②).
6. **기록:** 요청 날짜, 답한 날짜, 연장 여부를 **git 밖**(사업용 Google 드라이브의 비공개 문서)에 적어요. 내용은 적지 않아요.

### 9-7. 개인정보 유출 기록과 보고 (문제가 생기면)

PIPEDA s.10.1, s.10.3, 유출 규정 SOR/2018-64.

1. **기록은 git 밖에** 둬요(사업용 Google 드라이브의 비공개 스프레드시트 "breach log"). 저장소에는 절대 적지 않아요. 아무 일이 없으면 비어 있어요.
2. 보호 조치 위반(유출, 잘못된 접근, 분실 등)은 위험이 낮아도 **모두** 기록해요. 항목: 알게 된 날짜, 일어난 날짜나 기간, 무슨 일이 있었는지, 관련 개인정보 종류, 영향받은 사람 수(모르면 대략), 한 조치, **실질적인 중대한 피해 위험(RROSH)** 판단과 이유, 보고·통지 여부와 날짜.
3. **보관: 24개월**(SOR/2018-64 s.6(1)). 위원회가 요청하면 보여 줘야 해요(s.10.3(2)).
4. **RROSH가 있으면:** ① 가능한 한 빨리 **개인정보보호위원회(OPC)에 서면 보고**해요 [미확인: 보고 양식과 제출 방법]. ② **영향받은 사용자에게 직접, 가능한 한 빨리** 알려요.
5. 의심되면 필요한 기능을 킬 스위치로 멈추고(9-4), Claude에게 **개인정보 없이** 알려요: "유출이 의심돼. 무슨 일: (개인정보 없이 요약)".

### 9-8. 남은 날짜 환불 (`end_pass`)

시간: 약 10분 · **비용: 0원** (구매자에게 돌려주는 금액 말고는 없어요. 원래 결제의 Stripe 수수료는 돌려받지 못할 수 있어요 [미확인])

약관은 몇몇 경우(서비스 종료, 공정 사용 한도 축소, 오너 사유 해지, 중대한 약관 변경) **남은 날짜만큼 환불하고 이용권을 끝낸다**고 약속해요.

**무엇을 하나요?** 부분 환불로 이용권을 끝내려면 환불에 **메타데이터** `end_pass` = `true`가 붙어 있어야 해요. 이게 있어야 사이트가 이용권을 끝내요. Stripe 대시보드의 환불 화면에 메타데이터 칸이 있는지는 [미확인]이라서, 이 표시를 대신 붙여 주는 워크플로 "**Refund unused days**"를 써요. 오너는 버튼만 누르면 돼요. 터미널은 필요 없어요.

**필요한 것:** 비밀 `STRIPE_SECRET_KEY` (8-4의 실사용 제한 키. 4-4 ④의 권한이면 충분해요). 결제를 켤 때 이미 넣었어요.

1. **금액:** 가격 × 남은 일수 ÷ 이용권 일수(30 또는 90). 예: C$39 30일 이용권의 남은 12일 → 39 × 12 ÷ 30 = **C$15.60**. 미리보기 요약에도 이 계산표가 나와요.
2. **결제 ID 찾기:** Stripe 대시보드 → "**Payments**"(결제) [미확인: 메뉴 이름] → 그 구매자의 결제를 눌러요. 결제 화면에서 `pi_`로 시작하는 **결제 ID**를 복사해요 [미확인: ID가 보이는 자리 — "Payment ID"나 "ID"라고 적힌 곳]. `ch_`나 `py_`로 시작하는 것은 다른 ID예요. 결제 ID와 금액은 **비밀이 아니에요.**
3. **미리보기(`preview`)로 먼저 실행해요.** 저장소 → **"Actions"** 탭 → 왼쪽 목록의 "**Refund unused days**" → 오른쪽 **"Run workflow"** 버튼. 칸은 이렇게 채워요:
   - 브랜치: **`master`** 그대로
   - `payment_intent`: 2번에서 복사한 `pi_…` ID
   - `amount_cad`: 1번 금액을 **숫자와 점만** 써요. 예: `15.60` (`C$`, 쉼표, 빈칸 없이)
   - `mode`: **`preview`**(기본값)

   초록색 "**Run workflow**"를 눌러요. 잠시 뒤 목록 맨 위에 새 실행이 생겨요. 그 이름을 눌러 **요약(Summary)** 화면을 읽어요. 제목이 "**Refund unused days: 미리보기 (preview)**"이고, 표에 키 모드, 결제 ID, 결제한 금액, 이미 환불된 금액, 환불할 수 있는 최대 금액, 요청 금액이 있어요. "무엇이 일어나나요"에는 "**이용권이 끝나요**"가 보여요. 이때는 **아직 아무것도 환불하지 않았어요.** 금액이 맞는지, 키 모드가 `live`(실사용)인지 확인해요.
4. **진짜 환불(`refund`):** 요약이 맞으면 3번을 **같은 값으로** 다시 해요. 이번에는 `mode`만 **`refund`**(진짜 환불)로 바꿔요. 요약 제목이 "**환불했어요**"이고 환불 ID(`re_`로 시작)와 상태(`succeeded` 또는 `pending`)가 보이면 끝이에요. 사이트가 Stripe의 알림을 받으면 이용권을 **자동으로** 끝내요. 구매자에게 환불했다고 알려요.
5. `end_pass` 없이 부분 환불하면(예: 선의의 일부 환불) 이용권은 그대로예요. **전액 환불**은 메타데이터 없이도 이용권이 자동으로 끝나요. 그래서 전액 환불은 이 워크플로 없이 Stripe 대시보드의 그 결제 화면에서 "**Refund**" 버튼으로 해도 돼요 [미확인: 버튼 이름].
6. 환불이 나중에 실패하면 `[MPC] Refund failed` 알림이 와요. 구매자와 다른 환불 방법을 정해요.

> ✅ **이렇게 보이면 성공:** `refund` 실행 옆에 초록색 체크(✓)가 있고, 요약 제목이 "**환불했어요**"이고, 환불 ID(`re_…`)가 보여요. Stripe 대시보드의 그 결제 화면에도 부분 환불이 보여요.
>
> ⚠️ **자주 하는 실수:**
> - 처음부터 `refund`로 실행하는 것. 먼저 **`preview`**(미리보기)로 금액을 확인해요.
> - `amount_cad`에 `C$15.60`, `15,60`, `$15.6`처럼 쓰는 것. **숫자와 점만** 써요(`15.60`).
> - `pi_`가 아닌 ID(`ch_`나 `py_`로 시작하는 ID)나 이메일 주소를 넣는 것. 결제 화면의 `pi_`로 시작하는 ID를 써요.
> - 두 번 눌러도 **두 번 환불되지 않아요.** 같은 값의 두 번째 실행은 "이용권은 이미 끝났어요"라며 빨간색으로 멈춰요. 정상이에요.
> - 요약 제목이 "**멈췄어요**"이면 아무것도 환불하지 않은 거예요(빨간색 ✗이어도 돈은 움직이지 않았어요). 요약에 이유가 적혀 있어요. 예: 금액이 최대 금액보다 커요, 분쟁(dispute) 중인 결제예요.
> - 요약의 키 모드가 `test`(시험)이면 진짜 돈은 움직이지 않아요. 실제 결제는 `live`예요.
>
> 💬 **막히면 Claude에게 이렇게 말하세요:** "Refund unused days가 멈췄어. 결제 ID는 pi_○○, 금액은 C$15.60, 실행 링크는 ○○야." (결제 ID, 금액, 실행 링크는 보내도 돼요. Stripe 키는 절대 보내지 마세요.)

### 9-9. ServiceOntario에 전화하기: 사업자명 (15–30분, 결제를 켜기 전에 하면 가장 좋아요)

**왜 하나요?** 사이트는 "Maple Practice Coach is sold by <법적 이름>"이라고 적어서, 판매자는 오너 개인이고 "Maple Practice Coach"는 **제품 이름**이에요. 이렇게 하면 사업자명 등록이 필요 없는지 **확인되지 않았어요** [미확인: 온타리오 Business Names Act 해석]. 전화 문의는 **무료**예요.

1. ServiceOntario에 전화해서 이렇게 읽어요:

   > "I am a sole proprietor in Ontario. My website is called Maple Practice Coach, but the website, the terms and every message say it is sold by <my full legal name>. Do I need to register Maple Practice Coach under the Business Names Act?"

2. 날짜, 상담원 이름(성 빼고), 답을 적어요. Claude에게 "ServiceOntario 이슈 만들어줘"라고 한 뒤 **날짜와 결론만** 댓글로 남겨요.
3. **"필요 없다"** → 끝이에요. **비용: 0원.**
4. **"필요하다"** → 결제를 켜기 전에 등록해요. 수수료는 약 C$60(5년) [미확인]. 등록하면 정부의 공개 검색에 **이름과 사업장 주소**가 올라가요(집 주소일 수 있어요). 등록한 뒤 Claude에게 알려 주세요(장부에 비용으로 적고, 사이트 문구를 확인해요).

### 9-10. 개인정보 처리방침의 "책임자 주소" 질문 [미확인]

PIPEDA는 책임자의 "**주소**"를 알리라고 해요(Schedule 1, 4.8.2(a)). 우편 주소여야 하는지, 지원 양식만으로 되는지는 **확인되지 않았어요.**

| 선택 | 비용 | 장단점 |
|---|---|---|
| 비워 두기 (지금 설정) | 0원 | 집 주소가 공개되지 않아요. 법적 요건을 채우는지 [미확인] |
| 집 주소를 `MPC_MAILING_ADDRESS`에 넣기 | 0원 | 요건에 더 가깝지만, 개인정보 처리방침에 **집 주소가 공개**돼요 |
| 사서함(PO Box) | 돈이 들어요 | 무자본 원칙에 맞지 않아 **권하지 않아요** |

정하면 Claude에게 알려 주세요. 주소를 넣으면 다시 배포해야 사이트에 반영돼요.

### 9-11. 세금 (짧게)

- **GST/HST는 등록하지 않아요.** 네 분기 합계 매출이 C$30,000을 넘으면 30일 안에 등록해야 해요. 장부 루틴이 80%에서 알려 줘요.
- 소득은 T2125로 신고해요. 영수증(크레딧 구매 등)을 보관해요.
- 법률·세무 자문이 아니에요. 궁금하면 세무 전문가에게 물어보세요.

### 9-12. (선택) Google Search Console

어떤 검색어로 사람들이 들어오는지 보고 싶을 때만 해요. **비용: 0원.** Claude에게 "Search Console 인증 준비해줘"라고 하면, Claude가 Search Console이 주는 확인 값(비밀 아님)을 사이트에 넣는 방법을 알려 줘요 [미확인: 화면 이름]. 하지 않아도 사이트맵으로 Google이 사이트를 찾을 수 있어요.

---

## 10. Routine(자동 AI 운영) 켜기

시간: 약 5분 · **비용: 0원** (지금 쓰는 Claude 요금제 안에서 돌아요. 루틴 실행 횟수 한도는 [미확인]. 추가 결제를 요구하면 켜지 말고 알려 주세요)

**루틴이란?** 정해진 시간에 Claude가 **스스로** 일하는 예약 작업이에요. 프롬프트(지시문)는 `ops/routines/`에 있어요.

| 루틴 | 언제 | 하는 일 |
|---|---|---|
| `daily` | 매일 | 이상 지표·알림을 이슈로 정리, 크레딧 충전 이슈와 PR, Gmail에 지원 답장 **초안**(보내지 않아요) |
| `kpi` | 매주 월요일 | "KPI digest …" 이슈(한국어·영어), 중단 규칙 평가 |
| `books` | 매주 월요일과 매월 1일 | 장부, EI 순이익 메모 |
| `eval` | 월요일(새 품질 점검이 있을 때만) | 품질 점검 결과 검토 |
| `nov30` | 12월 1일 이후 한 번 | 11월 결과 메모 |
| `day90` | 12월 26일, 1월 31일 | 계속할지 정리할지 검토 |

1. **출시 뒤(8단계 뒤)** Claude 대화창에 "**루틴 켜줘**"라고 말해요. **오너가 "예"라고 한 뒤에만** Claude가 루틴을 만들어요.
2. `daily` 루틴은 사업용 Gmail을 읽어야 해요. Claude가 안내하면 claude.ai의 설정에서 **Gmail 연결**(connector)을 사업용 계정으로 허용해요 [미확인: 메뉴 이름 — "Connectors"가 들어간 설정].
3. 루틴은 **지원 메일을 Gmail 안에서만** 읽어요. 학습자의 연습 답은 읽지 않아요(개인정보 처리방침에 공개됨).

> ✅ **이렇게 보이면 성공:** 다음 월요일에 "KPI digest …" 이슈가 열려요.
>
> 💬 **막히면 Claude에게 이렇게 말하세요:** "루틴이 이번 주에 KPI 이슈를 안 만들었어. 확인해줘."

---

## 11. 문제가 생기면

**오류 문장과 실행 링크는 Claude에게 보내도 돼요.** 비밀 값, 학습자 이메일, 카드 정보는 보내지 않아요.

| 증상 | Claude에게 이렇게 말하세요 |
|---|---|
| Actions 실행에 빨간 ✗ | "'<워크플로 이름>' 실행이 실패했어. 링크는 (주소)야." |
| 배포가 "skipped: add the CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID…"라고 해요 | "배포가 Cloudflare 비밀이 없다고 건너뛰었어. 이름 확인해줘." |
| 배포 설정 검사 오류(빠진 변수 이름이 나와요) | "배포 설정 검사에서 이 오류가 나: (오류 문장)." |
| Google 로그인에서 "Error 400: redirect_uri_mismatch" | "구글 로그인에서 redirect_uri_mismatch가 나. 주소는 (사이트 주소)야." |
| 로그인이나 무료 체험에서 `turnstile_failed` | "로그인할 때 turnstile_failed가 나. Turnstile 설정 확인해줘." |
| 오너 알림 메일이 안 와요 | "알림 메일이 안 와. 스팸함에도 없어." (Resend 가입 주소 = `MPC_OWNER_EMAIL`인지 먼저 봐요) |
| `[MPC] Grading paused (prepaid credits nearly used)` | "크레딧 거의 다 썼다는 알림이 왔어. 충전 순서 알려줘." (9-3) |
| `[MPC] Grading paused (Anthropic credits used up)` | "크레딧이 다 떨어져서 AI 피드백이 멈췄다는 알림이 왔어. 충전 순서 알려줘." (9-3) |
| `[MPC] Free samples switched off (spend)` | "무료 체험이 자동으로 꺼졌다는 알림이 왔어. 괜찮은 거야?" |
| `[MPC] Dispute opened` | "분쟁 알림이 왔어. Stripe에서 뭘 해야 해?" |
| `[MPC] Refund failed` | "환불 실패 알림이 왔어. 구매 번호는 (번호)야." |
| `[MPC] Non-card payment refunded` | "카드가 아닌 결제가 자동 환불됐대. Stripe 결제수단 설정 확인 방법 알려줘." |
| GitHub "90% / 100%" 사용량 메일 | "GitHub Actions 사용량이 90%래. 뭘 줄여야 해?" |
| Stripe, Anthropic, Google, Cloudflare, Resend, GitHub에서 "계정 검토·정지" 메일 | "○○에서 계정 검토 메일이 왔어. 요약: (개인정보 없이)." |
| 사이트에 "Error 1102"나 한도 관련 Cloudflare 메일 | "사이트가 Error 1102를 보여 줘." / "Cloudflare에서 한도 메일이 왔어." |
| Anthropic API가 갑자기 거절해요 | Console의 Billing(잔액 0인지)과 Limits를 보고: "Console 잔액은 ○○, 한도는 ○○야." |
| Claude가 저장소를 못 읽어요 | "저장소를 못 읽는다고 나와." (1-6 확인) |
| 유출이 의심돼요 | "유출이 의심돼. 무슨 일: (개인정보 없이)." (9-7) |
| 학습자가 "Error 403: disallowed_useragent"나 "로그인이 안 돼요"라고 해요 (카카오톡·네이버 앱 안에서 연 경우) | "앱 안 브라우저에서 구글 로그인이 안 된다는 문의가 왔어. 답장 초안 만들어줘." (9-1의 7번) |
| 이 안내서의 화면과 실제 화면이 달라요 | "안내서 ○-○단계의 '○○' 버튼이 화면에 없어. 대신 ○○가 보여." |

---

## 12. (선택) Claude 웹 검색 한도 올리기

시간: 5분 · **비용: 0원**

**무엇인가요?** Claude가 한 대화(세션)에서 웹을 검색할 수 있는 횟수에는 한도가 있어요. 한도를 올리면 Claude가 공식 문서를 더 많이 찾아보고 **[미확인]을 줄일 수** 있어요. **꼭 할 필요는 없어요.**

1. Claude 대화창 **맨 위 제목 줄**에서 **클라우드 환경(cloud environment) 메뉴**를 열어요.
2. "**Edit**"를 눌러요.
3. 환경 변수(environment variable)에 이름 **`CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION`**, 값 **`500`**(예시)을 넣고 저장해요.
4. **새 대화**(세션)를 시작해야 적용돼요. 지금 대화에는 적용되지 않아요.

이 값은 비밀이 아니에요. 키나 비밀번호를 이 칸에 넣지 않아요.

---

## 부록 A. 예전 번호 안내

다른 파일(오류 메시지, 워크플로 설명)이 이 안내서의 **예전 번호**를 가리킬 수 있어요. 아래 표로 새 위치를 찾으세요.

| 예전 번호 | 내용 | 새 위치 |
|---|---|---|
| `0` | 저장소 비공개 | 1단계 |
| `1` | 관문(Gate 0, Gate B) | 3단계 |
| `2-1` | Anthropic Console | 4-5 |
| `2-2` | Cloudflare 계정, API 토큰, Turnstile | 4-1 |
| `2-3` | D1·KV 만들기 | 6단계 (워크플로가 만들어요) |
| `2-4` | Stripe, 남은 날짜 환불 | 4-4, 8-4, 9-8 |
| `2-5` | Resend | 4-3 |
| `2-6` | GitHub 비밀과 변수 | 5단계 |
| `2-7` | 첫 배포와 스테이징 | 7-1, 8-2 |
| `2-7a` | B단계 점검 | 7단계 |
| `2-8` | 법률 페이지 검토 | 8-1 |
| `2-10` | 출시일 점검 | 8-4, 8-6 |
| `2-11` | Routine 켜기 | 10단계 |
| `3` | 주간 업무 | 9-2 |
| `3-1` | 킬 스위치 | 9-4 |
| `3-2` | 지원 메일, 개인정보 요청 | 9-5, 9-6 |
| `5` | 세금, 유출 기록 | 9-11, 9-7 |

## 부록 B. 함께 보는 문서

- `business/online/decision-memo.md`: 전체 결정(영어). §7.2가 무자본 출시예요.
- `business/online/gate-b-anthropic-email.md`: Gate B 영어 이메일 초안(한국어 설명 포함).
- `business/online/legal-summary-ko.md`: 법률 페이지 한국어 요약. 기준은 영어 페이지.
- `business/online/launch-kit-ko.md`: 커뮤니티 글 초안.
- `ops/README.md`: 워크플로와 루틴 목록(영어).
