'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ITEMS = [
  { href: '/budget', label: '홈', icon: '🏠' },
  { href: '/budget/add', label: '입력', icon: '➕' },
  { href: '/budget/list', label: '내역', icon: '📋' },
  { href: '/budget/import', label: '가져오기', icon: '📥' },
  { href: '/budget/settings', label: '설정', icon: '⚙️' },
]

export function BudgetNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur">
      <ul className="mx-auto flex max-w-xl justify-between px-2 pb-[env(safe-area-inset-bottom)]">
        {ITEMS.map((item) => {
          const active = pathname === item.href
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors ${
                  active ? 'text-gray-900' : 'text-gray-400'
                }`}
              >
                <span aria-hidden className="text-lg leading-none">
                  {item.icon}
                </span>
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
