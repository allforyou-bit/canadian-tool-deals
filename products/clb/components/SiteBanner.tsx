'use client'

import { useMe } from '../lib/hooks'

/** Owner-controlled notice (KV flag `banner`), shown on every page when non-empty. */
export function SiteBanner() {
  const state = useMe()
  const banner = state.status === 'ready' ? state.me.flags.banner.trim() : ''
  if (!banner) return null
  return (
    <div role="status" className="border-b border-amber-300 bg-amber-50">
      <p className="mx-auto max-w-5xl px-4 py-2 text-sm font-medium text-amber-950">{banner}</p>
    </div>
  )
}
