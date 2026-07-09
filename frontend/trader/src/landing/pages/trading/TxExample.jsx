'use client'

import { useState, useMemo } from 'react'
import { Calculator, Sun, Moon, Receipt, Gauge, Activity, TrendingUp } from 'lucide-react'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

const BROKERAGE_RATE = 0.0008
const OVERNIGHT_FEE_RATE = 0.00012

function fmt(n) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function TxExample() {
  const [tradeSize, setTradeSize] = useState(1000)
  const [leverage, setLeverage] = useState(5)
  const [overnight, setOvernight] = useState(false)

  const { ownCapital, borrowed, brokerage, leverageFee } = useMemo(() => {
    const own = tradeSize / leverage
    const borrowedAmt = tradeSize - own
    const brk = tradeSize * BROKERAGE_RATE
    const fee = overnight ? borrowedAmt * OVERNIGHT_FEE_RATE : 0
    return { ownCapital: own, borrowed: borrowedAmt, brokerage: brk, leverageFee: fee }
  }, [tradeSize, leverage, overnight])

  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg-elev)' }}>
      <div className="fx-container">
        {/* ── Two-column intro ──────────────────────────────── */}
        <div className="fx-split-intro">
          <ScrollReveal variant="fadeUp">
            <div>
              <span className="fx-eyebrow mb-5">Trade Example</span>
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mt-5">
                How <span className="gradient-text">a Trade Works</span>
              </h2>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <p className="text-base md:text-lg" style={{ color: 'var(--fx-text-2)' }}>
              Walk through a real scenario. Change the numbers — every cost shows up before you'd ever click execute.
            </p>
          </ScrollReveal>
        </div>

        <ScrollReveal variant="fadeUp">
          <div className="fx-tile mt-12 md:mt-16 max-w-4xl mx-auto">
            {/* Header */}
            <div
              className="flex items-center justify-between px-6 md:px-7 py-4"
              style={{
                borderBottom: '1px solid var(--fx-line)',
                background: 'rgba(214,169,61,0.04)',
              }}
            >
              <div className="flex items-center gap-3">
                <div className="feature-icon" style={{ width: 40, height: 40 }}>
                  <Calculator size={18} />
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--fx-text-3)' }}>
                    Cost Calculator
                  </div>
                  <div className="text-sm font-bold text-white">Pre-execution view</div>
                </div>
              </div>
              <span
                className="text-[10px] font-bold uppercase tracking-[0.22em] hidden sm:inline"
                style={{ color: 'var(--fx-gold-light)' }}
              >
                Demo
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-0">
              {/* INPUTS */}
              <div
                className="lg:col-span-3 p-6 md:p-7 space-y-6"
                style={{ borderRight: '1px solid var(--fx-line)' }}
              >
                {/* Trade Size */}
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-[0.22em]" style={{ color: 'var(--fx-text-3)' }}>
                    Trade Size (USD)
                  </label>
                  <div
                    className="mt-2 flex items-center rounded-xl"
                    style={{
                      background: 'var(--fx-bg)',
                      border: '1px solid var(--fx-line-strong)',
                    }}
                  >
                    <span className="pl-4 pr-2 text-sm font-bold" style={{ color: 'var(--fx-gold-light)' }}>
                      $
                    </span>
                    <input
                      type="number"
                      min={100}
                      max={1000000}
                      step={100}
                      value={tradeSize}
                      onChange={(e) => setTradeSize(Math.max(100, Number(e.target.value) || 0))}
                      className="flex-1 bg-transparent py-3 text-base font-bold text-white outline-none"
                      autoComplete="off"
                      data-form-type="other"
                      data-lpignore="true"
                      data-1p-ignore
                      suppressHydrationWarning
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[500, 1000, 5000, 10000].map((v) => (
                      <button
                        key={v}
                        type="button"
                        suppressHydrationWarning
                        onClick={() => setTradeSize(v)}
                        className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
                        style={{
                          background:
                            tradeSize === v ? 'rgba(214,169,61,0.18)' : 'rgba(255,255,255,0.04)',
                          border:
                            tradeSize === v
                              ? '1px solid rgba(214,169,61,0.55)'
                              : '1px solid var(--fx-line-strong)',
                          color: tradeSize === v ? 'var(--fx-gold-light)' : 'var(--fx-text-2)',
                        }}
                      >
                        ${v.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Leverage */}
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold uppercase tracking-[0.22em]" style={{ color: 'var(--fx-text-3)' }}>
                      Leverage
                    </label>
                    <span className="text-sm font-bold gradient-text">{leverage}Ã—</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={20}
                    step={1}
                    value={leverage}
                    onChange={(e) => setLeverage(Number(e.target.value))}
                    className="mt-3 w-full accent-[#ecc657]"
                  />
                  <div className="mt-1 flex justify-between text-[10px]" style={{ color: 'var(--fx-text-3)' }}>
                    <span>1Ã—</span>
                    <span>10Ã—</span>
                    <span>20Ã—</span>
                  </div>
                </div>

                {/* Duration toggle */}
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-[0.22em]" style={{ color: 'var(--fx-text-3)' }}>
                    Duration
                  </label>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      suppressHydrationWarning
                      onClick={() => setOvernight(false)}
                      className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all"
                      style={{
                        background: !overnight
                          ? 'rgba(214,169,61,0.12)'
                          : 'rgba(255,255,255,0.03)',
                        border: !overnight
                          ? '1px solid rgba(214,169,61,0.45)'
                          : '1px solid var(--fx-line-strong)',
                        color: !overnight ? 'var(--fx-gold-light)' : 'var(--fx-text-2)',
                      }}
                    >
                      <Sun size={15} />
                      Same Day
                    </button>
                    <button
                      type="button"
                      suppressHydrationWarning
                      onClick={() => setOvernight(true)}
                      className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all"
                      style={{
                        background: overnight
                          ? 'rgba(248,113,113,0.10)'
                          : 'rgba(255,255,255,0.03)',
                        border: overnight
                          ? '1px solid rgba(248,113,113,0.45)'
                          : '1px solid var(--fx-line-strong)',
                        color: overnight ? '#f87171' : 'var(--fx-text-2)',
                      }}
                    >
                      <Moon size={15} />
                      Overnight
                    </button>
                  </div>
                </div>
              </div>

              {/* OUTPUTS */}
              <div className="lg:col-span-2 p-6 md:p-7 space-y-4" style={{ background: 'var(--fx-bg)' }}>
                <Row
                  label="Your Capital"
                  value={`$${fmt(ownCapital)}`}
                  sub={leverage > 1 ? `Borrowed $${fmt(borrowed)}` : 'No leverage used'}
                />
                <Row
                  icon={Receipt}
                  iconColor="#ecc657"
                  label="Brokerage"
                  value={`$${fmt(brokerage)}`}
                  sub="Applied on execution"
                />
                <Row
                  icon={Gauge}
                  iconColor={overnight ? '#f87171' : '#ecc657'}
                  label="Leverage Fee"
                  value={overnight ? `$${fmt(leverageFee)}` : '$0.00'}
                  sub={overnight ? 'Overnight rate applied' : 'Intraday — none'}
                  highlight={overnight}
                />
                <Row
                  icon={Activity}
                  iconColor="#ecc657"
                  label="Spread"
                  value="Market"
                  sub="Tightens with XP"
                />
                <div
                  className="mt-2 pt-4 flex items-center justify-between"
                  style={{ borderTop: '1px solid var(--fx-line)' }}
                >
                  <div className="flex items-center gap-2">
                    <TrendingUp size={16} style={{ color: 'var(--fx-gold-light)' }} />
                    <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--fx-text-3)' }}>
                      Total Known Cost
                    </span>
                  </div>
                  <span className="text-lg font-extrabold gradient-text">
                    ${fmt(brokerage + leverageFee)}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div
              className="px-6 md:px-7 py-4 text-xs text-center"
              style={{
                borderTop: '1px solid var(--fx-line)',
                background: 'rgba(214,169,61,0.04)',
                color: 'var(--fx-text-3)',
              }}
            >
              Indicative figures Â· Spread is market-driven, not a fixed cost Â· Profit and loss settle automatically
            </div>
          </div>
        </ScrollReveal>

        <ScrollReveal variant="fadeUp" delay={0.18}>
          <p
            className="mt-10 md:mt-12 text-center text-base md:text-lg italic max-w-2xl mx-auto"
            style={{ color: 'var(--fx-text-2)' }}
          >
            &ldquo;All costs are known before execution.&rdquo;
          </p>
        </ScrollReveal>
      </div>
    </section>
  )
}

function Row({ icon: Icon, iconColor, label, value, sub, highlight = false }) {
  return (
    <div
      className="flex items-center justify-between rounded-xl px-4 py-3"
      style={{
        background: highlight ? 'rgba(248,113,113,0.06)' : 'rgba(255,255,255,0.03)',
        border: highlight
          ? '1px solid rgba(248,113,113,0.30)'
          : '1px solid var(--fx-line-strong)',
      }}
    >
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{
              background: `${iconColor}1f`,
              border: `1px solid ${iconColor}55`,
            }}
          >
            <Icon size={14} style={{ color: iconColor }} />
          </div>
        )}
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--fx-text-3)' }}>
            {label}
          </div>
          <div className="text-[11px]" style={{ color: 'var(--fx-text-2)' }}>
            {sub}
          </div>
        </div>
      </div>
      <div className="text-base font-bold text-white shrink-0 ml-3">{value}</div>
    </div>
  )
}
