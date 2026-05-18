'use client'

import { Link } from 'react-router-dom'
import { ArrowRight, Layers, TrendingDown, LineChart, Zap } from 'lucide-react'

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
      <div className="fx-container relative z-10 pt-28 md:pt-32 lg:pt-36 pb-20 md:pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* LEFT (60%) */}
          <div className="lg:col-span-7">
            <div className="fx-fade-up mb-5">
              <span className="badge">
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: 'var(--fx-gold)', boxShadow: '0 0 8px rgba(214,169,61,0.7)' }}
                />
                Trading on FX Artha
              </span>
            </div>
            <h1 className="fx-headline text-[40px] sm:text-[52px] md:text-[60px] lg:text-[68px] xl:text-[76px] fx-fade-up fx-fade-up-d1">
              Trade Smart. <br />
              <span className="fx-gold-text">Pay Less Over Time.</span>
            </h1>
            <p
              className="mt-6 max-w-xl text-base md:text-lg leading-relaxed fx-fade-up fx-fade-up-d2"
              style={{ color: 'var(--fx-text-2)' }}
            >
              A trading system where your costs improve as you grow — designed for clarity,
              fairness, and long-term efficiency.
            </p>
            <div className="mt-6 fx-fade-up fx-fade-up-d2">
              <span
                className="inline-block text-sm md:text-base font-semibold tracking-wide"
                style={{ color: 'var(--fx-gold-light)' }}
              >
                Transparent pricing. Performance-based benefits.
              </span>
            </div>
            <div className="mt-8 md:mt-10 flex flex-col sm:flex-row gap-3 sm:gap-4 fx-fade-up fx-fade-up-d3">
              <Link to="/auth/register" className="fx-btn-primary justify-center">
                Start Trading
                <ArrowRight size={18} />
              </Link>
              <Link to="#how-it-works" className="fx-btn-ghost justify-center">
                See How It Works
              </Link>
            </div>
          </div>

          {/* RIGHT (40%) — Trading dashboard mock with overlays */}
          <div className="lg:col-span-5 relative">
            <div className="relative h-[420px] sm:h-[480px] lg:h-[520px]">
              {/* Main dashboard panel */}
              <div
                className="absolute inset-x-0 top-0 glass-card p-5"
                style={{ animation: 'fxFloat 7s ease-in-out infinite' }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="feature-icon" style={{ width: 36, height: 36 }}>
                      <LineChart size={16} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">EUR / USD</div>
                      <div className="text-xs" style={{ color: 'var(--fx-text-3)' }}>
                        Live
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-white">1.08245</div>
                    <div className="text-xs font-semibold" style={{ color: '#4ade80' }}>
                      +0.34%
                    </div>
                  </div>
                </div>
                <svg viewBox="0 0 280 100" className="w-full h-24" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="txHeroSpark" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(214,169,61,0.45)" />
                      <stop offset="100%" stopColor="rgba(214,169,61,0)" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0,76 L24,64 L52,72 L82,46 L114,54 L144,32 L172,40 L204,22 L236,28 L264,14 L280,18 L280,100 L0,100 Z"
                    fill="url(#txHeroSpark)"
                  />
                  <path
                    d="M0,76 L24,64 L52,72 L82,46 L114,54 L144,32 L172,40 L204,22 L236,28 L264,14 L280,18"
                    fill="none"
                    stroke="#ecc657"
                    strokeWidth="1.75"
                  />
                </svg>

                {/* In-panel cost row */}
                <div
                  className="mt-3 pt-3 grid grid-cols-3 gap-2 text-center"
                  style={{ borderTop: '1px solid var(--fx-line)' }}
                >
                  {['Brokerage', 'Leverage', 'Spread'].map((c) => (
                    <div key={c}>
                      <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--fx-text-3)' }}>
                        {c}
                      </div>
                      <div className="text-xs font-semibold text-white">Known</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Overlay: 3 Cost System */}
              <div
                className="absolute left-0 top-[64%] w-[58%] glass-card p-4"
                style={{ animation: 'fxFloat 8s ease-in-out infinite 1.2s' }}
              >
                <div className="flex items-center gap-3">
                  <div className="feature-icon" style={{ width: 40, height: 40 }}>
                    <Layers size={18} />
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--fx-gold-light)' }}>
                      3-Cost System
                    </div>
                    <div className="text-sm font-bold text-white">Brokerage · Leverage · Spread</div>
                  </div>
                </div>
              </div>

              {/* Overlay: XP Growth */}
              <div
                className="absolute right-0 bottom-2 w-[52%] px-4 py-3 rounded-2xl"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(167,139,250,0.18), rgba(167,139,250,0.04))',
                  border: '1px solid rgba(167,139,250,0.4)',
                  boxShadow: '0 8px 30px -10px rgba(167,139,250,0.4)',
                  animation: 'fxFloat 6s ease-in-out infinite 0.4s',
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Zap size={16} style={{ color: '#a78bfa' }} />
                  <div className="text-[10px] uppercase tracking-wider" style={{ color: '#a78bfa' }}>
                    XP Growth
                  </div>
                </div>
                <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: '68%',
                      background: 'linear-gradient(90deg, #a78bfa, #ecc657)',
                      boxShadow: '0 0 12px rgba(167,139,250,0.5)',
                    }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px]">
                  <span style={{ color: 'var(--fx-text-3)' }}>Fees</span>
                  <span className="inline-flex items-center gap-1 font-semibold" style={{ color: '#4ade80' }}>
                    <TrendingDown size={11} /> Lower over time
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
