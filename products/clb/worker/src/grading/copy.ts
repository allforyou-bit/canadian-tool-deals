// Fixed learner-facing text used when the grader's own wording cannot be shown. Every string here
// must pass findClaims with GRADER_OUTPUT_RULES (tested in worker/test/grading/filter.test.ts).
import type { Lang } from '../../../shared/api'

type Bi = Record<Lang, string>

/** Out-of-scope request (immigration, visa, legal): point to licensed professionals. */
export const SCOPE_REFUSAL: Bi = {
  en: 'This coach only gives feedback on English practice responses. For immigration, visa or legal questions, please contact a licensed immigration consultant (a CICC member) or a lawyer.',
  ko: '이 코치는 영어 연습 답안에 대한 피드백만 드려요. 이민, 비자, 법률 관련 질문은 CICC에 등록된 이민 컨설턴트나 변호사에게 문의해 주세요.',
}

/** The model declined for safety reasons (stop_reason "refusal"). */
export const SAFETY_REFUSAL: Bi = {
  en: 'We could not give feedback on this response. Please try again with an answer to the practice task.',
  ko: '이 답안에는 피드백을 드릴 수 없어요. 연습 과제에 대한 답안으로 다시 시도해 주세요.',
}

/** Replacements for explanation fields that are empty or were emptied by the claim filter. */
export const FIELD_FALLBACK: Record<'name' | 'strengths' | 'improve' | 'why' | 'nextStep', Bi> = {
  name: { en: 'Feedback', ko: '피드백' },
  strengths: {
    en: 'You made a clear attempt at this part of the task.',
    ko: '이 부분에서 과제를 분명하게 시도했어요.',
  },
  improve: {
    en: 'Read this part again and try one small, specific change.',
    ko: '이 부분을 다시 읽고 작고 구체적인 변화 하나를 시도해 보세요.',
  },
  why: {
    en: 'This change makes the sentence clearer and more natural.',
    ko: '이렇게 바꾸면 문장이 더 분명하고 자연스러워져요.',
  },
  nextStep: {
    en: 'Rewrite one paragraph using the corrections above, then try the task again.',
    ko: '위의 교정을 반영해 한 단락을 다시 써 보고, 과제를 한 번 더 연습해 보세요.',
  },
}
