// The five legal pages, in footer order.
import type { LegalPage } from '../types'
import { AI_DISCLOSURE_PAGE } from './ai-disclosure'
import { NOT_AFFILIATED_PAGE } from './not-affiliated'
import { PRIVACY } from './privacy'
import { REFUNDS } from './refunds'
import { TERMS } from './terms'

export { AI_DISCLOSURE_PAGE, NOT_AFFILIATED_PAGE, PRIVACY, REFUNDS, TERMS }

export const LEGAL_PAGES: LegalPage[] = [PRIVACY, TERMS, REFUNDS, AI_DISCLOSURE_PAGE, NOT_AFFILIATED_PAGE]
