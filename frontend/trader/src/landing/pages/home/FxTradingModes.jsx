import { Coins, Gauge, CheckCircle2, Sparkles } from 'lucide-react'
import SectionHeader from '@/landing/components/SectionHeader'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

const fundedFeatures = [
  'No borrowing',
  'No overnight costs',
  'Clear risk exposure',
]

const leveragedFeatures = [
  'Adjustable leverage',
  'Optimized capital usage',
  'Transparent cost on leveraged exposure',
]

export default function FxTradingModes() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg)' }}>
      <div className="fx-container">
        <SectionHeader
          badge="Trading Modes"
          title="Flexible Trading Built Around Your Strategy"
          highlight="Your Strategy"
          subtitle="Pick the mode that matches your risk profile — switch any time."
        />

        <div className="mt-12 md:mt-16 grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          {/* ── Fully Funded ─────────────────────────────────── */}
          <ScrollReveal variant="fadeUp">
            <div
              className="relative h-full rounded-2xl overflow-hidden p-8 md:p-9"
              style={{
                background:
                  'linear-gradient(180deg, rgba(74,222,128,0.10) 0%, rgba(74,222,128,0.02) 60%), var(--fx-bg-elev)',
                border: '1px solid rgba(74,222,128,0.30)',
              }}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{
                      background: 'rgba(74,222,128,0.18)',
                      border: '1px solid rgba(74,222,128,0.4)',
                    }}
                  >
                    <Coins size={22} style={{ color: '#4ade80' }} />
                  </div>
                  <h3 className="text-2xl md:text-[26px] font-bold text-white">
                    Fully Funded Trading
                  </h3>
                </div>
                <span
                  className="px-3 py-1.5 rounded-full text-[11px] font-bold tracking-wider uppercase"
                  style={{
                    background: 'rgba(74,222,128,0.15)',
                    color: '#4ade80',
                    border: '1px solid rgba(74,222,128,0.35)',
                  }}
                >
                  Safer Approach
                </span>
              </div>

              <p className="text-base mb-6" style={{ color: 'var(--fx-text-2)' }}>
                Trade using your available capital without leverage.
              </p>

              <ul className="space-y-3">
                {fundedFeatures.map((f) => (
                  <li key={f} className="flex items-center gap-3">
                    <CheckCircle2 size={18} style={{ color: '#4ade80' }} />
                    <span className="text-sm md:text-[15px] text-white">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          </ScrollReveal>

          {/* ── Leveraged ────────────────────────────────────── */}
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <div
              className="relative h-full rounded-2xl overflow-hidden p-8 md:p-9"
              style={{
                background:
                  'linear-gradient(180deg, rgba(96,165,250,0.10) 0%, rgba(96,165,250,0.02) 60%), var(--fx-bg-elev)',
                border: '1px solid rgba(96,165,250,0.30)',
              }}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{
                      background: 'rgba(96,165,250,0.18)',
                      border: '1px solid rgba(96,165,250,0.4)',
                    }}
                  >
                    <Gauge size={22} style={{ color: '#60a5fa' }} />
                  </div>
                  <h3 className="text-2xl md:text-[26px] font-bold text-white">
                    Leveraged Trading
                  </h3>
                </div>
                <span
                  className="px-3 py-1.5 rounded-full text-[11px] font-bold tracking-wider uppercase inline-flex items-center gap-1.5"
                  style={{
                    background: 'rgba(96,165,250,0.15)',
                    color: '#60a5fa',
                    border: '1px solid rgba(96,165,250,0.35)',
                  }}
                >
                  <Sparkles size={11} />
                  Advanced Mode
                </span>
              </div>

              <p className="text-base mb-6" style={{ color: 'var(--fx-text-2)' }}>
                Access larger positions using leverage based on your preference.
              </p>

              <ul className="space-y-3">
                {leveragedFeatures.map((f) => (
                  <li key={f} className="flex items-center gap-3">
                    <CheckCircle2 size={18} style={{ color: '#60a5fa' }} />
                    <span className="text-sm md:text-[15px] text-white">{f}</span>
                  </li>
                ))}
              </ul>

              <p
                className="mt-6 pt-5 text-xs italic"
                style={{ borderTop: '1px solid var(--fx-line)', color: 'var(--fx-text-3)' }}
              >
                Costs apply only when leverage is used.
              </p>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  )
}
