'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import { langForLocation, setUiLang } from '../lib/lang'

/**
 * Applies the language a page asks for (/ko/… pages, or ?lang=) after every navigation and
 * remembers it. Reading the URL during render is not enough: on a client-side <Link> navigation the
 * address bar changes only after the new page has rendered, so the router's own values are used
 * here, after commit. Rendered inside <Suspense> in the root layout (useSearchParams on a static
 * page needs a boundary; see next/dist/docs …/use-search-params.md).
 */
export function UiLangSync() {
  const pathname = usePathname()
  const search = useSearchParams().toString()
  useEffect(() => {
    const lang = langForLocation(pathname ?? '', search)
    if (lang) setUiLang(lang)
  }, [pathname, search])
  return null
}
