import { FLAG_DEFAULTS, type FlagName } from '../../../shared/config'
import type { Env } from '../env'

export type Flags = { -readonly [K in FlagName]: (typeof FLAG_DEFAULTS)[K] extends boolean ? boolean : string }

/** Kill switches (memo B10). Missing keys fall back to FLAG_DEFAULTS. */
export async function getFlags(env: Env): Promise<Flags> {
  const flags = { ...FLAG_DEFAULTS } as Flags
  const names = Object.keys(FLAG_DEFAULTS) as FlagName[]
  const values = await Promise.all(names.map((n) => env.FLAGS.get(`flag:${n}`)))
  names.forEach((n, i) => {
    const v = values[i]
    if (v === null) return
    if (typeof FLAG_DEFAULTS[n] === 'boolean') (flags as Record<string, unknown>)[n] = v === 'true'
    else (flags as Record<string, unknown>)[n] = v
  })
  // band stays off in this window regardless of KV (memo §1.1)
  flags.band_enabled = false
  return flags
}

export async function setFlag(env: Env, name: FlagName, value: boolean | string): Promise<void> {
  await env.FLAGS.put(`flag:${name}`, String(value))
}
