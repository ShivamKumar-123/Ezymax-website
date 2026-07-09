import { Coins, Gauge, CheckCircle2 } from 'lucide-react'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

const funded = ['No leverage exposure', 'Only brokerage applies', 'Lower risk profile']
const leveraged = [
  'Adjustable leverage',
  'Capital efficiency',
  'Leverage cost applies only when positions are held overnight',
]

export default function TxModes() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg-elev)' }}>
      <div className="fx-container">
        {/* ── Two-column intro ──────────────────────────────── */}
        <div className="fx-split-intro">
          <ScrollReveal variant="fadeUp">
            <div>
              <span className="fx-eyebrow mb-5">Trading Modes</span>
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mt-5">
                Flexible <span className="gradient-text">Trading Modes</span>
              </h2>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <p className="text-base md:text-lg" style={{ color: 'var(--fx-text-2)' }}>
              Two ways to trade — pick whichever fits how you want to handle risk. Same transparent rules apply to both.
            </p>
          </ScrollReveal>
        </div>

        {/* ── Bento: gold tile + dark tile + image tile ─────── */}
        <div className="fx-bento grid-cols-1 md:grid-cols-3 mt-10 md:mt-14 items-stretch">
          {/* Fully Funded — solid gold accent tile */}
          <ScrollReveal variant="fadeUp">
            <div className="fx-tile-gold h-full p-7 md:p-8 flex flex-col">
              <div
                className="relative z-[1] w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                style={{ background: 'rgba(28,22,8,0.14)', border: '1px solid rgba(28,22,8,0.22)' }}
              >
                <Coins size={22} style={{ color: '#1c1608' }} />
              </div>
              <span className="fx-accent-bar mb-4 relative z-[1]" />
              <h3 className="relative z-[1] text-2xl md:text-[26px] font-bold mb-3" style={{ color: '#1c1608' }}>
                Fully Funded Mode
              </h3>
              <p className="relative z-[1] text-base mb-6" style={{ color: 'rgba(28,22,8,0.78)' }}>
                Trade using only your available capital.
              </p>
              <ul className="relative z-[1] space-y-3 mt-auto">
                {funded.map((f) => (
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
              <div className="feature-icon mb-5" style={{ width: 48, height: 48 }}>
                <Gauge size={20} />
              </div>
              <span className="fx-accent-bar mb-4" />
              <h3 className="text-2xl md:text-[26px] font-bold text-white mb-3">
                Leveraged Mode
              </h3>
              <p className="text-base mb-6" style={{ color: 'var(--fx-text-2)' }}>
                Enhance your trading power using leverage.
              </p>
              <ul className="space-y-3 mt-auto">
                {leveraged.map((f) => (
                  <li key={f} className="flex items-center gap-3">
                    <CheckCircle2 size={18} style={{ color: 'var(--fx-gold-light)' }} />
                    <span className="text-sm md:text-[15px] text-white">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          </ScrollReveal>

          {/* Image tile */}
          <ScrollReveal variant="fadeUp" delay={0.16}>
            <div className="fx-tile-media h-full min-h-[280px]">
              <span className="fx-tile-media-label">Image</span>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  )
}
