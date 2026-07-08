import { CheckCircle2 } from 'lucide-react'
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
        {/* ── Two-column intro ──────────────────────────────── */}
        <div className="fx-split-intro">
          <ScrollReveal variant="fadeUp">
            <div>
              <span className="fx-eyebrow mb-5">Trading Modes</span>
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mt-5">
                Flexible Trading Built Around <span className="gradient-text">Your Strategy</span>
              </h2>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <p className="text-base md:text-lg" style={{ color: 'var(--fx-text-2)' }}>
              Two ways to trade. Same platform, same fair rules — pick whichever matches how much risk you're willing to carry today.
            </p>
          </ScrollReveal>
        </div>

        {/* ── Bento: gold tile + dark tile + image tile ─────── */}
        <div className="fx-bento grid-cols-1 md:grid-cols-3 mt-10 md:mt-14 items-stretch">
          {/* Fully Funded — solid gold accent tile */}
          <ScrollReveal variant="fadeUp">
            <div className="fx-tile-gold h-full p-7 md:p-8 flex flex-col">
              <span className="fx-accent-bar mb-4 relative z-[1]" />
              <h3 className="relative z-[1] text-2xl md:text-[26px] font-bold mb-3" style={{ color: '#1c1608' }}>
                Fully Funded Trading
              </h3>
              <p className="relative z-[1] text-base mb-6" style={{ color: 'rgba(28,22,8,0.78)' }}>
                Trade using your available capital without leverage.
              </p>
              <ul className="relative z-[1] space-y-3 mt-auto">
                {fundedFeatures.map((f) => (
                  <li key={f} className="flex items-center gap-3">
                    <CheckCircle2 size={18} style={{ color: '#1c1608' }} />
                    <span className="text-sm md:text-[15px] font-medium" style={{ color: '#1c1608' }}>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          </ScrollReveal>

          {/* Leveraged — dark tile with gold accent bar */}
          <ScrollReveal variant="fadeUp" delay={0.08}>
            <div className="fx-tile h-full p-7 md:p-8 flex flex-col">
              <span className="fx-accent-bar mb-4" />
              <h3 className="text-2xl md:text-[26px] font-bold text-white mb-3">
                Leveraged Trading
              </h3>
              <p className="text-base mb-6" style={{ color: 'var(--fx-text-2)' }}>
                Access larger positions using leverage based on your preference.
              </p>
              <ul className="space-y-3">
                {leveragedFeatures.map((f) => (
                  <li key={f} className="flex items-center gap-3">
                    <CheckCircle2 size={18} style={{ color: 'var(--fx-gold-light)' }} />
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

          {/* Image tile */}
          <ScrollReveal variant="fadeUp" delay={0.16}>
            <div className="fx-tile h-full min-h-[300px] overflow-hidden">
              <img
                src="/images/hero_card1.png"
                alt="Flexible trading"
                className="h-full w-full object-cover"
              />
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  )
}
