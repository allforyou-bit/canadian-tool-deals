// Layout for product-documentation and legal pages: title, "Last reviewed/updated" line, intro, an
// on-page contents list for long pages, sections and related links. The site header and footer come from
// app/layout.tsx (frontend-app).
import Link from 'next/link'
import type { ReactNode } from 'react'
import { DOC_LABELS, type DocPage } from '../../content/types'
import { cls } from '../ui'
import { Blocks } from './Blocks'

/** An HTML comment in the exported page (not visible), e.g. the "review before launch" note on legal pages. */
function HtmlComment({ text }: { text: string }) {
  const safe = text.replace(/--/g, '—')
  return <div hidden dangerouslySetInnerHTML={{ __html: `<!-- ${safe} -->` }} />
}

export function LastReviewed({ label, date }: { label: string; date: string }) {
  return (
    <p className={cls.muted}>
      {`${label}: `}
      <time dateTime={date}>{date}</time>
    </p>
  )
}

export function DocArticle(props: { page: DocPage; draftComment?: string; children?: ReactNode }) {
  const { page, draftComment, children } = props
  const showContents = page.sections.length > 5
  return (
    <article lang={page.lang} className="max-w-3xl sm:py-4">
      {draftComment && <HtmlComment text={draftComment} />}
      <header className="space-y-4 border-b border-slate-200 pb-8">
        <h1 className={cls.h1}>{page.title}</h1>
        <LastReviewed label={page.lastReviewedLabel} date={page.lastReviewed} />
        <div className="space-y-4">
          <Blocks blocks={page.intro} />
        </div>
      </header>

      {showContents && (
        <nav aria-labelledby="on-this-page" className="mt-8 rounded-lg border border-slate-200 bg-white p-4 sm:p-6">
          <h2 id="on-this-page" className="text-base font-semibold text-slate-950">
            {DOC_LABELS.onThisPage}
          </h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {page.sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className={cls.link}>
                  {s.heading}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {page.sections.length > 0 && (
        <div className="mt-10 space-y-10">
          {page.sections.map((s) => (
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-heading`} className="scroll-mt-24 space-y-4">
              <h2 id={`${s.id}-heading`} className={cls.h2}>
                {s.heading}
              </h2>
              <Blocks blocks={s.blocks} />
            </section>
          ))}
        </div>
      )}

      {children}

      {page.related && page.related.length > 0 && (
        <aside aria-labelledby="related-pages" className="mt-12 border-t border-slate-200 pt-8">
          <h2 id="related-pages" className="text-base font-semibold text-slate-950">
            {DOC_LABELS.related}
          </h2>
          <ul className="mt-3 space-y-2">
            {page.related.map((r) => (
              <li key={r.href}>
                <Link href={r.href} className={cls.link}>
                  {r.label}
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </article>
  )
}
