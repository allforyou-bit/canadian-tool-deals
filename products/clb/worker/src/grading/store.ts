// D1 writes for grading: finishing the pending `grades` row reserved before the model call
// (lib/usage.ts reserveGrade; one row per request, for cost accounting and the history log), and
// giving back a free sample when a call produced no feedback.
import type { Env } from '../env'
import type { FreeKeys } from '../lib/usage'
import { dayKey } from '../lib/time'

/** grades.outcome (worker/migrations/0001_init.sql); every outcome except 'graded' is refused = 1. */
export type GradeOutcome = 'graded' | 'scope_refused' | 'safety_refused' | 'failed' | 'no_speech' | 'too_long'

export interface GradeFinish {
  outcome: GradeOutcome
  /** false when the free sample was given back and no tokens were spent on it */
  free: boolean
  model: string
  /** essay or transcript; null for anonymous samples and every outcome but 'graded' */
  inputText: string | null
  /** GradeResult JSON; same rule as inputText */
  resultJson: string | null
  errorKinds: string | null
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  audioSeconds: number
  costMicroUsd: number
}

/**
 * Close a reserved row: pending = 0 with its outcome, tokens and cost. Text is written only while the
 * row still has a user, so an account deleted mid-call (rows de-identified, decision 5) never gets
 * the essay back.
 */
export async function finishGrade(env: Env, id: string, f: GradeFinish): Promise<void> {
  await env.DB.prepare(
    `UPDATE grades SET pending = 0, outcome = ?2, refused = ?3, free = ?4, model = ?5,
            input_text = CASE WHEN user_id IS NULL THEN NULL ELSE ?6 END,
            result_json = CASE WHEN user_id IS NULL THEN NULL ELSE ?7 END,
            error_kinds = ?8, input_tokens = ?9, output_tokens = ?10, cache_read_tokens = ?11,
            cache_write_tokens = ?12, audio_seconds = ?13, cost_micro_usd = ?14
      WHERE id = ?1`,
  )
    .bind(
      id,
      f.outcome,
      f.outcome === 'graded' ? 0 : 1,
      f.free ? 1 : 0,
      f.model,
      f.inputText,
      f.resultJson,
      f.errorKinds,
      f.inputTokens,
      f.outputTokens,
      f.cacheReadTokens,
      f.cacheWriteTokens,
      f.audioSeconds,
      f.costMicroUsd,
    )
    .run()
}

/** Undo recordFreeWriting (lib/usage.ts) when the call produced no feedback. */
export async function releaseFreeWriting(env: Env, keys: FreeKeys, now: Date): Promise<void> {
  const day = dayKey(now)
  const dec = 'UPDATE free_usage SET count = count - 1 WHERE key_hash = ?1 AND kind = ?2 AND day = ?3 AND count > 0'
  await env.DB.batch([
    env.DB.prepare(dec).bind(keys.deviceHash, 'device', day),
    env.DB.prepare(dec).bind(keys.ipHash, 'ip', day),
  ])
}

/** Undo recordFreeSpeaking (lib/usage.ts) when no feedback could be produced. */
export async function releaseFreeSpeaking(env: Env, userId: string): Promise<void> {
  await env.DB.prepare('UPDATE users SET free_speaking_used = 0 WHERE id = ?1').bind(userId).run()
}
