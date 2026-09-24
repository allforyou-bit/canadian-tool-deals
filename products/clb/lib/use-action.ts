// Small state helper for one-shot account actions (pending → done | error).
import { useCallback, useState } from 'react'
import { ApiClientError } from './api'

export interface Action<T> {
  pending: boolean
  error: ApiClientError | null
  done: T | null
  run: (fn: () => Promise<T>) => Promise<T | null>
  reset: () => void
}

export function useAction<T>(): Action<T> {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<ApiClientError | null>(null)
  const [done, setDone] = useState<T | null>(null)

  const run = useCallback(async (fn: () => Promise<T>) => {
    setPending(true)
    setError(null)
    try {
      const value = await fn()
      setDone(value)
      return value
    } catch (e) {
      setError(e instanceof ApiClientError ? e : new ApiClientError('internal', 0, 'Network error'))
      return null
    } finally {
      setPending(false)
    }
  }, [])

  const reset = useCallback(() => {
    setError(null)
    setDone(null)
  }, [])

  return { pending, error, done, run, reset }
}
