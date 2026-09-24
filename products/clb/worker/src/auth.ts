// STUB — replaced by the owning build agent (see products/clb/CONTRACT.md).
import type { Ctx } from './env'
import { error } from './lib/http'

export const requestMagicLink = (_req: Request, _ctx: Ctx): Promise<Response> => Promise.resolve(error('internal', 'not implemented'))
export const verify = (_req: Request, _ctx: Ctx): Promise<Response> => Promise.resolve(error('internal', 'not implemented'))
export const logout = (_req: Request, _ctx: Ctx): Promise<Response> => Promise.resolve(error('internal', 'not implemented'))
