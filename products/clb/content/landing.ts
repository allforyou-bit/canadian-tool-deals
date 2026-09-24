// Landing page copy: / (English) and /ko/ (Korean, 해요체). Rendered by components/content/Landing.tsx.
// Rules: every string passes findClaims(); the test is named only descriptively; the two disclaimer
// sentences are the exact ALLOWED_PHRASES / AI_DISCLOSURE text.
import type { Lang } from '../shared/api'
import { AI_DISCLOSURE, BRAND } from '../shared/config'
import { SPEAKING_TASKS, TASKS, WRITING_TASKS, type TaskType } from '../shared/tasks'
import { FREE_WRITING_PATH, PATHS, practicePath } from './routes'
import { FACTS, passLabel, QUEBEC_RULE } from './site'
import type { FaqItem } from './types'

export interface TaskLine {
  id: string
  kind: TaskType['kind']
  title: string
  summary: string
  detail: string
  href: string
}

export interface LandingCopy {
  lang: Lang
  meta: { title: string; description: string }
  hero: {
    eyebrow: string
    title: string
    lead: string
    cta: { label: string; href: string }
    secondary: { label: string; href: string }
    note: string
  }
  disclosure: { heading: string; text: string }
  steps: { heading: string; items: { title: string; body: string }[] }
  korean: { heading: string; paragraphs: string[] }
  tasks: {
    heading: string
    intro: string
    writingHeading: string
    speakingHeading: string
    writing: TaskLine[]
    speaking: TaskLine[]
    more: string
  }
  feedback: {
    heading: string
    includesHeading: string
    includes: string[]
    excludesHeading: string
    excludes: string[]
    more: string
  }
  pricing: { heading: string; items: string[]; note: string; cta: { label: string; href: string } }
  faq: { heading: string; items: FaqItem[] }
}

// criteria names from shared/tasks.ts (writing and speaking share the first three; grammar differs).
// Semicolons, because each criterion name already contains "and".
const WRITING_CRITERIA_EN = WRITING_TASKS[0].criteria.map((c) => c.en.toLowerCase())
const WRITING_CRITERIA_KO = WRITING_TASKS[0].criteria.map((c) => c.ko)

const writingDetail = (t: TaskType, lang: Lang): string => {
  const { minWords, maxWords } = t.target
  const minutes = Math.round((t.timerSeconds ?? 0) / 60)
  return lang === 'en'
    ? `${minWords}–${maxWords} words · ${minutes}-minute practice timer`
    : `${minWords}–${maxWords}단어 · 연습 타이머 ${minutes}분`
}

const speakingDetail = (t: TaskType, lang: Lang): string => {
  const { prepSeconds, speakSeconds } = t.target
  return lang === 'en'
    ? `${prepSeconds} seconds to prepare · ${speakSeconds} seconds to speak`
    : `준비 ${prepSeconds}초 · 말하기 ${speakSeconds}초`
}

const taskLines = (tasks: TaskType[], lang: Lang): TaskLine[] =>
  tasks.map((t) => ({
    id: t.id,
    kind: t.kind,
    title: t.title[lang],
    summary: t.instructions[lang],
    detail: t.kind === 'writing' ? writingDetail(t, lang) : speakingDetail(t, lang),
    // the practice pages read ?lang=ko to show the Korean interface (lib/lang.ts)
    href: lang === 'ko' ? `${practicePath(t)}?lang=ko` : practicePath(t),
  }))

export const LANDING_EN: LandingCopy = {
  lang: 'en',
  meta: {
    title: `${BRAND.en}: feedback on English writing and speaking practice`,
    description: `Timed English writing and speaking practice tasks with AI feedback, for adults in Canada. Your first writing task is free, no account needed. Explanations in English or Korean.`,
  },
  hero: {
    eyebrow: 'English practice for adults in Canada',
    title: 'Practise English writing and speaking tasks, and see what to work on next',
    lead: `${BRAND.en} gives AI feedback on timed practice tasks modelled on the format of the CELPIP-General test. See what worked, fix your most important errors, and read improved versions of your own sentences. Explanations are available in English or Korean.`,
    cta: { label: 'Try a free writing task', href: FREE_WRITING_PATH },
    secondary: { label: 'See pricing', href: PATHS.pricing },
    note: 'Your first writing task is free, with no account needed.',
  },
  disclosure: { heading: 'About the feedback', text: AI_DISCLOSURE.en },
  steps: {
    heading: 'How it works',
    items: [
      {
        title: 'Choose a task',
        body: `Pick one of ${TASKS.length} practice task types: ${WRITING_TASKS.length} writing and ${SPEAKING_TASKS.length} speaking. Each one has prompts we wrote ourselves and a practice timer.`,
      },
      {
        title: 'Write or record your answer',
        body: `Type your answer in the browser, or record yourself speaking for up to ${FACTS.audioMinutes} minutes.`,
      },
      {
        title: 'Read your feedback',
        body: 'Claude, an AI model made by Anthropic, reviews your answer against four criteria and explains what to improve, in English or Korean.',
      },
    ],
  },
  korean: {
    heading: 'Explanations in Korean',
    paragraphs: [
      'Choose Korean as your explanation language and the feedback explains your errors, and how to fix them, in Korean.',
      'Corrections and improved sentences always stay in English, so you see the English wording to use. The practice pages and pricing are also available [in Korean](/ko/).',
    ],
  },
  tasks: {
    heading: `${TASKS.length} practice task types`,
    intro:
      'The tasks follow the format of the CELPIP-General test, but every prompt is our own. Timings are practice defaults we chose for this product.',
    writingHeading: 'Writing',
    speakingHeading: 'Speaking',
    writing: taskLines(WRITING_TASKS, 'en'),
    speaking: taskLines(SPEAKING_TASKS, 'en'),
    more: `Read more about each [writing task](${PATHS.formatsWriting}) and [speaking task](${PATHS.formatsSpeaking}).`,
  },
  feedback: {
    heading: 'What the feedback gives you',
    includesHeading: 'Included',
    includes: [
      `Comments on four criteria: ${WRITING_CRITERIA_EN.join('; ')}. Each criterion gets a strength and something to improve.`,
      'Your most important errors (up to three), each with a correction and a short explanation.',
      'One or two improved versions of your weaker sentences, or a short model paragraph.',
      'One clear next step for your next practice task.',
      'When you are signed in, your saved answers and feedback, and a record of the error types that keep coming back across your tasks.',
    ],
    excludesHeading: 'Not included',
    excludes: [
      'Feedback is not a score and does not predict test results.',
      'Speaking feedback is based on a transcript of your recording. Pronunciation and fluency are not assessed.',
      'No person reviews your answers. The feedback is written by AI and can be wrong.',
      'No immigration or legal advice.',
    ],
    more: `Learn [how the feedback works](${PATHS.helpFeedback}).`,
  },
  pricing: {
    heading: 'Start free, then choose a pass',
    items: [
      `${FACTS.freeWriting} free writing task, no account needed.`,
      `${FACTS.freeSpeaking} free speaking task after you sign in with your email.`,
      `${passLabel('pass30', 'en')}. ${passLabel('pass90', 'en')}.`,
      'One-time payment in Canadian dollars. No subscription and no automatic renewal.',
    ],
    note: `${QUEBEC_RULE.en} They are sold only to residents of Canada outside Quebec. The free tasks can be used from anywhere.`,
    cta: { label: 'Compare passes', href: PATHS.pricing },
  },
  faq: {
    heading: 'Questions',
    items: [
      {
        q: 'Is this the real test?',
        a: `No. ${BRAND.en} is an independent practice tool. Our tasks are modelled on the format of the CELPIP-General test, but we wrote every prompt ourselves, and the timings are practice defaults we chose. [Read our not-affiliated notice](${PATHS.notAffiliated}).`,
      },
      {
        q: 'Will the feedback tell me what result I would get on the test?',
        a: 'No. Feedback is not a score and does not predict test results. It describes what you did well and the specific things to improve.',
      },
      {
        q: 'Who writes the feedback?',
        a: `Claude, an AI model made by Anthropic. No person reviews your answer before you see the feedback, and AI feedback can be wrong. Use it as one input to your own study. [Read our AI disclosure](${PATHS.aiDisclosure}).`,
      },
      {
        q: 'Do you keep my recordings?',
        a: `No. Your recording is used only to make a transcript, and we never store audio. If you are signed in, we keep the text of your answers and your feedback so you can open them again from your account page, and delete them ${FACTS.retentionDays} days after your last activity. You can delete your account at any time. [See how we handle your data](${PATHS.helpPrivacy}).`,
      },
      {
        q: 'Can I get explanations in Korean?',
        a: 'Yes. Before you submit a task, choose English or Korean as your explanation language. Corrections and improved sentences stay in English.',
      },
      {
        q: 'Can I buy a pass if I live in Quebec or outside Canada?',
        a: 'Not at the moment. Passes are sold only to residents of Canada outside Quebec who pay with a card issued in Canada. If a payment does not meet these conditions, we refund it in full automatically.',
      },
      {
        q: 'Can you help with my immigration application?',
        a: 'No. We only give feedback on English practice tasks. For immigration advice, speak to a licensed immigration consultant who is a member of the College of Immigration and Citizenship Consultants (CICC), or to a lawyer.',
      },
      {
        q: 'What if the pass is not right for me?',
        a: `You can request a refund from your account page within ${FACTS.refundDays} days of purchase if you have used ${FACTS.refundMaxTasks} or fewer tasks with feedback. Self-serve refunds are available once per person and per card. [Read the refund policy](${PATHS.refunds}).`,
      },
    ],
  },
}

export const LANDING_KO: LandingCopy = {
  lang: 'ko',
  meta: {
    title: `${BRAND.ko}: 한국어 설명으로 배우는 영어 쓰기·말하기 연습`,
    description:
      '캐나다에 사는 성인을 위한 영어 쓰기·말하기 연습 과제와 AI 피드백이에요. 틀린 이유를 한국어로 설명받을 수 있어요. 첫 쓰기 과제는 계정 없이 무료예요.',
  },
  hero: {
    eyebrow: '캐나다에 사는 한국어 사용자를 위한 영어 연습',
    title: '영어 쓰기와 말하기를 연습하고, 설명은 한국어로 받아 보세요',
    lead: 'CELPIP-General 시험 형식을 본뜬 연습 과제에 답하면, AI가 잘한 점과 가장 중요한 오류, 고친 문장, 다음에 연습할 점을 알려 드려요. 교정 문장은 영어로, 왜 틀렸는지는 한국어로 읽을 수 있어요.',
    cta: { label: '무료 쓰기 과제 해 보기', href: `${FREE_WRITING_PATH}?lang=ko` },
    secondary: { label: '요금 보기', href: PATHS.pricingKo },
    note: '첫 쓰기 과제는 계정 없이 무료예요.',
  },
  disclosure: { heading: '피드백 안내', text: AI_DISCLOSURE.ko },
  steps: {
    heading: '이용 방법',
    items: [
      {
        title: '과제 고르기',
        body: `쓰기 ${WRITING_TASKS.length}가지, 말하기 ${SPEAKING_TASKS.length}가지, 모두 ${TASKS.length}가지 연습 과제 중에서 골라요. 과제마다 저희가 직접 쓴 문제와 연습 타이머가 있어요.`,
      },
      {
        title: '답안 쓰기 또는 녹음하기',
        body: `브라우저에서 답안을 쓰거나, 최대 ${FACTS.audioMinutes}분 동안 말하는 것을 녹음해요.`,
      },
      {
        title: '피드백 읽기',
        body: 'Anthropic의 AI인 Claude가 네 가지 기준으로 답안을 살펴보고, 고칠 점을 한국어나 영어로 설명해 줘요.',
      },
    ],
  },
  korean: {
    heading: '틀린 이유를 한국어로 설명해 드려요',
    paragraphs: [
      '설명 언어를 한국어로 고르면, 무엇이 틀렸는지와 어떻게 고치면 좋은지를 한국어로 읽을 수 있어요. 영어 설명을 다시 해석하느라 시간을 쓰지 않아도 돼요.',
      '교정한 문장과 고쳐 쓴 예시는 영어로 보여 드려요. 실제로 쓸 영어 표현을 그대로 익힐 수 있어요.',
      `연습 화면과 요금 안내도 한국어로 볼 수 있어요. [과제 형식](${PATHS.formats}), [도움말](${PATHS.help}), 약관은 지금은 영어로만 제공돼요.`,
    ],
  },
  tasks: {
    heading: `연습 과제 ${TASKS.length}가지`,
    intro:
      '과제는 CELPIP-General 시험 형식을 본떠 만들었지만, 문제는 모두 저희가 직접 썼어요. 시간은 이 서비스에서 정한 연습용 기본값이에요.',
    writingHeading: '쓰기',
    speakingHeading: '말하기',
    writing: taskLines(WRITING_TASKS, 'ko'),
    speaking: taskLines(SPEAKING_TASKS, 'ko'),
    more: `과제별 자세한 안내(영어): [쓰기 과제](${PATHS.formatsWriting}), [말하기 과제](${PATHS.formatsSpeaking})`,
  },
  feedback: {
    heading: '피드백에 담기는 내용',
    includesHeading: '포함돼요',
    includes: [
      `네 가지 기준에 대한 의견: ${WRITING_CRITERIA_KO.join(', ')}. 기준마다 잘한 점과 고칠 점을 알려 드려요.`,
      '가장 중요한 오류(최대 3개)와 교정, 짧은 설명',
      '약한 문장을 고쳐 쓴 예시 1–2개 또는 짧은 모범 문단',
      '다음 연습에서 집중할 한 가지',
      '로그인하면 저장된 답안과 피드백을 다시 볼 수 있고, 여러 과제에서 반복되는 오류 유형도 모아서 보여 드려요.',
    ],
    excludesHeading: '포함되지 않아요',
    excludes: [
      '피드백은 점수가 아니며 시험 결과를 예측하지 않습니다.',
      '말하기 피드백은 녹음을 받아쓴 내용을 바탕으로 해요. 발음과 유창성은 평가하지 않아요.',
      '사람이 답안을 검토하지 않아요. 피드백은 AI가 쓰며 틀릴 수 있어요.',
      '이민이나 법률 상담은 하지 않아요.',
    ],
    more: `[피드백이 만들어지는 방식(영어)](${PATHS.helpFeedback})`,
  },
  pricing: {
    heading: '무료로 시작하고, 필요할 때 이용권을 고르세요',
    items: [
      `쓰기 과제 ${FACTS.freeWriting}개: 계정 없이 무료`,
      `말하기 과제 ${FACTS.freeSpeaking}개: 이메일로 로그인한 뒤 무료`,
      `${passLabel('pass30', 'ko')}, ${passLabel('pass90', 'ko')}`,
      '캐나다 달러로 한 번만 결제해요. 구독이나 자동 갱신은 없어요.',
    ],
    note: `${QUEBEC_RULE.ko} 이용권은 퀘벡을 제외한 캐나다 거주자에게만 판매하고, 무료 과제는 어디서나 이용할 수 있어요.`,
    cta: { label: '이용권 비교하기', href: PATHS.pricingKo },
  },
  faq: {
    heading: '자주 묻는 질문',
    items: [
      {
        q: '실제 시험인가요?',
        a: `아니요. ${BRAND.ko}는 독립적인 연습 도구예요. 과제는 CELPIP-General 시험 형식을 본떠 만들었지만, 문제는 모두 저희가 직접 썼고 시간도 연습용 기본값이에요. [제휴 없음 안내(영어)](${PATHS.notAffiliated})`,
      },
      {
        q: '피드백으로 시험 결과를 알 수 있나요?',
        a: '아니요. 피드백은 점수가 아니며 시험 결과를 예측하지 않습니다. 잘한 점과 구체적으로 고칠 점을 알려 드려요.',
      },
      {
        q: '피드백은 누가 쓰나요?',
        a: `Anthropic이 만든 AI인 Claude가 써요. 피드백을 보여 드리기 전에 사람이 답안을 검토하지 않고, AI 피드백은 틀릴 수 있어요. 공부할 때 참고 자료 중 하나로 활용해 주세요. [AI 안내(영어)](${PATHS.aiDisclosure})`,
      },
      {
        q: '녹음 파일을 저장하나요?',
        a: `아니요. 녹음은 받아쓰기에만 쓰고 저장하지 않아요. 로그인한 경우 답안과 피드백 글은 저장되어 계정 페이지에서 다시 볼 수 있고, 마지막 활동 후 ${FACTS.retentionDays}일이 지나면 삭제해요. 계정 페이지에서 언제든지 계정을 삭제할 수도 있어요.`,
      },
      {
        q: '설명은 모두 한국어로 나오나요?',
        a: '과제를 제출하기 전에 설명 언어를 한국어나 영어 중에서 고를 수 있어요. 교정 문장과 고쳐 쓴 예시는 영어로 보여 드려요.',
      },
      {
        q: '퀘벡이나 캐나다 밖에 살아도 살 수 있나요?',
        a: '지금은 퀘벡을 제외한 캐나다에 살고, 캐나다에서 발급된 카드로 결제하는 분만 살 수 있어요. 결제가 이 조건에 맞지 않으면 자동으로 전액 환불해 드려요.',
      },
      {
        q: '이민 신청도 도와주나요?',
        a: '아니요. 영어 연습 과제에 대한 피드백만 드려요. 이민 관련 상담은 CICC(College of Immigration and Citizenship Consultants)에 등록된 이민 컨설턴트나 변호사에게 받으세요.',
      },
      {
        q: '이용권이 맞지 않으면 환불받을 수 있나요?',
        a: `구매 후 ${FACTS.refundDays}일 안에, 피드백을 받은 과제가 ${FACTS.refundMaxTasks}개 이하라면 계정 페이지에서 환불을 요청할 수 있어요. 직접 환불은 한 사람과 한 카드당 한 번만 가능해요. [환불 정책(영어)](${PATHS.refunds})`,
      },
    ],
  },
}

export const LANDING: Record<Lang, LandingCopy> = { en: LANDING_EN, ko: LANDING_KO }
