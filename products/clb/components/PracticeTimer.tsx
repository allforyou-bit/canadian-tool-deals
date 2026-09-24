'use client'

import { useEffect, useState } from 'react'
import type { Lang } from '../shared/api'
import { formatClock, t } from '../lib/i18n'
import { cls } from './ui'

type TimerState = { running: false; remainingMs: number } | { running: true; endsAt: number }

/** Optional countdown for writing practice. It never blocks submission. */
export function PracticeTimer(props: { seconds: number; lang: Lang }) {
  const { seconds, lang } = props
  const [state, setState] = useState<TimerState>({ running: false, remainingMs: seconds * 1000 })
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!state.running) return
    const id = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(id)
  }, [state.running])

  const remainingMs = state.running ? Math.max(0, state.endsAt - now) : state.remainingMs
  const done = remainingMs <= 0
  const untouched = !state.running && state.remainingMs === seconds * 1000

  useEffect(() => {
    if (state.running && done) setState({ running: false, remainingMs: 0 })
  }, [state.running, done])

  const toggle = () => {
    const at = Date.now()
    setNow(at)
    setState((s) => (s.running ? { running: false, remainingMs: Math.max(0, s.endsAt - at) } : { running: true, endsAt: at + s.remainingMs }))
  }

  return (
    <section aria-label={t(lang, 't.label')} className="flex flex-wrap items-center gap-3 rounded-md border border-slate-200 bg-white p-3">
      <span className="text-sm font-semibold text-slate-800">{t(lang, 't.label')}</span>
      <span role="timer" aria-live="off" className="font-mono text-2xl tabular-nums text-slate-950">
        {formatClock(remainingMs / 1000)}
      </span>
      <div className="flex gap-2">
        {!done && (
          <button type="button" className={`${cls.btn} ${cls.secondary} min-h-9 px-3 py-1 text-sm`} onClick={toggle}>
            {state.running ? t(lang, 't.pause') : untouched ? t(lang, 't.start') : t(lang, 't.resume')}
          </button>
        )}
        <button
          type="button"
          className={`${cls.btn} ${cls.secondary} min-h-9 px-3 py-1 text-sm`}
          onClick={() => setState({ running: false, remainingMs: seconds * 1000 })}
          disabled={untouched}
        >
          {t(lang, 't.reset')}
        </button>
      </div>
      <p role="status" className="w-full text-sm text-slate-700">
        {done ? t(lang, 't.done') : t(lang, 't.note')}
      </p>
    </section>
  )
}
