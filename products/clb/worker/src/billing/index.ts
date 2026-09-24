// STUB — replaced by the owning build agent (see products/clb/CONTRACT.md).
import type { Ctx } from '../env'
import { error } from '../lib/http'

export const checkout = (_req: Request, _ctx: Ctx): Promise<Response> => Promise.resolve(error('internal', 'not implemented'))
export const webhook = (_req: Request, _ctx: Ctx): Promise<Response> => Promise.resolve(error('internal', 'not implemented'))
export const refundRequest = (_req: Request, _ctx: Ctx): Promise<Response> => Promise.resolve(error('internal', 'not implemented'))
