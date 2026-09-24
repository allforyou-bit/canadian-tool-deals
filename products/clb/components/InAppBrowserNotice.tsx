'use client'

import { useId, useState } from 'react'
import type { Lang } from '../shared/api'
import { t } from '../lib/i18n'
import { externalPageUrl, openExternalHref, type InAppBrowser } from '../lib/in-app-browser'
import { cls, tone } from './ui'

/** Copy with the Clipboard API, or the older execCommand path that some in-app browsers still need. */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // no Clipboard API, or not allowed here
  }
  try {
    const el = document.createElement('textarea')
    el.value = text
    el.setAttribute('readonly', '')
    el.style.position = 'fixed'
    el.style.opacity = '0'
    document.body.appendChild(el)
    el.select()
    const ok = document.execCommand('copy')
    el.remove()
    return ok
  } catch {
    return false
  }
}

/**
 * Shown on the sign-in page inside an in-app browser (KakaoTalk, Naver, Facebook …), where Google refuses
 * sign-in: why, in the page language and the other one (the launch posts are Korean, the page may not be yet), a
 * link that opens the page in the phone's browser where the app offers one, and the page's link to copy.
 */
export function InAppBrowserNotice(props: { kind: InAppBrowser; lang: Lang; userAgent: string; onTryAnyway: () => void }) {
  const { kind, lang, userAgent } = props
  const other: Lang = lang === 'ko' ? 'en' : 'ko'
  const id = useId()
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle')
  const url = externalPageUrl(window.location.href, lang)
  const openHref = openExternalHref(kind, url, userAgent)

  return (
    <section className={`${tone.warn} space-y-3`} aria-labelledby={`${id}-title`} data-testid="in-app-browser" data-kind={kind}>
      <h2 id={`${id}-title`} className="text-base font-semibold">
        {t(lang, 'l.inApp.title')}
      </h2>
      <p>{t(lang, 'l.inApp.body')}</p>
      <div lang={other} className="border-l-2 border-amber-300 pl-3 text-amber-900">
        <p className="font-semibold">{t(other, 'l.inApp.title')}</p>
        <p>{t(other, 'l.inApp.body')}</p>
      </div>

      {openHref && (
        <p>
          <a href={openHref} className={`${cls.btn} ${cls.primary}`} data-testid="in-app-open">
            {t(lang, 'l.inApp.open')}
          </a>
        </p>
      )}
      {!openHref && <p>{t(lang, 'l.inApp.menuHint')}</p>}

      <p>{t(lang, 'l.inApp.copyHint')}</p>
      <div className="space-y-1">
        <label htmlFor={`${id}-link`} className={cls.label}>
          {t(lang, 'l.inApp.linkLabel')}
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            id={`${id}-link`}
            type="text"
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className={`${cls.input} min-w-0 flex-1 text-sm`}
          />
          <button
            type="button"
            className={`${cls.btn} ${cls.secondary}`}
            onClick={() => {
              void copyText(url).then((ok) => setCopy(ok ? 'copied' : 'failed'))
            }}
          >
            {t(lang, 'l.inApp.copy')}
          </button>
        </div>
      </div>
      <p aria-live="polite" data-testid="in-app-copy-status">
        {copy === 'copied' ? t(lang, 'l.inApp.copied') : copy === 'failed' ? t(lang, 'l.inApp.copyFailed') : ''}
      </p>

      <p>{t(lang, 'l.inApp.practice')}</p>
      <p>
        <button type="button" className={cls.link} onClick={props.onTryAnyway}>
          {t(lang, 'l.inApp.anyway')}
        </button>
      </p>
    </section>
  )
}
