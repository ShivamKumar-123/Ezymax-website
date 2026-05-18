import { Zap, TrendingDown, ArrowDownRight, CheckCircle2 } from 'lucide-react'
import SectionHeader from '@/landing/components/SectionHeader'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

const improvements = [
  { label: 'Brokerage fees', drop: '↓' },
  { label: 'Leverage fees', drop: '↓' },
  { label: 'Market spread', drop: '↓' },
]

export default function TxXP() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg)' }}>
      <div className="fx-container">
        <SectionHeader
          badge="XP Progression"
          title="Your Activity Unlocks Better Conditions"
          highlight="Better Conditions"
          subtitle="FX Artha replaces account tiers with a dynamic XP-based progression. Every trade contributes to your growth."
        />

        <div className="mt-12 md:mt-16 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-stretch">
          {/* LEFT — copy */}
          <ScrollReveal variant="fadeUp">
            <div
              className="h-full rounded-2xl p-7 md:p-8"
              style={{
                background:
                  'linear-gradient(180deg, var(--fx-bg-elev-2) 0%, var(--fx-bg-elev) 100%)',
                border: '1px solid var(--fx-line-strong)',
              }}
            >
              <div className="feature-icon mb-5">
                <Zap size={20} />
              </div>
              <h3 className="text-2xl md:text-[28px] font-bold text-white mb-4 leading-tight">
                The more you trade, the more efficient your trading becomes.
              </h3>
              <p className="text-base mb-6" style={{ color: 'var(--fx-text-2)' }}>
                XP isn&apos;t cosmetic. It directly improves your live trading conditions across all three
                cost components.
              </p>
              <ul className="space-y-3">
                {improvements.map((i) => (
                  <li
                    key={i.label}
                    className="flex items-center justify-between rounded-xl px-4 py-3"
                    style={{
                      background: 'rgba(214,169,61,0.05)',
                      border: '1px solid rgba(214,169,61,0.22)',
                    }}
                  >
                    <span className="flex items-center gap-3">
                      <CheckCircle2 size={18} style={{ color: 'var(--fx-gold-light)' }} />
                      <span className="text-sm md:text-[15px] text-white">{i.label}</span>
                    </span>
                    <span
                      className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider"
                      style={{ color: '#4ade80' }}
                    >
                      <ArrowDownRight size={13} /> Gradually lower
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </ScrollReveal>

          {/* RIGHT — XP visual */}
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <div
              className="relative h-full rounded-2xl p-7 md:p-8 overflow-hidden"
              style={{
                background:
                  'linear-gradient(160deg, rgba(167,139,250,0.06) 0%, var(--fx-bg-elev-2) 60%)',
                border: '1px solid rgba(167,139,250,0.30)',
              }}
            >
              <div className="absolute inset-0 fx-grid-bg" />
              <div className="relative">
                <div className="text-[11px] font-bold uppercase tracking-[0.22em] mb-6" style={{ color: '#a78bfa' }}>
                  XP Progression
                </div>

                {/* XP Bar */}
                <div className="mb-7">
                  <div className="flex items-center justify-between mb-2 text-xs">
                    <span style={{ color: 'var(--fx-text-3)' }}>Trader XP</span>
                    <span className="font-bold text-white">Level 4 · 6,840 XP</span>
                  </div>
                  <div className="h-3 w-full rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: '68%',
                        background: 'linear-gradient(90deg, #a78bfa, #ecc657)',
                        boxShadow: '0 0 14px rgba(167,139,250,0.5)',
                      }}
                    />
                  </div>
                </div>

                {/* Fee declining graph */}
                <div className="mb-5">
                  <div className="flex items-center justify-between mb-2 text-xs">
                    <span style={{ color: 'var(--fx-text-3)' }}>Effective Cost</span>
                    <span className="inline-flex items-center gap-1 font-semibold" style={{ color: '#4ade80' }}>
                      <TrendingDown size={12} /> Lower over time
                    </span>
                  </div>
                  <svg viewBox="0 0 280 80" className="w-full h-20" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="txXpDown" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(74,222,128,0.40)" />
                        <stop offset="100%" stopColor="rgba(74,222,128,0)" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M0,10 L40,18 L80,28 L120,38 L160,46 L200,54 L240,62 L280,68 L280,80 L0,80 Z"
                      fill="url(#txXpDown)"
                    />
                    <path
                      d="M0,10 L40,18 L80,28 L120,38 L160,46 L200,54 L240,62 L280,68"
                      fill="none"
                      stroke="#4ade80"
                      strokeWidth="1.75"
                    />
                  </svg>
                </div>

                {/* Spread indicator */}
                <div
                  className="rounded-xl p-4"
                  style={{
                    background: 'rgba(167,139,250,0.08)',
                    border: '1px solid rgba(167,139,250,0.30)',
                  }}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span style={{ color: 'var(--fx-text-3)' }}>Spread (relative)</span>
                    <span className="font-bold inline-flex items-center gap-1" style={{ color: '#a78bfa' }}>
                      <ArrowDownRight size={12} /> Tightening
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-5 gap-1">
                    {[100, 86, 72, 60, 48].map((w, i) => (
                      <div
                        key={i}
                        className="h-2 rounded-full"
                        style={{
                          background: `linear-gradient(90deg, #a78bfa, #ecc657)`,
                          opacity: 0.35 + i * 0.16,
                          width: `${w}%`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  )
}
