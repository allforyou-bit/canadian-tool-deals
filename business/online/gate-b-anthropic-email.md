# Gate B: Anthropic 이용 정책 문의 이메일 초안

> **근거:** 메모 §1.3 Gate B("The owner emails Anthropic's usage-policy contact, using a description the AI drafts")와
> `business/online/owner-setup.md`의 Gate B 단계. 오너가 **직접** 보내요. AI는 보내지 않아요.
>
> - 아래 영어 본문이 실제로 보낼 글이에요. 각 문단 아래 한국어 설명은 이해를 돕는 번역이고, 보내지 않아요.
> - **어디로 보내나요:** 이용 정책(AUP) 본문에는 **출시 전 문의를 받는 연락처가 적혀 있지 않아요.** 본문에 있는
>   이메일 주소는 `usersafety@anthropic.com` 하나뿐이고, 이 주소는 "AI 답변이 부정확하거나 편향되거나 해롭다"고
>   **신고하는 용도**예요(2025-09-15 시행본, OpenTermsArchive 보관본에서 확인). 그러니 이 주소로 보내지 말고,
>   **Anthropic Console의 도움말(Help)·지원(Support) 창구**로 보내요. 메뉴의 정확한 이름과 위치는 확인하지
>   못했어요 [미확인]. Console 계정이 있어야 하니, Anthropic 설정 단계(owner-setup.md)를 먼저 해요.
> - **보내기 전 날짜 확인(5분):** 브라우저로 `www.anthropic.com/legal/aup`를 열어 제목 "Usage Policy" 아래
>   "Effective"로 시작하는 줄을 봐요. **"Effective September 15, 2025"**이면 아래 인용문이 현재 문구와 같아요.
>   날짜가 다르면 보내지 말고, 페이지 전체를 복사해 Gate B 이슈에 붙여 주세요. AI가 새 문구와 비교하고 인용을
>   고쳐요. (AI는 anthropic.com에 접속할 수 없어서, 두 곳의 보관 기록으로 2026-09-24까지 바뀐 기록이 없다는 것만
>   확인했어요.)
> - 보내기 전에 `[대괄호]` 칸을 채워요. 보낸 날짜를 Gate B 이슈에 댓글로 남겨요(본문은 붙이지 않아도 돼요).
> - 답장은 보장되지 않아요. 21일차(10월 18일 일)까지 답이 없으면 아래 "보낸 뒤" 규칙을 따라요.
> - 본문의 사실은 2026-09-24 코드와 무자본 출시 결정(메모 §7.2) 기준이에요(`products/clb/shared/config.ts`,
>   `shared/api.ts`, `worker/src/grading/`). 제품이 바뀌면 보내기 전에 AI에게 다시 확인을 요청해요.

---

**Subject:** Usage Policy question: AI feedback tool for English writing and speaking practice

> **제목:** 이용 정책 문의: 영어 쓰기·말하기 연습용 AI 피드백 도구

Hello,

I am a sole proprietor in Ontario, Canada, and I use the Claude API through my Anthropic Console
organization **[Console organization name or ID]**. Before launching, I would like to confirm how your
Usage Policy applies to my product. I did not find a contact for questions about the Usage Policy in the
policy itself, so I am asking through this channel; please forward it if another team handles it.

> 안녕하세요. 저는 캐나다 온타리오의 개인사업자이고, Anthropic Console 조직 **[조직 이름 또는 ID]**로 Claude
> API를 써요. 출시 전에 이용 정책이 제 제품에 어떻게 적용되는지 확인하고 싶어요. 정책 본문에서 이용 정책
> 문의 연락처를 찾지 못해 이 창구로 문의해요. 다른 팀이 담당한다면 전달해 주세요.

**What the product is.** "Maple Practice Coach" is a website where adults practise English writing and
speaking tasks. The task formats are modelled on a Canadian English test, but all prompts are our own,
and the site states on every page that it is independent and not affiliated with or endorsed by any test
provider or government body. A learner writes an answer or records a spoken answer. Speech is transcribed
by a separate speech-to-text model (Whisper on Cloudflare Workers AI). Claude then returns structured
practice feedback: short comments on a few criteria (such as task completion and vocabulary), up to three
important language errors with corrections, one or two improved sentences, and a next step, with
explanations in English or Korean. The site also has a free practice mode (a timer, a word counter and
recording that stays on the learner's device) that does not use Claude or any other AI.

> **제품 소개.** "Maple Practice Coach"는 성인이 영어 쓰기·말하기 과제를 연습하는 웹사이트예요. 과제 형식은
> 캐나다의 영어 시험을 본떴지만 문제는 모두 직접 만들었고, 모든 페이지에 독립 도구이며 어떤 시험 기관이나
> 정부 기관과도 관련이 없다고 적혀 있어요. 학습자가 답을 쓰거나 말로 녹음하면, 말은 별도의 음성 인식
> 모델(Cloudflare Workers AI의 Whisper)이 글로 바꿔요. 그다음 Claude가 연습용 피드백을 정해진 형식으로
> 돌려줘요: 몇 가지 기준(과제 수행, 어휘 등)에 대한 짧은 코멘트, 고칠 점이 있는 중요한 언어 오류 최대 3개,
> 고친 문장 1–2개, 다음 연습 방향. 설명은 영어나 한국어예요. 사이트에는 Claude나 다른 AI를 쓰지 않는 무료 연습
> 모드(타이머, 단어 수 세기, 학습자 기기 안에만 남는 녹음)도 있어요.

**What it does not do.** The product does not administer, score or proctor any test, and it is not offered
to, or connected with, any school, employer, test provider or government, or with any of their decisions.
It shows no score, band, level or prediction of a test result; an automatic filter also removes sentences
that use set words or number patterns presenting a test result (such as "score", "band", "level" or a
number out of 12). Every practice page tells the learner, before they submit, that the feedback comes
from an AI (Claude by Anthropic), that it can make mistakes and that it does not predict test results.
Requests for immigration or legal advice receive a fixed message that points to a licensed immigration
consultant or a lawyer, instead of an answer. Users must confirm they are 18 or older. No person reviews
the feedback before the learner sees it; I may review a small sample afterwards to fix quality problems.
Learners pay for a 30-day or 90-day practice pass (Canada outside Quebec only).

> **하지 않는 일.** 이 제품은 어떤 시험도 실시·채점·감독하지 않고, 학교·고용주·시험 기관·정부에 제공되거나
> 그들의 결정과 연결되지 않아요. 점수, 밴드, 레벨, 시험 결과 예측을 보여 주지 않고, 자동 필터가 시험 결과를
> 나타내는 정해진 단어나 숫자 형식("score", "band", "level", 12점 만점의 숫자 등)이 든 문장을 지워요. 모든 연습
> 페이지는 제출 전에 피드백이 AI(Anthropic의 Claude)에서 나오며 틀릴 수 있고 시험 결과를 예측하지 않는다고
> 알려요. 이민·법률 조언 요청에는 답 대신, 등록된 이민 컨설턴트나 변호사를 안내하는 고정 문구를 보여 줘요.
> 사용자는 18세 이상임을 확인해야 해요. 학습자가 보기 전에 사람이 피드백을 검토하지는 않아요. 품질 문제를
> 고치려고 나중에 일부 표본을 제가 볼 수 있어요. 학습자는 30일 또는 90일 연습 이용권을 사요(퀘벡을 제외한
> 캐나다에서만 판매).

**My question.** The archived version of your Usage Policy that I reviewed (effective September 15, 2025)
lists as a high-risk use case "Academic testing, accreditation and admissions: Use cases related to
standardized testing companies that administer school admissions …, language proficiency, or professional
certification exams", and it asks for review by a "qualified professional" before outputs are
disseminated in high-risk use cases. **[If the current policy text differs, quote the current wording
here instead.]**

1. Does a practice-feedback tool like this one, which is independent of any testing company and gives
   no scores or predictions, fall under that high-risk category?
2. If it does, what requirements apply to it? In particular, what would "review by a qualified
   professional" mean for automated practice feedback that a learner sees immediately, and are there
   disclosure requirements beyond the AI notice described above?
3. Is there anything else in the Usage Policy you would ask me to change before I launch?

> **질문.** 제가 읽은 이용 정책 보관본(2025년 9월 15일 시행)은 고위험 사용 사례로 "학업 시험, 인증, 입학: 학교
> 입학, 언어 능력, 전문 자격 시험을 실시하는 표준화 시험 회사와 관련된 사용 사례"를 들고, 고위험 사용에서는
> 결과를 내보내기 전에 "자격 있는 전문가(qualified professional)"의 검토를 요구해요. **[현재 정책 문구가
> 다르면 여기에 현재 문구를 대신 인용해요.]**
>
> 1. 시험 회사와 무관하고 점수나 예측을 주지 않는 이런 연습 피드백 도구가 그 고위험 범주에 들어가나요?
> 2. 들어간다면 어떤 요건이 적용되나요? 특히 학습자가 바로 보는 자동 연습 피드백에서 "자격 있는 전문가의
>    검토"는 무엇을 뜻하나요? 위에 적은 AI 안내 외에 더 알려야 할 것이 있나요?
> 3. 출시 전에 이용 정책상 바꿔야 할 다른 것이 있나요?

I plan to launch in October 2026. If the use case is inside the high-risk category, I will not launch the
feedback feature until I can meet the requirements you describe.

> 2026년 10월 출시를 계획하고 있어요. 고위험 범주에 들어간다면, 알려 주신 요건을 지킬 수 있을 때까지 피드백
> 기능을 출시하지 않을게요.

Thank you,
**[Your full legal name]**, sole proprietor, Ontario, Canada (product: Maple Practice Coach)
**[the email address of your Anthropic Console account]**

> 감사합니다. **[오너의 법적 이름]**, 온타리오 개인사업자(제품: Maple Practice Coach), **[Anthropic Console
> 계정의 이메일 주소]**

---

## 보낸 뒤 (메모 §1.3 Gate B 규칙 요약)

- 답이 "고위험에 해당한다"이고 요건을 지킬 수 없으면: **AI 피드백 기능을 출시하지 않아요**(메모 §1.3). 학습자에게
  보이기 전에 전문가가 모든 피드백을 검토하려면 돈이 들어서, 무자본 출시로는 지킬 수 없어요. AI를 쓰지 않는 무료
  연습 모드는 이 문제와 관계없지만, 그 뒤 어떻게 할지(메모 §1.3의 대안 포함)는 오너가 정해요.
- 답이 "해당하지 않는다"이면: 답장을 보관하고 Gate B 이슈에 날짜와 결론만 적어요.
- 21일차(10월 18일 일)까지 답이 없으면: "writing and speaking practice feedback"으로만 출시하고, 출력과
  페이지에 CLB·band·level·score 표현을 쓰지 않아요. owner-setup.md의 "위험 수용"에 서명해요.
- 마지막 문단의 약속("고위험이면 요건을 지킬 때까지 출시하지 않음")은 메모 §1.3 규칙과 같아요. 지킬 수 없는
  약속이면 보내기 전에 그 문단을 지워요.
