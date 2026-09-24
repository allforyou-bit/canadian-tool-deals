// Remembered UI language (a per-viewer convenience in localStorage; the page works without it).
// `?lang=ko` in the URL and the Korean pages (/ko/…) set it: components/UiLangSync.tsx calls
// setUiLang after every navigation, so the choice also survives the magic-link tab.
import type { Lang } from '../shared/api'

const STORAGE_KEY = 'mpc_lang'

export const isLang = (v: unknown): v is Lang => v === 'en' || v === 'ko'

/** `lang` query parameter, if it names a supported language. */
export function langFromSearch(search: string): Lang | null {
  const v = new URLSearchParams(search).get('lang')
  return isLang(v) ? v : null
}

/**
 * The language a location asks for: the Korean pages (/ko/…) mean Korean, otherwise an explicit
 * ?lang= wins. null means "keep the remembered choice".
 */
export function langForLocation(pathname: string, search: string): Lang | null {
  if (pathname === '/ko' || pathname.startsWith('/ko/')) return 'ko'
  return langFromSearch(search)
}

let current: Lang | null = null
const listeners = new Set<() => void>()

function readStored(): Lang | null {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY)
    return isLang(v) ? v : null
  } catch {
    return null
  }
}

export function getUiLang(): Lang {
  if (current === null) current = langForLocation(window.location.pathname, window.location.search) ?? readStored() ?? 'en'
  return current
}

export const getServerUiLang = (): Lang => 'en'

export function setUiLang(lang: Lang): void {
  current = lang
  try {
    window.localStorage.setItem(STORAGE_KEY, lang)
  } catch {
    // storage blocked: the choice still applies for this page view
  }
  for (const fn of listeners) fn()
}

export function subscribeUiLang(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
