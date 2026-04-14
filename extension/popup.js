const POPULAR = [
  'Milwaukee M18', 'DeWalt circular saw', 'Makita impact driver',
  'RIDGID shop vac', 'Milwaukee Packout', 'Bosch laser level',
]

const STORE_COLORS = {
  'Walmart Canada': '#0071DC',
  'Home Depot Canada': '#F96302',
  'Amazon Canada': '#FF9900',
  'Canadian Tire': '#D52B1E',
  'RONA': '#00703C',
  'Princess Auto': '#7C3AED',
}

const qEl = document.getElementById('q')
const btn = document.getElementById('btn')
const content = document.getElementById('content')
const chipsEl = document.getElementById('chips')

// Render popular chips
POPULAR.forEach(term => {
  const chip = document.createElement('button')
  chip.className = 'chip'
  chip.textContent = term
  chip.onclick = () => { qEl.value = term; doSearch(term) }
  chipsEl.appendChild(chip)
})

btn.onclick = () => doSearch(qEl.value.trim())
qEl.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(qEl.value.trim()) })

function showLoading() {
  content.innerHTML = `
    <div class="loading">
      <div class="dots">
        <div class="dot"></div><div class="dot"></div><div class="dot"></div>
      </div>
      <p>Fetching live prices from 6 stores...</p>
    </div>`
}

function renderResults(data) {
  const { prices, query, brand } = data
  const real = prices.filter(p => !p.checkManually && !p.notCarried && p.price > 0)
  const manual = prices.filter(p => p.checkManually)
  const notCarried = prices.filter(p => p.notCarried)

  let html = '<div class="results">'

  // Brand detected notice
  if (brand) {
    html += `<div style="font-size:10px;color:#475569;margin-bottom:8px;padding:4px 8px;background:#1e293b;border-radius:6px;">
      🏷️ <strong style="color:#94a3b8">${brand.charAt(0).toUpperCase() + brand.slice(1)}</strong> — showing stores that carry this brand
    </div>`
  }

  // Savings banner
  if (real.length >= 2) {
    const lowest = real[0].price
    const highest = real[real.length - 1].price
    const savings = highest - lowest
    const pct = Math.round((savings / highest) * 100)
    if (savings > 1) {
      html += `
        <div class="savings">
          <div>
            <div class="label">Best savings</div>
            <div class="amount">$${savings.toFixed(2)}</div>
            <div class="detail">Buy at ${real[0].store}</div>
          </div>
          <div class="pct">${pct}%</div>
        </div>`
    }
  }

  // Real prices
  if (real.length > 0) {
    real.forEach((p, i) => {
      const isBest = i === 0
      const color = STORE_COLORS[p.store] ?? '#94a3b8'
      html += `
        <a href="${p.url}" target="_blank" class="price-row${isBest ? ' best' : ''}">
          <div class="rank${isBest ? ' best' : ''}">${isBest ? '★' : i + 1}</div>
          <div style="flex:1;min-width:0">
            <div class="store-name" style="color:${isBest ? '#4ade80' : color}">${p.store}</div>
            ${p.name ? `<div class="product-name">${p.name.slice(0, 55)}</div>` : ''}
          </div>
          <div class="badges">
            ${p.discount >= 10 ? `<span class="badge discount">-${p.discount}%</span>` : ''}
            ${isBest ? `<span class="badge best">BEST</span>` : ''}
          </div>
          <div class="price-wrap">
            <div class="price${isBest ? ' best' : ''}">$${p.price.toFixed(2)}</div>
            ${p.originalPrice > p.price ? `<div class="was-price">$${p.originalPrice.toFixed(2)}</div>` : ''}
          </div>
        </a>`
    })
  }

  // Manual check stores
  if (manual.length > 0) {
    html += `<div class="section-label">Check price on site</div>`
    manual.forEach(p => {
      const color = STORE_COLORS[p.store] ?? '#94a3b8'
      html += `
        <a href="${p.url}" target="_blank" class="price-row">
          <div class="rank">→</div>
          <div style="flex:1;min-width:0">
            <div class="store-name" style="color:${color}">${p.store}</div>
          </div>
          <div class="badges"><span class="badge manual">Visit →</span></div>
          <div class="price-wrap"><div class="price manual">See site</div></div>
        </a>`
    })
  }

  // Not carried stores
  if (notCarried.length > 0) {
    html += `<div class="section-label">Not sold at these stores</div>`
    notCarried.forEach(p => {
      html += `
        <div class="price-row" style="opacity:0.4;cursor:default">
          <div class="rank" style="font-size:10px">✕</div>
          <div style="flex:1;min-width:0">
            <div class="store-name" style="color:#475569">${p.store}</div>
            <div class="product-name">Brand not carried</div>
          </div>
          <div class="price-wrap"><div class="price manual">—</div></div>
        </div>`
    })
  }

  if (real.length === 0 && manual.length === 0 && notCarried.length === 0) {
    html += `<div class="empty"><div class="icon">🔍</div><p>No results found</p></div>`
  }

  html += '</div>'
  content.innerHTML = html
}

async function doSearch(query) {
  if (!query || query.length < 2) return
  showLoading()
  btn.disabled = true

  try {
    const data = await chrome.runtime.sendMessage({ type: 'SEARCH', query })
    renderResults(data)
  } catch (e) {
    content.innerHTML = `<div class="empty"><div class="icon">⚠️</div><p>Search failed</p><p style="font-size:11px;margin-top:4px">${e.message ?? 'Try again'}</p></div>`
  } finally {
    btn.disabled = false
  }
}

// Load last search from storage
chrome.storage.local.get(['lastQuery', 'lastResults'], ({ lastQuery, lastResults }) => {
  if (lastQuery) {
    qEl.value = lastQuery
    if (lastResults) renderResults(lastResults)
  }
})
