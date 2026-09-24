// Where to go after the magic link is opened. The link itself carries only the token, so the
// login page remembers ?next= in localStorage (a convenience; sign-in works without it).
import { safeNextPath } from './url'

const STORAGE_KEY = 'mpc_next'
/** Remembered paths older than this are ignored (magic links live 15 minutes). */
export const RETURN_PATH_TTL_MS = 60 * 60 * 1000

export function rememberReturnPath(path: string | null): void {
  try {
    if (path) window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ path, at: Date.now() }))
    else window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // storage blocked: sign-in lands on /account/
  }
}

/** Read and clear the remembered path; only a fresh, safe same-origin path is returned. */
export function takeReturnPath(origin: string, now = Date.now()): string | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    window.localStorage.removeItem(STORAGE_KEY)
    if (!raw) return null
    const { path, at } = JSON.parse(raw) as { path?: unknown; at?: unknown }
    if (typeof path !== 'string' || typeof at !== 'number' || now - at > RETURN_PATH_TTL_MS) return null
    return safeNextPath(path, origin)
  } catch {
    return null
  }
}
