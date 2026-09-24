// STUB — replaced by the auth fixer (memo §7.2 Z3: Google sign-in, OpenID Connect code flow with PKCE).
import type { Ctx } from './env'
import { error } from './lib/http'

export async function start(_req: Request, _ctx: Ctx): Promise<Response> {
  return error('not_found', 'Not implemented')
}

export async function callback(_req: Request, _ctx: Ctx): Promise<Response> {
  return error('not_found', 'Not implemented')
}
