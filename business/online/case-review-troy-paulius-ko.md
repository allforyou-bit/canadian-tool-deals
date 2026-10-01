# 사례 종합 검토: 트로이(StackEasy)와 파울리우스(Vibed Agents)

작성일 2026-10-01 · 대상: 오너 · 법률·세무 자문이 아니에요.

함께 보는 문서: `improve-existing-assets-memo-ko.md`(남의 자산 개선 판단 메모, 트로이 사실 확인 표 포함), `decision-memo.md` §7.2(무자본 계획과 중단 규칙).

## 읽는 법

- **확인**: 1차 자료를 직접 읽었어요. 본인 GitHub, Anthropic 공식 페이지, 법령 원문 같은 자료예요.
- **2차**: 검색 발췌, 재게재본, 제3자 글로만 봤어요.
- **틀림**: 자료가 카드뉴스와 다르게 말해요.
- **[미확인]**: 찾지 못했어요.
- **(추정)**: 계산이나 판단이에요. 근거를 옆에 적었어요.
- **조사의 한계:** 이 작업 환경에서 X(트위터), Substack, YouTube, 레딧, 크몽, 인프런 같은 사이트가 막혀 있었어요. 웹 검색 한도(세션당 200회)도 중간에 다 썼어요. 그래서 많은 내용이 2차예요. 대신 막히지 않은 본인 GitHub 저장소와 공식 문서로 1차 확인을 최대한 했어요.
- 각 조사는 "찾는 담당"과 "반박하는 담당"이 따로 했어요. 아래 표는 반박 검증을 거친 결과예요.

---

## 1. 결론

1. **두 사람 모두 실제 인물이고, 실제로 돈을 벌었다는 근거는 있어요.** 하지만 두 카드뉴스(같은 계정 teu.insight) 모두 숫자와 이야기를 부풀리거나 바꿨어요. 영감으로는 쓸 수 있어도 증거로 쓰면 안 돼요.
2. **두 사람에게는 있고 오너에게는 없는 것이 성공을 갈랐을 가능성이 커요(추정).** 바로 **이미 모인 청중**이에요.
   - 파울리우스는 2021년부터 X를 했고 팔로워가 약 1.5만–2.9만이었어요(2차, 시점별). 첫 수익 앱 출시 글은 약 50만 회 조회됐어요(2차).
   - 트로이는 사업을 세 번 팔아 봤다고 하고(본인 주장), WSJ 기사에 소개됐어요(2차).
3. **"만들다 막힌 곳을 도구로 만들어 판다"는 방법은 사장님 상황에 이미 적용돼 있어요.** 사장님이 막힌 곳마다 제가 도구를 만들었으니까요. 한국어 초보자 가이드, Cloudflare 원클릭 설정, 환불 워크플로가 그 예예요. 그런데 이걸 **팔 수 있는지** 조사해 보니 증거가 약했어요.
   - 무료 공식 도구가 같은 일을 이미 해요.
   - 비개발자용 한국어 상품의 판매 기록은 10–22건 수준이에요.
   - 청중 없이 2–3개월 안에 판다면 매출 예상은 약 C$0–200이에요(추정).
4. **권고(추정):** 지난 메모와 같아요.
   - 메이플 연습 코치를 11월 1일에 열어요.
   - 새 제품은 만들지 않아요.
   - 대신 돈 안 드는 **청중 쌓기 실험**(아래 6장)을 할지 사장님이 정해 주세요.
   - 11월 30일 점검일에 다시 판단해요.

---

## 2. 카드뉴스(teu.insight)의 공통 문제

두 게시물에서 같은 패턴이 보였어요.

| 패턴 | 트로이 게시물 | 파울리우스 게시물 |
|---|---|---|
| 세부 사항 바꾸기 | "엑셀" → 실제로는 Google Sheet(본인 글) | "핀터레스트 광고대행사" → 실제로는 핀터레스트 직원(2차). "회사를 그만두고 시작" → 실제로는 다니면서 만들고 나중에 그만둠(2차) |
| 불리한 정보 빼기 | 무료 요금제, $12/월 화면 | 첫 수익 앱은 AI 에이전트가 아니라 노코드(Framer, Airtable)로 만들었다는 점(2차). 공동창업자가 있다는 발췌(2차). 서비스 이름이 바뀌었다는 점(확인) |
| 인용문 바꾸기 | — | "거침없던 적이 없다" → 원문 표현은 "unstoppable"(2차). "월 20달러부터" → 그는 $100–200 요금제를 말했어요(2차) |
| 숫자 키우기 | 순이익 약 US$3,000을 "420만 원"으로 환산 | 매출 합계를 "1억 원 넘게 벌었다"로 표현했어요. 매출이지 이익이 아니고, 앱 10개 이상을 합친 숫자예요(2차) |

---

## 3. 파울리우스 사실 확인 (1–10장)

| 장 | 카드뉴스 주장 | 결과 | 근거 요약 |
|---|---|---|---|
| — | 파울리우스 마살스카스 = X @0xPaulius | **확인** | 본인 GitHub(PauliusOS/komand-app) README와 약관에 이름과 계정이 나와요. |
| 1 | 깃 커밋도 모르던 비개발자 | **[미확인], 반대 증거 있음** | 그 문장은 제3자 Substack 글에만 있어요. 본인 GitHub에 2023-09-30~10-02 커밋과 AI 챗봇 앱이 있어요(확인). 첫 수익 앱보다 약 11개월 앞서요. "몇 년 동안 바이브 코딩을 실험했다"는 제3자 평도 있어요(2차). |
| 1 | 1억 원 넘게 벌었다 | **2차** | 본인 소개에 "총매출 $100k+, 앱 10개 이상, 사용자 3만+"라고 해요. **매출 합계**이고 이익이 아니에요. 검증된 매출 대시보드는 못 찾았어요. 출처마다 숫자가 달라요($13k, $17k, $30k, $60k 등). |
| 1 | AI 에이전트로 벌었다 | **[미확인]** | 첫 수익 앱(CreatorHunter v1)은 Framer와 Airtable로 만들었다고 본인 글에 있어요(2차). Claude Code는 2025-02-24에 처음 나왔어요(Anthropic 공식, 확인). 첫 수익은 그보다 먼저예요. |
| 2 | Vibed Agents로 월 9,000달러 | **2차, 범위 불명확** | "$9k MRR"(매달 반복되는 매출)은 2025년 말 무렵 본인이 밝힌 한 시점의 숫자예요. 이익이 아니에요. 한 발췌는 "앱 10개 이상 합계 $9k MRR"이라고 해서, Vibed Agents 하나의 매출인지 불명확해요. |
| 2 | Vibed Agents가 지금 그 이름으로 운영 중 | **틀림** | vibed.inc 도메인이 연결되지 않아요(두 가지 방법으로 확인). 그의 앱 Komand 릴리스 노트에 2026년 3월 "Clonk로 이름 변경, clonk.ai로 도메인 변경"이 있어요(확인). 제품군이 Komand와 Clonk로 옮겨 간 것으로 보여요(2차). |
| 3 | 핀터레스트 광고대행사에서 일했다 | **틀림** | 핀터레스트에서 광고대행사를 담당하는 직원("SMB Senior Agency Account Manager")이었어요(2차). |
| 3 | 회사를 그만두고 AI로 만들기 시작 | **틀림(순서)** | 출퇴근 기차에서 만들기 시작했고, 2024년 12월 24일에 그만뒀어요(인터뷰 정리본, 2차). |
| 4 | 첫 앱 CreatorHunter, 2024년 가을 | **부분** | 출시 글은 2024-09-18이에요(게시물 번호로 계산, 2차). "첫 앱"은 틀리고 "첫 **수익** 앱"이에요. |
| 4 | 평생 이용권으로 2024년 11월까지 1만 3천 달러 | **2차** | 2024-11-28 본인 글 "made ~$13k"이 검색 제목으로 확인돼요. 한 번 받고 끝나는 돈이에요. 매달 들어오는 수입이 아니에요. CreatorHunter 전체 매출은 약 9개월에 $30–40k였다는 제3자 정리가 있어요(2차). 이것을 "월 $30,000"으로 잘못 옮긴 글도 있어요. |
| 5 | 2025년 매일 만들어 앱 10개, 사용자 3만 명 | **2차 / [미확인]** | 앱 10개는 본인 주장이에요(2차). 사용자 3만 명은 확인하지 못했어요. |
| 5 | 맥 API 키 관리 도구 | **틀림(시점)** | 그 기능은 2026-02-23 무렵 그의 Komand 앱에 들어간 기능이에요(본인 릴리스, 확인). 2025년 앱이 아니에요. 같은 일을 하는 무료 도구도 있어요(확인). |
| 6 | 2025년 10월 Claude Code로 갈아타 스킬과 MCP를 붙였다 | **대체로 맞음** | Anthropic 스킬 기능은 2025-10-16에 출시됐어요(공식, 확인). 그의 Claude Code 관련 저장소는 10월 16일, 10월 27일에 생겨요(확인). 다만 8월에 이미 비슷한 도구를 복제한 기록이 있어 "10월에 갈아탔다"는 정확하지 않아요. |
| 6 | X에 "이렇게 거침없던 적이 없다" | **틀림(번역)** | 알려진 원문은 "never have i felt so unstoppable"이에요(2차). "막을 수 없는 기분"이라는 뜻이에요. |
| 7 | 크레딧 도구로 바이브 코딩은 도박이라며 정액제를 권함 | **2차** | 알려진 원문은 "$100 for unlimited tokens is the way. Vibe coding is pure gambling if you're using anything that requires AI credits."예요. "돈이 보이면 실험을 덜 한다"는 이유는 원문에서 찾지 못했어요. |
| 7 | Claude Code는 월 20달러부터 | **가격은 맞지만 맥락은 틀림** | Anthropic 공식 가격: Pro는 월 결제 $20, 연 결제 월 $17이고 세금 별도예요(확인). 그런데 그가 권한 것은 $100(Max)이에요. "무제한 토큰"도 틀려요. Max에도 5시간 단위와 주 단위 사용 한도가 있어요(공식, 확인). |
| 8 | 막힌 일 적기 → 작은 도구 만들기 → X에 올려 팔기 | **핵심만 2차** | "자기 작업의 불편을 고친 뒤 상품으로 만든다"는 핵심은 출처가 있어요. "적어 둔다", "X에 올려 판다" 단계는 찾지 못했어요. CreatorHunter가 이 방식에서 나왔다는 근거도 없어요. |
| 9–10 | 앱 10개, 월 1,240만 원 | **2차** | 위 2장, 5장과 같아요. |
| 빠진 정보 | 혼자 했다 | **2차** | "Paulius and Gabe are founders of Vibed Inc Studio"라는 발췌가 있어요. 한 번에 약 $5K를 받는 외주 제작도 한 것으로 보여요(2차). |

---

## 4. 두 사람이 가졌고 오너에게는 아직 없는 것

| 항목 | 트로이 | 파울리우스 | 오너 |
|---|---|---|---|
| 이미 모인 청중 | WSJ 기사(2차), 사업 이력(본인 주장) | X 팔로워 약 1.5만–2.9만(2차), 출시 글 약 50만 회 조회(2차) | 없음 |
| 직접 겪은 문제 | 카드 수십 장(본인 주장, 글마다 14–28장) | 앱을 만들며 겪은 불편 | 비개발자로서 출시하며 겪은 불편(실제로 겪는 중) |
| 기술 경험 | AI로 코딩(2차) | 2023년부터 코드 실험(확인), 마케팅 경력(2차) | 없음. Claude가 대신해요. |
| 들인 시간 | [미확인] | 회사 다니며 출퇴근 시간 + 이후 전업, 2025년 매일 작업(2차) | 주 1시간 이하를 원해요 |
| 보도된 결과 | 월 이익 약 US$3,000(2차, 본인 발언) | $9k MRR 한 시점(2차, 본인 발언), 이익은 [미확인] | 메이플 4개월 +C$8–66 예상(추정) |

**정리(추정):** 두 사람의 결과는 "AI로 만들었다"보다 "**누구에게 바로 보여 줄 수 있었다**"와 "**매일 많은 시간을 썼다**"에서 더 많이 나왔을 가능성이 커요. 이 두 가지는 무자본·저노동 조건과 정면으로 부딪혀요.

---

## 5. 오너에게 적용: "만들다 막힌 곳을 팔기"

### 5-1. Claude Code용 도구(스킬, 에이전트, MCP) 시장

**결론: 지금 오너에게는 맞지 않아요(추정).**

- **이미 많이 나와 있어요.** Anthropic 공식 장터에 공식 플러그인 315개와 커뮤니티 플러그인 2,282개가 있어요(확인). MCP 공식 등록소에는 서버 38,063개가 있어요(확인, 2026-10-01 재집계). 인기 목록 저장소 하나는 별이 7.6만 개예요(확인).
- **Anthropic 장터는 무료 배포만 돼요.** 결제 기능도 수익 배분도 없어요(확인). 팔려면 오너 사이트와 오너 Stripe로 팔아야 해요.
- **실제 매출 신호가 약하고, 떨어지는 중이에요.**
  - ClaudeKit으로 보이는 제품은 최근 30일 US$2,623으로 전달보다 28% 줄었어요.
  - Claude Fast로 보이는 제품은 최근 30일 US$768이에요. 방문자 46,038명 기준으로 1명당 약 4.4센트예요.
  - 둘 다 이름이 익명 처리된 집계를 맞춰 본 추정이에요.
- **출시 3개월 이하 개발 도구의 51–54%는 한 번도 돈을 못 벌었어요**(TrustMRR 공개 집계 재계산, 확인).
- **이름 규칙:** Claude Code를 설치하거나 실행하는 제품은 이름에 "Claude", "Claude Code", "Anthropic"을 쓸 수 없고 Claude 로고도 못 써요(약관, 확인). 가이드나 키트 같은 다른 상품도 Anthropic의 이름을 쓰려면 서면 허가가 필요해요(상표 지침, 확인). 결국 오너 자신의 브랜드를 쓰고, 본문에서 "Claude Code를 사용해요"라고만 적는 게 안전해요.
- **계정 규칙:** 고객이 오너의 Claude 계정이나 구독을 쓰게 하면 안 돼요. 고객은 각자 자기 계정을 써야 해요(약관, 확인).

### 5-2. 한국어 비개발자용 "출시 키트" (오너가 겪은 불편을 상품으로)

**결론: 메이플보다 나은 선택이 아니에요. 하더라도 메이플 출시 뒤 작은 시험 정도예요(추정).**

- **돈을 내는 수요는 주로 개발자 쪽이에요.** 수강생이 수천 명인 인프런 1위 강의는 개발자용이에요(2차). 비개발자용 상품의 판매 기록은 크몽 10건, 22건이 전부였어요(2차).
- **오너의 도구와 같은 일을 하는 무료 공식 도구가 이미 있어요.**
  - Cloudflare: "Deploy to Cloudflare" 버튼(공식 문서, 확인)
  - Stripe: 대시보드와 모바일 앱에서 환불 가능(2차)
  - Anthropic: 한국어 공식 문서(확인)와 무료 아카데미(2차)
  - 무료 한국어 입문 가이드(CC101, GitHub 별 301개, 확인)
- **큰 경쟁자가 있어요.** 구독자 약 73–75만 명의 조코딩이 Claude Code, Supabase, Stripe를 다루는 책과 5주 부트캠프를 팔아요(2차).
- **팔게 되면 쓸 수 있는 결제 경로:** Polar라는 판매 대행사(merchant of record)가 있어요.
  - 카카오페이, 네이버페이(원화)를 받고, 캐나다로 정산하고, 해외 판매세 책임을 대신 져요(Polar 공식 문서, 확인).
  - 다만 전자책과 선주문은 "추가 심사" 대상이고, "부자 되기" 류 콘텐츠는 금지예요(확인).
- **세금 기준:** 캐나다 소규모 사업자 기준은 4분기 합계 C$30,000이고, 해외 판매도 합산해요(법령 원문, 확인). 한국에 직접 팔면 간편 부가세 등록 의무가 생길 수 있는데, 판매 대행사를 쓰면 그 의무가 대행사로 넘어가는 조항이 있어요(부가가치세법 제53조의2 제2항, 법령 사본으로 확인). 세무 자문이 아니에요.
- **손익 계산(추정):** C$29에 3개만 팔아도 C$87로, 메이플 4개월 예상의 위쪽 끝(C$66)보다 커요. 하지만 청중 없이 그 3개를 팔 근거가 없어요. 비교 대상인 ShipFast의 구매 전환율 0.56%는 영어권 개발자, 이미 따뜻한 청중 기준이라 상한선이에요. 그 비율로도 3개를 팔려면 방문자가 약 536명 필요해요.

---

## 6. 권고와 다음 단계

### 6-1. 그대로 할 일
- 메이플 연습 코치: 체크리스트(0–12단계)대로 10월 18일 점검, 11월 1일 결제 켜기를 해요.
- 새 제품 코드는 만들지 않아요. 유료 등록(크롬 US$5, Shopify US$19)도 하지 않아요.

### 6-2. 돈 안 드는 선택 실험 (오너 결정 필요): "비개발자 출시 기록"
두 사례에서 반복된 핵심은 **청중**이었어요. 오너에게만 있는 자산은 "코딩을 모르는 캐나다 한인이 AI로 실제 사업을 열어 보는 과정" 그 자체예요(추정).

| 항목 | 내용 |
|---|---|
| 무엇 | 메이플 출시 과정을 한국어로 짧게 기록해요. 무엇이 막혔고 어떻게 풀었는지를 써요. 초보자 가이드와 도구는 **무료로** 공개해요. |
| 누가 | Claude가 초안을 써요. 오너는 읽고 고친 뒤 본인 이름이나 계정으로 올려요. |
| 오너 시간 | 글 하나에 약 10–15분, 주 1–2개예요(추정). |
| 돈 | 0원이에요. |
| 언제 판단 | 11월 30일 점검일에 봐요. 팔로워, 문의, "돈 내고 쓰겠다"는 답이 몇 개인지 세요. 지난 메모의 통과 기준(5명 이상이 정해진 가격에 사겠다고 글로 답)을 채우면 그때 유료 키트를 검토해요. |
| 위험 | 공개 활동이라 오너의 이름과 시간이 들어가요. 커뮤니티마다 홍보 규칙이 달라요 [미확인]. 그리고 "부자 되기"처럼 보이는 표현은 쓰지 않아요. |

### 6-3. 오너가 정할 것 (지난 메모의 3개 + 새 1개)
1. 두 번째 제품 규칙을 "돈 기준"에서 "증거 기준"으로 바꿀까요? **권고: 예.**
2. 주간 "불편 수집"을 위해 네트워크를 열까요? **권고: 예.**
3. 소액 등록비를 허용할까요? **권고: 아니요.**
4. **(새로)** 6-2의 "출시 기록"을 오너 이름으로 올릴까요? **권고: 메이플 출시 뒤(11월 초)에 시작.** 이건 오너의 이름과 시간이 드는 일이라 오너만 정할 수 있어요.

---

## 7. 예상 질문

**Q1. 파울리우스는 코딩을 몰랐는데도 됐잖아요. 저도 되지 않나요?**
- "깃 커밋도 몰랐다"는 확인되지 않았어요.
- 오히려 첫 수익 앱보다 약 11개월 앞서 GitHub에 코드를 올린 기록이 있어요(확인).
- 마케팅 경력과 X 청중도 있었어요(2차).
- 코딩을 몰라도 만들 수 있다는 건 맞아요. 지금 사장님 사업도 그렇게 만들었어요. 하지만 **파는 일**은 다른 문제예요.

**Q2. 그가 권한 대로 비싼 정액제(Max)로 바꿔야 하나요?**
- 아니요. 지금 쓰시는 유료 플랜으로 Claude Code를 이미 쓰고 있어요. 클라우드 세션은 유료 플랜에 포함되고 별도 서버 요금이 없어요(공식 문서, 확인).
- 메이플 고객에게 주는 AI 피드백은 API 선불 크레딧(약 US$10)으로 따로 내요. 이 크레딧은 다 쓰면 멈추고, 환불되지 않고, 1년 뒤 만료돼요(공식, 확인).
- 지금 플랜을 올릴 이유는 없어요(추정).

**Q3. 왜 같은 계정의 카드뉴스를 믿으면 안 되나요?**
- 두 게시물에서 세부 사항 바꾸기, 불리한 정보 빼기, 인용 바꾸기, 매출을 버는 돈처럼 보이게 하기가 반복됐어요(2장).
- 아이디어를 얻는 데는 좋지만, 결정의 근거로는 원문 확인이 필요해요.

**Q4. 그럼 제 초보자 가이드와 도구는 쓸모없나요?**
- 아니요. 메이플 출시에 바로 쓰여요.
- 무료로 공개하면 "출시 기록"의 신뢰를 쌓는 재료가 될 수 있어요(추정).
- 다만 지금 바로 돈을 받고 팔 근거는 약해요.

---

## 8. 참고: 클라우드 세션 크레딧 (2차, 마감 10월 7일)

- **발표 내용(2차):** Anthropic 공식 개발자 X 계정(@ClaudeDevs)이 2026-09-23에 발표한 것으로 보도됐어요. 기존 개인 Pro 구독자에게 $100, Max 구독자에게 $250의 일회성 크레딧을 줘요. 클라우드 세션 전용이고, 사용 한도와 별개예요. 10월 7일까지 받아야 하고, 11월 4일에 만료된다고 해요.
- **확인하지 못한 점:**
  - Anthropic 웹페이지와 변경 기록에서는 찾지 못했어요.
  - 받는 페이지는 이 환경에서 열리지 않았어요.
  - 사장님 계정이 대상인지, 어디서 받는지 [미확인]이에요.
- **필수는 아니에요.** 무자본 계획은 이 크레딧 없이 그대로 돌아가요.

---

## 부록 (English): sources

Read 2026-10-01 by the research agents (four workflows: Troy fact-check, Paulius slides 1–5, slides 6–10 with market research, each with an adversarial verify pass). Most non-GitHub, non-Anthropic pages were seen only through search excerpts (labelled "2차" above). Third-party personal records found during research (a data-broker profile, a corporate-registry officer page, a third party's bookkeeping file, an Instagram viewer site and an influencer profile) are deliberately left out of this list. The Troy/StackEasy sources are in `improve-existing-assets-memo-ko.md`.

- https://pawelbrodzinski.substack.com/p/vibe-coded-product-success-stories
- https://www.thehumansintheloop.ai/p/vibe-coding-for-people-who-dont-want
- https://medium.com/@yumaueno/non-engineer-paulius-who-built-a-tool-earning-30-000-month-with-zero-programming-3443bc34ab8b
- https://nocodeexits.substack.com/p/how-paulius-built-a-directory-of
- https://github.com/PauliusOS/streamlit-notion-site
- https://threadreaderapp.com/thread/1685606866624077824.html
- https://iamjohnellison.substack.com/p/the-vibe-coding-wave-is-here-5-builders
- https://x.com/0xpaulius
- https://arrfounder.com/@0xPaulius
- https://arrfounder.com/product/creatorhunter
- https://x.com/0xPaulius/status/1862171878355300385
- https://indiepa.ge/0xpaulius
- https://x.com/0xPaulius/status/1836419037254832358
- https://x.com/0xPaulius/status/1855601661751775647
- https://www.anthropic.com/news/claude-3-7-sonnet
- https://millionairecopy.com/success-story/creatorhunter-ai-app-development/
- https://www.youtube.com/watch?v=jpSY4MlWX50
- https://github.com/PauliusOS/komand-app
- https://devpost.com/0xpaulius
- https://apps.apple.com/us/app/clonk-vibe-code/id6769214089
- https://gptstore.ai/creators/user-VQdJ2oiIrSBlBbCpzXNawzZl
- https://daily.dev/posts/i-used-cursor-to-build-an-app-on-the-train-made-30k-and-quit-my-job--5bxawgmcm
- https://x.com/0xPaulius/status/1907898389624168921
- https://x.com/0xPaulius/status/1907171213035573262
- https://github.com/PauliusOS
- https://github.com/PauliusOS/Vibed-Web-Start
- https://github.com/clonkbot/y-clawbinator-ac2c24
- https://github.com/clonkbot/ios27-tip-calc-03bd28
- https://www.vibed.inc/onboarding
- https://github.com/PauliusOS/komand-app/blob/main/Legal/TERMS_OF_USE.md
- https://github.com/PauliusOS/komand-releases/releases/tag/v1.20.0
- https://github.com/Ommsharravana/flywheel-coach
- https://github.com/PauliusOS/komand-releases/releases?page=9
- https://github.com/PauliusOS/komand-releases/releases/tag/v0.1.44
- https://open-vsx.org/extension/vibed/komand
- https://www.clonk.ai/
- https://www.clonk.ai/upgrade
- https://github.com/clonkbot
- https://x.com/0xPaulius
- https://x.com/0xPaulius/status/1949076438331621770
- https://github.com/PauliusOS/komand-releases/releases/tag/v0.1.48
- https://github.com/PauliusOS/komand-releases/releases/tag/v1.21.0
- https://github.com/Alplox/mis-recursos-webdev
- https://github.com/PauliusOS/komand-releases/releases/tag/v1.16.0
- https://studio.vibed.inc/
- https://github.com/PauliusOS/komand-app/blob/main/Legal/PRIVACY_POLICY.md
- https://github.com/PauliusOS/komand-releases/releases
- https://code.claude.com/docs/en/legal-and-compliance
- https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan
- https://code.claude.com/docs/en/remote-control
- https://code.claude.com/docs/en/desktop
- https://github.com/PauliusOS/komand-releases/releases/tag/v0.1.46
- https://x.com/0xPaulius/status/2026008455052460146
- https://x.com/0xPaulius/status/1927483375452934399
- https://raw.githubusercontent.com/s-badran/starter_story_analysis/HEAD/transcripts/jpSY4MlWX50/jpSY4MlWX50_conversation.json
- https://x.com/0xPaulius/status/1839686755785617445
- https://substack.com/@nocodeexits/note/c-84318580
- https://creatorhunter.io/demo
- https://creatorhunter.io/old-home
- https://creatorhunter.io/pricing
- https://raw.githubusercontent.com/bettercallzaal/ZAOOS/HEAD/research/dev-workflows/196-solo-dev-ai-coding-landscape-2026/README.md
- https://x.com/0xPaulius/status/1916863433649029282
- https://github.com/PauliusOS/komand-releases
- https://x.com/0xPaulius/status/1922723593315586052
- https://x.com/0xPaulius/status/1925309057050550653
- https://github.com/PauliusOS/komand-releases/releases?page=8
- https://github.com/PauliusOS?tab=repositories
- https://github.com/PauliusOS/Claudable
- https://x.com/0xPaulius/status/1980963985093542255
- https://claude.com/blog/skills
- https://x.com/0xPaulius/status/2026707625165894049
- https://x.com/0xPaulius/status/2003786499423388150
- https://support.claude.com/en/articles/11049741-what-is-the-max-plan
- https://claude.com/pricing
- https://support.claude.com/en/articles/8325606-what-is-the-pro-plan
- https://support.claude.com/en/articles/11145838-using-claude-code-with-your-pro-or-max-plan
- https://www.aisubdeal.com/pricing/claude/canada/
- https://chatgpt.ca/blog/claude-pro-canada
- https://support.claude.com/en/articles/12429409-manage-usage-credits-for-paid-claude-plans
- https://code.claude.com/docs/en/costs
- https://support.claude.com/en/articles/8977456-how-do-i-pay-for-my-claude-api-usage
- https://code.claude.com/docs/en/claude-code-on-the-web
- https://x.com/ClaudeDevs/status/2102871550974427462
- https://x.com/ClaudeDevs/status/2102871554069774451
- https://x.com/ClaudeDevs/status/2102871555244257518
- https://www.ghacks.net/2026/09/26/anthropic-offers-up-to-250-in-free-claude-code-cloud-credits-to-pro-and-max-subscribers/
- https://daily.dev/posts/anthropic-rolls-out-up-to-250-in-free-claude-code-credits-but-only-for-cloud-sessions-09xrdatai
- https://github.com/luongnv89/freetokens/issues/468
- https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md
- https://code.claude.com/docs/en/cloud-environments
- https://github.com/paperfoot/api-key-manager
- https://claudekeychain.app/
- https://x.com/0xPaulius/status/1845258324347957600
- https://x.com/grok/status/1946339783795773458
- https://code.claude.com/docs/en/plugins/anthropic-marketplaces
- https://code.claude.com/docs/en/plugins/publish
- https://claude.com/docs/directory/publish
- https://support.claude.com/en/articles/13145338-anthropic-software-directory-terms
- https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy
- https://www.unite.ai/anthropic-opens-directory-submission-portal-for-claude-plugins/
- https://justinmckelvey.com/blog/claude-plugins
- https://claude.com/marketplace
- https://claude.com/marketplace/agents-products
- https://claude.com/marketplace-partners
- https://www.techzine.eu/news/applications/139359/anthropic-launches-claude-powered-app-marketplace-without-taking-a-cut/
- https://siliconangle.com/2026/03/06/anthropic-launches-claude-marketplace-third-party-cloud-services/
- https://www.ghacks.net/2026/09/27/anthropic-launches-claude-marketplace-with-more-than-2000-connectors-and-plugins/
- https://500k.io/journal/anthropic-skills-marketplace-launch
- https://www.agensi.io/learn/anthropic-skills-marketplace-vs-agensi
- https://code.claude.com/docs/en/cli-reference
- https://code.claude.com/docs/llms.txt
- https://code.claude.com/docs/en/whats-new/2026-w18.md
- https://venturebeat.com/ai/how-anthropics-skills-make-claude-faster-cheaper-and-more-consistent-for
- https://registry.modelcontextprotocol.io/v0.1/servers
- https://thinkneo.ai/blog/mcp-registries-compared-20260714
- https://github.com/anthropics/claude-plugins-official
- https://github.com/anthropics/claude-plugins-community
- https://github.com/search?q=topic%3Aclaude-code&type=repositories
- https://github.com/obra/superpowers
- https://github.com/anthropics/skills
- https://smartscope.blog/en/blog/skillsmp-marketplace-guide/
- https://www.productmarketfit.tech/p/the-largest-ai-skills-marketplace
- https://rywalker.com/research/skills-sh
- https://github.com/leejaeyoung2026-bot/vibed-lab-plugins
- https://github.com/leejaeyoung2026-bot/vibed-lab-agents
- https://github.com/hesreallyhim/awesome-claude-code/blob/main/CONTRIBUTING.md
- https://github.com/ComposioHQ/awesome-claude-skills
- https://github.com/claudekit/.github
- https://github.com/claudekit/claudekit-docs/blob/main/src/content/docs/getting-started/agentkit-overview.md
- https://trustmrr.com/startup/claudekit
- https://github.com/mifanr/trustmrr-research
- https://zuey.me/
- https://trustmrr.com/startup/claudekit-1
- https://theclaudekit.com/
- https://trustmrr.com/startup/claude-fast
- https://www.agensi.io/learn/how-to-monetize-skill-md-skills-developer-guide-2026
- https://trustmrr.com/startup/claude-code-distribution-framework
- https://github.com/AgentPowers-AI/agentpowers-plugin
- https://buildtolaunch.gumroad.com/l/claude-code-project-starter-pack
- https://bigideasdb.com/how-to-make-money-with-claude-code
- https://www.inflearn.com/pages/claudecode2026
- https://kmong.com/gig/759142
- https://kmong.com/gig/779333
- https://wikidocs.net/book/19556
- https://code.claude.com/docs/ko/quickstart
- https://code.claude.com/docs/ko/web-quickstart
- https://github.com/fivetaku/cc101
- https://github.com/fivetaku/gptaku_plugins
- https://github.com/wlsdks/claude-code-guide
- https://github.com/shinhyukahn/cck
- https://www.anthropic.com/news/seoul-office-partnerships-korean-ai-ecosystem
- https://github.com/anthropics/skills/blob/main/skills/academy-guide/SKILL.md
- https://code.claude.com/docs/en/plugins/host-marketplace
- https://www.anthropic.com/legal/consumer-terms
- https://www.anthropic.com/legal/commercial-terms
- https://code.claude.com/docs/en/agent-sdk/overview
- https://www.anthropic.com/legal/trademark-guidelines
- https://www.forbes.com/sites/ronschmelzer/2026/01/27/viral-ai-sidekick-clawdbot-changes-name-to-moltbot-and-sheds-its-old-skin/
- https://code.claude.com/docs/en/whats-new/2026-w14.md
- https://code.claude.com/docs/en/whats-new/2026-w15.md
- https://code.claude.com/docs/en/whats-new/2026-w28.md
- https://code.claude.com/docs/en/whats-new/2026-w33.md
- https://winbuzzer.com/2026/02/19/anthropic-bans-claude-subscription-oauth-in-third-party-apps-xcxwbn/
- https://www.techmeme.com/260403/p21
- https://venturebeat.com/technology/anthropic-reinstates-openclaw-and-third-party-agent-usage-on-claude-subscriptions-with-a-catch
- https://www.inflearn.com/course/%ED%81%B4%EB%A1%9C%EB%93%9C-%EC%BD%94%EB%93%9C-%EC%99%84%EB%B2%BD-%EB%A7%88%EC%8A%A4%ED%84%B0-ai-%EA%B0%9C%EB%B0%9C/inquiries
- https://www.gymcoding.co/courses/claude-code-master
- https://www.inflearn.com/course/%EB%B9%84%EA%B0%9C%EB%B0%9C%EC%9E%90-4%EC%A3%BC%EB%A7%8C%EC%97%90-%EC%88%98%EC%9D%B5%ED%99%94-%EC%84%9C%EB%B9%84%EC%8A%A4-%EB%A7%8C%EB%93%A4/inquiries
- https://www.inflearn.com/tag-curation/skill/%EB%B0%94%EC%9D%B4%EB%B8%8C%EC%BD%94%EB%94%A9
- https://class101.net/ko/products/6a30c00e0981b29f4dc51ac7
- https://class101.net/ko/products/68b51950dfa183535a7d655f
- https://fastcampus.co.kr/data_online_svvibecoding
- https://fastcampus.co.kr/biz_online_claudecode
- https://fastcampus.co.kr/b2b_camp_claudecode
- https://m.hanbit.co.kr/store/books/book_view.html?p_code=B2047363015
- https://www.yes24.com/product/goods/189855418
- https://jocoding.net/courses/ai-product-builder/
- https://playboard.co/en/channel/UCQNE2JmbasNYbjGAcuBiRRg
- https://www.aitimes.com/news/articleView.html?idxno=203434
- https://www.hanbit.co.kr/store/books/look.php?p_code=B1785590517
- https://www.yes24.com/product/goods/167573138
- https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=379260002
- https://kmong.com/gig/741513
- https://kmong.com/gig/799000
- https://kmong.com/gig/802489
- https://kmong.com/gig/798949
- https://kmong.com/gig/794757
- https://builders1452.com/
- https://www.gpters.org/study-community
- https://vibecrew.kr/
- https://www.threads.com/@steady__study.dev/post/DNyHLKzQhG6
- https://www.dt.co.kr/article/12065971
- https://maily.so/josh/posts/g1o4k08grve
- https://www.threads.com/@bokmanhi/post/DMplZd8y8Lj
- https://code.claude.com/docs/ko/terminal-guide
- https://code.claude.com/docs/ko/desktop-quickstart
- https://code.claude.com/docs/ko/setup
- https://www.anthropic.com/learn
- https://www.classcentral.com/course/anthropic-academy-claude-code-in-action-536160
- https://dev.to/amareswer/anthropic-academy-free-claude-courses-and-certificates-22ki
- https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/docs/workers/platform/deploy-buttons.mdx
- https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/docs/workers/platform/claim-deployments.mdx
- https://docs.stripe.com/refunds
- https://github.com/Eyre921/ofiicial-developer-docs/blob/main/dev-platforms/stripe/pages/refunds.md
- https://www.inflearn.com/pages/how-to-use-claudecode
- https://www.inflearn.com/pages/claudecode-install-guide
- https://github.com/bear2u/my-skills
- https://github.com/modu-ai/moai-cowork
- https://github.com/taehojo/vibecoding
- https://github.com/sunwon12/vibe-coding-curriculum
- https://www.anthropic.com/news/seoul-becomes-third-anthropic-office-in-asia-pacific
- https://inblog.ai/ko/blog/stripe-in-korea
- https://brunch.co.kr/@chunja07/196
- https://github.com/Eyre921/ofiicial-developer-docs/blob/main/dev-platforms/stripe/pages/payments/local-markets.md
- https://docs.stripe.com/payments/kakao-pay/accept-a-payment
- https://docs.stripe.com/payments/countries/korea
- https://github.com/polarsource/polar/blob/main/docs/features/checkout/payment-methods.mdx
- https://github.com/polarsource/polar/blob/main/docs/merchant-of-record/supported-countries.mdx
- https://github.com/polarsource/polar/blob/main/docs/merchant-of-record/introduction.mdx
- https://github.com/polarsource/polar/blob/main/docs/merchant-of-record/fees.mdx
- https://github.com/polarsource/polar/blob/main/server/polar/organization_review/acceptable-use-policy.fallback.mdx
- https://github.com/legalize-kr/legalize-kr/blob/main/kr/부가가치세법/법률.md
- https://github.com/legalize-kr/legalize-kr/blob/main/kr/부가가치세법/시행령.md
- https://github.com/legalize-kr/legalize-kr/blob/main/kr/전자상거래등에서의소비자보호에관한법률/법률.md
- https://github.com/legalize-kr/legalize-kr/blob/main/kr/전자상거래등에서의소비자보호에관한법률/시행령.md
- https://support.cafe24.com/hc/ko/articles/8470992131609
- https://support.kmong.com/hc/ko/articles/900001963883
- https://support.kmong.com/hc/ko/articles/4405515534745
- https://inflab-1.gitbook.io/inflearn/course-operating/courses/incomes
- https://github.com/justicecanada/laws-lois-xml/blob/main/eng/acts/E-15.xml
- https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/4-5-3/exports-services-intangible-personal-property.html
- https://twitter.com/marc_louvion/status/1767932387802100012
- https://www.linkedin.com/posts/marclouvion_shipfast-crossed-300000-in-revenue-today-activity-7173698077101338626-VBfs
- https://trustmrr.com/startup/shipfast
- https://streakr.co/playbook/marc-lou