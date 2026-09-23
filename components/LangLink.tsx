'use client'

import { useEffect, useState } from 'react'

/** EN/KO switch that keeps the query string (e.g. ?src=c1 from a flyer QR code) so lead attribution survives. */
export default function LangLink({ href, hrefLang, className, children }: { href: string; hrefLang: string; className?: string; children: React.ReactNode }) {
  const [target, setTarget] = useState(href)
  useEffect(() => {
    // runs after hydration: the static HTML cannot know the visitor's query string
    if (window.location.search) setTarget(href + window.location.search)
  }, [href])
  return (
    <a href={target} hrefLang={hrefLang} className={className}>
      {children}
    </a>
  )
}
