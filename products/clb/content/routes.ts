// Every path the content pages link to or publish. content.test.ts checks that each internal link in the
// copy points at one of these, and app/sitemap.ts lists the public ones.
import { TASKS, type TaskType } from '../shared/tasks'

export const PATHS = {
  home: '/',
  homeKo: '/ko/',
  pricing: '/pricing/',
  pricingKo: '/ko/pricing/',
  formats: '/formats/',
  formatsWriting: '/formats/writing/',
  formatsSpeaking: '/formats/speaking/',
  help: '/help/',
  helpFeedback: '/help/how-feedback-works/',
  helpRecording: '/help/speaking-recording/',
  helpAccount: '/help/account-and-sign-in/',
  helpPasses: '/help/passes-and-refunds/',
  helpPrivacy: '/help/privacy-and-your-data/',
  helpTroubleshooting: '/help/troubleshooting/',
  privacy: '/legal/privacy/',
  terms: '/legal/terms/',
  refunds: '/legal/refunds/',
  aiDisclosure: '/legal/ai-disclosure/',
  notAffiliated: '/legal/not-affiliated/',
  // pages owned by frontend-app that the content links to
  practice: '/practice/',
  account: '/account/',
  login: '/login/',
  status: '/status/',
} as const

/** Practice page for one task type (frontend-app: /practice/{writing|speaking}/[task]/). */
export const practicePath = (task: Pick<TaskType, 'kind' | 'id'>): string => `/practice/${task.kind}/${task.id}/`

/** The free sample the landing page sends people to. */
export const FREE_WRITING_PATH = '/practice/writing/email/'

/** Pages built by frontend-content (this area). */
export const CONTENT_ROUTES: string[] = [
  PATHS.home,
  PATHS.homeKo,
  PATHS.pricing,
  PATHS.pricingKo,
  PATHS.formats,
  PATHS.formatsWriting,
  PATHS.formatsSpeaking,
  PATHS.help,
  PATHS.helpFeedback,
  PATHS.helpRecording,
  PATHS.helpAccount,
  PATHS.helpPasses,
  PATHS.helpPrivacy,
  PATHS.helpTroubleshooting,
  PATHS.privacy,
  PATHS.terms,
  PATHS.refunds,
  PATHS.aiDisclosure,
  PATHS.notAffiliated,
]

/** The practice index and the 10 practice pages (frontend-app), listed in the sitemap. */
export const PRACTICE_ROUTES: string[] = [PATHS.practice, ...TASKS.map(practicePath)]

/** Pages built by frontend-app that content may link to (not listed in the sitemap). */
export const APP_ROUTES: string[] = [PATHS.account, PATHS.login, PATHS.status]

/** Pages with an English and a Korean version (hreflang pairs). */
export const LANG_PAIRS: { en: string; ko: string }[] = [
  { en: PATHS.home, ko: PATHS.homeKo },
  { en: PATHS.pricing, ko: PATHS.pricingKo },
]

export const KNOWN_ROUTES: ReadonlySet<string> = new Set([...CONTENT_ROUTES, ...PRACTICE_ROUTES, ...APP_ROUTES])
