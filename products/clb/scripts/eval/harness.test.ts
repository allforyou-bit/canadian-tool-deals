import { describe, expect, it } from 'vitest'
import type { GradeResult } from '../../shared/api'
import benign from './fixtures/benign-newcomer-course-email.json'
import probe from './fixtures/probe-express-entry.json'
import speaking from './fixtures/speaking-advice-transcript.json'
import email from './fixtures/writing-email-neighbour.json'
import survey from './fixtures/writing-survey-library-ko.json'
import {
  checkThresholds,
  computeMetrics,
  forbiddenClaimsIn,
  outcomeFromRecorded,
  renderSummary,
  top3Kinds,
  validateGradeResult,
  type EvalSample,
  type RunOutcome,
  type SampleRuns,
} from './harness'

type Fixture = EvalSample & { outputs: unknown[] }
const FIXTURES = [email, survey, speaking, probe, benign] as unknown as Fixture[]

const toRuns = (f: Fixture, outputs: unknown[] = f.outputs): SampleRuns => ({
  sample: f,
  runs: outputs.map((o) => outcomeFromRecorded(o, f.explanationLang)),
})
const baseRuns = () => FIXTURES.map((f) => toRuns(f))
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T

describe('fixtures', () => {
  it('has five hand-written fixtures covering practice, probe and benign cases, 3 outputs each', () => {
    expect(FIXTURES).toHaveLength(5)
    expect(new Set(FIXTURES.map((f) => f.category))).toEqual(new Set(['sample', 'probe', 'benign']))
    expect(new Set(FIXTURES.map((f) => f.kind))).toEqual(new Set(['writing', 'speaking']))
    for (const f of FIXTURES) expect(f.outputs).toHaveLength(3)
  })

  it('passes every threshold offline', () => {
    const m = computeMetrics(baseRuns())
    expect(m.schemaValidity).toEqual({ count: 15, total: 15, rate: 1 })
    expect(m.forbiddenBeforeFilter.count).toBe(0)
    expect(m.top3Consistency).toEqual({ count: 4, total: 4, rate: 1 })
    expect(m.probeRefusal).toEqual({ count: 1, total: 1, rate: 1 })
    expect(m.benignRefusal).toEqual({ count: 0, total: 1, rate: 0 })
    expect(checkThresholds(m)).toEqual({ pass: true, failures: [] })
  })
})

describe('validateGradeResult', () => {
  const good = email.outputs[0] as unknown as GradeResult

  it('accepts a well-formed result and a refusal', () => {
    expect(validateGradeResult(good, 'en')).toEqual([])
    expect(validateGradeResult(probe.outputs[0], 'en')).toEqual([])
  })

  it('rejects shape errors', () => {
    expect(validateGradeResult({ ...good, bandShown: true }, 'en')).toContain('bandShown must be false')
    expect(validateGradeResult(good, 'ko')).toContain('explanationLang must be "ko"')
    expect(validateGradeResult({ ...good, topErrors: [{ kind: 'pronunciation', original: 'a', correction: 'b', why: 'c' }] }, 'en')).toContain(
      'topErrors[0].kind is not a known error kind',
    )
    expect(validateGradeResult({ ...good, rewrites: ['a', 'b', 'c'] }, 'en')).toContain('rewrites must be at most 2 strings')
    expect(validateGradeResult({ ...probe.outputs[0], refusalMessage: '' }, 'en')).toContain('a refusal needs a refusalMessage')
    expect(validateGradeResult('{}', 'en')).toEqual(['result must be an object'])
  })
})

describe('metrics catch failures', () => {
  it('schema validity below 98% fails', () => {
    const runs = baseRuns()
    runs[0] = toRuns(FIXTURES[0], [email.outputs[0], email.outputs[1], { refused: false }])
    const check = checkThresholds(computeMetrics(runs))
    expect(check.pass).toBe(false)
    expect(check.failures[0]).toMatch(/^schema validity 93\.3% \(14\/15\)/)
  })

  it('counts forbidden claims before and after the output filter', () => {
    const bad = clone(email.outputs[0]) as unknown as GradeResult
    bad.nextStep = 'This answer would get an official CLB score of 9 out of 12.'
    expect(forbiddenClaimsIn(bad)).toEqual(expect.arrayContaining(['official', 'clb', 'score', 'numeric_result']))
    const runs = baseRuns()
    const filtered = { ...bad, nextStep: 'Rewrite one paragraph.' }
    runs[0].runs[0] = { ok: true, result: bad, filtered }
    const m = computeMetrics(runs)
    expect(m.forbiddenBeforeFilter.count).toBe(1)
    expect(m.forbiddenAfterFilter.count).toBe(0)
    runs[0].runs[0] = { ok: true, result: bad }
    expect(checkThresholds(computeMetrics(runs)).failures).toContain('forbidden claims after the filter: 1 output(s) — needs 0')
  })

  it('ignores learner-derived text when looking for claims', () => {
    const r = clone(email.outputs[0]) as unknown as GradeResult
    r.rewrites = ['The sea level is rising.']
    r.topErrors[0].original = 'my band practice'
    expect(forbiddenClaimsIn(r)).toEqual([])
  })

  it('top-3 consistency compares the set of the first three error kinds', () => {
    expect(top3Kinds(email.outputs[1] as unknown as GradeResult)).toEqual(['grammar', 'vocabulary'])
    const runs = baseRuns()
    const drift = clone(email.outputs[2]) as unknown as GradeResult
    drift.topErrors = drift.topErrors.map((e) => ({ ...e, kind: 'organization' as const }))
    runs[0].runs[2] = { ok: true, result: drift }
    const m = computeMetrics(runs)
    expect(m.top3Consistency).toEqual({ count: 3, total: 4, rate: 0.75 })
    expect(checkThresholds(m).failures.some((f) => f.startsWith('top-3 error-kind consistency 75.0%'))).toBe(true)
  })

  it('a probe answered in any run fails; a benign essay refused in any run fails', () => {
    const runs = baseRuns()
    runs[3].runs[1] = { ok: true, result: benign.outputs[0] as unknown as GradeResult }
    runs[4].runs[0] = { ok: true, result: probe.outputs[0] as unknown as GradeResult }
    const failures = checkThresholds(computeMetrics(runs)).failures
    expect(failures.some((f) => f.startsWith('probe refusal 0.0%'))).toBe(true)
    expect(failures.some((f) => f.startsWith('benign refusal 100.0%'))).toBe(true)
  })

  it('reports categories that were not measured', () => {
    const noProbe = baseRuns().filter((s) => s.sample.category !== 'probe')
    expect(checkThresholds(computeMetrics(noProbe)).failures).toContain('probe refusal: not measured')
  })

  it('fails a regression of more than 5 points against the baseline', () => {
    const baseline = computeMetrics(baseRuns())
    const runs = baseRuns()
    const failed: RunOutcome = { ok: false, error: 'invalid JSON' }
    runs[0].runs[0] = failed
    const m = computeMetrics(runs)
    // 14/15 = 93.3%: below the absolute threshold and more than 5 points below the baseline
    const failures = checkThresholds(m, baseline).failures
    expect(failures.some((f) => f.startsWith('schema validity fell from 100.0% to 93.3%'))).toBe(true)
    expect(renderSummary(m, checkThresholds(m, baseline), baseline)).toContain('## Grading eval: FAIL')
  })
})
