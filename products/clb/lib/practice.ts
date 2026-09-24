// Free practice mode (memo §7.2 Z9): "Practise without feedback" on every practice page. No AI, no
// upload, no sign-in; a call to action points to the free AI writing sample and to pricing.
import type { Lang, MeResponse } from '../shared/api'
import type { TaskKind } from '../shared/tasks'
import { activePass, freeSample, speakingOpen } from './me'

export type PracticeMode = 'feedback' | 'practice'

/** `?mode=practice` opens a practice page in the practice mode (links from community posts use it). */
export function practiceModeFromSearch(search: string): PracticeMode | null {
  const v = new URLSearchParams(search).get('mode')
  return v === 'practice' || v === 'feedback' ? v : null
}

/** Short self-check lists shown in the practice mode (plain study advice, no claims about any test). */
export const SELF_CHECK: Record<TaskKind, Record<Lang, readonly string[]>> = {
  writing: {
    en: [
      'I answered every point in the task.',
      'My answer is within the target number of words.',
      'I used paragraphs: an opening, the main points and a closing.',
      'I joined my ideas with linking words such as "however", "also" and "as a result".',
      'The tone fits the reader: polite and clear.',
      'I checked verb tenses, articles (a, an, the) and spelling.',
    ],
    ko: [
      '과제의 모든 요점에 답했어요.',
      '답안이 목표 단어 수 안에 있어요.',
      '문단을 나눴어요: 시작, 주요 내용, 마무리.',
      '"however", "also", "as a result" 같은 연결어로 생각을 이었어요.',
      '받는 사람에게 맞는 어조예요: 공손하고 분명해요.',
      '시제, 관사(a, an, the), 철자를 확인했어요.',
    ],
  },
  speaking: {
    en: [
      'I answered the question I was asked.',
      'I gave reasons and at least one example.',
      'I kept talking until close to the end of the time.',
      'I used linking words such as "first", "also" and "because".',
      'When I listened back, my main point was easy to follow.',
    ],
    ko: [
      '받은 질문에 맞게 답했어요.',
      '이유와 예시를 하나 이상 말했어요.',
      '시간이 거의 끝날 때까지 계속 말했어요.',
      '"first", "also", "because" 같은 연결어를 썼어요.',
      '다시 들어 보니 요점을 쉽게 따라갈 수 있었어요.',
    ],
  },
}

/** What the practice mode's call to action offers this visitor. */
export interface PracticeCta {
  /** switch this page to AI feedback (writing keeps the answer) */
  feedback: boolean
  /** speaking, signed out: sign in with Google; the first speaking task with feedback is free */
  signIn: boolean
  /** speaking pages: the free AI writing sample is still available (no account needed) */
  writingSample: boolean
  /** no pass: link to pricing */
  pricing: boolean
}

/**
 * The call to action after a practice answer. `me` is null while /api/me loads or failed: then the
 * free offers are shown and the server decides later.
 */
export function practiceCta(me: MeResponse | null, kind: TaskKind): PracticeCta {
  if (!me) return { feedback: kind === 'writing', signIn: kind === 'speaking', writingSample: kind === 'speaking', pricing: true }
  const pass = activePass(me) !== null
  const freeWriting = !pass && freeSample(me, 'writing') === 'available'
  if (kind === 'writing') return { feedback: pass || freeWriting, signIn: false, writingSample: false, pricing: !pass }
  const open = speakingOpen(me)
  const freeSpeaking = !pass && me.signedIn && freeSample(me, 'speaking') === 'available'
  return {
    feedback: open && (pass || freeSpeaking),
    // signed out: the speaking sample is unlocked by signing in, unless free samples are off
    signIn: open && !me.signedIn && me.flags.freeEnabled !== false,
    writingSample: freeWriting,
    pricing: !pass,
  }
}

/** The next 00:00 UTC, when the daily limits and the site-wide speaking budget reset. */
export function nextUtcMidnight(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
}
