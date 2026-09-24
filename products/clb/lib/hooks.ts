// React bindings for the client stores in lib/me.ts and lib/lang.ts.
import { useSyncExternalStore } from 'react'
import type { Lang } from '../shared/api'
import { PUBLIC_ENV } from './env'
import { getServerUiLang, getUiLang, subscribeUiLang } from './lang'
import { getMeState, getServerMeState, subscribeMe, type MeState } from './me'

/** Shared /api/me state; the first subscriber triggers the request. */
export function useMe(): MeState {
  return useSyncExternalStore(subscribeMe, getMeState, getServerMeState)
}

/** Remembered UI language ('en' during prerender). */
export function useUiLang(): Lang {
  return useSyncExternalStore(subscribeUiLang, getUiLang, getServerUiLang)
}

const noSubscribe = () => () => {}

/** Public site URL for consent text: NEXT_PUBLIC_SITE_URL, else this page's origin. */
export function useSiteUrl(): string {
  return useSyncExternalStore(
    noSubscribe,
    () => PUBLIC_ENV.siteUrl || window.location.origin,
    () => PUBLIC_ENV.siteUrl,
  )
}
