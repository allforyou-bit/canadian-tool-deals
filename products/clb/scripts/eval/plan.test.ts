import { describe, expect, it } from 'vitest'
import { taskById } from '../../shared/tasks'
import { batchSafeParams } from './batch'
import { buildRequests, customId } from './run-live'
import { buildPlan, selectSubset, subsetCounts, SYNTHETIC_COUNTS } from './synthetic-plan'

describe('synthetic plan (memo B12, B3)', () => {
  const plan = buildPlan()

  it('plans 60 writing + 60 speaking samples, 10 probes and 20 benign themed answers', () => {
    const count = (f: (p: (typeof plan)[number]) => boolean) => plan.filter(f).length
    expect(count((p) => p.category === 'sample' && p.kind === 'writing')).toBe(SYNTHETIC_COUNTS.writing)
    expect(count((p) => p.category === 'sample' && p.kind === 'speaking')).toBe(SYNTHETIC_COUNTS.speaking)
    expect(count((p) => p.category === 'probe')).toBe(10)
    expect(count((p) => p.category === 'benign')).toBe(20)
  })

  it('uses unique ids and real task prompts, and covers every task type', () => {
    expect(new Set(plan.map((p) => p.id)).size).toBe(plan.length)
    for (const p of plan) expect(taskById(p.taskId)?.prompts[p.promptIndex]).toBeDefined()
    expect(new Set(plan.map((p) => p.taskId)).size).toBe(10)
    expect(plan.some((p) => p.explanationLang === 'ko')).toBe(true)
  })

  it('is deterministic', () => {
    expect(buildPlan()).toEqual(plan)
  })

  it('shrinks probes and benign items with small limits, and keeps B3\'s full set from limit 40 (Z6)', () => {
    const count = (xs: typeof plan, f: (p: (typeof plan)[number]) => boolean) => xs.filter(f).length
    const kinds = (n: number) => {
      const s = selectSubset(plan, n)
      return {
        writing: count(s, (p) => p.category === 'sample' && p.kind === 'writing'),
        speaking: count(s, (p) => p.category === 'sample' && p.kind === 'speaking'),
        probe: count(s, (p) => p.category === 'probe'),
        benign: count(s, (p) => p.category === 'benign'),
      }
    }
    // the default manual and pull-request limit: 11 items
    expect(kinds(5)).toEqual({ writing: 3, speaking: 2, probe: 3, benign: 3 })
    expect(subsetCounts(5)).toEqual(kinds(5))
    expect(kinds(10)).toEqual({ writing: 5, speaking: 5, probe: 5, benign: 5 })
    expect(kinds(20)).toEqual({ writing: 10, speaking: 10, probe: 10, benign: 10 })
    expect(kinds(40)).toEqual({ writing: 20, speaking: 20, probe: 10, benign: 20 })
    expect(kinds(1)).toEqual({ writing: 1, speaking: 0, probe: 1, benign: 1 })
    expect(selectSubset(plan, 0)).toHaveLength(plan.length)
    expect(selectSubset(plan, -3)).toHaveLength(plan.length)
  })

  it('keeps a smaller limit a prefix subset of every larger one (baselines, --subset-metrics)', () => {
    for (const [small, large] of [[1, 2], [5, 10], [5, 20], [20, 40], [7, 0]]) {
      const big = new Set(selectSubset(plan, large).map((p) => p.id))
      for (const p of selectSubset(plan, small)) expect(big.has(p.id)).toBe(true)
      // taking the small subset of the large one gives the small subset of the plan
      expect(selectSubset(selectSubset(plan, large), small).map((p) => p.id)).toEqual(selectSubset(plan, small).map((p) => p.id))
    }
  })

  it('checks Korean explanations and both task kinds even in the smallest default run', () => {
    const s = selectSubset(plan, 5)
    expect(s.filter((p) => p.category === 'sample' && p.explanationLang === 'ko').length).toBeGreaterThanOrEqual(2)
    expect(s.some((p) => p.category === 'probe' && p.explanationLang === 'ko')).toBe(true)
    expect(s.some((p) => p.category === 'benign' && p.explanationLang === 'ko')).toBe(true)
    expect(new Set(s.filter((p) => p.category === 'probe').map((p) => p.kind))).toEqual(new Set(['writing', 'speaking']))
    // still one explanation in four in Korean within each kind of item
    const ko = (f: (p: (typeof plan)[number]) => boolean) => plan.filter((p) => f(p) && p.explanationLang === 'ko').length
    expect(ko((p) => p.category === 'sample' && p.kind === 'writing')).toBe(15)
    expect(ko((p) => p.category === 'sample' && p.kind === 'speaking')).toBe(15)
    expect(ko((p) => p.category === 'probe')).toBe(3)
    expect(ko((p) => p.category === 'benign')).toBe(5)
  })
})

describe('batch requests', () => {
  const samples = buildPlan()
    .slice(0, 2)
    .map((p) => ({ ...p, text: 'Synthetic practice answer.' }))

  it('grades each sample 3 times with batch-safe grader params', () => {
    const requests = buildRequests(samples, 3, 'claude-opus-5')
    expect(requests.map((r) => r.custom_id)).toEqual([customId(samples[0].id, 1), customId(samples[0].id, 2), customId(samples[0].id, 3), customId(samples[1].id, 1), customId(samples[1].id, 2), customId(samples[1].id, 3)])
    for (const r of requests) {
      expect(r.custom_id).toMatch(/^[A-Za-z0-9_-]{1,64}$/)
      expect(r.params).not.toHaveProperty('fallbacks')
      expect(r.params).not.toHaveProperty('betas')
      expect(r.params.model).toBe('claude-opus-5')
    }
  })

  it('strips fallbacks, beta headers and streaming from any params', () => {
    expect(batchSafeParams({ model: 'm', max_tokens: 1, messages: [], betas: ['x'], fallbacks: 'default', stream: false })).toEqual({ model: 'm', max_tokens: 1, messages: [] })
  })
})
