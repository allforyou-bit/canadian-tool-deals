// Request/response contracts between the static site (products/clb/app) and the Worker
// (products/clb/worker). Every /api response is JSON. Errors: HTTP 4xx/5xx with ApiError.

import type { Sku } from './config'

export type Lang = 'en' | 'ko'

export interface ApiError {
  error:
    | 'bad_request'
    | 'unauthorized'
    | 'forbidden'
    | 'not_found'
    | 'rate_limited'
    | 'payment_required'
    | 'region_not_supported'
    | 'grading_paused'
    | 'checkout_unavailable'
    | 'free_unavailable'
    | 'turnstile_failed'
    | 'too_large'
    | 'internal'
  message: string
}

// ---------- auth (magic link) ----------
export interface MagicLinkRequest {
  email: string
  lang: Lang
  turnstileToken: string
  /** separate, unticked-by-default CASL express consent (memo B2) */
  marketingOptIn: boolean
  /** exact consent wording shown next to the box; stored with a version */
  marketingConsentText: string
  /** user confirms they are 18+ */
  adult: boolean
}
export interface MagicLinkResponse {
  ok: true
}
export interface VerifyRequest {
  token: string
}
export interface VerifyResponse {
  ok: true
  email: string
}

// ---------- me / account ----------
export interface Pass {
  sku: Sku
  startsAt: string
  endsAt: string
}
export interface MeResponse {
  signedIn: boolean
  email?: string
  pass?: Pass | null
  /** signed-in only: current CASL marketing consent */
  marketingOptIn?: boolean
  /** free samples still available to this device/user */
  free: { writing: boolean; speaking: boolean }
  usage: { writingToday: number; speakingToday: number; graded30d: number }
  flags: { checkoutEnabled: boolean; gradingEnabled: boolean; banner: string }
}
export interface DeleteAccountResponse {
  ok: true
}
/** Withdraw (or give) CASL marketing consent from the account page. */
export interface MarketingRequest {
  optIn: boolean
  /** required when optIn is true: the exact consent wording shown */
  consentText?: string
}
export interface SupportRequest {
  message: string
  lang: Lang
}

// ---------- grading ----------
export interface CriterionFeedback {
  /** criterion name, in the explanation language */
  name: string
  strengths: string
  improve: string
}
/** Fixed error categories, so the history page can show recurring patterns across tasks. */
export const ERROR_KINDS = [
  'grammar',
  'vocabulary',
  'spelling',
  'punctuation',
  'sentence_structure',
  'organization',
  'coherence',
  'task_fulfillment',
  'tone_register',
  'fluency',
] as const
export type ErrorKind = (typeof ERROR_KINDS)[number]

export interface ErrorItem {
  kind: ErrorKind
  original: string
  correction: string
  why: string
}
export interface GradeResult {
  /** true when the request was out of scope (e.g. immigration/legal questions) — no feedback given */
  refused: boolean
  refusalMessage?: string
  criteria: CriterionFeedback[]
  topErrors: ErrorItem[]
  /** 1–2 improved versions of weak sentences or a short model paragraph */
  rewrites: string[]
  /** overall next step, one or two sentences */
  nextStep: string
  explanationLang: Lang
  /** always false in this window (memo: band_enabled stays false through Jan 31 2027) */
  bandShown: false
  /** speaking only: the transcript the feedback was based on */
  transcript?: string
  wordCount?: number
}
export interface WritingGradeRequest {
  taskId: string
  promptIndex: number
  text: string
  explanationLang: Lang
  /** required whenever the request uses the free writing sample: signed out, or signed in without an active pass */
  turnstileToken?: string
}
/** Speaking: multipart/form-data with fields taskId, promptIndex, explanationLang, audio (Blob) */
export interface GradeResponse {
  gradeId: string
  result: GradeResult
  /** true when this used the free sample */
  free: boolean
}

// ---------- history ----------
export interface HistoryItem {
  gradeId: string
  taskId: string
  createdAt: string
  topErrorKinds: string[]
}
export interface HistoryResponse {
  items: HistoryItem[]
  /** recurring error kinds across the learner's recent work */
  recurring: { kind: string; count: number }[]
}

// ---------- payments ----------
export interface CheckoutRequest {
  sku: Sku
  /** "I live in Canada, outside Quebec" checkbox */
  residentAttestation: boolean
  lang: Lang
}
export interface CheckoutResponse {
  url: string
}
export interface RefundRequest {
  lang: Lang
}
export interface RefundResponse {
  ok: true
  refundedCents: number
}

// ---------- events (first-party analytics, no personal data) ----------
export type EventName = 'landing' | 'sample_start' | 'sample_done' | 'signup' | 'checkout_start' | 'purchase' | 'refund'
export interface EventRequest {
  name: EventName
  /** utm_source/medium/campaign and gclid captured on landing; never personal data */
  utm?: Record<string, string>
  path: string
}

// ---------- health ----------
export interface HealthResponse {
  ok: true
  version: string
}
