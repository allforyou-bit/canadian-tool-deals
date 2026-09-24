// Pricing page copy: /pricing/ (English) and /ko/pricing/ (Korean). The buy buttons are <BuyPass> from
// frontend-app (components/BuyPass.tsx), which shows each pass's name, price and days itself.
import type { Lang } from '../shared/api'
import { BRAND } from '../shared/config'
import { SPEAKING_TASKS, TASKS, WRITING_TASKS } from '../shared/tasks'
import { PATHS } from './routes'
import { DAILY_RESET_EN, DAILY_RESET_KO, FACTS } from './site'
import type { DocSection } from './types'

export interface PricingCopy {
  lang: Lang
  path: string
  meta: { title: string; description: string }
  title: string
  intro: string
  /** the short statements shown right under the heading */
  facts: string[]
  passesHeading: string
  free: { heading: string; items: string[]; note: string }
  sections: DocSection[]
  help: string
  product: { name: string; description: string }
}

export const PRICING_EN: PricingCopy = {
  lang: 'en',
  path: PATHS.pricing,
  meta: {
    title: 'Pricing',
    description: `${FACTS.price.pass30} for ${FACTS.days.pass30} days or ${FACTS.price.pass90} for ${FACTS.days.pass90} days of AI feedback on English writing and speaking practice. One-time payment, no subscription. For residents of Canada outside Quebec.`,
  },
  title: 'Pricing',
  intro:
    'Try it free first. When you want more practice with feedback, buy a pass. You pay once, and a pass never renews on its own.',
  facts: [
    'Prices in Canadian dollars.',
    'Not available in Quebec.',
    // Owner is a small supplier and not registered for GST/HST (shared/config.ts, memo §4.1 "Tax and GST/HST").
    'No GST/HST is charged at this time.',
  ],
  passesHeading: 'Passes',
  free: {
    heading: 'Try it free',
    items: [
      `${FACTS.freeWriting} free writing task, no account needed.`,
      `${FACTS.freeSpeaking} free speaking task after you sign in with your email.`,
    ],
    note: 'The free writing task is limited to one per device. Free tasks can be paused at busy times or to stop abuse.',
  },
  sections: [
    {
      id: 'one-time',
      heading: 'One-time passes, not subscriptions',
      blocks: [
        'You pay once. A pass is not a subscription: it does not renew automatically, and we never charge your card again unless you buy another pass.',
        'Your pass starts as soon as your payment is confirmed. If you buy a pass while another one is active, the new days are added to the end of your current pass.',
        'If we pause feedback for maintenance or to stop unusual activity, we extend active passes by the length of the pause.',
      ],
    },
    {
      id: 'included',
      heading: 'What every pass includes',
      blocks: [
        {
          ul: [
            `Feedback on all ${TASKS.length} practice task types: ${WRITING_TASKS.length} writing and ${SPEAKING_TASKS.length} speaking.`,
            'Explanations in English or Korean.',
            'Your practice history and a record of the error types that keep coming back.',
            'Access from any device where you sign in with your email.',
          ],
        },
      ],
    },
    {
      id: 'fair-use',
      heading: 'Fair-use limits',
      blocks: [
        `Each account can get feedback on up to ${FACTS.writingPerDay} writing tasks and ${FACTS.speakingPerDay} speaking tasks per day, and up to ${FACTS.gradedPer30Days} tasks in any 30 days. Daily limits reset at ${DAILY_RESET_EN}.`,
        `Writing answers can be up to ${FACTS.maxEssayChars} characters. Recordings can be up to ${FACTS.audioMinutes} minutes long and ${FACTS.audioMb} MB in size.`,
        'Requests we cannot give feedback on, such as questions about immigration, do not count toward these limits.',
      ],
    },
    {
      id: 'who-can-buy',
      heading: 'Who can buy a pass',
      blocks: [
        'Passes are for adults (18 or older) who live in Canada outside Quebec and pay with a card issued in Canada. When you buy, you tick a box to confirm that you live in Canada outside Quebec.',
        'After payment we check your billing address and the country where your card was issued. If either one is outside Canada, or your billing address is in Quebec, we do not activate the pass and we refund the full payment automatically.',
        'Payment is handled by Stripe. We never see or store your full card number.',
      ],
    },
    {
      id: 'refunds',
      heading: 'Refunds',
      blocks: [
        `You can request a refund from your [account page](${PATHS.account}) within ${FACTS.refundDays} days of purchase if you have used ${FACTS.refundMaxTasks} or fewer tasks with feedback. Self-serve refunds are available once per person and per card.`,
        `[Read the full refund policy](${PATHS.refunds}).`,
      ],
    },
  ],
  help: `More questions? See [passes and refunds](${PATHS.helpPasses}) in the help centre.`,
  product: {
    name: `${BRAND.en} practice pass`,
    description:
      'One-time pass for AI feedback on English writing and speaking practice tasks. No subscription and no automatic renewal.',
  },
}

export const PRICING_KO: PricingCopy = {
  lang: 'ko',
  path: PATHS.pricingKo,
  meta: {
    title: '요금',
    description: `영어 쓰기·말하기 연습 AI 피드백 이용권: ${FACTS.days.pass30}일 ${FACTS.price.pass30}, ${FACTS.days.pass90}일 ${FACTS.price.pass90}. 한 번만 결제하고 구독은 없어요. 퀘벡을 제외한 캐나다 거주자만 구매할 수 있어요.`,
  },
  title: '요금',
  intro: '먼저 무료로 해 보고, 피드백을 받으며 더 연습하고 싶을 때 이용권을 사세요. 한 번만 결제하고, 이용권은 자동으로 갱신되지 않아요.',
  facts: ['가격은 캐나다 달러 기준이에요.', '퀘벡에서는 이용할 수 없어요.', '현재 GST/HST는 붙지 않아요.'],
  passesHeading: '이용권',
  free: {
    heading: '무료로 해 보기',
    items: [
      `쓰기 과제 ${FACTS.freeWriting}개: 계정 없이 무료`,
      `말하기 과제 ${FACTS.freeSpeaking}개: 이메일로 로그인한 뒤 무료`,
    ],
    note: '무료 쓰기 과제는 기기 하나당 한 번이에요. 이용자가 몰리거나 악용을 막아야 할 때는 무료 체험을 잠시 멈출 수 있어요.',
  },
  sections: [
    {
      id: 'one-time',
      heading: '구독이 아닌 1회 결제 이용권',
      blocks: [
        '한 번만 결제해요. 이용권은 구독이 아니라서 자동으로 갱신되지 않고, 이용권을 새로 사지 않는 한 카드로 다시 청구하지 않아요.',
        '결제가 확인되면 바로 이용권이 시작돼요. 이용권이 남아 있을 때 새로 사면, 지금 이용권이 끝나는 날 뒤로 일수가 더해져요.',
        '점검이나 비정상적인 사용을 막기 위해 피드백을 멈추면, 멈춘 시간만큼 이용권 기간을 늘려 드려요.',
      ],
    },
    {
      id: 'included',
      heading: '모든 이용권에 포함돼요',
      blocks: [
        {
          ul: [
            `연습 과제 ${TASKS.length}가지 전부(쓰기 ${WRITING_TASKS.length}가지, 말하기 ${SPEAKING_TASKS.length}가지)에 대한 피드백`,
            '한국어 또는 영어 설명',
            '연습 기록과 자주 반복되는 오류 유형 모아 보기',
            '이메일로 로그인한 어느 기기에서나 이용',
          ],
        },
      ],
    },
    {
      id: 'fair-use',
      heading: '공정 사용 한도',
      blocks: [
        `계정 하나당 하루에 쓰기 ${FACTS.writingPerDay}개, 말하기 ${FACTS.speakingPerDay}개까지, 30일 동안 모두 ${FACTS.gradedPer30Days}개까지 피드백을 받을 수 있어요. 하루 한도는 ${DAILY_RESET_KO}에 초기화돼요.`,
        `쓰기 답안은 ${FACTS.maxEssayChars}자까지, 녹음은 ${FACTS.audioMinutes}분, ${FACTS.audioMb}MB까지 가능해요.`,
        '이민 관련 질문처럼 피드백을 드릴 수 없는 요청은 한도에 포함되지 않아요.',
      ],
    },
    {
      id: 'who-can-buy',
      heading: '구매할 수 있는 분',
      blocks: [
        '만 18세 이상이고, 퀘벡을 제외한 캐나다에 살며, 캐나다에서 발급된 카드로 결제하는 분만 살 수 있어요. 구매할 때 퀘벡을 제외한 캐나다에 산다는 것을 체크 상자로 확인해 주세요.',
        '결제 후 청구지 주소와 카드 발급 국가를 확인해요. 둘 중 하나라도 캐나다 밖이거나 청구지 주소가 퀘벡이면, 이용권을 활성화하지 않고 자동으로 전액 환불해 드려요.',
        '결제는 Stripe가 처리해요. 저희는 카드 번호 전체를 보거나 저장하지 않아요.',
      ],
    },
    {
      id: 'refunds',
      heading: '환불',
      blocks: [
        `구매 후 ${FACTS.refundDays}일 안에, 피드백을 받은 과제가 ${FACTS.refundMaxTasks}개 이하라면 [계정 페이지](${PATHS.account})에서 환불을 요청할 수 있어요. 직접 환불은 한 사람과 한 카드당 한 번만 가능해요.`,
        `[환불 정책 전문 보기(영어)](${PATHS.refunds})`,
      ],
    },
  ],
  help: `더 궁금한 점은 [이용권과 환불 도움말(영어)](${PATHS.helpPasses})을 확인해 주세요.`,
  product: {
    name: `${BRAND.ko} 이용권`,
    description: '영어 쓰기·말하기 연습 과제에 AI 피드백을 받는 1회 결제 이용권이에요. 구독이나 자동 갱신은 없어요.',
  },
}

export const PRICING: Record<Lang, PricingCopy> = { en: PRICING_EN, ko: PRICING_KO }
