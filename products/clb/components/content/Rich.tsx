// Renders the small inline markup used in content/*.ts strings: [label](href) and **bold**.
import Link from 'next/link'
import type { ReactNode } from 'react'
import { cls } from '../ui'

const TOKEN = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*/g

export function Rich({ text }: { text: string }) {
  const out: ReactNode[] = []
  let last = 0
  let key = 0
  for (const m of text.matchAll(TOKEN)) {
    const start = m.index ?? 0
    if (start > last) out.push(text.slice(last, start))
    if (m[1] !== undefined && m[2] !== undefined) {
      const href = m[2]
      out.push(
        href.startsWith('/') ? (
          <Link key={key++} href={href} className={cls.link}>
            {m[1]}
          </Link>
        ) : (
          <a key={key++} href={href} className={cls.link} rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}>
            {m[1]}
          </a>
        ),
      )
    } else if (m[3] !== undefined) {
      out.push(
        <strong key={key++} className="font-semibold text-slate-950">
          {m[3]}
        </strong>,
      )
    }
    last = start + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return <>{out}</>
}
