// One shared GET /api/me per page load. Header, banner, BuyPass and pages all read this store, and
// sign-in, sign-out and checkout call refreshMe() so every subscriber updates together.
import type { MeResponse } from '../shared/api'
import { api, ApiClientError } from './api'

export type MeState =
  | { status: 'loading' }
  | { status: 'ready'; me: MeResponse }
  | { status: 'error'; error: ApiClientError }

const LOADING: MeState = { status: 'loading' }

let state: MeState = LOADING
let started = false
let inflight: Promise<MeResponse | null> | null = null
const listeners = new Set<() => void>()

function setState(next: MeState): void {
  state = next
  for (const fn of listeners) fn()
}

function toClientError(e: unknown): ApiClientError {
  return e instanceof ApiClientError ? e : new ApiClientError('internal', 0, 'Network error')
}

/** Fetch /api/me again. Never rejects: failures land in the store as { status: 'error' }. */
export function refreshMe(): Promise<MeResponse | null> {
  started = true
  if (inflight) return inflight
  inflight = api
    .me()
    .then(
      (me) => {
        setState({ status: 'ready', me })
        return me
      },
      (e: unknown) => {
        setState({ status: 'error', error: toClientError(e) })
        return null
      },
    )
    .finally(() => {
      inflight = null
    })
  return inflight
}

export function subscribeMe(fn: () => void): () => void {
  listeners.add(fn)
  if (!started) void refreshMe()
  return () => {
    listeners.delete(fn)
  }
}

export const getMeState = (): MeState => state
export const getServerMeState = (): MeState => LOADING

/** The active pass, if /api/me says there is one that has not ended yet. */
export function activePass(me: MeResponse, now = new Date()) {
  const pass = me.pass
  if (!pass) return null
  return new Date(pass.endsAt).getTime() > now.getTime() ? pass : null
}
