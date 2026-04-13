'use client'

import { useState } from 'react'
import { ToolResult, ToolPrice } from '@/lib/types'

const POPULAR_SEARCHES = [
  'Milwaukee M18 drill',
  'DeWalt circular saw',
  'Makita impact driver',
  'RIDGID shop vac',
  'Milwaukee Packout',
  'DeWalt table saw',
]

const STORE_COLORS: Record<string, string> = {
  'Canadian Tire': 'bg-red-100 text-red-800 border-red-200',
  'Home Depot Canada': 'bg-orange-100 text-orange-800 border-orange-200',
  'Amazon Canada': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'Walmart Canada': 'bg-blue-100 text-blue-800 border-blue-200',
  'RONA': 'bg-green-100 text-green-800 border-green-200',
  'Princess Auto': 'bg-purple-100 text-purple-800 border-purple-200',
}

function PriceCard({ price, isLowest }: { price: ToolPrice; isLowest: boolean }) {
  return (
    <a
      href={price.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all hover:shadow-md ${
        isLowest
          ? 'border-green-400 bg-green-50 shadow-sm'
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      <div className="flex items-center gap-3">
        {isLowest && (
          <span className="text-xs font-bold bg-green-500 text-white px-2 py-0.5 rounded-full">
            BEST PRICE
          </span>
        )}
        <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${STORE_COLORS[price.store] ?? 'bg-gray-100 text-gray-700 border-gray-200'}`}>
          {price.store}
        </span>
        {price.discount && price.discount >= 10 && (
          <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
            -{price.discount}% OFF
          </span>
        )}
        {!price.inStock && (
          <span className="text-xs text-gray-400">Out of stock</span>
        )}
      </div>
      <div className="text-right">
        <div className={`text-xl font-bold ${isLowest ? 'text-green-700' : 'text-gray-900'}`}>
          ${price.price.toFixed(2)}
        </div>
        {price.originalPrice && price.originalPrice > price.price && (
          <div className="text-sm text-gray-400 line-through">
            ${price.originalPrice.toFixed(2)}
          </div>
        )}
      </div>
    </a>
  )
}

function ResultCard({ result }: { result: ToolResult }) {
  const savings = result.prices.length >= 2
    ? result.prices[result.prices.length - 1].price - result.prices[0].price
    : 0

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{result.name}</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {result.prices.length} store{result.prices.length !== 1 ? 's' : ''} compared
            </p>
          </div>
          {savings > 0 && (
            <div className="text-right shrink-0">
              <div className="text-xs text-gray-500">Save up to</div>
              <div className="text-lg font-bold text-green-600">${savings.toFixed(2)}</div>
              <div className="text-xs text-gray-400">vs highest price</div>
            </div>
          )}
        </div>
      </div>
      <div className="p-4 flex flex-col gap-3">
        {result.prices.map((price, i) => (
          <PriceCard key={`${price.store}-${i}`} price={price} isLowest={i === 0} />
        ))}
      </div>
    </div>
  )
}

export default function Home() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<ToolResult[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [searchedQuery, setSearchedQuery] = useState('')

  async function search(q: string) {
    if (!q.trim() || q.trim().length < 2) return
    setLoading(true)
    setError(null)
    setResults(null)
    setSearchedQuery(q)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Search failed')
      setResults(data.results)
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    search(query)
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="bg-red-600 text-white shadow-md">
        <div className="max-w-3xl mx-auto px-4 py-5 flex items-center gap-3">
          <span className="text-2xl">🔧</span>
          <div>
            <h1 className="text-xl font-bold leading-tight">Canadian Tool Deals</h1>
            <p className="text-red-200 text-xs">Compare prices across 6 Canadian stores instantly</p>
          </div>
        </div>
      </header>

      {/* Search */}
      <div className="bg-red-600 pb-8 px-4">
        <div className="max-w-3xl mx-auto">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search tools... (e.g. Milwaukee M18 drill)"
              className="flex-1 px-4 py-3 rounded-xl text-gray-900 text-sm font-medium shadow-inner focus:outline-none focus:ring-2 focus:ring-white/50"
            />
            <button
              type="submit"
              disabled={loading || query.trim().length < 2}
              className="px-5 py-3 bg-white text-red-600 font-bold rounded-xl shadow hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
            >
              {loading ? '...' : 'Search'}
            </button>
          </form>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6">

        {/* Popular searches */}
        {!results && !loading && !error && (
          <div>
            <p className="text-sm font-semibold text-gray-500 mb-3">Popular searches</p>
            <div className="flex flex-wrap gap-2">
              {POPULAR_SEARCHES.map(s => (
                <button
                  key={s}
                  onClick={() => { setQuery(s); search(s) }}
                  className="px-3 py-1.5 bg-white border border-gray-200 rounded-full text-sm text-gray-700 hover:border-red-400 hover:text-red-600 transition-colors shadow-sm"
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Stores badge */}
            <div className="mt-8">
              <p className="text-sm font-semibold text-gray-500 mb-3">Stores we compare</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(STORE_COLORS).map(([store, cls]) => (
                  <span key={store} className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${cls}`}>
                    {store}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-500">Checking prices across 6 stores...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Results */}
        {results && !loading && (
          <div>
            <p className="text-sm text-gray-500 mb-4">
              Results for <span className="font-semibold text-gray-800">"{searchedQuery}"</span>
            </p>
            {results.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <p className="text-4xl mb-3">🔍</p>
                <p className="font-medium">No results found</p>
                <p className="text-sm mt-1">Try a different search term</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {results.map((r, i) => (
                  <ResultCard key={i} result={r} />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-6 px-4 mt-auto">
        <div className="max-w-3xl mx-auto text-center text-xs text-gray-400">
          <p>Prices updated in real-time. Links may include affiliate commissions — they help keep this site free.</p>
          <p className="mt-1">Canadian Tool Deals is not affiliated with any store.</p>
        </div>
      </footer>
    </div>
  )
}
