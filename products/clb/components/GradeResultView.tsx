'use client'

import Link from 'next/link'
import type { Ref } from 'react'
import type { GradeResponse, Lang } from '../shared/api'
import { errorKindLabel, t } from '../lib/i18n'
import { Notice } from './Notice'
import { cls } from './ui'

/**
 * Feedback for one graded task. Labels follow the explanation language; the "not a score"
 * sentence (an exact ALLOWED_PHRASES entry) is always shown in English, and in Korean too when
 * the explanations are Korean. `ref` goes to the heading so focus can move here after grading.
 */
export function GradeResultView(props: {
  response: GradeResponse
  kind: 'writing' | 'speaking'
  onAgain?: () => void
  ref?: Ref<HTMLHeadingElement>
}) {
  const { response, kind, onAgain, ref } = props
  const { result } = response
  const lang: Lang = result.explanationLang === 'ko' ? 'ko' : 'en'
  const pricingHref = lang === 'ko' ? '/ko/pricing/' : '/pricing/'

  return (
    <section aria-labelledby="grade-result-title" className={`${cls.card} space-y-6`} lang={lang} data-testid="grade-result">
      <div className="space-y-2">
        <h2 id="grade-result-title" ref={ref} tabIndex={-1} className={`${cls.h2} focus:outline-none`}>
          {t(lang, 'r.title')}
        </h2>
        <p className="text-sm font-medium text-slate-700" lang="en">
          {t('en', 'r.disclaimer')}
        </p>
        {lang === 'ko' && <p className="text-sm text-slate-700">{t('ko', 'r.disclaimer')}</p>}
      </div>

      {result.transcript !== undefined && (
        <div>
          <h3 className="text-base font-semibold text-slate-900">{t(lang, 'r.transcript')}</h3>
          <blockquote
            lang="en"
            className="mt-2 whitespace-pre-wrap rounded-md border-l-4 border-slate-300 bg-slate-50 p-3 text-slate-800"
          >
            {result.transcript}
          </blockquote>
        </div>
      )}

      {result.refused ? (
        <Notice kind="warn">
          <p>{result.refusalMessage || t(lang, 'r.refused')}</p>
        </Notice>
      ) : (
        <>
          {result.criteria.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              {result.criteria.map((c, i) => (
                <article key={`${c.name}-${i}`} className="rounded-md border border-slate-200 p-4">
                  <h3 className="font-semibold text-slate-950">{c.name}</h3>
                  <p className="mt-2 text-sm">
                    <span className="font-semibold text-emerald-800">{t(lang, 'r.strengths')}: </span>
                    {c.strengths}
                  </p>
                  <p className="mt-2 text-sm">
                    <span className="font-semibold text-amber-800">{t(lang, 'r.improve')}: </span>
                    {c.improve}
                  </p>
                </article>
              ))}
            </div>
          )}

          {result.topErrors.length > 0 && (
            <div>
              <h3 className="text-base font-semibold text-slate-900">{t(lang, 'r.topErrors')}</h3>
              <ol className="mt-2 space-y-3">
                {result.topErrors.map((e, i) => (
                  <li key={i} className="rounded-md border border-slate-200 p-3 text-sm">
                    <span className="inline-block rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                      {errorKindLabel(lang, e.kind)}
                    </span>
                    <p className="mt-2">
                      <span className="font-semibold">{t(lang, kind === 'speaking' ? 'r.originalSpoken' : 'r.original')}: </span>
                      <del lang="en" className="text-red-900">
                        {e.original}
                      </del>
                    </p>
                    <p className="mt-1">
                      <span className="font-semibold">{t(lang, 'r.correction')}: </span>
                      <ins lang="en" className="text-emerald-900 no-underline">
                        {e.correction}
                      </ins>
                    </p>
                    <p className="mt-1 text-slate-700">
                      <span className="font-semibold">{t(lang, 'r.why')}: </span>
                      {e.why}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {result.rewrites.length > 0 && (
            <div>
              <h3 className="text-base font-semibold text-slate-900">{t(lang, 'r.rewrites')}</h3>
              <ul className="mt-2 space-y-2">
                {result.rewrites.map((r, i) => (
                  <li key={i}>
                    <blockquote lang="en" className="whitespace-pre-wrap rounded-md bg-emerald-50 p-3 text-sm text-emerald-950">
                      {r}
                    </blockquote>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.nextStep && (
            <div>
              <h3 className="text-base font-semibold text-slate-900">{t(lang, 'r.nextStep')}</h3>
              <p className="mt-1 text-slate-800">{result.nextStep}</p>
            </div>
          )}

          {typeof result.wordCount === 'number' && kind === 'writing' && (
            <p className={cls.muted}>{t(lang, 'r.wordCount', { n: result.wordCount })}</p>
          )}
        </>
      )}

      {response.free && (
        <Notice kind="info">
          <p>{t(lang, 'r.freeDone')}</p>
          <p className="mt-2">
            <Link href={pricingHref} className={cls.link}>
              {t(lang, 'common.seePricing')}
            </Link>
          </p>
        </Notice>
      )}

      {onAgain && (
        <button type="button" className={`${cls.btn} ${cls.secondary}`} onClick={onAgain}>
          {t(lang, 'r.again')}
        </button>
      )}
    </section>
  )
}
