'use client'

// Controls shared by the writing and speaking pages: explanation language and prompt picker.
import { useId } from 'react'
import type { Lang } from '../shared/api'
import type { Bi } from '../shared/tasks'
import { t } from '../lib/i18n'
import { isLang, setUiLang } from '../lib/lang'
import { cls } from './ui'

/** English / 한국어 select; the choice is remembered and also switches these controls' language. */
export function ExplanationLangSelect(props: { lang: Lang; disabled?: boolean }) {
  const id = useId()
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label htmlFor={id} className={cls.label}>
        {t(props.lang, 'p.explanationLang')}
        {props.lang === 'en' && (
          <span lang="ko" className="ml-1 font-normal text-slate-600">
            (설명 언어)
          </span>
        )}
      </label>
      <select
        id={id}
        value={props.lang}
        disabled={props.disabled}
        onChange={(e) => {
          if (isLang(e.target.value)) setUiLang(e.target.value)
        }}
        className="min-h-11 rounded-md border border-slate-400 bg-white px-3 py-2 text-base"
      >
        <option value="en">English</option>
        <option value="ko" lang="ko">
          한국어
        </option>
      </select>
    </div>
  )
}

/** Radio list of the task's prompts: English text with the Korean help below it. */
export function PromptPicker(props: {
  prompts: Bi[]
  value: number
  onChange: (index: number) => void
  lang: Lang
  disabled?: boolean
}) {
  const name = useId()
  return (
    <fieldset disabled={props.disabled} className="space-y-3">
      <legend className={`${cls.label} mb-2`}>{t(props.lang, 'p.prompt')}</legend>
      {props.prompts.map((p, i) => {
        const id = `${name}-${i}`
        const selected = props.value === i
        return (
          <div
            key={id}
            className={`flex gap-3 rounded-md border p-3 ${selected ? 'border-red-700 bg-red-50/40' : 'border-slate-200 bg-white'}`}
          >
            <input
              id={id}
              type="radio"
              name={name}
              className={cls.checkbox}
              checked={selected}
              onChange={() => props.onChange(i)}
            />
            <label htmlFor={id} className="block">
              <span className="sr-only">{t(props.lang, 'p.promptN', { n: i + 1 })}: </span>
              <span className="text-base text-slate-950">{p.en}</span>
              <span lang="ko" className="mt-1 block text-sm text-slate-600">
                {p.ko}
              </span>
            </label>
          </div>
        )
      })}
    </fieldset>
  )
}
