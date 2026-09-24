// First-party funnel events (CONTRACT §6). The browser may send only landing, sample_start,
// sample_done, practice_start and practice_done (the free practice mode without AI, memo §7.2 Z9);
// signup/checkout_start/purchase/refund are recorded by the Worker. No personal data and no answer
// content: only the event name, the path (no query string) and whitelisted campaign parameters.
import type { EventName, EventRequest } from '../shared/api'
import { api } from './api'

export type ClientEventName = Extract<EventName, 'landing' | 'sample_start' | 'sample_done' | 'practice_start' | 'practice_done'>

const CLIENT_EVENTS: readonly ClientEventName[] = ['landing', 'sample_start', 'sample_done', 'practice_start', 'practice_done']

export const isClientEvent = (name: string): name is ClientEventName =>
  (CLIENT_EVENTS as readonly string[]).includes(name)

/** Campaign parameters we keep from the landing URL (no ad click ids: the launch runs no ads, memo §7.2 Z1). */
export const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const

const MAX_VALUE_LENGTH = 100
/** Same character set the Worker accepts (worker/src/events.ts): no "@", "/", "?", "=" or "%". */
const VALUE_RE = /^[A-Za-z0-9._~ -]+$/
const UTM_STORAGE_KEY = 'mpc_utm'
const SENT_PREFIX = 'mpc_sent_'

/**
 * Whitelisted campaign parameters from a query string. Values are trimmed and capped; values with
 * other characters (an email address or a URL, for example) are dropped, so personal data never
 * reaches the events table.
 */
export function extractUtm(search: string): Record<string, string> {
  const params = new URLSearchParams(search)
  const out: Record<string, string> = {}
  for (const key of UTM_KEYS) {
    const value = params.get(key)?.trim().slice(0, MAX_VALUE_LENGTH)
    if (value && VALUE_RE.test(value)) out[key] = value
  }
  return out
}

type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>

export interface TrackEnv {
  /** sessionStorage, or null when the browser blocks it */
  storage: KeyValueStore | null
  search: string
  path: string
  send: (req: EventRequest) => void
}

function storedUtm(storage: KeyValueStore | null): Record<string, string> | undefined {
  try {
    const raw = storage?.getItem(UTM_STORAGE_KEY)
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return undefined
    // re-filter on the way out in case storage was edited
    return extractUtm(new URLSearchParams(parsed as Record<string, string>).toString())
  } catch {
    return undefined
  }
}

// Fallback de-duplication for the life of this page when sessionStorage is unavailable.
const sentInMemory = new Set<string>()

/** landing: once per session; sample and practice events: once per session per task page. */
export function dedupeKey(name: ClientEventName, path: string): string {
  return name === 'landing' ? SENT_PREFIX + name : `${SENT_PREFIX}${name}:${path}`
}

function alreadySent(storage: KeyValueStore | null, key: string): boolean {
  try {
    if (storage) return storage.getItem(key) === '1'
  } catch {
    // fall through to memory
  }
  return sentInMemory.has(key)
}

function markSent(storage: KeyValueStore | null, key: string): void {
  sentInMemory.add(key)
  try {
    storage?.setItem(key, '1')
  } catch {
    // memory fallback already recorded it
  }
}

/**
 * Send an event at most once (see dedupeKey). For 'landing' this also captures the campaign
 * parameters of the landing URL so later events carry the same attribution. Returns true if sent.
 */
export function trackOnce(name: ClientEventName, env: TrackEnv): boolean {
  if (!isClientEvent(name)) return false
  const key = dedupeKey(name, env.path)
  if (alreadySent(env.storage, key)) return false
  markSent(env.storage, key)
  if (name === 'landing') {
    const utm = extractUtm(env.search)
    if (Object.keys(utm).length > 0) {
      try {
        env.storage?.setItem(UTM_STORAGE_KEY, JSON.stringify(utm))
      } catch {
        // attribution for later events is lost; the landing event still carries it
      }
    }
    env.send({ name, path: env.path, ...(Object.keys(utm).length > 0 ? { utm } : {}) })
    return true
  }
  const utm = storedUtm(env.storage)
  env.send({ name, path: env.path, ...(utm && Object.keys(utm).length > 0 ? { utm } : {}) })
  return true
}

function browserEnv(): TrackEnv {
  let storage: KeyValueStore | null = null
  try {
    storage = window.sessionStorage
  } catch {
    storage = null
  }
  return {
    storage,
    search: window.location.search,
    path: window.location.pathname,
    send: (req) => {
      api.track(req).catch(() => {
        // analytics must never break the page
      })
    },
  }
}

/** Browser entry point (no-op during prerender). */
export function track(name: ClientEventName): void {
  if (typeof window === 'undefined') return
  trackOnce(name, browserEnv())
}
