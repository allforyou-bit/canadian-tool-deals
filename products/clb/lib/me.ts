// One shared GET /api/me per page load. Header, banner, BuyPass and pages all read this store, and
// sign-in, sign-out and checkout call refreshMe({ force: true }) so every subscriber updates together.
import type { MeResponse } from '../shared/api'
import { api, ApiClientError } from './api'

export type MeState =
  | { status: 'loading' }
  | { status: 'ready'; me: MeResponse }
  | { status: 'error'; error: ApiClientError }

const LOADING: MeState = { status: 'loading' }

let state: MeState = LOADING
let started = false
/** Bumped by every request that is actually sent; only the newest request may write the store. */
let generation = 0
let inflight: { gen: number; promise: Promise<MeResponse | null> } | null = null
const listeners = new Set<() => void>()

function setState(next: MeState): void {
  state = next
  for (const fn of listeners) fn()
}

function toClientError(e: unknown): ApiClientError {
  return e instanceof ApiClientError ? e : new ApiClientError('internal', 0, 'Network error')
}

/** What a superseded request resolves to: the newer request's answer (or the store, once it has landed). */
function latest(): Promise<MeResponse | null> {
  if (inflight) return inflight.promise
  return Promise.resolve(state.status === 'ready' ? state.me : null)
}

export interface RefreshOptions {
  /**
   * Send a new request even if one is already in flight. Use it after anything that changes the
   * answer (sign-in, sign-out, deletion, purchase): a request that started earlier may have left
   * without the new session cookie, and its late answer must not overwrite the new one.
   */
  force?: boolean
}

/** Fetch /api/me again. Never rejects: failures land in the store as { status: 'error' }. */
export function refreshMe(opts: RefreshOptions = {}): Promise<MeResponse | null> {
  started = true
  if (inflight && !opts.force) return inflight.promise
  const gen = ++generation
  const promise = api
    .me()
    .then(
      (me): MeResponse | null | Promise<MeResponse | null> => {
        if (gen !== generation) return latest()
        setState({ status: 'ready', me })
        return me
      },
      (e: unknown): MeResponse | null | Promise<MeResponse | null> => {
        if (gen !== generation) return latest()
        setState({ status: 'error', error: toClientError(e) })
        return null
      },
    )
    .finally(() => {
      if (inflight?.gen === gen) inflight = null
    })
  inflight = { gen, promise }
  return promise
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

/** A free sample: still available, already used, or switched off for everyone right now. */
export type FreeSample = 'available' | 'used' | 'off'

/**
 * The state of this visitor's free sample of `kind`. 'off' wins over 'used': while free samples are
 * switched off (by the owner or the spend monitor) /api/me reports every sample as unavailable, and
 * a new visitor must not be told they already used theirs. A missing flag (an older Worker) is on.
 */
export function freeSample(me: MeResponse, kind: 'writing' | 'speaking'): FreeSample {
  if (me.flags.freeEnabled === false) return 'off'
  return me.free[kind] ? 'available' : 'used'
}

/**
 * When the learner's access ends: the end of the chain of passes (queued passes included), falling
 * back to the active pass. null when nothing runs past `now`.
 */
export function accessEndsAt(me: MeResponse, now = new Date()): string | null {
  const candidates = [me.accessEndsAt, activePass(me, now)?.endsAt].filter(
    (v): v is string => typeof v === 'string' && new Date(v).getTime() > now.getTime(),
  )
  if (candidates.length === 0) return null
  return candidates.reduce((a, b) => (new Date(b).getTime() > new Date(a).getTime() ? b : a))
}

