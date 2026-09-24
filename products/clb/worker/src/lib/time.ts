/** UTC day key, e.g. 2026-10-05. All daily caps and budgets reset at 00:00 UTC. */
export function dayKey(now: Date): string {
  return now.toISOString().slice(0, 10)
}

export function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

export function startOfUtcMonth(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86_400_000)
}
