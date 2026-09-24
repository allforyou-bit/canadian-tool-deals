// D1 writes for grading: one `grades` row per model call (cost accounting and the history log),
// and giving back a free sample when a call produced no feedback.
import type { Env } from '../env'
import type { FreeKeys } from '../lib/usage'
import { dayKey } from '../lib/time'

export interface GradeRow {
  id: string
  userId: string | null
  deviceHash: string
  taskId: string
  promptIndex: number
  kind: 'writing' | 'speaking'
  /** essay or transcript; null for anonymous samples */
  inputText: string | null
  /** GradeResult JSON; null for anonymous samples and failed calls */
  resultJson: string | null
  errorKinds: string | null
  free: boolean
  /** true for every row that produced no feedback (scope or safety refusal, failed call, no speech) */
  refused: boolean
  model: string
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  audioSeconds: number
  costMicroUsd: number
  createdAt: string
}

export async function insertGrade(env: Env, r: GradeRow): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO grades (id, user_id, device_hash, task_id, prompt_index, kind, input_text, result_json, error_kinds,
                         free, refused, model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens,
                         audio_seconds, cost_micro_usd, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19)`,
  )
    .bind(
      r.id,
      r.userId,
      r.deviceHash,
      r.taskId,
      r.promptIndex,
      r.kind,
      r.inputText,
      r.resultJson,
      r.errorKinds,
      r.free ? 1 : 0,
      r.refused ? 1 : 0,
      r.model,
      r.inputTokens,
      r.outputTokens,
      r.cacheReadTokens,
      r.cacheWriteTokens,
      r.audioSeconds,
      r.costMicroUsd,
      r.createdAt,
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
