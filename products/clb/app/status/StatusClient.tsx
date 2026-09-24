'use client'

import { useCallback, useEffect, useState } from 'react'
import { cls } from '../../components/ui'
import { api } from '../../lib/api'
import { useMe, useUiLang } from '../../lib/hooks'
import { t } from '../../lib/i18n'
import { refreshMe } from '../../lib/me'
import type { HealthResponse } from '../../shared/api'

type Health = { kind: 'loading' } | { kind: 'ok'; data: HealthResponse } | { kind: 'down' }

function Row(props: { label: string; value: string; good: boolean | null; testId?: string }) {
  const dot = props.good === null ? 'bg-slate-400' : props.good ? 'bg-emerald-600' : 'bg-amber-500'
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <dt className="text-slate-800">{props.label}</dt>
      <dd className="flex items-center gap-2 font-semibold text-slate-950" data-testid={props.testId}>
        <span aria-hidden="true" className={`inline-block size-2.5 rounded-full ${dot}`} />
        {props.value}
      </dd>
    </div>
  )
}

/** /api/health plus the kill-switch flags and banner from /api/me. */
export function StatusClient() {
  const lang = useUiLang()
  const meState = useMe()
  const [health, setHealth] = useState<Health>({ kind: 'loading' })
  const [checkedAt, setCheckedAt] = useState<Date | null>(null)

  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    api.health().then(
      (data) => {
        if (cancelled) return
        setHealth({ kind: 'ok', data })
        setCheckedAt(new Date())
      },
      () => {
        if (cancelled) return
        setHealth({ kind: 'down' })
        setCheckedAt(new Date())
      },
    )
    return () => {
      cancelled = true
    }
  }, [attempt])

  const retry = useCallback(() => {
    setHealth({ kind: 'loading' })
    setAttempt((n) => n + 1)
    void refreshMe({ force: true })
  }, [])

  const loading = t(lang, 'common.loading')
  const flags = meState.status === 'ready' ? meState.me.flags : null
  // /api/me failed: the flags are unknown, so say so instead of "Loading…" forever
  const meDown = meState.status === 'error'
  const flagRow = (on: boolean | undefined) =>
    flags && on !== undefined
      ? { good: on, value: t(lang, on ? 'st.on' : 'st.off') }
      : meDown
        ? { good: false, value: t(lang, 'st.down') }
        : { good: null, value: loading }
  const grading = flagRow(flags?.gradingEnabled)
  const checkout = flagRow(flags?.checkoutEnabled)

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className={cls.h1}>{t(lang, 'st.title')}</h1>
      <dl className={`${cls.card} divide-y divide-slate-200 py-0 sm:py-0`}>
        <Row
          label={t(lang, 'st.api')}
          testId="status-api"
          good={health.kind === 'loading' ? null : health.kind === 'ok'}
          value={
            health.kind === 'loading'
              ? loading
              : health.kind === 'ok'
                ? `${t(lang, 'st.ok')} · ${t(lang, 'st.version', { v: health.data.version })}`
                : t(lang, 'st.down')
          }
        />
        <Row label={t(lang, 'st.grading')} testId="status-grading" good={grading.good} value={grading.value} />
        <Row label={t(lang, 'st.checkout')} testId="status-checkout" good={checkout.good} value={checkout.value} />
      </dl>
      {(meDown || health.kind === 'down') && (
        <button type="button" className={`${cls.btn} ${cls.secondary}`} onClick={retry}>
          {t(lang, 'common.tryAgain')}
        </button>
      )}
      {flags?.banner.trim() && (
        <section aria-labelledby="status-notice" className="rounded-md border border-amber-300 bg-amber-50 p-4">
          <h2 id="status-notice" className="font-semibold text-amber-950">
            {t(lang, 'st.notice')}
          </h2>
          <p className="mt-1 text-amber-950">{flags.banner}</p>
        </section>
      )}
      {checkedAt && (
        <p className={cls.muted}>{t(lang, 'st.checked', { time: checkedAt.toLocaleTimeString(lang === 'ko' ? 'ko-KR' : 'en-CA') })}</p>
      )}
    </div>
  )
}
