import { useState } from 'react'
import { BarChart2 } from 'lucide-react'
import ScrollReveal from '../../components/animations/ScrollReveal'
import SectionHeader from '../../components/SectionHeader'

const INSTRUMENT_TABS = ['All', 'Forex', 'Metals', 'Crypto', 'Indices', 'Energy']

const INSTRUMENTS = [
  { symbol: 'EUR/USD', name: 'Euro vs US Dollar',            desc: 'Most liquid forex pair globally',  category: 'Forex',    leverage: '1:500',  spread: '0.6 pips' },
  { symbol: 'GBP/USD', name: 'Pound vs US Dollar',           desc: 'High-volatility major pair',       category: 'Forex',    leverage: '1:500',  spread: '0.8 pips' },
  { symbol: 'USD/JPY', name: 'Dollar vs Japanese Yen',       desc: 'Popular carry trade pair',         category: 'Forex',    leverage: '1:500',  spread: '0.7 pips' },
  { symbol: 'USD/CHF', name: 'Dollar vs Swiss Franc',        desc: 'Safe-haven currency pair',         category: 'Forex',    leverage: '1:500',  spread: '0.9 pips' },
  { symbol: 'AUD/USD', name: 'Australian Dollar vs US Dollar', desc: 'Commodity-linked major pair',    category: 'Forex',    leverage: '1:500',  spread: '0.8 pips' },
  { symbol: 'USD/CAD', name: 'Dollar vs Canadian Dollar',    desc: 'Oil-correlated major pair',        category: 'Forex',    leverage: '1:500',  spread: '0.9 pips' },
  { symbol: 'NZD/USD', name: 'New Zealand Dollar vs US Dollar', desc: 'Commodity-linked minor',        category: 'Forex',    leverage: '1:500',  spread: '1.0 pips' },

  { symbol: 'XAU/USD', name: 'Gold vs US Dollar',            desc: 'World\u2019s primary safe-haven asset', category: 'Metals', leverage: '1:200',  spread: '0.25' },
  { symbol: 'XAG/USD', name: 'Silver vs US Dollar',          desc: 'High-volatility precious metal',   category: 'Metals',   leverage: '1:200',  spread: '0.03' },
  { symbol: 'XPT/USD', name: 'Platinum vs US Dollar',        desc: 'Industrial precious metal',        category: 'Metals',   leverage: '1:100',  spread: '2.50' },

  { symbol: 'BTC/USD', name: 'Bitcoin vs US Dollar',         desc: 'Largest cryptocurrency by market cap', category: 'Crypto', leverage: '1:20', spread: '$25' },
  { symbol: 'ETH/USD', name: 'Ethereum vs US Dollar',        desc: 'Leading smart-contract platform',  category: 'Crypto',   leverage: '1:20',   spread: '$3.5' },
  { symbol: 'XRP/USD', name: 'Ripple vs US Dollar',          desc: 'Cross-border payments network',    category: 'Crypto',   leverage: '1:10',   spread: '$0.01' },
  { symbol: 'SOL/USD', name: 'Solana vs US Dollar',          desc: 'High-throughput blockchain',       category: 'Crypto',   leverage: '1:10',   spread: '$0.5' },

  { symbol: 'US30',    name: 'Dow Jones Industrial',         desc: 'Top 30 US blue-chip stocks',       category: 'Indices',  leverage: '1:200',  spread: '1.5' },
  { symbol: 'US500',   name: 'S&P 500 Index',                desc: 'Top 500 US companies',             category: 'Indices',  leverage: '1:200',  spread: '0.5' },
  { symbol: 'NAS100',  name: 'NASDAQ 100 Index',             desc: 'Top 100 US tech & growth stocks',  category: 'Indices',  leverage: '1:200',  spread: '1.0' },
  { symbol: 'UK100',   name: 'FTSE 100 Index',               desc: 'Top 100 UK-listed companies',      category: 'Indices',  leverage: '1:200',  spread: '1.2' },
  { symbol: 'GER40',   name: 'DAX 40 Index',                 desc: 'Top 40 German blue chips',         category: 'Indices',  leverage: '1:200',  spread: '1.0' },

  { symbol: 'USOIL',   name: 'US Crude Oil (WTI)',           desc: 'West Texas Intermediate benchmark',category: 'Energy',   leverage: '1:100',  spread: '3 pips' },
  { symbol: 'UKOIL',   name: 'Brent Crude Oil',              desc: 'International oil benchmark',      category: 'Energy',   leverage: '1:100',  spread: '3 pips' },
  { symbol: 'NATGAS',  name: 'Natural Gas',                  desc: 'High-volatility energy commodity', category: 'Energy',   leverage: '1:50',   spread: '0.004' },
]

/* Animated bar-sparkline — each bar wobbles continuously on its own offset
   phase, so every symbol gets a distinct "live market" feel without having to
   fetch any real data. Deterministic seed → consistent look per symbol. */
function Sparkline({ seed }) {
  const bars = []
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  for (let i = 0; i < 5; i++) {
    h = (h * 1103515245 + 12345) >>> 0
    bars.push({
      base: 30 + (h % 55),
      delay: ((h >>> 4) % 1200) / 1000,
      duration: 1.1 + (((h >>> 8) % 9) / 10),
    })
  }
  return (
    <div className="flex items-end gap-[2px] h-4 shrink-0" aria-hidden>
      {bars.map((b, i) => (
        <span
          key={i}
          className="sparkline-bar w-[3px] rounded-sm bg-gradient-to-t from-primary-accent/60 to-primary-accent"
          style={{
            height: `${b.base}%`,
            animationDelay: `${b.delay}s`,
            animationDuration: `${b.duration}s`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes sparkline-pulse {
          0%, 100% { transform: scaleY(0.55); opacity: 0.65; }
          50%      { transform: scaleY(1.35); opacity: 1; }
        }
        .sparkline-bar {
          transform-origin: bottom;
          animation-name: sparkline-pulse;
          animation-iteration-count: infinite;
          animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
          will-change: transform, opacity;
        }
      `}</style>
    </div>
  )
}

export default function LiveMarketChartsSection() {
  const [activeTab, setActiveTab] = useState('All')

  const rows = activeTab === 'All'
    ? INSTRUMENTS
    : INSTRUMENTS.filter((r) => r.category === activeTab)

  return (
    <section className="pt-20 pb-24 md:pt-24 md:pb-32 bg-primary-bg">
      <div className="container-custom">
        <SectionHeader
          badge="Markets"
          title="Tradable Instruments"
          highlight="Tradable Instruments"
          subtitle="Competitive spreads and high leverage across all major asset classes."
        />

        {/* Category tabs */}
        <ScrollReveal variant="fadeUp" delay={0.15}>
          <div className="flex flex-wrap gap-2 mt-10 mb-6">
            {INSTRUMENT_TABS.map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`px-4 py-2 rounded-md text-sm font-semibold transition-all duration-200 border ${
                  activeTab === t
                    ? 'bg-primary-accent/15 text-primary-accent border-primary-accent/40'
                    : 'bg-transparent text-text-secondary border-white/5 hover:text-white hover:border-white/15'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </ScrollReveal>

        {/* Instruments table */}
        <ScrollReveal variant="fadeUp" delay={0.25}>
          <div className="rounded-2xl border border-white/5 bg-primary-secondary/40 overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[1.8fr_2.2fr_1fr_0.8fr_1fr] gap-4 px-6 py-4 border-b border-white/5 text-xs font-semibold tracking-wider uppercase text-primary-accent">
              <div>Instrument</div>
              <div className="hidden md:block">Description</div>
              <div>Category</div>
              <div>Leverage</div>
              <div>Avg. Spread</div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-white/5 max-h-[520px] overflow-y-auto">
              {rows.map((r) => (
                <div
                  key={r.symbol}
                  className="grid grid-cols-[1.8fr_2.2fr_1fr_0.8fr_1fr] gap-4 px-6 py-4 items-center hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Sparkline seed={r.symbol} />
                    <div className="min-w-0">
                      <div className="font-semibold text-primary-accent text-base truncate">{r.symbol}</div>
                      <div className="text-text-secondary text-xs truncate">{r.name}</div>
                    </div>
                  </div>
                  <div className="hidden md:block text-text-secondary text-sm truncate">{r.desc}</div>
                  <div className="text-white text-sm">{r.category}</div>
                  <div className="text-white text-sm font-medium">{r.leverage}</div>
                  <div className="text-white text-sm font-semibold">{r.spread}</div>
                </div>
              ))}
              {rows.length === 0 && (
                <div className="px-6 py-10 text-center text-text-secondary text-sm flex items-center justify-center gap-2">
                  <BarChart2 size={16} /> No instruments in this category yet.
                </div>
              )}
            </div>
          </div>
          <p className="mt-4 text-xs text-text-tertiary text-center">
            Spreads may vary due to market volatility, news events, and instrument type. Additional instruments available inside the platform.
          </p>
        </ScrollReveal>
      </div>
    </section>
  )
}
