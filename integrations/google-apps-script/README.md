# 견적 요청을 Google 시트에 저장하고 이메일로 받기 (Google Apps Script)

> **이 연결은 선택 사항입니다.** 연결하지 않아도 사이트는 정상적으로 동작합니다(아래 "연결하지 않으면?" 참고).
> 모든 설정은 **오너 본인의 Google 계정**에서 직접 합니다. AI는 계정을 만들거나, 버튼을 대신 누르거나, 메시지를 보내지 않습니다.
> 법률 자문이 아닙니다. CASL·개인정보 관련 내용은 결정 메모(`business/research/decision-memo.md`)의 출처를 그대로 옮긴 것입니다.

---

## 한눈에 보기

```
고객이 사이트 견적 양식 제출
   → 이 스크립트(Code.gs)가 받음
   → 오너 Google 시트 "Leads" 탭에 한 줄 저장
   → 오너 이메일(OWNER_EMAIL)로 요약 메일 발송
```

| 단계 | Code.gs가 하는 일 |
|---|---|
| 1 | 양식 데이터(JSON)를 받습니다. 형식은 `lib/lead.ts`의 `LeadPayload`와 같습니다. |
| 2 | 사람에게는 보이지 않는 숨은 칸 `website`가 채워져 있으면 봇으로 보고 **버립니다**(저장·메일 없음). |
| 3 | 스크립트 속성 `TURNSTILE_SECRET`이 있으면 Cloudflare에 봇 확인 토큰을 검사합니다. 실패하면 **"Rejected" 탭에만** 저장하고 메일은 보내지 않습니다. 비밀 키 오타처럼 **오너 쪽 설정 문제**라면 요청을 버리지 않고 "Leads"에 저장한 뒤, 메일 제목에 `[확인 CHECK]`를 붙입니다. |
| 4 | "Leads" 탭에 한 줄을 추가합니다. 첫 줄 머리글은 없으면 자동으로 만듭니다. |
| 5 | `OWNER_EMAIL`로 한국어·영어 요약 메일을 보냅니다. 고객이 이메일을 적었다면 메일에서 **"답장"만 누르면 고객에게 바로** 갑니다. |

### "Leads" 탭의 열

| 열 | 뜻 |
|---|---|
| `serverReceivedAt` | 스크립트가 요청을 받은 시각(시트 시간대 기준) |
| `v` ~ `website` | 양식이 보낸 값 그대로(`lib/lead.ts`의 필드 이름과 똑같음). `turnstileToken`은 한 번 쓰면 끝나는 긴 값이라 앞부분만 저장합니다. |
| `turnstileResult` | `verified`(확인됨), `not checked`(비밀 키 없음), `error, stored unverified`(확인 불가, 일단 저장), `failed`(실패, Rejected 탭에만 있음) |
| `receiveDelaySec` | 고객 기기의 제출 시각 → 시트 저장까지 걸린 초. 고객 휴대폰 시계가 틀리면 값도 틀립니다. |
| `notifyResult` | 오너에게 메일을 보냈는지(`sent …` / `failed: …` / `skipped: …`) |

- 전화번호나 메모는 **입력된 글자 그대로** 저장합니다. `+1 416…`이 숫자로 바뀌거나 `=`로 시작하는 글이 수식이 되지 않도록, 셀 앞에 보이지 않는 `'`를 붙입니다.
- `page` 열에 `?src=c1` 같은 값이 붙어 있으면, 그 동네 묶음용 인쇄물의 QR 코드로 들어온 고객입니다. 어느 전단이 효과가 있는지 볼 때 씁니다.
- 오너가 열을 직접 추가해도 됩니다(예: `연락함`, `수신거부`). 스크립트는 그 열을 건드리지 않습니다.

---

## 연결하지 않으면? (기본 동작)

- `NEXT_PUBLIC_LEAD_ENDPOINT`가 비어 있으면, 고객이 "보내기"를 누른 뒤 요청 요약과 함께 **오너에게 바로 보내는 문자 버튼과 이메일 버튼**이 나타납니다.
- 버튼을 누르면 고객 휴대폰의 문자 앱이나 메일 앱이 열리고, 요약 내용이 채워진 상태로 오너(`NEXT_PUBLIC_PHONE`, `NEXT_PUBLIC_EMAIL`)에게 보내집니다.
- 이 버튼은 `NEXT_PUBLIC_PHONE`, `NEXT_PUBLIC_EMAIL`이 설정되어 있어야 보입니다. 두 값은 꼭 넣어 두세요(`business/08-배포-가이드.md`).
- 단점은 두 가지입니다.
  - 고객이 버튼을 누르지 않으면 요청이 오너에게 오지 않습니다.
  - 기록이 남지 않으니 오너가 CRM 파일에 직접 옮겨 적어야 합니다.
- **연결한 뒤에도 이 버튼은 계속 보입니다.** 사이트는 `no-cors` 방식으로 보내기 때문에 시트 저장이 성공했는지 알 수 없습니다. 그래서 아래 10단계의 20회 테스트가 꼭 필요합니다.

---

## 준비물

- 오너 Google 계정(Gmail). 사업용 계정을 따로 쓰고 2단계 인증을 켜 두기를 권합니다.
- Cloudflare Pages에 배포된 사이트(`business/08-배포-가이드.md`).
- (선택) Cloudflare Turnstile 봇 차단(아래 "Turnstile 연결" 절).

---

## 설정 순서

화면의 메뉴 이름은 계정 언어와 Google의 화면 변경에 따라 조금 다를 수 있습니다. 그래서 한국어와 영어 이름을 함께 적었습니다.

### 1단계: Google 시트 만들기

1. <https://sheets.google.com> → **빈 스프레드시트**.
2. 이름을 정합니다. 예: `{BRAND} 견적 요청`(예: `우리동네 홈케어 견적 요청`).
3. **파일(File) → 설정(Settings) → 시간대(Time zone)**를 사업하는 도시(예: Toronto)로 맞추고 저장합니다.
4. 탭은 따로 만들지 않아도 됩니다. 스크립트가 "Leads" 탭을 자동으로 만듭니다.

### 2단계: Apps Script 열기

1. 그 시트의 메뉴에서 **확장 프로그램(Extensions) → Apps Script**.
2. 새 탭에 편집기가 열립니다. 왼쪽 위 "제목 없는 프로젝트(Untitled project)"를 눌러 이름을 바꿉니다. 예: `Lead form`.

> 꼭 **시트 안에서** 열어야 합니다. script.google.com에서 따로 만든 프로젝트는 이 시트를 찾지 못합니다.

### 3단계: 코드 붙여넣기

1. 편집기의 `Code.gs`(또는 `코드.gs`)에 있는 기존 내용(`function myFunction() { … }`)을 모두 지웁니다.
2. 이 저장소의 `integrations/google-apps-script/Code.gs` 내용을 **전부** 복사해서 붙여넣습니다.
   - GitHub에서 파일을 열고 오른쪽 위 복사 아이콘(Copy raw file)을 누르면 편합니다.
3. 저장합니다(디스크 아이콘, 또는 Ctrl+S / ⌘+S).

> 첫 줄의 `@OnlyCurrentDoc`는 지우지 마세요. 스크립트가 **이 시트 하나에만** 접근하도록 권한을 좁혀 줍니다.

### 4단계: 스크립트 속성 넣기

1. 왼쪽 톱니바퀴 **프로젝트 설정(Project Settings)**.
2. 같은 화면의 **시간대(Time zone)**를 1단계와 같은 도시로 맞춥니다.
3. 맨 아래 **스크립트 속성(Script Properties) → 스크립트 속성 추가(Add script property)**.

| 속성 | 값 | 필수 |
|---|---|---|
| `OWNER_EMAIL` | 알림을 받을 이메일 주소 | **필수** |
| `TURNSTILE_SECRET` | Cloudflare Turnstile의 **비밀 키(Secret key)** | 선택. 아래 "Turnstile 연결"을 먼저 읽으세요. |
| `BRAND` | 알림 메일에 쓸 상호. 비워 두면 `Neighbourhood Home Care / 우리동네 홈케어` | 선택 |

4. **스크립트 속성 저장(Save script properties)**.

### 5단계: 권한 승인 + 테스트 실행

1. 왼쪽 `< >` **편집기(Editor)**로 돌아갑니다.
2. 위쪽 함수 선택 칸에서 **`testSetup`**을 고르고 **실행(Run)**을 누릅니다.
3. "승인 필요(Authorization required)" → **권한 검토(Review permissions)** → 본인 계정 선택.
4. "Google에서 확인하지 않은 앱(Google hasn't verified this app)" 경고가 나옵니다. 오너가 직접 만든 스크립트이므로 **고급(Advanced) → `Lead form`(으)로 이동(안전하지 않음) → 허용(Allow)**을 누릅니다.
   - 요청하는 권한은 세 가지입니다. ① 이 스프레드시트 보기·수정 ② 오너 이름으로 이메일 보내기 ③ 외부 서비스 연결(Cloudflare Turnstile 확인용).
5. 확인할 것:
   - 시트에 **"Leads" 탭**이 생기고, 머리글과 `TEST (delete me)` 줄이 있습니다.
   - `OWNER_EMAIL`로 테스트 메일이 왔습니다(안 보이면 스팸함도 확인).
6. 확인이 끝나면 TEST 줄을 **행 전체 삭제**합니다. 머리글(1행)은 남겨 두세요.

### 6단계: 웹 앱으로 배포

1. 오른쪽 위 **배포(Deploy) → 새 배포(New deployment)**.
2. **유형 선택(Select type)** 옆 톱니바퀴 → **웹 앱(Web app)**.
3. 설명(Description): `v1`.
4. **다음 사용자 인증 정보로 실행(Execute as): 나(Me)**.
5. **액세스 권한이 있는 사용자(Who has access): 모든 사용자(Anyone)**.
   - "Google 계정이 있는 모든 사용자(Anyone with Google account)"가 **아닙니다**. 사이트 방문자는 Google 로그인 없이 양식을 보내기 때문입니다.
   - 대신 주소를 아는 사람은 누구나 데이터를 **보낼 수** 있습니다. 그래서 숨은 칸과 Turnstile로 걸러 냅니다. 외부 사람이 이 주소로 시트를 **읽을 수는 없습니다**. 스크립트는 저장과 메일 발송만 합니다.
6. **배포(Deploy)**. 권한을 다시 물으면 허용합니다.

### 7단계: 웹 앱 URL 복사 + 확인

1. 화면에 나온 **웹 앱 URL**을 복사합니다. `https://script.google.com/macros/s/…/exec` 형태입니다.
2. 새 브라우저 탭에 붙여넣어 엽니다. 화면에 **`ok`**만 보이면 정상입니다.
   - 로그인 화면이 나오면 5번의 "모든 사용자" 설정이 잘못된 것입니다.
3. 주소가 `/dev`로 끝나면 본인만 쓰는 테스트 주소입니다. 사이트에는 반드시 **`/exec`** 주소를 넣으세요.

### 8단계: Cloudflare Pages에 주소 넣기

1. Cloudflare 대시보드 → **Workers & Pages** → 사이트 프로젝트 → **설정(Settings)** → **변수 및 비밀(Variables and Secrets)** 또는 **환경 변수(Environment variables)**.
2. 변수 추가:
   - 이름: `NEXT_PUBLIC_LEAD_ENDPOINT`
   - 값: 7단계의 `/exec` 주소
   - 유형: 일반 텍스트(Plain text). 이 주소는 사이트 코드에 어차피 공개되므로 비밀이 아닙니다.
   - 환경: **Production**(미리보기 주소에서도 쓰려면 Preview에도 추가)
3. 저장합니다.

### 9단계: 사이트 재배포

- `NEXT_PUBLIC_` 값은 **빌드할 때** 사이트에 들어갑니다. 저장만 해서는 반영되지 않습니다.
- **배포(Deployments)** 탭 → 가장 최근 프로덕션 배포의 `⋯` → **배포 다시 시도(Retry deployment)**. 새 커밋을 올려도 됩니다.
- 빌드가 끝나면 사이트의 개인정보 안내문이 "견적 요청은 사업자의 Google 계정(Google 스프레드시트·Gmail)에 저장됩니다"로 바뀌었는지 확인합니다.

### 10단계: 테스트 20회 + 걸린 시간 기록

결정 메모 10절 4번 항목의 통과 기준입니다(요지): 테스트 제출 20건이 모두 오너에게 도착하고, 걸린 시간을 재서 기록합니다. "1분 안에" 같은 약속은 하지 않습니다.

**방법**
1. 휴대폰으로 사이트를 열고 실제 양식으로 제출합니다. 이름 칸에 `TEST 01` ~ `TEST 20`을 적습니다.
2. 조건을 섞습니다. 한국어·영어 페이지, 켜져 있는 서비스별, 이메일 있음·없음, 마케팅 동의 체크 있음·없음, Wi-Fi·모바일 데이터, 가진 기기의 여러 브라우저(iPhone Safari, Android Chrome 등).
3. 건마다 적습니다.
   - 제출을 누른 시각(휴대폰 시계, 초 단위)
   - 시트의 `receiveDelaySec`
   - 메일 도착 시각(Gmail에서 메일을 열면 보이는 시각)
   - 제출 → 메일 도착까지 걸린 시간
4. **통과 기준:** 20건 **모두** 시트와 메일에 도착해야 합니다. 하나라도 빠지면 아래 "문제 해결"을 봅니다. 해결될 때까지는 문자·이메일 버튼에 의존합니다.
5. 끝나면 TEST 줄을 지웁니다("Rejected" 탭에 생긴 TEST 줄도 지웁니다).

**기록표** (여기에 적거나 CRM 파일로 옮기세요)

| # | 기기·브라우저 | 페이지(ko/en) | 제출 시각 | receiveDelaySec | 메일 도착 시각 | 제출→메일 | 결과 |
|---|---|---|---|---|---|---|---|
| 1 | | | | | | | |
| 2 | | | | | | | |
| 3 | | | | | | | |
| 4 | | | | | | | |
| 5 | | | | | | | |
| 6 | | | | | | | |
| 7 | | | | | | | |
| 8 | | | | | | | |
| 9 | | | | | | | |
| 10 | | | | | | | |
| 11 | | | | | | | |
| 12 | | | | | | | |
| 13 | | | | | | | |
| 14 | | | | | | | |
| 15 | | | | | | | |
| 16 | | | | | | | |
| 17 | | | | | | | |
| 18 | | | | | | | |
| 19 | | | | | | | |
| 20 | | | | | | | |

요약: 도착 __ / 20건, 제출→메일 중간값 __초, 최댓값 __초. 측정한 날짜: ____.

> 측정값은 기록용일 뿐입니다. 고객에게 "몇 분 안에 연락드립니다" 같은 약속을 하지 마세요.

### 차단 테스트 (Turnstile·숨은 칸)

결정 메모 10절 4번 항목의 기준(요지): 토큰 없이 프로그램으로 보낸 요청은 Turnstile이 막아야 합니다. 오너 컴퓨터의 터미널(맥: 터미널, 윈도우: PowerShell)에서 실행합니다. 먼저 아래 내용을 `test.json` 파일로 저장합니다.

```json
{"v":1,"submittedAt":"2026-10-01T15:00:00Z","lang":"en","page":"/curl-test","service":"other","selections":"curl test","estimateLow":null,"estimateHigh":null,"name":"CURL TEST","phone":"","email":"","address":"","preferredDates":"","notes":"","marketingOptIn":false,"marketingConsentText":"","turnstileToken":"","website":""}
```

```bash
# 맥은 curl, 윈도우 PowerShell은 curl.exe 로 입력
curl -sL -H "Content-Type: text/plain;charset=utf-8" --data "@test.json" "https://script.google.com/macros/s/…/exec"
```

마지막 주소는 7단계에서 복사한 실제 `/exec` 주소로 바꿉니다.

| 테스트 | 방법 | 기대 결과 |
|---|---|---|
| A. 토큰 없음 | 위 그대로(`TURNSTILE_SECRET`이 설정된 상태) | 응답 `{"ok":false,"error":"turnstile"}`. "Leads"는 그대로, "Rejected"에 한 줄, 메일 없음. |
| B. 숨은 칸 | `test.json`에서 `"website":""`를 `"website":"x"`로 바꿔 실행 | 응답 `{"ok":false,"error":"rejected"}`. 어디에도 저장되지 않고 메일도 없음. |

- `TURNSTILE_SECRET`을 설정하지 않았다면 A는 "Leads"에 저장되고 메일이 옵니다(`not checked`). Turnstile을 쓰지 않을 때는 이것이 정상입니다.
- 테스트가 끝나면 CURL TEST 줄을 지웁니다.

---

## Turnstile 연결 (봇 차단, 선택)

- Cloudflare Turnstile 무료 플랜: "Up to 20 widgets", "Unlimited challenges", "Free" (결정 메모 F41, [Cloudflare 문서](https://raw.githubusercontent.com/cloudflare/cloudflare-docs/production/src/content/docs/turnstile/plans.mdx), 원문 확인됨).
- 순서:
  1. Cloudflare 대시보드 → **Turnstile** → **위젯 추가(Add widget)**.
  2. 이름을 정하고, 호스트 이름(Hostname)에 사이트 주소를 넣습니다. `○○○.pages.dev`와, 있으면 자체 도메인까지 넣습니다.
  3. 만들면 **사이트 키(Site key)**와 **비밀 키(Secret key)**가 나옵니다.
  4. **사이트 키** → Cloudflare Pages 환경 변수 `NEXT_PUBLIC_TURNSTILE_SITE_KEY` → 사이트 재배포.
  5. **비밀 키** → Apps Script 스크립트 속성 `TURNSTILE_SECRET`.
- ⚠️ **비밀 키는 `NEXT_PUBLIC_` 변수에 넣거나 GitHub에 올리면 안 됩니다.** `NEXT_PUBLIC_` 값은 누구나 볼 수 있습니다.
- ⚠️ **두 키는 함께 넣거나 함께 비워 두세요.**
  - 비밀 키만 넣으면: 사이트가 토큰을 보내지 않아 **모든 요청이 "Rejected" 탭으로만** 가고 메일이 오지 않습니다.
  - 사이트 키만 넣으면: 확인 화면은 보이지만 스크립트가 검사하지 않으므로 봇이 그대로 들어옵니다.
- **"Rejected" 탭을 일주일에 한 번 확인하세요.** 실제 고객이 봇 확인이 끝나기 전에 보내기를 눌렀다면 여기에 남아 있을 수 있습니다.

---

## 코드를 고친 뒤 (주소 그대로 유지)

- **배포(Deploy) → 배포 관리(Manage deployments)** → 연필(수정) 아이콘 → **버전(Version): 새 버전(New version)** → **배포(Deploy)**. 웹 앱 URL은 바뀌지 않습니다.
- 실수로 **"새 배포"**를 또 만들면 URL이 바뀝니다. 그때는 8·9단계를 다시 합니다.
- `lib/lead.ts`에 필드가 추가되면 `Code.gs`의 `LEAD_FIELDS`에도 같은 이름을 추가해야 합니다(AI에게 함께 고쳐 달라고 하세요). 새 열은 시트 끝에 자동으로 붙습니다.

## 연결 끊기

1. Cloudflare Pages에서 `NEXT_PUBLIC_LEAD_ENDPOINT`를 지우고 재배포합니다. 사이트는 문자·이메일 버튼 방식으로 돌아갑니다.
2. Apps Script **배포 관리 → 보관(Archive)**으로 웹 앱을 끕니다.

---

## 개인정보와 CASL (법률 자문 아님)

- **시트에는 개인정보가 들어 있습니다**(이름, 전화, 주소). 공유하지 말고, "링크가 있는 모든 사용자" 공유도 켜지 마세요.
  - 온타리오는 PIPEDA, BC·앨버타는 각 주의 PIPA, 퀘벡은 퀘벡 법이 적용됩니다(결정 메모 6절).
  - 개인정보 유출 기록(breach log)은 24개월 보관합니다(SOR/2018-64, [PIPEDA](https://github.com/justicecanada/laws-lois-xml/blob/main/eng/acts/P-8.6.xml), 결정 메모 6절).
- **동의 증거:** `marketingOptIn`, `marketingConsentText`(체크박스 옆에 보인 문구 그대로), `submittedAt`, `serverReceivedAt`, `page`, `lang` 열이 함께 동의 기록입니다. **고치거나 지우지 마세요.** CASL에서는 동의를 증명할 책임이 보내는 사람에게 있습니다(s.13, 결정 메모 F11, [CASL](https://github.com/justicecanada/laws-lois-xml/blob/main/eng/acts/E-1.6.xml)).
- **수신거부:** 요청을 받으면 **10영업일 안에** 처리합니다. 수신거부 방법은 60일 동안 유효해야 합니다(결정 메모 F11). 시트에 `수신거부` 열을 직접 만들어 날짜를 적으세요.
- **답장할 때:**
  - 문의에 대한 답장은 CASL s.6의 적용을 받지 않지만, 신원 정보는 넣습니다(SOR/2013-221 s.3(b), 결정 메모 F12).
  - 견적 답장은 동의 요건만 면제되고, 신원 정보와 수신거부 문구는 필요합니다(s.6(6), 결정 메모 F11).
  - 그러니 모든 문자·이메일에 `{BRAND}`, `{MAILING_ADDRESS}`, 전화·이메일·웹 연락처, 수신거부 문구(문자는 `Reply STOP to opt out`)를 넣습니다(결정 메모 F11–F13).
- 마케팅 동의 체크가 없는 고객에게는 문의일로부터 6개월간의 묵시적 동의만 적용됩니다(CASL s.10(10), 결정 메모 F11). 모르는 소비자에게 먼저 문자·이메일을 보내는 것(콜드 메시지)은 하지 않습니다.

---

## 확인되지 않은 것 (확인 필요 / not verified)

- **Apps Script 할당량**(하루 메일 발송 수, 외부 호출 수, 실행 시간, 동시 실행 수)은 이번 조사에서 확인하지 않았습니다. 요청이 많아지기 전에 Google의 공식 할당량 페이지("Quotas for Google Services")에서 직접 확인하세요. 메일 할당량을 넘어도 시트 저장은 되고, `notifyResult`에 `failed: …`가 남습니다.
- **전달 속도:** 약속하지 않습니다. 10단계에서 직접 잽니다.
- Turnstile 오류 코드 이름은 Cloudflare 문서를 기준으로 썼고, 조사에서 다시 확인하지는 않았습니다.
- Google·Cloudflare 화면의 메뉴 이름은 바뀔 수 있습니다.

---

## 문제 해결

| 증상 | 확인할 것 |
|---|---|
| 시트에 줄이 안 생김 | Apps Script 왼쪽 **실행(Executions)** 목록에 `doPost` 기록과 오류가 있는지 · 사이트에 넣은 주소가 `/exec`로 끝나는지 · 액세스가 "모든 사용자"인지 · 8단계 뒤에 사이트를 재배포했는지 · Turnstile 키를 한쪽만 넣지 않았는지("Rejected" 탭 확인) |
| 시트에는 있는데 메일이 안 옴 | 그 줄의 `notifyResult` 열 · `OWNER_EMAIL` 철자 · 스팸함 · 할당량(확인 필요) |
| 주소를 브라우저로 열면 로그인 화면 | 6단계 액세스가 "모든 사용자(Anyone)"가 아님. 배포 관리에서 고친 뒤 새 버전으로 배포 |
| 메일 제목에 `[확인 CHECK]` | 메일 본문 맨 위 "확인 필요" 줄을 읽습니다. 대개 `TURNSTILE_SECRET` 오타이거나, Cloudflare 확인을 실행하지 못한 경우입니다. 이런 요청도 버리지 않고 저장합니다. |
| 코드를 고쳤는데 그대로임 | "새 버전"으로 다시 배포했는지(저장만 하면 웹 앱에 반영되지 않음) |
| 실행 기록에 스프레드시트 권한 오류(permission) | 첫 줄의 `@OnlyCurrentDoc` 줄을 지우고 저장 → `testSetup`을 다시 실행해 권한을 다시 승인 → "새 버전"으로 배포. 권한 범위가 이 시트 하나에서 오너의 모든 시트로 넓어지는 대신 문제가 풀립니다. |
