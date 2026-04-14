'use client'

import { useState, useEffect } from 'react'
import { ToolPrice, SearchResponse } from '@/lib/types'

// Chrome extension ID — update after publishing to Chrome Web Store
const EXTENSION_ID = 'pmnkaniabfpfenlihdfafembmadnjmfj'

declare const chrome: any

async function searchViaExtension(query: string): Promise<SearchResponse | null> {
  try {
    if (typeof chrome === 'undefined' || !chrome?.runtime) return null
    return await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(EXTENSION_ID, { type: 'SEARCH', query }, (response: any) => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError)
        else resolve(response)
      })
    })
  } catch {
    return null
  }
}

async function pingExtension(): Promise<boolean> {
  try {
    if (typeof chrome === 'undefined' || !chrome?.runtime) return false
    return await new Promise((resolve) => {
      chrome.runtime.sendMessage(EXTENSION_ID, { type: 'PING' }, (response: any) => {
        resolve(!chrome.runtime.lastError && response?.status === 'ok')
      })
    })
  } catch {
    return false
  }
}

const POPULAR = [
  'Milwaukee M18 drill',
  'DeWalt 20V circular saw',
  'Makita impact driver',
  'RIDGID shop vac',
  'Milwaukee Packout',
  'DeWalt table saw',
  'Bosch laser level',
  'Milwaukee M12',
]

const STORE_CONFIG: Record<string, { color: string; bg: string; border: string; text: string }> = {
  'Walmart Canada':    { color: '#0071DC', bg: '#EFF6FF', border: '#BFDBFE', text: '#1D4ED8' },
  'Home Depot Canada': { color: '#F96302', bg: '#FFF7ED', border: '#FED7AA', text: '#C2410C' },
  'Amazon Canada':     { color: '#FF9900', bg: '#FFFBEB', border: '#FDE68A', text: '#B45309' },
  'Canadian Tire':     { color: '#D52B1E', bg: '#FEF2F2', border: '#FECACA', text: '#B91C1C' },
  'RONA':              { color: '#00703C', bg: '#F0FDF4', border: '#BBF7D0', text: '#15803D' },
  'Princess Auto':     { color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', text: '#6D28D9' },
}

function StoreIcon({ logo }: { logo: string }) {
  const icons: Record<string, string> = {
    walmart: '🛒',
    homedepot: '🏠',
    amazon: '📦',
    canadiantire: '🍁',
    rona: '🔨',
    princessauto: '⚙️',
  }
  return <span className="text-lg">{icons[logo] ?? '🏪'}</span>
}

function PriceRow({ price, rank }: { price: ToolPrice; rank: number }) {
  const cfg = STORE_CONFIG[price.store] ?? { color: '#6B7280', bg: '#F9FAFB', border: '#E5E7EB', text: '#374151' }
  const isLowest = rank === 0 && !price.checkManually

  return (
    <a
      href={price.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-3 p-4 rounded-2xl border-2 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
      style={{
        borderColor: isLowest ? cfg.color : '#E5E7EB',
        backgroundColor: isLowest ? cfg.bg : '#FFFFFF',
      }}
    >
      {/* Rank */}
      <div className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold"
        style={{ backgroundColor: isLowest ? cfg.color : '#F3F4F6', color: isLowest ? '#fff' : '#9CA3AF' }}>
        {isLowest ? '★' : rank + 1}
      </div>

      {/* Store */}
      <div className="flex items-center gap-2 w-44 shrink-0">
        <StoreIcon logo={price.storeLogo} />
        <span className="text-sm font-semibold text-gray-800 leading-tight">{price.store}</span>
      </div>

      {/* Name */}
      <div className="flex-1 min-w-0">
        {price.checkManually ? (
          <span className="text-sm text-gray-400 italic">Click to check price</span>
        ) : (
          <span className="text-xs text-gray-500 truncate block">{price.name?.slice(0, 60)}</span>
        )}
      </div>

      {/* Badges */}
      <div className="flex items-center gap-2 shrink-0">
        {price.discount && price.discount >= 10 && (
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
            -{price.discount}%
          </span>
        )}
        {isLowest && (
          <span className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: cfg.color, color: '#fff' }}>
            BEST PRICE
          </span>
        )}
        {price.checkManually && (
          <span className="text-xs text-gray-400 border border-gray-200 px-2 py-0.5 rounded-full">
            Check →
          </span>
        )}
      </div>

      {/* Price */}
      <div className="text-right shrink-0 w-24">
        {price.checkManually ? (
          <span className="text-sm font-semibold text-gray-400">See site</span>
        ) : (
          <>
            <div className="text-xl font-black" style={{ color: isLowest ? cfg.color : '#111827' }}>
              ${price.price.toFixed(2)}
            </div>
            {price.originalPrice && price.originalPrice > price.price && (
              <div className="text-xs text-gray-400 line-through">${price.originalPrice.toFixed(2)}</div>
            )}
          </>
        )}
      </div>
    </a>
  )
}

function SavingsBar({ prices }: { prices: ToolPrice[] }) {
  const realPrices = prices.filter(p => !p.checkManually && p.price > 0)
  if (realPrices.length < 2) return null
  const lowest = realPrices[0].price
  const highest = realPrices[realPrices.length - 1].price
  const savings = highest - lowest
  const pct = Math.round((savings / highest) * 100)

  return (
    <div className="mb-4 p-4 rounded-2xl bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">Potential savings</p>
          <p className="text-2xl font-black text-green-700">${savings.toFixed(2)}</p>
          <p className="text-xs text-green-600">Buy at {realPrices[0].store} vs {realPrices[realPrices.length - 1].store}</p>
        </div>
        <div className="text-right">
          <div className="text-4xl font-black text-green-600">{pct}%</div>
          <div className="text-xs text-green-600">cheaper</div>
        </div>
      </div>
    </div>
  )
}

export default function Home() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<SearchResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState('')
  const [hasExtension, setHasExtension] = useState(false)

  useEffect(() => {
    pingExtension().then(setHasExtension)
  }, [])

  async function doSearch(q: string) {
    if (!q.trim() || q.trim().length < 2) return
    setLoading(true)
    setError(null)
    setData(null)
    setSearched(q)
    setQuery(q)
    try {
      // Try extension first (live prices), fallback to cached API
      const extResult = hasExtension ? await searchViaExtension(q) : null
      if (extResult) {
        setData(extResult)
        return
      }
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Search failed')
      setData(json)
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const realPrices = data?.prices.filter(p => !p.checkManually && !p.notCarried && p.price > 0) ?? []
  const manualPrices = data?.prices.filter(p => p.checkManually) ?? []
  const notCarriedPrices = data?.prices.filter(p => p.notCarried) ?? []

  return (
    <div className="min-h-screen flex flex-col">

      {/* Hero */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
        <div className="max-w-2xl mx-auto px-4 pt-12 pb-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">🍁</span>
            <h1 className="text-2xl font-black tracking-tight">Canadian Tool Deals</h1>
          </div>
          <p className="text-slate-400 text-sm mb-8">
            Compare prices across 6 Canadian stores instantly — Canadian Tire, Home Depot, Walmart, Amazon, RONA & Princess Auto
          </p>

          {/* Search box */}
          <form onSubmit={e => { e.preventDefault(); doSearch(query) }} className="relative">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder='Try "Milwaukee M18 drill" or "DeWalt circular saw"...'
              className="w-full px-5 py-4 pr-28 rounded-2xl text-gray-900 text-sm font-medium shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder:text-gray-400"
              autoFocus
            />
            <button
              type="submit"
              disabled={loading || query.trim().length < 2}
              className="absolute right-2 top-2 bottom-2 px-5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm disabled:opacity-40 transition-colors"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                </span>
              ) : 'Search'}
            </button>
          </form>

          {/* Extension status banner */}
          {hasExtension ? (
            <div className="mt-4 flex items-center gap-2 text-xs text-green-400">
              <span className="w-2 h-2 bg-green-400 rounded-full inline-block animate-pulse" />
              Extension connected — fetching live prices from all 6 stores
            </div>
          ) : (
            <div className="mt-4 flex items-center justify-between gap-3 bg-white/10 rounded-xl px-4 py-2.5 border border-white/10">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <span>⚡</span>
                <span>Install the extension for <strong className="text-white">live prices</strong> from all stores</span>
              </div>
              <a href="#install" className="text-xs font-bold bg-blue-500 hover:bg-blue-400 text-white px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                Get Extension
              </a>
            </div>
          )}

          {/* Popular searches */}
          {!loading && (
            <div className="mt-4 flex flex-wrap gap-2">
              {POPULAR.map(s => (
                <button key={s} onClick={() => doSearch(s)}
                  className="text-xs px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors border border-white/10">
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center py-16 gap-4">
            <div className="flex gap-1">
              {['Walmart', 'Home Depot', 'Amazon', 'Canadian Tire', 'RONA', 'Princess Auto'].map((s, i) => (
                <div key={s} className="w-2 h-2 rounded-full bg-blue-500 animate-bounce"
                  style={{ animationDelay: `${i * 0.1}s` }} />
              ))}
            </div>
            <p className="text-sm text-gray-500">Checking prices across 6 stores...</p>
            <div className="flex flex-wrap gap-2 justify-center mt-2">
              {['Walmart CA', 'Home Depot', 'Amazon CA', 'Canadian Tire', 'RONA', 'Princess Auto'].map(s => (
                <span key={s} className="text-xs px-2 py-1 bg-gray-100 rounded-full text-gray-500 animate-pulse">{s}</span>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Results */}
        {data && !loading && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-500">
                Results for <span className="font-bold text-gray-900">"{searched}"</span>
              </p>
              <p className="text-xs text-gray-400">{realPrices.length} live prices</p>
            </div>

            {/* Brand detection notice */}
            {data.brand && (
              <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-700">
                <span>🏷️</span>
                <span>
                  <strong className="capitalize">{data.brand}</strong> — showing only stores that carry this brand in Canada
                </span>
              </div>
            )}

            {/* Cached notice */}
            {data.cached && !data.brand && (
              <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-100 text-xs text-amber-700">
                <span>⏱️</span>
                <span>Showing cached prices — install the extension for live prices</span>
              </div>
            )}

            {/* Savings banner */}
            <SavingsBar prices={data.prices} />

            {/* Real prices */}
            {realPrices.length > 0 && (
              <div className="flex flex-col gap-2 mb-6">
                {realPrices.map((p, i) => (
                  <PriceRow key={p.store} price={p} rank={i} />
                ))}
              </div>
            )}

            {/* Manual check stores */}
            {manualPrices.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  Also check these stores (prices loaded on their sites)
                </p>
                <div className="flex flex-col gap-2">
                  {manualPrices.map((p, i) => (
                    <PriceRow key={p.store} price={p} rank={realPrices.length + i} />
                  ))}
                </div>
              </div>
            )}

            {/* Not carried stores */}
            {notCarriedPrices.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Not sold at these stores</p>
                <div className="flex flex-col gap-1.5">
                  {notCarriedPrices.map(p => (
                    <div key={p.store} className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50 opacity-50">
                      <span className="text-gray-300 text-sm font-bold">✕</span>
                      <span className="text-sm font-semibold text-gray-400">{p.store}</span>
                      <span className="text-xs text-gray-400 ml-auto">Brand not carried</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {realPrices.length === 0 && manualPrices.length === 0 && notCarriedPrices.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <p className="text-4xl mb-3">🔍</p>
                <p className="font-medium text-gray-600">No results found</p>
                <p className="text-sm mt-1">Try a different search term</p>
              </div>
            )}

            <p className="mt-6 text-xs text-gray-400 text-center">
              Prices fetched in real-time · Links may include affiliate commissions
            </p>
          </div>
        )}

        {/* Empty state */}
        {!data && !loading && !error && (
          <div className="py-8">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Stores covered</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Object.entries(STORE_CONFIG).map(([name, cfg]) => (
                <div key={name} className="p-3 rounded-xl border-2 text-sm font-semibold"
                  style={{ borderColor: cfg.border, backgroundColor: cfg.bg, color: cfg.text }}>
                  {name}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-gray-100 py-4 px-4">
        <p className="text-center text-xs text-gray-400">
          Canadian Tool Deals · Not affiliated with any store · © {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  )
}
