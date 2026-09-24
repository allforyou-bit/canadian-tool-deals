'use client'

import Link from 'next/link'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { Notice } from '../../components/Notice'
import { cls } from '../../components/ui'
import { api, ApiClientError } from '../../lib/api'
import { t, type UiKey } from '../../lib/i18n'
import { unsubscribeFromHash } from '../../lib/url'
import type { UnsubscribeRequest } from '../../shared/api'

type State = 'working' | 'done' | 'invalid' | 'network' | 'failed'

/** The same message in English and Korean: the link comes from an email, so we do not know the reader's language. */
function Both(props: { k: UiKey; kind?: 'success' | 'error' | 'info' }) {
  const body = (
    <>
      <p>{t('en', props.k)}</p>
      <p lang="ko" className="mt-2">
        {t('ko', props.k)}
      </p>
    </>
  )
  return props.kind ? <Notice kind={props.kind}>{body}</Notice> : <div role="status">{body}</div>
}

/**
 * CASL unsubscribe (s.11) from the link in every email: /unsubscribe/#h=<email hash>&s=<signature>.
 * No sign-in: the fragment is posted to POST /api/unsubscribe, which checks the signature and turns
 * marketing email off at once. The fragment never reaches servers or logs.
 */
export function UnsubscribeClient() {
  const [state, setState] = useState<State>('working')
  const requestRef = useRef<UnsubscribeRequest | null>(null)
  const startedRef = useRef(false)

  async function send(body: UnsubscribeRequest) {
    setState('working')
    try {
      await api.unsubscribe(body)
      setState('done')
    } catch (err) {
      const e = err instanceof ApiClientError ? err : new ApiClientError('internal', 0, 'Network error')
      // bad_request: the signature does not match (altered or truncated link)
      setState(e.isNetwork ? 'network' : e.code === 'bad_request' ? 'invalid' : 'failed')
    }
  }

  const start = useEffectEvent(() => {
    if (startedRef.current) return
    startedRef.current = true
    const body = unsubscribeFromHash(window.location.hash)
    if (!body) {
      setState('invalid')
      return
    }
    requestRef.current = body
    void send(body)
  })

  useEffect(() => {
    start()
  }, [])

  return (
    <section className={`${cls.card} space-y-4`} aria-labelledby="unsubscribe-title">
      <h1 id="unsubscribe-title" className={cls.h1}>
        {t('en', 'u.title')} <span lang="ko">· {t('ko', 'u.title')}</span>
      </h1>
      {state === 'working' && <Both k="u.working" />}
      {state === 'done' && <Both k="u.done" kind="success" />}
      {state === 'invalid' && <Both k="u.invalid" kind="error" />}
      {(state === 'network' || state === 'failed') && (
        <>
          <Both k={state === 'network' ? 'common.network' : 'common.generic'} kind="error" />
          <button
            type="button"
            className={`${cls.btn} ${cls.primary}`}
            onClick={() => requestRef.current && void send(requestRef.current)}
          >
            {t('en', 'common.tryAgain')} · <span lang="ko">{t('ko', 'common.tryAgain')}</span>
          </button>
        </>
      )}
      {state !== 'working' && (
        <p>
          <Link href="/account/" className={cls.link}>
            {t('en', 'common.goToAccount')}
          </Link>{' '}
          ·{' '}
          <Link href="/account/?lang=ko" className={cls.link} lang="ko">
            {t('ko', 'common.goToAccount')}
          </Link>
        </p>
      )}
    </section>
  )
}
