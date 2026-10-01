# 남의 자산을 고쳐 돈 벌기: 판단 메모

작성일 2026-10-01 · 대상: 오너 · 법률·세무 자문이 아니에요. · 숫자 재확인(통합 담당): TrustMRR 표(출시 3개월 이하 1,048개 중 MRR US$1k 이상 1.9%)와 IRCC 국가별 영주권 CSV(한국 2021년 8,140 → 2025년 2,300)를 원본 파일에서 다시 읽어 일치함을 확인했어요.

## 읽는 법 (먼저 1분)

- **(추정)**: 계산하거나 판단한 값이에요. 무엇에 기댔는지 바로 옆에 적었어요.
- **[미확인]**: 확인하지 못한 내용이에요.
- **2차**: 원문 대신 재게재본, 검색 발췌, 제3자 정리로 본 내용이에요.
- **본인 주장**: 당사자가 자기 사이트에 쓴 내용이에요. 다른 곳에서 따로 확인하지 못했어요.
- 모든 출처는 리서치 에이전트들이 **2026-10-01**에 읽었어요. 전체 주소는 맨 끝 영어 부록에 있어요.
- **조사의 한계:** 이 작업 환경의 네트워크가 대부분의 사이트를 막았어요. 막힌 곳은 WSJ, Shopify, Reddit, canada.ca, 네이버 등이에요. 그래서 많은 사실을 원문 전체가 아니라 검색 발췌, GitHub에 올라온 사본, 제3자 정리로 확인했어요. 원문을 직접 읽은 것은 주로 GitHub에 있는 공식 자료예요. 예를 들면 캐나다 법무부가 올린 법령 XML과 Cloudflare 공식 문서가 있어요.
- **용어:**
  - MRR: 매달 반복해서 들어오는 구독 매출
  - API: 프로그램끼리 데이터를 주고받는 공식 통로
  - 오픈소스: 코드가 공개돼 있어서 라이선스(사용 조건)를 지키면 고쳐 쓸 수 있는 소프트웨어
  - 스크래핑: 프로그램으로 웹페이지 내용을 자동으로 긁어 오는 것

---

## 1) 결론

1. **생각 자체는 맞아요.** 남이 만든 것의 불편한 점을 고쳐서 돈을 번 1–2인 사례가 실제로 많아요. Tally, Plausible, Postiz 같은 경우예요(대부분 창업자 발표, 2차). 트로이의 StackEasy도 이미 더 싼 경쟁 앱이 있던 분야에 들어간 경우예요.
2. **오너의 조건에서는 빨리 돈이 되기 어려워요.** 조건은 자본 0, 오너 노동 거의 0, 2–3개월, 광고 없음, 기존 청중 없음이에요.
   - 며칠에서 몇 주 만에 돈을 번 사례는 거의 다 창업자에게 이미 큰 청중이 있었어요.
   - 출시 3개월 이하 제품 1,048개 중 월 US$1,000 이상인 곳은 1.9%였어요(TrustMRR 집계). 이 숫자는 공개를 원한 사람만 모인 표본이라 성공 확률로 읽으면 안 돼요.
3. **이번 후보 9개는 검증에서 모두 탈락했어요.** 고친 점을 누구나 며칠 만에 따라 만들 수 있었고, 무료 대안이 이미 있었어요. 그 개선에 돈을 내겠다는 증거도 없었어요.
4. **가장 맞는 형태(추정):** 큰 플랫폼 안의 부가기능이 아니라, 오너 사이트와 오너 Stripe로 파는 **독립형 개선판**이에요. 조건은 네 가지예요.
   - 재료: 상업 이용이 허락된 공개 자산, 또는 기존 제품에서 문서로 확인된 불편 1–2개
   - 쓸 때마다 AI 비용이 드는 대신, 한 번 만들어 두면 되는 코드
   - 무료로 닿을 수 있는 고객층. 오너에게는 한국어 커뮤니티가 있어요.
   - 메이플 연습 코치가 이미 이 형태예요. 영어로만 된 CELPIP 연습 도구에 한국어 설명을 붙인 제품이니까요.
5. **권고(추정):**
   - 지금 새 제품을 만들지 마세요.
   - 메이플은 11월 1일 일정대로 열어요.
   - 돈이 들지 않는 방법으로 "돈을 내겠다"는 증거를 모아요.
   - 11월 30일에 다시 판단해요.

---

## 2) 트로이(StackEasy) 사례 사실 확인

카드뉴스(teu.insight)의 주장을 하나씩 확인했어요. WSJ 원문은 읽지 못했어요. WSJ 관련 내용은 모두 허가받은 재게재본(Kanebridge News, The Currency)과 한국 언론 보도로 본 **2차** 자료예요.

| 카드뉴스 주장 | 확인 결과 | 출처 |
|---|---|---|
| 2026년 7월 WSJ가 1인 회사 기사에서 소개함 | **2차 확인.** 기사 제목은 "The Rise of Million-Dollar Companies With Just One Employee"이고, 온라인 게재일은 미국 시간 7월 29일 무렵이에요. 중심인물은 Ben Broca이고, 트로이는 보조 사례예요. | kanebridgenews.com 재게재본, thecurrency.news, 머니투데이(PADO) |
| 40세, 플로리다 올랜도 | **2차 확인.** 재게재본에 "said Johnston, 40", "alone in Orlando, Florida"라고 나와요. | kanebridgenews.com |
| StackEasy(stackeasy.ai)를 만들었다 | **확인.** 본인 사이트의 창업자 페이지와 크롬 웹스토어 게시자 이름이 일치해요. 다만 WSJ 발췌에는 "신용카드 혜택 앱"이라고만 나오고, StackEasy라는 이름이 기사에 있었는지는 [미확인]이에요. | stackeasy.ai/about/troy-johnston, 크롬 웹스토어 |
| 모든 카드를 한 화면에서 본다 | **확인**(본인 사이트). 은행 데이터는 MX와 Quiltt라는 연결 서비스로 가져와요. | stackeasy.ai |
| 결제마다 혜택이 가장 큰 카드를 추천한다 | **확인**(본인 사이트, 크롬 확장 설명). | stackeasy.ai, 크롬 웹스토어 |
| 0% 이자 기간 종료와 연회비 청구 전에 알려 준다 | **확인.** 연회비는 45일 전에 알려 줘요. | stackeasy.ai, stackeasy.ai/blog/credit-stacking-dashboard |
| 월 US$25 | **부분 확인.** 14일 체험 뒤 Premium 요금이 $25/월이에요. 카드뉴스가 빠뜨린 것이 두 가지 있어요. 무료 요금제가 따로 있고, 앱 로그인 화면에는 $12/월로 나와요. 자기 페이지끼리 가격이 달라요. | stackeasy.ai, stackeasy.ai/start, app.stackeasy.ai |
| 전에 온라인 사업 3개를 키워 팔았다 | **본인 주장만 확인.** "3개 사업을 7년간 매각, 온라인 매출 $20M 이상"이라고 썼어요. 독립 기록은 없어요. | stackeasy.ai/about/troy-johnston |
| 카드 한도를 사업 자금으로 썼다 | **본인 주장만 확인.** | stackeasy.ai/blog/credit-stacking-for-business |
| 카드 28장, 한도 합계 US$40만 이상 | **본인 주장만 확인.** 그런데 본인 글마다 카드 수가 14장, 17장, 20장, 28장으로 달라요. | stackeasy.ai/about, dev.to/stackeasy 글 2개 |
| 스프레드시트로 관리하다 0% 마감을 놓쳐 손해 봤다 | **본인 주장으로 확인.** 잔액 $12,000인 카드의 0% 기간 끝을 놓쳤다고 썼어요. WSJ 발췌에는 이 이야기가 없어요. | dev.to/stackeasy, stackeasy.ai |
| 그 스프레드시트는 엑셀이었다 | **틀림.** 본인 글에는 "Google Sheet"라고 돼 있어요. | dev.to/stackeasy |
| AI로 코드를 짰다 | **2차 확인.** "used AI to code an app"이라고 나와요. 어떤 AI 도구를 썼는지는 [미확인]이에요. | kanebridgenews.com |
| 직원이 없다 | **2차 확인.** | kanebridgenews.com |
| 개발자 없이 만들었다 | **[미확인].** 외주 개발자를 썼는지는 어느 자료에도 없어요. | — |
| 지금은 크롬 확장 프로그램도 있다 | **확인.** 버전 1.8.2이고, 2026-07-11에 업데이트됐어요. | 크롬 웹스토어 |
| ChatGPT와 Claude에 연결된다 | **확인.** 읽기 전용 연결이에요. | stackeasy.ai/mcp |
| 비용을 빼고 월 약 US$3,000을 벌며 성장 중이다 | **2차 확인.** "around $3,000 a month in profit"이라고 나와요. 본인이 기자에게 말한 숫자로 보이고, 감사를 받은 숫자가 아니에요. 가입자 수는 [미확인]이에요. | kanebridgenews.com |
| "누구나 칼을 가졌다, 엑스칼리버를 뽑을 수 있다" (따라 하기가 쉬워졌다는 뜻) | **2차 확인.** 번역이 원문에 충실해요. 따라 만들기가 쉬워져 걱정이라는 맥락에서 나온 말이에요. | kanebridgenews.com |
| 비슷한 카드 앱이 여럿 있다고 WSJ에 말했다 | **[미확인].** 그런 발언은 찾지 못했어요. 비슷한 앱 자체는 실제로 있어요. | 아래 줄 |
| (참고) 경쟁 앱과 가격 | CardPointers는 무료판이 있고 유료는 US$9.99/월이에요(도움말). 2026-10-01부터 연 $99.99로 올랐다는 보도가 있어요(2차). MaxRewards Gold는 $9/월부터 연 결제만 돼요. CardStack+는 $12.99/월이에요. 캐나다의 Rewardly는 무료이고 캐나다 카드 410종 이상을 지원한다고 해요(본인 주장). | 각 회사 도움말과 사이트 |
| (참고) StackEasy를 캐나다에서 쓸 수 있나 | **[미확인].** | stackeasy.ai |

**이 사례에서 배울 점**
- 트로이도 더 싼 앱이 이미 있는 분야에 들어갔어요.
- 그는 자기 불편을 직접 겪은 당사자였어요(카드 수십 장, 본인 주장).
- 사업 경험도 있었다고 해요(본인 주장).
- 그런데도 보도된 이익은 월 약 US$3,000이에요(2차). 오너 목표 C$5,000보다 낮을 가능성이 커요(추정, 오늘 환율은 확인하지 않았어요).

---

## 3) "남의 자산 개선"의 세 가지 형태

| 형태 | 사례 | 무자본·무노동 조건에서 | 플랫폼 위험 | 따라 하기 위험 | 캐나다 법 한계 |
|---|---|---|---|---|---|
| **(가) 더 나은 대체품**: 오너 사이트에서 따로 팔기 | Tally(Typeform·Google Forms 대체), Plausible(Google Analytics 대체), Photopea(Photoshop 대체) | **가장 잘 맞아요(추정).** Cloudflare 무료 요금제로 하루 10만 요청까지 처리해요(공식 문서). 오너 Stripe를 쓸 수 있어요. 단, 청중 없이는 느려요. Plausible은 첫 유료 고객 뒤 $400 MRR까지 324일, Tally는 2020년 9월 출시 뒤 2022년 2월에 월 $1만이었어요(창업자 글, 2차). Photopea는 "처음 7,000시간 동안 $0"이었어요(2차). | 낮아요. 큰 회사가 같은 기능을 내도 살아남은 예가 있어요. Notion이 2024-10-24 폼 기능을 냈지만 Tally는 계속 컸어요(2차). | **높아요.** 한 앱 개발자는 "이미 잘되는 것만 복제한다"는 전략으로 월 $35K를 번다고 해요(본인 발표, 2차). 같은 주에 거의 같은 앱이 GitHub에 올라오기도 해요(4장 바코드 후보). | 코드·글·디자인 복사 금지(저작권법 s.3, s.27). 상업 목적 침해는 작품당 C$500–20,000 법정손해배상(s.38.1). 남의 상표를 제품명·도메인에 쓰면 안 돼요(상표법 s.20, s.22). "X보다 정확하다" 같은 주장은 미리 제대로 시험해야 해요(경쟁법 s.74.01(1)(b)). 아이디어 자체는 보호되지 않는다는 판례는 [미확인]이에요. |
| **(나) 큰 플랫폼 안의 부가기능**: Shopify 앱, 크롬 확장 등 | Closet Tools(Poshmark), Superpower ChatGPT, Kleo(LinkedIn), Black Magic(Twitter) | **잘 안 맞아요(추정).** Shopify는 등록비 US$19, Shopify 결제 필수(오너 Stripe 불가), 영어 시연 영상, 심사 5–10영업일(30일–4개월이라는 보고도 있어요)이 필요해요(2차). 크롬은 등록비 US$5(2차), 결제 수단 직접 마련, 유료면 실제 주소 공개가 필요해요(구글 보관 문서). Google Workspace에서 Gmail 같은 제한 권한을 쓰면 매년 US$500–4,500의 외부 보안 심사가 필요해요(2차). | **높아요.** Twitter API 유료화 뒤 Black Magic은 $50만 제안을 거절했다가 $12.8만에 팔렸어요. Reddit API 가격 때문에 Apollo가 2023-06-30 종료됐어요. GummySearch는 2025-11-30 신규 가입을 닫았어요. LinkedIn은 사용자 7만 명인 Kleo 확장에 중단 요구를 보냈어요. ChatGPT는 2024-12-13 폴더(Projects)를 직접 냈어요(모두 2차). | 높아요. 앱 스토어 검색에서 별점 4.9–5.0의 무료 앱과 바로 비교돼요. | 플랫폼 약관이 스크래핑과 역설계를 금지해요(Shopify 약관, 2차). 플랫폼 이름을 앱 이름에 쓰면 안 돼요(Shopify 파트너 계약 5.3, 2차). 사용자 데이터는 개인정보보호법 PIPEDA가 정한 동의를 받아야 해요(s.6.1). |
| **(다) 공개 자산 재포장**: 정부 공개 데이터나 오픈소스를 쓰기 쉽게 | Postiz(오픈소스), MacWhisper(Whisper), GummySearch(Reddit 데이터). 캐나다: IRCC 처리기간 데이터를 다시 보여 주는 GovWait 등 | **조건부로 맞아요(추정).** 정부 공개 데이터 라이선스(OGL-Canada)는 출처 표시를 하면 상업 이용을 허락해요. 단, 로고는 쓸 수 없고 정부가 보증하는 것처럼 보여도 안 돼요(라이선스 원문 사본). 서버와 DB가 필요한 오픈소스는 무료 요금제로 못 돌려요. Cloudflare Containers는 월 $5 유료 요금제가 있어야 해요(공식 문서). | 중간이에요. 데이터 제공처가 형식을 바꾸거나 막을 수 있어요. Reddit은 2026-10-31 새 API 신청을, 2026-11-13 RSS를 끝낸다고 발표했어요(2차). | **높아요.** 같은 데이터는 누구나 쓸 수 있고 무료 재포장도 이미 있어요. 유료판은 "무료 코드에 화면만 씌웠다"는 비판을 받기도 해요(MacWhisper 토론). | 일반 canada.ca 페이지는 상업적 재배포에 서면 허가가 필요해요(2022 사본, 2차). AGPL 코드를 고쳐 서비스하면 고친 코드를 사용자에게 공개해야 해요(s.13). n8n 라이선스는 판매를 금지해요. 이민·시민권 분야에서 돈을 받고 조언하면 처벌받아요(IRPA s.91, 시민권법 s.21.1). 최대 C$200,000 벌금 또는 2년이에요. |

**정리(추정):** 오너에게는 (가)와 (다)를 오너 사이트에서 섞는 방식이 가장 맞아요. (나)는 등록비, 플랫폼 결제 규칙, 사람이 해야 하는 등록 작업, 플랫폼 위험이 모두 커요. 어느 형태든 따라 하기 위험은 높아요. 그래서 "무엇을 고치나"보다 **"누구에게 무료로 닿나"**가 승부를 가르는 경우가 많아요. 근거는 앞의 사례들에서 빨리 번 곳이 모두 청중이 있었다는 점이에요.

---

## 4) 후보 순위

### 검증을 통과한 후보: **없음 (9개 중 0개)**

검증 담당자는 "탈락"을 기본값으로 두고, 증거가 버티는 후보만 남겼어요. 점수는 6개 항목을 각각 1–5점으로 매긴 거예요.
- 6개 항목: 수요 증거, 무자본 적합, 오너 노동 적음, 법 안전, 따라 하기 어려움, 첫 매출 속도
- 30점이 만점이고, 점수가 높을수록 좋아요.

| 후보 | 고치려던 것 | 탈락한 핵심 이유 | 점수 |
|---|---|---|---|
| Shopify 바코드 라벨 앱 | Shopify 공식 무료 앱의 불편이에요. 별점 2.3, 리뷰 465개(2차, 2026-07-27 수집). | 별점 4.9–5.0인 무료 앱이 이미 여럿 있어요(2차). 거의 같은 앱(Truelabel)이 2026-09-27부터 10-01 사이에 GitHub에서 만들어지고 있어요. 등록비 US$19, Shopify 결제 필수, 심사 지연이 있고, 실제 프린터로 시험해야 해요. | 2·3·2·4·1·1 = **13** |
| Shopify 백업 앱 | Rewind의 가격 인상 불만이에요. 한 리뷰어는 $3에서 $19/월이 됐다고 썼어요. | 10개월 동안 부정 리뷰가 17개뿐이고, 5점 리뷰는 전체 495개예요. 무료 요금제로는 매일 백업을 못 돌려 월 $5 유료가 필요해요(공식 문서). 복구에 실패하면 책임이 크고, 급할 때 사람이 응대해야 해요. | 2·1·1·2·2·1 = **9** |
| Shopify 알림 메일 템플릿 | 2026-03-29 Orderly 사고예요. 1점 리뷰 52개가 "컬렉션이 지워졌다"는 내용이에요(2차). | 사고 여파가 줄었어요(6월 0개, 7월 1개). GitHub에 무료 템플릿 묶음이 많아요. 한 캐나다 리뷰어는 "Claude로 10분이면 된다, 무료"라고 썼어요(2차). 기본 템플릿 저작권은 Shopify에 있어요. | 1·4·4·3·1·2 = **15** |
| 급여 계산 도우미 (정부 계산기 PDOC에 저장 기능을 더한 것) | 국세청(CRA)의 무료 계산기는 입력값을 기억하지 못해요. | Argo Books가 이미 저장, 누적 금액, 급여명세서, T4 신고 자료를 월 C$15에 줘요. 이 가격은 코드 기본값이고 실제 가격은 [미확인]이에요. 무료 계산 엔진도 여럿 있어요. 고객이 원천징수를 빠뜨리면 그 금액의 10%가 벌금이에요(소득세법 s.227(8), 확인). 정확도 부담이 커요. 직원 사회보험번호(SIN)를 보관해야 해요. | 2·4·2·2·1·2 = **13** |
| 캐나다 카드 혜택 지갑 ("캐나다판 StackEasy") | 미국 앱은 캐나다 카드를 잘 지원하지 않아요(2차). | 캐나다에서 돈을 내겠다는 증거가 0이에요. Rewardly(본인 주장), Oh My Cards 같은 무료 도구가 있어요. 2026년에만 만든 사람이 4명 이상이에요. 카드 조건이 매주 바뀌어 데이터 관리 부담이 커요(2차). | 1·4·2·4·1·1 = **13** |
| IRCC 처리기간 한국어판과 알림 | 공식 도구는 지금 숫자만 보여 줘요. | IRCC에 공식 신청 상태 조회가 있어요(2차). 기록과 알림을 주는 무료 앱도 많아요. 그중 MyImmiTracker는 사용자 20만 명 이상이고 $5/월이에요(2차). 한국 국적 영주권 취득자는 2025년 2,300명이에요(IRCC 공개 데이터 가공본, 2차). 유료 조언은 이민법 s.91 위험이 있어요. | 2·4·3·3·1·1 = **14** |
| 한국어 CELPIP 템플릿·실수 규칙 팩 (메이플 추가 판매) | 한국어 설명이 붙은 시험 답안 틀이에요. | 수요 증거가 한 사람뿐이고, 그 사람은 자기 Claude로 무료로 해결했어요(확인). IELTS Corner가 이미 템플릿을 CA$49.50에 팔고 무료 블로그에도 공개해요(그쪽 코드에서 확인). 메이플은 이미 "쓴 문장, 더 나은 문장, 짧은 이유"를 줘요(저장소 확인). | 1·5·4·4·1·1 = **16** |
| 시민권 시험 한국어 준비 | 공식 안내서와 시험은 영어나 프랑스어로만 돼요(시민권법 s.5(1)(e), 확인). | 수요 증거가 없어요. 무료 연습 도구가 많아요. "문제는 영어, 해설은 모국어" 방식은 이미 다른 개발자가 영국 시험용으로 만들었어요(확인). 한국 국적법 제15조에 따르면 스스로 외국 국적을 얻은 사람은 한국 국적을 잃어요(2차). 그래서 대상자가 줄 가능성이 있어요(추론, [미확인]). | 점수 [미확인]: 전달 중 잘림. 결론은 탈락이에요. |
| 첫 직장 영어 롤플레이 | 한인 구인 글에 "영어 가능자" 조건이 있어요(2차). | 한국 워홀러용 면접 롤플레이(WorkAbroad AI, 7일 $9.99)가 이미 있지만 판매 기록은 없어요. Speak는 한국에서 시작한 앱이에요. 수집된 구인 글 약 8개 중 영어를 요구한 것은 2개뿐이에요(2차). | 점수 [미확인]: 전달 중 잘림. 결론은 탈락이에요. |

### 그나마 가까웠던 것: 제품이 아니라 메이플 보강용

| 항목 | 내용 |
|---|---|
| 무엇 | 메이플 **무료 모드**에 한국어 설명이 붙은 영어 답안 틀 약 10개를 넣어요. 따로 팔지 않고, 유료 결제로 이어지게 돕는 용도예요. 검증 담당자의 권고예요. |
| 증거 | 한 학습자가 "외울 수 있는 빈칸 틀"과 "한국어 메타 설명"을 원했어요(n=1, 확인). 돈을 낸 증거는 없어요. |
| 수익 구조 | 따로 받지 않아요. 기존 C$39/30일 이용권 결제를 돕는 역할이에요. Stripe 캐나다 수수료는 국내 카드 기준 2.9% + C$0.30이에요(2차). |
| 무료로 고객 찾기 | 이미 계획한 한국어 커뮤니티 글 3개에 한 줄을 더해요. |
| 오너가 할 일 | 한국어 문장 검토 약 2–3시간을 한 번만 해요(추정, 검증 담당자 추정과 같아요). |
| 법·정책 위험 | 낮아요(추정). 메이플 규칙상 "점수, 밴드, 레벨, CLB"라는 말을 쓸 수 없어서 "Band 7 템플릿" 같은 이름은 안 돼요(저장소 확인). Paragon의 시험 문제를 베끼면 안 돼요. CELPIP 상표가 Paragon 것이라는 점은 [미확인]이에요. |
| 첫 매출까지 | 따로 매출이 생기지 않아요. 메이플 예측은 4개월 동안 +C$8에서 +C$66이에요(추정, 저장소 메모 §7.2). |

(참고) IRCC 처리기간 페이지는 검증 담당자가 "원하면 메이플 사이트에 하루짜리 무료 페이지 정도"라고만 봤어요. 기본 권고는 만들지 않는 거예요.

### 다음 후보가 통과하려면 (추정 기준, 오너 결정 1과 연결)

- 대상 고객 **5명 이상**이 정해진 가격에 사겠다고 글로 답해야 해요. 이 숫자는 급여 후보 검증에서 쓴 기준을 빌린 거예요.
- 고친 점이 무료 대안보다 낫고, 오너만 가진 것(한국어, 캐나다 생활 맥락, 한인 커뮤니티 접근)과 연결돼야 해요.
- 현금 C$0이어야 하고, 오너 시간은 주 1시간 이하여야 해요. 메이플의 K11 기준과 같아요.
- 고위험 영역은 피해야 해요. 이민·시민권 조언, 돈을 보관하거나 송금하는 기능(지급서비스법 s.23 등록 대상), 은행 로그인 정보나 SIN을 대량으로 보관하는 일이 여기에 해당해요.

---

## 5) 메이플 연습 코치와의 관계

**메이플은 계속 출시해요.**
- 이미 만든 제품이고, 고정비가 약 C$0이에요(저장소 메모 §7.2, 추정).
- 저장소 규칙 K1에 따라 11월 1일까지 결제가 작동하게 해요.
- 규칙 K11에 따라, 최근 30일 순이익이 −C$20 아래로 가거나 오너 응대가 주 1시간을 넘을 때만 접어요. 그 전에는 느린 자산으로 그대로 둬요.

**메이플은 이미 "남의 자산 개선"이에요.**
- 영어 전용 CELPIP AI 도구가 이미 팔리고 있어요. CELPIPAce는 C$24.99/월, IELTS Corner는 CA$5/월이에요. 둘 다 그쪽 코드에서 확인했고, 실제 결제 가격은 [미확인]이에요.
- 메이플은 여기에 한국어 설명을 더했어요.
- 경쟁은 빠르게 늘고 있어요. GitHub에 "celpip" 저장소가 212개이고, 그중 37개가 2026-08-01 이후에 생겼어요(확인).
- 대상층은 줄고 있어요. 한국 국적 영주권 취득자는 2021년 8,140명에서 2025년 2,300명으로 줄었어요(IRCC 공개 데이터 가공본, 2차. 같은 파일의 2025년 전체 합계가 381,535명이라 1년치 자료로 보이지만, IRCC 원본은 [미확인]).

**확장이냐, 별도 제품이냐**
- 통과한 후보가 없으니 지금은 **별도 제품을 만들지 않아요.**
- 작은 개선은 **메이플 안에서** 해요(답안 틀 10개).
- 저장소에는 이미 "11월 30일 전 두 번째 제품 없음, 11월 순이익 C$500 이상일 때만 검토"라는 규칙(K6)이 있어요. 이 규칙을 바꿀지는 6장 결정 1에서 다뤄요.

**앞으로 2주 할 일 (10월 1일 목 – 10월 14일 수, 새 돈 0원)**

| 기간 | 누가 | 할 일 | 오너 시간 (추정) |
|---|---|---|---|
| 10/1–10/7 | 오너 | 메이플 설정 안내서(owner-setup.md)를 계속 따라가요. Gate B 이메일을 아직 안 보냈다면 보내요. 보냈는지는 [미확인]이에요. 안내서는 10월 18일까지 답이 없을 때의 규칙을 정해 두었어요. | 기존 계획 안에 포함 |
| 10/1–10/7 | Claude | 한국어 설명을 붙인 답안 틀 10개 초안을 써요. 메이플의 금지어 검사를 통과하게 써요. | 0 |
| 10/1–10/7 | Claude | 커뮤니티 글 하나의 끝에 붙일 질문 한 줄 초안을 써요. 예: "캐나다 생활에서 가장 불편한 앱이나 서비스는? 돈을 내서라도 고치고 싶은 것은?" 각 커뮤니티의 홍보 규칙은 [미확인]이에요. | 0 |
| 10/8–10/14 | 오너 | 답안 틀 10개의 한국어를 검토하고 승인해요. | 2–3시간 |
| 10/8–10/14 | 오너 | 6장 결정 2(네트워크 허용)와 결정 3(소액 등록비)에 답해요. | 약 10–20분 |
| 10/8–10/14 | Claude | 결정 2가 "예"면 주 1회 "불편 수집" 예약 작업을 설정해요. 대상은 Hacker News, GitHub 이슈, WordPress.org 플러그인 평가예요. 결과는 저장소의 pain/연도-주차.md에 저장하고, 보내지 않은 Gmail 초안으로 상위 5개를 정리해요. 사용자 이름은 저장하지 않아요. | 0 |
| 계속 | — | **하지 않을 일:** 새 제품 코드 작성, 유료 등록(Shopify US$19, 크롬 US$5), 스크래핑, Reddit·네이버 카페 자동 수집. 네이버는 2026-08-31 공지로 대량 수집을 금지했어요(2차). | — |

2주 동안 오너가 추가로 쓸 시간은 약 3–5시간이에요(추정, 위 표를 더한 값).

---

## 6) 오너가 꼭 결정할 것 (3개)

**결정 1. "두 번째 제품" 규칙을 바꿀까요?**
- 지금 규칙(K6): 11월 순이익이 C$500 미만이면 두 번째 제품을 만들지 않아요.
- 메이플 예측(4개월 합계 +C$8에서 +C$66, 추정)으로 보면 이 조건을 넘기 어려워요. 그러면 사실상 "두 번째 제품 없음"이 돼요.
- 선택지:
  - (가) 지금 규칙을 그대로 둬요.
  - (나) 돈 기준 대신 **증거 기준**으로 바꿔요.
- **권고 기본값: (나).** 11월 30일에 4장의 "통과 기준"을 모두 채운 후보가 있을 때만 만들어요. 없으면 아무것도 만들지 않아요.

**결정 2. 자동 "불편 수집"을 위해 네트워크를 열까요?**
- 지금 이 환경에서는 GitHub만 자동으로 읽을 수 있어요(확인).
- 오너가 클라우드 환경의 Network access 설정에서 도메인 6개를 추가해야 해요: hn.algolia.com, hacker-news.firebaseio.com, api.wordpress.org, wordpress.org, open.canada.ca, data.ontario.ca.
- 한 번만 하면 되고 약 10분이 걸려요(추정).
- 예약 작업이 추가 요금을 쓰는지는 [미확인]이에요.
- **권고 기본값: 예.** 주 1회 돌리고, 요금이 청구되는 게 보이면 바로 멈춰요.

**결정 3. 작은 일회성 등록비를 허용할까요?**
- 크롬 웹스토어 US$5(2차)와 Shopify US$19(2차)예요.
- **권고 기본값: 아니요.** 결정 1의 증거 기준을 통과한 후보가 나오기 전까지는 C$0을 지켜요.

---

## 7) 예상 질문

**Q1. 트로이는 혼자 월 US$3,000을 번다는데, 저도 비슷하게 할 수 있지 않나요?**
- 그 숫자는 본인이 기자에게 말한 이익으로 보여요(2차). 감사를 받은 숫자가 아니에요.
- 그는 카드 수십 장을 직접 쓰던 당사자였고, 사업을 3개 팔아 봤다고 해요(본인 주장).
- 출시 3개월 이하 제품 가운데 월 US$1,000을 넘은 곳은 1.9%였어요(TrustMRR, 자기선택 표본).
- 가능은 하지만 2–3개월 안에는 드문 일이에요(추정).

**Q2. StackEasy를 캐나다용으로 똑같이 만들면 되지 않나요?**
- 검증에서 탈락했어요.
- 캐나다에서 돈을 내겠다는 증거가 없어요.
- Rewardly 같은 무료 도구가 이미 있어요.
- 2026년에만 같은 것을 만드는 사람이 4명 이상이에요.
- 카드 조건이 매주 바뀌어서 오너 노동이 커져요(2차).

**Q3. 남의 제품을 고쳐서 파는 게 불법은 아닌가요?**
- 기능과 아이디어를 자기 코드로 다시 만드는 것은 대체로 괜찮아요. 저작권법은 작품 "또는 그 상당 부분"의 복제를 막아요(s.3, 확인). 아이디어 자체가 보호되지 않는다는 판례는 [미확인]이에요.
- 하지만 다음은 안 돼요.
  - 남의 코드, 글, 그림을 복사하기
  - 남의 상표를 이름이나 도메인에 쓰기
  - 시험해 보지 않고 성능을 비교하기(경쟁법 s.74.01(1)(b))
  - 약관이 금지한 자동 수집
- 이민이나 시민권에 대해 돈을 받고 조언하는 것은 형사처벌 대상이에요(IRPA s.91, 시민권법 s.21.1).

**Q4. AI가 다 만들면 저는 정말 할 일이 없나요?**
- 아니요. 사람이 해야 하는 일이 있어요.
  - 결제 회사나 플랫폼에 신분증과 주소 올리기(Gumroad 결제사 신원 확인 등, 2차)
  - Shopify 영어 시연 영상(2차)
  - 한국어 문장 검토
  - 고객이 "이 숫자가 맞냐"고 물을 때 책임지기
- 그래서 새 제품에도 "오너 주 1시간 이하" 기준을 권해요(추정).

**Q5. 메이플을 접고 새 아이디어로 갈아탈까요?**
- 권하지 않아요(추정).
- 메이플은 고정비가 약 C$0이에요. 저장소 규칙 K11에 따르면 응대 시간이 주 1시간을 넘지 않는 한 계속 둘 수 있어요.
- 새 후보 9개 중 메이플보다 증거가 강한 것은 없었어요.

---

## 부록 (English): every source URL used

All sources were read 2026-10-01 by the research agents. Most non-GitHub pages were seen only through search excerpts or third-party copies (labelled "secondary" in the memo).

**StackEasy / WSJ fact-check**
- https://kanebridgenews.com/the-rise-of-million-dollar-companies-with-just-one-employee/
- https://kanebridgenews.co.uk/the-rise-of-million-dollar-companies-with-just-one-employee/
- https://thecurrency.news/articles/235043/the-rise-of-million-dollar-companies-with-just-one-employee/
- https://www.mt.co.kr/world/2026/08/08/2026080716000127314
- https://www.sedaily.com/article/20075753
- https://x.com/WSJ/status/2082671616266240060
- https://www.linkedin.com/in/troyjohnston/
- https://www.stackeasy.ai/
- https://www.stackeasy.ai/start
- https://app.stackeasy.ai/
- https://www.stackeasy.ai/about/troy-johnston
- https://www.stackeasy.ai/mcp
- https://www.stackeasy.ai/blog/credit-stacking-dashboard
- https://www.stackeasy.ai/blog/credit-stacking-for-business
- https://www.stackeasy.ai/blog/maxrewards-vs-cardpointers
- https://chromewebstore.google.com/detail/stackeasy-%E2%80%94-smart-card-pi/dfeidimbamanpcnopbignggngpdmnnke
- https://dev.to/stackeasy/how-i-built-a-credit-card-management-dashboard-and-why-spreadsheets-were-not-cutting-it-il1
- https://dev.to/stackeasy/using-automation-to-track-0-apr-deadlines-across-20-credit-cards-5dhg
- https://help.cardpointers.com/article/43-how-much-does-cardpointers-cost
- https://frequentmiler.com/cardpointers/
- https://cardpointers.com/
- https://help.maxrewards.com/en/articles/4655205-how-much-is-maxrewards-gold
- https://cardstack.money/
- https://rewardly.ca/blog/rewardly-vs-cardpointers-canada-2026.html

**Improve-an-existing-asset cases and base rates**
- https://github.com/mifanr/trustmrr-research
- https://raw.githubusercontent.com/mifanr/trustmrr-research/main/data/report_v2.txt
- https://blog.tally.so/6-years-in-6-million-far/
- https://blog.tally.so/how-we-bootstrapped-tally-to-10k-mrr/
- https://thomasjfrank.com/every-notion-feature-released-in-2024/
- https://plausible.io/blog/bootstrapping-saas
- https://news.ycombinator.com/item?id=29001723
- https://github.com/gitroomhq/postiz-app
- https://trustmrr.com/startup/postiz
- https://news.tonydinh.com/p/making-22k-in-7-days-the-story
- https://news.tonydinh.com/p/apr-2023-i-sold-black-magic
- https://news.tonydinh.com/p/may-2023-i-sold-my-2-years-old-business
- https://x.com/jakezward/status/1964054021443887510
- https://www.indiehackers.com/post/tech/from-0-to-62k-mrr-in-three-months-mUPVSYOlJAC2iogGK7d4
- https://venturebeat.com/ai/openai-launches-chatgpt-projects-letting-you-organize-files-chats-in-groups
- https://techcrunch.com/2023/06/08/popular-third-party-reddit-app-apollo-is-shutting-down-as-a-result-of-reddits-new-api-pricing/
- https://syncsuptech.substack.com/p/gummysearch-shuts-down
- https://github.com/ggml-org/whisper.cpp/discussions/420
- https://www.starterstory.com/stories/i-cloned-3-apps-and-now-make-35k-month

**Pain-mining sources and terms**
- https://techcrunch.com/2026/09/30/reddit-is-killing-rss-feeds-ending-public-api-access-because-of-ai-bots/
- https://www.newsis.com/view/NISX20260831_0003769836
- https://code.claude.com/docs/en/claude-code-on-the-web

**Marketplaces and hosting**
- https://raw.githubusercontent.com/GoogleChrome/developer.chrome.com/main/site/en/docs/webstore/register/index.md
- https://raw.githubusercontent.com/GoogleChrome/developer.chrome.com/main/site/en/docs/webstore/cws-payments-deprecation/index.md
- https://raw.githubusercontent.com/GoogleChrome/developer.chrome.com/main/site/en/docs/webstore/set-up-account/index.md
- https://raw.githubusercontent.com/tomada1114/braintrust/HEAD/docs/plan/indie-earning-fields/research/marketplace-surfaces.md
- https://raw.githubusercontent.com/d-beck/shopify-partner-agreement/HEAD/shopify-partner-agreement.md
- https://raw.githubusercontent.com/NangoHQ/nango/HEAD/docs/api-integrations/google-shared/google-security-review.mdx
- https://raw.githubusercontent.com/kelvinlim/wearable-hub/HEAD/docs/google-verification/01-casa-tier-assessment.md
- https://raw.githubusercontent.com/cloudflare/cloudflare-docs/production/src/content/docs/workers/platform/limits.mdx
- https://raw.githubusercontent.com/cloudflare/cloudflare-docs/production/src/content/docs/workers/platform/pricing.mdx
- https://raw.githubusercontent.com/cloudflare/cloudflare-docs/production/src/content/docs/containers/platform/pricing.mdx

**Canadian law, licences and platform terms**
- https://raw.githubusercontent.com/justicecanada/laws-lois-xml/main/eng/acts/C-42.xml (Copyright Act)
- https://raw.githubusercontent.com/justicecanada/laws-lois-xml/main/eng/acts/T-13.xml (Trademarks Act)
- https://raw.githubusercontent.com/justicecanada/laws-lois-xml/main/eng/acts/C-34.xml (Competition Act)
- https://raw.githubusercontent.com/justicecanada/laws-lois-xml/main/eng/acts/P-8.6.xml (PIPEDA)
- https://raw.githubusercontent.com/justicecanada/laws-lois-xml/main/eng/acts/I-2.5.xml (IRPA)
- https://raw.githubusercontent.com/justicecanada/laws-lois-xml/main/eng/acts/C-29.xml (Citizenship Act)
- https://raw.githubusercontent.com/justicecanada/laws-lois-xml/main/eng/acts/I-3.3.xml (Income Tax Act)
- https://raw.githubusercontent.com/justicecanada/laws-lois-xml/main/eng/acts/R-7.36.xml (Retail Payment Activities Act)
- https://raw.githubusercontent.com/spdx/license-list-data/main/text/OGL-Canada-2.0.txt
- https://raw.githubusercontent.com/bilal21a/cd_search_html/main/en/transparency/terms.html (canada.ca terms mirror, 2022-07-28)
- https://github.com/plausible/analytics (LICENSE.md, AGPL-3.0 s.13)
- https://raw.githubusercontent.com/n8n-io/n8n/master/LICENSE.md
- https://raw.githubusercontent.com/ratyagi/AI_agent_compatibility/main/data/raw/tos_texts/shopify.com.txt (Shopify ToS copy)
- https://raw.githubusercontent.com/legalize-kr/legalize-kr/HEAD/kr/%EA%B5%AD%EC%A0%81%EB%B2%95/%EB%B2%95%EB%A5%A0.md (Korean Nationality Act mirror)

**Candidates and verification**
- https://raw.githubusercontent.com/kerthans/shopify-app-review-crawler/main/docs/data/apps/retail-barcode-labels.json
- https://raw.githubusercontent.com/kerthans/shopify-app-review-crawler/main/docs/data/apps/backup.json
- https://raw.githubusercontent.com/kerthans/shopify-app-review-crawler/main/docs/data/apps/email-templates.json
- https://raw.githubusercontent.com/4gather-ai/portfolio-apps/HEAD/PESQUISA.md
- https://raw.githubusercontent.com/Saimshafi0/truelabel/HEAD/README.md
- https://github.com/leemunroe/shopify-email-templates
- https://github.com/maizzle/shopify-notification-templates
- https://raw.githubusercontent.com/asterling/T4127-Engine/main/README.md
- https://raw.githubusercontent.com/ArgoBooks/Argo-Books-website/main/payroll/index.php
- https://raw.githubusercontent.com/ArgoBooks/Argo-Books-website/main/config/pricing.php
- https://raw.githubusercontent.com/ArgoBooks/Argo-Books-website/main/config/competitors.json
- https://github.com/GautamTalksDev/takehome
- https://raw.githubusercontent.com/vuthayak/Churney/main/docs/research/06-competitive-analysis.md
- https://raw.githubusercontent.com/peteseta/cardmatch/main/docs/research/final/market-research.md
- https://github.com/ChenFangfc/Oh_My_Cards
- https://raw.githubusercontent.com/artwisdom/govwait/main/handoff/HANDOFF_04_RESEARCH_COMPETITORS.md
- https://raw.githubusercontent.com/munsifhayat/immi-pulse/main/context/market-research/01-tracker-apps.md
- https://raw.githubusercontent.com/aafre/ircc-processing-times/main/README.md
- https://raw.githubusercontent.com/CanadaObservatory/canada-observatory/HEAD/data/population/ircc_pr_by_country.csv
- (one learner's public study notes on GitHub; link left out of this file for that person's privacy)
- https://raw.githubusercontent.com/clintviegas/celpipace/HEAD/src/data/paymentPlans.js
- https://raw.githubusercontent.com/karaabd23-crypto/ieltscorner-site/HEAD/src/lib/celpipWritingData.mjs
- https://raw.githubusercontent.com/karaabd23-crypto/ieltscorner-site/HEAD/src/pages/ebook/index.astro
- https://raw.githubusercontent.com/golikovichev/lifeintheuk-guide/HEAD/index.html
- https://raw.githubusercontent.com/kcemenike/canadian-citizenship-test-app/HEAD/README.md
- https://raw.githubusercontent.com/rnkhobbies/ircc-monitor/HEAD/README.md
- https://raw.githubusercontent.com/leopardlee/vanti_2.0/HEAD/public/uvanu-live-feed.json
- https://github.com/Glory-yk/- (apps/work-abroad-ai/index.html, WorkAbroad AI)

**Owner's own repo (local files)**
- /home/user/canadian-tool-deals/business/online/decision-memo.md (§7.2 zero-capital forecast; kill rules K1, K6, K10, K11)
- /home/user/canadian-tool-deals/business/online/owner-setup.md
- /home/user/canadian-tool-deals/business/online/gate-b-anthropic-email.md
- /home/user/canadian-tool-deals/products/clb/content/help.ts and /home/user/canadian-tool-deals/products/clb/worker/src/grading/prompt.ts
