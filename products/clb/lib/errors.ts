// Maps an ApiClientError to a user-facing message (and an optional next action) per context.
import type { Lang } from '../shared/api'
import { CAPS } from '../shared/config'
import type { ApiClientError } from './api'
import { t } from './i18n'
import { loginHref } from './url'

export type ErrorContext = 'writing' | 'speaking' | 'checkout' | 'login' | 'account'

export interface ErrorView {
  text: string
  /** links to the next step, e.g. sign in or pricing */
  actions: { href: string; label: string }[]
}

/** What the page knows from /api/me, so the wording fits this visitor. */
export interface ErrorHints {
  signedIn?: boolean
  /** free samples are switched off for everyone right now (MeResponse.flags.freeEnabled === false) */
  freeOff?: boolean
}

function pricingHref(lang: Lang): string {
  return lang === 'ko' ? '/ko/pricing/' : '/pricing/'
}

/**
 * `returnTo` is where sign-in should come back to (usually the current page). Server messages are
 * shown only for codes whose wording depends on server-side policy (refunds, bad input).
 */
export function describeError(
  err: ApiClientError,
  lang: Lang,
  context: ErrorContext,
  returnTo?: string,
  hints: ErrorHints = {},
): ErrorView {
  if (err.isNetwork) return { text: t(lang, 'common.network'), actions: [] }
  const signIn = { href: loginHref(returnTo, lang), label: t(lang, 'common.signIn') }
  const pricing = { href: pricingHref(lang), label: t(lang, 'common.seePricing') }

  switch (err.code) {
    case 'payment_required':
      return { text: t(lang, 'err.payment_required'), actions: [pricing] }
    case 'free_unavailable':
      // Free samples are switched off (the practice page says so too; a signed-in learner gets this
      // code only then): signing in does not help, only a pass does. Signed out, it can also mean
      // this device already used its sample, and signing in unlocks the speaking sample.
      if (hints.freeOff || hints.signedIn) return { text: t(lang, 'p.freeOff'), actions: [pricing] }
      return { text: t(lang, 'err.free_unavailable'), actions: context === 'writing' ? [signIn, pricing] : [pricing] }
    case 'grading_paused':
      return { text: t(lang, 'err.grading_paused'), actions: [] }
    case 'rate_limited':
      if (context === 'login') return { text: t(lang, 'l.rateLimited'), actions: [] }
      // the Worker answers rate_limited for the graded-task caps and for the daily cap on answers
      // that got no feedback (refusals, failures); the message names all of them
      return {
        text: t(lang, 'err.rate_limited', {
          w: CAPS.writingPerDay,
          s: CAPS.speakingPerDay,
          t: CAPS.gradedPer30Days,
          n: CAPS.noFeedbackPerDay,
        }),
        actions: [],
      }
    case 'turnstile_failed':
      return { text: t(lang, 'err.turnstile_failed'), actions: [] }
    case 'unauthorized':
      return { text: t(lang, 'err.unauthorized'), actions: [signIn] }
    case 'too_large': {
      const mb = CAPS.maxAudioBytes / 1024 / 1024
      return { text: context === 'speaking' ? t(lang, 's.tooLarge', { mb }) : t(lang, 'err.too_large'), actions: [] }
    }
    case 'region_not_supported':
      return { text: t(lang, context === 'checkout' ? 'b.region' : 'err.region_not_supported'), actions: [] }
    case 'checkout_unavailable':
      return { text: t(lang, 'err.checkout_unavailable'), actions: [] }
    case 'bad_request':
      if (context === 'login') return { text: t(lang, 'l.badEmail'), actions: [] }
      // speaking: the Worker's bad_request for a valid upload means the transcript was empty
      if (context === 'speaking') return { text: t(lang, 's.noSpeech'), actions: [] }
      // checkout: a stale page (e.g. terms version changed since it loaded)
      if (context === 'checkout') return { text: t(lang, 'b.reload'), actions: [] }
      return { text: context === 'account' && err.message ? err.message : t(lang, 'err.bad_request'), actions: [] }
    case 'forbidden':
    case 'not_found':
      // refund eligibility and similar policy answers come with a specific server message
      if (context === 'account' && err.message) return { text: err.message, actions: [] }
      return { text: t(lang, 'common.generic'), actions: [] }
    case 'internal':
      return { text: t(lang, 'common.generic'), actions: [] }
  }
}
