'use client'

import { useEffect, useState } from 'react'

const FOREX_PAIRS = [
  { symbol: 'EUR/USD', base: 'EUR', quote: 'USD' },
  { symbol: 'GBP/USD', base: 'GBP', quote: 'USD' },
  { symbol: 'USD/JPY', base: 'USD', quote: 'JPY' },
  { symbol: 'AUD/USD', base: 'AUD', quote: 'USD' },
  { symbol: 'USD/CHF', base: 'USD', quote: 'CHF' },
  { symbol: 'USD/CAD', base: 'USD', quote: 'CAD' },
]

const CRYPTO_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT']

const fmtPrice = (n) => {
  if (!Number.isFinite(n)) return '—'
  if (n >= 10000) return n.toLocaleString('en-US', { maximumFractionDigits: 0 })
  if (n >= 100)   return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (n >= 1)     return n.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
  return n.toLocaleString('en-US', { minimumFractionDigits: 5, maximumFractionDigits: 6 })
}

const fmtChange = (n) => {
  if (!Number.isFinite(n)) return ''
  const sign = n >= 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}

async function fetchForex() {
  // Frankfurter time-series: last 7 days for USD base
  const today = new Date()
  const start = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
  const fmt = (d) => d.toISOString().slice(0, 10)
  const url = `https://api.frankfurter.dev/v1/${fmt(start)}..${fmt(today)}?base=USD&symbols=EUR,GBP,JPY,AUD,CHF,CAD`
  const res = await fetch(url)
  if (!res.ok) throw new Error('frankfurter failed')
  const data = await res.json()
  const dates = Object.keys(data.rates).sort()
  if (dates.length < 1) throw new Error('no forex data')
  const last = data.rates[dates[dates.length - 1]]
  const prev = data.rates[dates[dates.length - 2]] || last

  return FOREX_PAIRS.map(({ symbol, base }) => {
    // If base is USD → rate is direct (e.g. USD/JPY = rates.JPY)
    // If base is something else → invert (EUR/USD = 1 / rates.EUR)
    const quote = symbol.split('/')[1]
    const cur = base === 'USD' ? last[quote] : 1 / last[base]
    const pr  = base === 'USD' ? prev[quote] : 1 / prev[base]
    const change = ((cur - pr) / pr) * 100
    return { symbol, price: cur, change }
  })
}

async function fetchCrypto() {
  const url = `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(
    JSON.stringify(CRYPTO_SYMBOLS)
  )}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('binance failed')
  const data = await res.json()
  return data.map((d) => ({
    symbol: `${d.symbol.replace('USDT', '')}/USDT`,
    price: parseFloat(d.lastPrice),
    change: parseFloat(d.priceChangePercent),
  }))
}

async function fetchGold() {
  // PAX Gold ≈ 1 troy oz physical gold, tracks XAU/USD closely
  const url =
    'https://api.coingecko.com/api/v3/simple/price?ids=pax-gold&vs_currencies=usd&include_24hr_change=true'
  const res = await fetch(url)
  if (!res.ok) throw new Error('coingecko failed')
  const data = await res.json()
  const g = data['pax-gold']
  if (!g) return []
  return [{ symbol: 'XAU/USD', price: g.usd, change: g.usd_24h_change }]
}

export default function TickerTape() {
  const [items, setItems] = useState([])

  useEffect(() => {
    let live = true

    const load = async () => {
      const results = await Promise.allSettled([fetchForex(), fetchGold(), fetchCrypto()])
      const merged = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
      if (live && merged.length) setItems(merged)
    }

    load()
    const id = setInterval(load, 60_000) // refresh every 60s
    return () => {
      live = false
      clearInterval(id)
    }
  }, [])

  // Duplicate for seamless marquee loop
  const loop = items.length ? [...items, ...items] : []

  return (
    <div
      className="w-full overflow-hidden relative"
      style={{
        background:
          'linear-gradient(180deg, rgba(214,169,61,0.04) 0%, rgba(0,0,0,0) 100%), #0b0c0e',
        borderTop: '1px solid rgba(214,169,61,0.18)',
        borderBottom: '1px solid rgba(214,169,61,0.18)',
      }}
    >
      {/* Edge fade masks so items disappear smoothly */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-12 sm:w-16 md:w-20 z-10"
        style={{ background: 'linear-gradient(90deg, #0b0c0e, transparent)' }}
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-12 sm:w-16 md:w-20 z-10"
        style={{ background: 'linear-gradient(270deg, #0b0c0e, transparent)' }}
      />

      {loop.length === 0 ? (
        <div
          className="flex items-center justify-center py-4 text-sm"
          style={{ color: 'var(--fx-text-3)' }}
        >
          Loading live market data…
        </div>
      ) : (
        <div className="fx-marquee py-3.5">
          {loop.map((it, i) => {
            const up = it.change >= 0
            return (
              <div
                key={`${it.symbol}-${i}`}
                className="flex items-center gap-3 whitespace-nowrap text-sm"
              >
                <span className="font-semibold tracking-wide" style={{ color: '#f5f5f5' }}>
                  {it.symbol}
                </span>
                <span className="font-mono" style={{ color: 'var(--fx-gold-light)' }}>
                  {fmtPrice(it.price)}
                </span>
                <span
                  className="font-mono text-xs"
                  style={{ color: up ? '#22c55e' : '#ef4444' }}
                >
                  {fmtChange(it.change)}
                </span>
                <span style={{ color: 'rgba(255,255,255,0.18)' }}>|</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
