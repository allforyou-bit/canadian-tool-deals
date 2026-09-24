import { describe, expect, it } from 'vitest'
import { taskById } from '../../shared/tasks'
import { batchSafeParams } from './batch'
import { buildRequests, customId } from './run-live'
import { buildPlan, selectSubset, SYNTHETIC_COUNTS } from './synthetic-plan'

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

  it('keeps every probe and benign item in a cost-limited subset', () => {
    const subset = selectSubset(plan, 10)
    expect(subset.filter((p) => p.category === 'sample' && p.kind === 'writing')).toHaveLength(5)
    expect(subset.filter((p) => p.category === 'sample' && p.kind === 'speaking')).toHaveLength(5)
    expect(subset.filter((p) => p.category === 'probe')).toHaveLength(10)
    expect(subset.filter((p) => p.category === 'benign')).toHaveLength(20)
    expect(selectSubset(plan, 0)).toHaveLength(plan.length)
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
