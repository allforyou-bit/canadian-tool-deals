// React bindings for the client stores in lib/me.ts and lib/lang.ts.
import { useSyncExternalStore } from 'react'
import type { Lang } from '../shared/api'
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
