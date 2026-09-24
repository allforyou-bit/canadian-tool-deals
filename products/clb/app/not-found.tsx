// 404 page (exported as out/404.html; the Worker serves it via assets.not_found_handling = "404-page").
// Bilingual because a missing URL can come from either language. Copy: content/not-found.ts.
import Link from 'next/link'
import { cls } from '@/components/ui'
import { NOT_FOUND } from '@/content/not-found'

export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-xl space-y-10 py-12 text-center sm:py-20">
      {(['en', 'ko'] as const).map((lang) => {
        const copy = NOT_FOUND[lang]
        const Heading = lang === 'en' ? 'h1' : 'h2'
        return (
          <section key={lang} lang={lang} className="space-y-3">
            <Heading className={lang === 'en' ? cls.h1 : cls.h2}>{copy.title}</Heading>
            <p className="text-slate-700">{copy.body}</p>
            <ul className="flex flex-wrap justify-center gap-x-5 gap-y-2">
              {copy.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className={cls.link}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
