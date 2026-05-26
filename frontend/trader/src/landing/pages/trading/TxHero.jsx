'use client'

import { Link } from 'react-router-dom'
import { ArrowRight, Sparkles, Ban, TrendingUp, Eye } from 'lucide-react'

const trustBadges = [
  { icon: Eye,        title: 'Transparent Costs', sub: 'Only pay what matters' },
  { icon: Ban,        title: 'No Swap Charges',   sub: 'Zero overnight swap' },
  { icon: TrendingUp, title: 'XP Progression',    sub: 'Better trading as you grow' },
]

export default function TxHero() {
  return (
    <section
      className="relative overflow-hidden"
      style={{
        backgroundColor: 'var(--fx-bg)',
        backgroundImage:
          'radial-gradient(60% 60% at 80% 25%, rgba(214,169,61,0.10) 0%, rgba(214,169,61,0) 60%), radial-gradient(40% 40% at 15% 90%, rgba(214,169,61,0.06) 0%, rgba(214,169,61,0) 60%)',
      }}
    >
      <div className="fx-grid-bg" />
      <div className="fx-container relative z-10 pt-28 md:pt-32 lg:pt-36 pb-16 md:pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* LEFT */}
          <div className="lg:col-span-5">
            <div className="fx-fade-up mb-5">
              <span className="badge">
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: 'var(--fx-gold)', boxShadow: '0 0 8px rgba(214,169,61,0.7)' }}
                />
                Trading on FX Artha
              </span>
            </div>
            <h1 className="fx-headline text-[36px] sm:text-[44px] md:text-[52px] lg:text-[56px] xl:text-[64px] fx-fade-up fx-fade-up-d1">
              Trade Smart. <br />
              <span className="fx-gold-text">Pay Less Over Time.</span>
            </h1>
            <p
              className="mt-5 max-w-xl text-base md:text-lg leading-relaxed fx-fade-up fx-fade-up-d2"
              style={{ color: 'var(--fx-text-2)' }}
            >
              A transparent trading system where your costs improve as you grow.
              No hidden fees. No swap charges. Just fair trading, built for you.
            </p>
            <div className="mt-7 flex flex-col sm:flex-row gap-3 sm:gap-4 fx-fade-up fx-fade-up-d3">
              <Link to="/auth/register" className="fx-btn-primary justify-center">
                Start Trading
                <ArrowRight size={18} />
              </Link>
              <Link to="#how-it-works" className="fx-btn-ghost justify-center">
                See How It Works
              </Link>
            </div>

            {/* Trust badges row */}
            <div className="mt-8 grid grid-cols-3 gap-3 sm:gap-4 fx-fade-up fx-fade-up-d4 max-w-xl">
              {trustBadges.map(({ icon: Icon, title, sub }) => (
                <div key={title} className="flex items-start gap-2">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{
                      background: 'rgba(214,169,61,0.10)',
                      border: '1px solid rgba(214,169,61,0.30)',
                    }}
                  >
                    <Icon size={14} style={{ color: 'var(--fx-gold-light)' }} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[12px] sm:text-[13px] font-bold text-white leading-tight">
                      {title}
                    </div>
                    <div className="text-[10px] sm:text-[11px] leading-tight mt-0.5" style={{ color: 'var(--fx-text-3)' }}>
                      {sub}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT — Trading dashboard + XP sidecar */}
          <div className="lg:col-span-7 relative">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Trading panel (spans 2 cols on sm+) */}
              <TradingPanel />
              {/* XP sidecar */}
              <ProgressCard />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function TradingPanel() {
  return (
    <div
      className="sm:col-span-2 rounded-2xl overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, var(--fx-bg-elev-2) 0%, var(--fx-bg-elev) 100%)',
        border: '1px solid rgba(214,169,61,0.30)',
        boxShadow: '0 30px 70px -30px rgba(214,169,61,0.30)',
        animation: 'fxFloat 7s ease-in-out infinite',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid var(--fx-line)', background: 'rgba(214,169,61,0.04)' }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #f7931a 0%, #ffb547 100%)',
              color: '#111',
              fontWeight: 800,
              fontSize: 11,
            }}
          >
            ₿
          </div>
          <span className="text-sm font-bold text-white">BTC/USDT</span>
          <span className="text-xs font-semibold" style={{ color: '#4ade80' }}>+2.34%</span>
        </div>
        <div className="hidden sm:flex items-center gap-1">
          {['1H', '4H', '1D', '1W'].map((t) => (
            <span
              key={t}
              className="px-2 py-0.5 rounded-md text-[10px] font-semibold"
              style={{
                background: t === '1D' ? 'rgba(214,169,61,0.18)' : 'transparent',
                color: t === '1D' ? 'var(--fx-gold-light)' : 'var(--fx-text-3)',
                border: t === '1D' ? '1px solid rgba(214,169,61,0.45)' : '1px solid transparent',
              }}
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* Chart area */}
      <div className="px-4 pt-3" style={{ background: 'rgba(0,0,0,0.25)' }}>
        <div className="flex items-start justify-between mb-1">
          <div className="text-xs" style={{ color: 'var(--fx-text-3)' }}>
            Price
          </div>
          <div className="text-sm font-bold text-white">$10,000</div>
        </div>
        <svg viewBox="0 0 320 110" className="w-full h-[110px]" preserveAspectRatio="none">
          <defs>
            <linearGradient id="txCandleArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(214,169,61,0.35)" />
              <stop offset="100%" stopColor="rgba(214,169,61,0)" />
            </linearGradient>
          </defs>
          {/* gridlines */}
          {[18, 40, 62, 84].map((y) => (
            <line key={y} x1="0" y1={y} x2="320" y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
          ))}
          {/* area */}
          <path
            d="M0,82 L20,74 L40,80 L60,62 L80,68 L100,50 L120,58 L140,40 L160,46 L180,30 L200,38 L220,22 L240,28 L260,18 L280,24 L300,14 L320,20 L320,110 L0,110 Z"
            fill="url(#txCandleArea)"
          />
          {/* line */}
          <path
            d="M0,82 L20,74 L40,80 L60,62 L80,68 L100,50 L120,58 L140,40 L160,46 L180,30 L200,38 L220,22 L240,28 L260,18 L280,24 L300,14 L320,20"
            fill="none"
            stroke="#ecc657"
            strokeWidth="1.75"
          />
          {/* candle marks */}
          {[
            [40, 76, 4, '#4ade80'],
            [80, 64, 5, '#4ade80'],
            [120, 52, 6, '#f87171'],
            [160, 42, 4, '#4ade80'],
            [200, 32, 6, '#f87171'],
            [240, 24, 4, '#4ade80'],
            [280, 20, 5, '#4ade80'],
          ].map(([cx, cy, h, color], i) => (
            <rect key={i} x={cx - 2} y={cy} width="4" height={h} fill={color} />
          ))}
        </svg>
      </div>

      {/* Trade stats grid */}
      <div
        className="grid grid-cols-4 text-center"
        style={{ borderTop: '1px solid var(--fx-line)' }}
      >
        <StatCell label="Leverage" value="10×" />
        <StatCell label="Position Size" value="$10,000" divider />
        <StatCell label="Margin Used" value="$1,000" divider />
        <StatCell label="P&L" value="+$320.50" valueColor="#4ade80" divider />
      </div>

      {/* Buy / Sell */}
      <div className="grid grid-cols-2 gap-2 p-3" style={{ borderTop: '1px solid var(--fx-line)' }}>
        <button
          type="button"
          className="py-2.5 rounded-lg text-sm font-bold"
          style={{
            background: 'linear-gradient(180deg, #34d168 0%, #22a85a 100%)',
            color: '#0a0a0a',
            border: '1px solid rgba(74,222,128,0.6)',
          }}
        >
          Buy / Long
        </button>
        <button
          type="button"
          className="py-2.5 rounded-lg text-sm font-bold"
          style={{
            background: 'linear-gradient(180deg, #ef4444 0%, #d93939 100%)',
            color: '#fff',
            border: '1px solid rgba(248,113,113,0.6)',
          }}
        >
          Sell / Short
        </button>
      </div>
    </div>
  )
}

function StatCell({ label, value, valueColor = '#ffffff', divider = false }) {
  return (
    <div
      className="px-2 py-3"
      style={divider ? { borderLeft: '1px solid var(--fx-line)' } : undefined}
    >
      <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--fx-text-3)' }}>
        {label}
      </div>
      <div className="text-sm font-bold mt-0.5" style={{ color: valueColor }}>
        {value}
      </div>
    </div>
  )
}

function ProgressCard() {
  const benefits = [
    'Lower Trading Fees',
    'Lower Leverage Fees',
    'Tighter Spreads',
  ]
  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: 'linear-gradient(180deg, var(--fx-bg-elev-2) 0%, var(--fx-bg-elev) 100%)',
        border: '1px solid var(--fx-line-strong)',
        animation: 'fxFloat 8s ease-in-out infinite reverse',
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <span
          className="text-[10px] font-bold uppercase tracking-[0.18em]"
          style={{ color: 'var(--fx-text-3)' }}
        >
          Your Progress
        </span>
        <Sparkles size={13} style={{ color: 'var(--fx-gold-light)' }} />
      </div>

      <div className="flex items-center gap-2.5 mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{
            background: 'linear-gradient(135deg, var(--fx-gold-light), var(--fx-gold))',
            color: '#1a1408',
            fontWeight: 800,
            fontSize: 11,
            letterSpacing: '0.05em',
          }}
        >
          XP
        </div>
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--fx-text-3)' }}>
            XP Level
          </div>
          <div className="text-xl font-extrabold gradient-text leading-none mt-0.5">42</div>
        </div>
      </div>

      <div
        className="h-2 rounded-full mb-1.5 overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--fx-line)' }}
      >
        <div
          style={{
            width: '83%',
            height: '100%',
            background: 'linear-gradient(90deg, var(--fx-gold) 0%, var(--fx-gold-light) 100%)',
            boxShadow: '0 0 12px rgba(214,169,61,0.6)',
          }}
        />
      </div>
      <div className="flex items-center justify-between text-[10px] mb-4" style={{ color: 'var(--fx-text-3)' }}>
        <span>24,850</span>
        <span>30,000 XP</span>
      </div>

      <div className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--fx-gold-light)' }}>
        Next Benefits
      </div>
      <ul className="space-y-1.5 mb-4">
        {benefits.map((b) => (
          <li key={b} className="flex items-center gap-2 text-[11px] text-white">
            <span className="w-1 h-1 rounded-full" style={{ background: '#4ade80' }} />
            {b}
          </li>
        ))}
      </ul>

      <div
        className="rounded-lg p-2.5"
        style={{
          background: 'rgba(74,222,128,0.08)',
          border: '1px solid rgba(74,222,128,0.30)',
        }}
      >
        <div className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--fx-text-3)' }}>
          Trading Cost (vs New User)
        </div>
        <div className="text-lg font-extrabold" style={{ color: '#4ade80' }}>
          −28%
        </div>
      </div>
    </div>
  )
}
