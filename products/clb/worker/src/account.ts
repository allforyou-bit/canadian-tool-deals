// STUB — replaced by the owning build agent (see products/clb/CONTRACT.md).
import type { Ctx } from './env'
import { error } from './lib/http'

export const me = (_req: Request, _ctx: Ctx): Promise<Response> => Promise.resolve(error('internal', 'not implemented'))
export const deleteAccount = (_req: Request, _ctx: Ctx): Promise<Response> => Promise.resolve(error('internal', 'not implemented'))
export const setMarketing = (_req: Request, _ctx: Ctx): Promise<Response> => Promise.resolve(error('internal', 'not implemented'))
export const support = (_req: Request, _ctx: Ctx): Promise<Response> => Promise.resolve(error('internal', 'not implemented'))
