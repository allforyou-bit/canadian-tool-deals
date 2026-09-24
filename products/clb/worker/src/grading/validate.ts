// Hand-written validator for the grader's JSON (shape: prompt.ts GRADE_JSON_SCHEMA). Types and
// enums are strict (throws); counts are normalised (extra items are cut) so one surplus error or
// rewrite does not cost the learner a whole grade.
import { ERROR_KINDS, type CriterionFeedback, type ErrorItem, type ErrorKind, type GradeResult, type Lang } from '../../../shared/api'

export const MAX_CRITERIA = 8
export const MAX_TOP_ERRORS = 5
export const MAX_REWRITES = 2

export class GradeValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GradeValidationError'
  }
}

type Obj = Record<string, unknown>

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function str(o: Obj, key: string, path: string): string {
  const v = o[key]
  if (typeof v !== 'string') throw new GradeValidationError(`${path}.${key} must be a string`)
  return v.trim()
}

function arr(o: Obj, key: string): unknown[] {
  const v = o[key]
  if (!Array.isArray(v)) throw new GradeValidationError(`${key} must be an array`)
  return v
}

function isErrorKind(v: unknown): v is ErrorKind {
  return typeof v === 'string' && (ERROR_KINDS as readonly string[]).includes(v)
}

function criterion(v: unknown, i: number): CriterionFeedback {
  if (!isObj(v)) throw new GradeValidationError(`criteria[${i}] must be an object`)
  const p = `criteria[${i}]`
  return { name: str(v, 'name', p), strengths: str(v, 'strengths', p), improve: str(v, 'improve', p) }
}

function errorItem(v: unknown, i: number): ErrorItem {
  if (!isObj(v)) throw new GradeValidationError(`topErrors[${i}] must be an object`)
  if (!isErrorKind(v.kind)) throw new GradeValidationError(`topErrors[${i}].kind is not a known error kind`)
  const p = `topErrors[${i}]`
  return { kind: v.kind, original: str(v, 'original', p), correction: str(v, 'correction', p), why: str(v, 'why', p) }
}

/** Validate parsed grader JSON and add the server-set fields. Throws GradeValidationError. */
export function validateGradeJson(value: unknown, explanationLang: Lang): GradeResult {
  if (!isObj(value)) throw new GradeValidationError('output must be a JSON object')
  if (typeof value.refused !== 'boolean') throw new GradeValidationError('refused must be a boolean')
  const refusalMessage = value.refusalMessage === undefined ? '' : str(value, 'refusalMessage', 'root')
  const criteria = arr(value, 'criteria').map(criterion)
  const topErrors = arr(value, 'topErrors')
    .map(errorItem)
    .filter((e) => e.original !== '' && e.correction !== '')
  const rewrites = arr(value, 'rewrites').map((r, i) => {
    if (typeof r !== 'string') throw new GradeValidationError(`rewrites[${i}] must be a string`)
    return r.trim()
  })
  const nextStep = str(value, 'nextStep', 'root')

  if (value.refused) {
    return {
      refused: true,
      refusalMessage,
      criteria: [],
      topErrors: [],
      rewrites: [],
      nextStep: '',
      explanationLang,
      bandShown: false,
    }
  }
  if (criteria.length === 0) throw new GradeValidationError('criteria must not be empty for a graded response')
  return {
    refused: false,
    criteria: criteria.slice(0, MAX_CRITERIA),
    topErrors: topErrors.slice(0, MAX_TOP_ERRORS),
    rewrites: rewrites.filter((r) => r !== '').slice(0, MAX_REWRITES),
    nextStep,
    explanationLang,
    bandShown: false,
  }
}
