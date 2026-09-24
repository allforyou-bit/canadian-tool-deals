import Link from 'next/link'
import type { ReactNode } from 'react'
import type { Lang } from '../shared/api'
import type { ApiClientError } from '../lib/api'
import { describeError, type ErrorContext } from '../lib/errors'
import { cls, tone } from './ui'

/** Message box. Errors are announced immediately (role="alert"); other tones politely. */
export function Notice(props: { kind: keyof typeof tone; children: ReactNode; className?: string }) {
  const role = props.kind === 'error' ? 'alert' : 'status'
  return (
    <div role={role} className={`${tone[props.kind]} ${props.className ?? ''}`}>
      {props.children}
    </div>
  )
}

/** An API error rendered with the right wording and next step for where it happened. */
export function ErrorNotice(props: { error: ApiClientError; lang: Lang; context: ErrorContext; returnTo?: string }) {
  const view = describeError(props.error, props.lang, props.context, props.returnTo)
  return (
    <Notice kind="error">
      <p>{view.text}</p>
      {view.actions.length > 0 && (
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {view.actions.map((a) => (
            <Link key={a.href} href={a.href} className={cls.link}>
              {a.label}
            </Link>
          ))}
        </p>
      )}
    </Notice>
  )
}
