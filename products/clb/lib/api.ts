// Typed client for the Worker's same-origin /api (CONTRACT §2). Every call sends JSON (or multipart
// for speaking) with same-origin credentials and throws ApiClientError on any non-2xx response.
import type {
  ApiError,
  CheckoutRequest,
  CheckoutResponse,
  DeleteAccountResponse,
  EventRequest,
  GradeResponse,
  HealthResponse,
  HistoryItemResponse,
  HistoryResponse,
  Lang,
  MagicLinkRequest,
  MagicLinkResponse,
  MarketingRequest,
  MeResponse,
  RefundRequest,
  RefundResponse,
  SupportRequest,
  UnsubscribeRequest,
  VerifyRequest,
  VerifyResponse,
  WritingGradeRequest,
} from '../shared/api'

export type ApiErrorCode = ApiError['error']

export interface OkResponse {
  ok: true
}

/** Error thrown for every failed call. `status` is 0 when the request never reached the server. */
export class ApiClientError extends Error {
  readonly code: ApiErrorCode
  readonly status: number

  constructor(code: ApiErrorCode, status: number, message: string) {
    super(message)
    this.name = 'ApiClientError'
    this.code = code
    this.status = status
  }

  /** true when the browser could not reach the server at all */
  get isNetwork(): boolean {
    return this.status === 0
  }
}

// A Record keyed by the union makes the compiler flag any code added to or removed from ApiError.
const KNOWN_CODES: Record<ApiErrorCode, true> = {
  bad_request: true,
  unauthorized: true,
  forbidden: true,
  not_found: true,
  rate_limited: true,
  payment_required: true,
  region_not_supported: true,
  grading_paused: true,
  checkout_unavailable: true,
  free_unavailable: true,
  turnstile_failed: true,
  too_large: true,
  internal: true,
}

export function isApiErrorCode(value: unknown): value is ApiErrorCode {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(KNOWN_CODES, value)
}

/** Fallback when an error body is not our JSON (e.g. an HTML page from a proxy). */
export function codeForStatus(status: number): ApiErrorCode {
  switch (status) {
    case 400:
      return 'bad_request'
    case 401:
      return 'unauthorized'
    case 402:
      return 'payment_required'
    case 403:
      return 'forbidden'
    case 404:
      return 'not_found'
    case 413:
      return 'too_large'
    case 429:
      return 'rate_limited'
    default:
      return 'internal'
  }
}

/** Build the ApiClientError for a failed response from its status and parsed body (if any). */
export function toApiClientError(status: number, body: unknown): ApiClientError {
  if (body && typeof body === 'object') {
    const { error, message } = body as Partial<Record<keyof ApiError, unknown>>
    if (isApiErrorCode(error)) {
      return new ApiClientError(error, status, typeof message === 'string' ? message : error)
    }
  }
  return new ApiClientError(codeForStatus(status), status, `Request failed (${status})`)
}

interface RequestOptions {
  method?: 'GET' | 'POST'
  json?: unknown
  form?: FormData
  signal?: AbortSignal
  keepalive?: boolean
}

async function readJsonBody(res: Response): Promise<unknown> {
  const text = await res.text()
  if (!text) return undefined
  try {
    return JSON.parse(text) as unknown
  } catch {
    return undefined
  }
}

/** Low-level call. Uses the global fetch at call time so tests can stub it. */
export async function apiRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json' }
  let body: BodyInit | undefined
  if (opts.json !== undefined) {
    headers['content-type'] = 'application/json'
    body = JSON.stringify(opts.json)
  } else if (opts.form) {
    body = opts.form
  }

  let res: Response
  try {
    res = await fetch(path, {
      method: opts.method ?? (body === undefined ? 'GET' : 'POST'),
      headers,
      body,
      credentials: 'same-origin',
      signal: opts.signal,
      keepalive: opts.keepalive,
    })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e
    throw new ApiClientError('internal', 0, 'Network error')
  }

  const data = await readJsonBody(res)
  if (!res.ok) throw toApiClientError(res.status, data)
  if (data === undefined) throw new ApiClientError('internal', res.status, 'Invalid response')
  return data as T
}

const post = <T>(path: string, json: unknown = {}, extra: Omit<RequestOptions, 'json' | 'method'> = {}) =>
  apiRequest<T>(path, { ...extra, method: 'POST', json })

/** Fields of the multipart speaking request (CONTRACT §2). */
export interface SpeakingGradeInput {
  taskId: string
  promptIndex: number
  explanationLang: Lang
  audio: Blob
  /** file name sent with the audio part, e.g. "answer.webm" */
  filename: string
  durationSeconds?: number
}

export function speakingFormData(input: SpeakingGradeInput): FormData {
  const form = new FormData()
  form.append('taskId', input.taskId)
  form.append('promptIndex', String(input.promptIndex))
  form.append('explanationLang', input.explanationLang)
  form.append('audio', input.audio, input.filename)
  if (input.durationSeconds !== undefined) form.append('durationSeconds', String(input.durationSeconds))
  return form
}

export const api = {
  me: (signal?: AbortSignal) => apiRequest<MeResponse>('/api/me', { signal }),
  health: () => apiRequest<HealthResponse>('/api/health'),
  requestMagicLink: (body: MagicLinkRequest) => post<MagicLinkResponse>('/api/auth/magic-link', body),
  verify: (body: VerifyRequest) => post<VerifyResponse>('/api/auth/verify', body),
  logout: () => post<OkResponse>('/api/auth/logout'),
  deleteAccount: () => post<DeleteAccountResponse>('/api/account/delete'),
  setMarketing: (body: MarketingRequest) => post<OkResponse>('/api/account/marketing', body),
  support: (body: SupportRequest) => post<OkResponse>('/api/support', body),
  /** newest first; pass the previous page's nextBefore for the next (older) page */
  history: (before?: string | null) =>
    apiRequest<HistoryResponse>(before ? `/api/history?before=${encodeURIComponent(before)}` : '/api/history'),
  historyItem: (gradeId: string) => apiRequest<HistoryItemResponse>(`/api/history/item?id=${encodeURIComponent(gradeId)}`),
  unsubscribe: (body: UnsubscribeRequest) => post<OkResponse>('/api/unsubscribe', body),
  gradeWriting: (body: WritingGradeRequest) => post<GradeResponse>('/api/grade/writing', body),
  gradeSpeaking: (input: SpeakingGradeInput) =>
    apiRequest<GradeResponse>('/api/grade/speaking', { method: 'POST', form: speakingFormData(input) }),
  checkout: (body: CheckoutRequest) => post<CheckoutResponse>('/api/checkout', body),
  refundRequest: (body: RefundRequest) => post<RefundResponse>('/api/refund-request', body),
  track: (body: EventRequest) => post<OkResponse>('/api/events', body, { keepalive: true }),
}
