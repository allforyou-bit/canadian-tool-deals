'use client'

import type { Lang } from '../shared/api'
import { t } from '../lib/i18n'
import { setUiLang } from '../lib/lang'

const OPTIONS: { lang: Lang; label: string }[] = [
  { lang: 'en', label: 'English' },
  { lang: 'ko', label: '한국어' },
]

/** English / 한국어 switch for the account-area pages (remembered per browser). */
export function LangToggle(props: { lang: Lang }) {
  return (
    <div role="group" aria-label={t(props.lang, 'common.language')} className="inline-flex rounded-md border border-slate-300 bg-white p-0.5">
      {OPTIONS.map((o) => (
        <button
          key={o.lang}
          type="button"
          lang={o.lang}
          aria-pressed={props.lang === o.lang}
          onClick={() => setUiLang(o.lang)}
          className={`min-h-9 rounded px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-red-700 ${
            props.lang === o.lang ? 'bg-slate-900 text-white' : 'text-slate-800 hover:bg-slate-100'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
