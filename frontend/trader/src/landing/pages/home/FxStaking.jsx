import { Gem, ArrowRight, TrendingUp, Activity, CheckCircle2 } from 'lucide-react'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

const benefits = [
  'Structured earning opportunities',
  'Additional trading utility',
  'Participation in ecosystem growth',
]

export default function FxStaking() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg)' }}>
      <div className="fx-container">
        {/* ── Two-column intro ──────────────────────────────── */}
        <div className="fx-split-intro">
          <ScrollReveal variant="fadeUp">
            <div>
              <span className="fx-eyebrow mb-5">Staking</span>
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mt-5">
                Activate <span className="gradient-text">Idle Assets</span>
              </h2>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <p className="text-base md:text-lg" style={{ color: 'var(--fx-text-2)' }}>
              Put the assets you're already holding to work inside the ecosystem â€” without forcing you to choose between earning and being able to trade.
            </p>
          </ScrollReveal>
        </div>

        {/* ── Bento: step tile + gold content tile + image tile ─ */}
        <div className="fx-bento grid-cols-1 md:grid-cols-2 lg:grid-cols-3 mt-10 md:mt-14 items-stretch">
          {/* Step diagram — dark tile with gold accent bar */}
          <ScrollReveal variant="fadeUp">
            <div className="fx-tile h-full p-7 md:p-8 flex flex-col">
              <span className="fx-accent-bar mb-4" />
              <h3 className="text-xl md:text-2xl font-bold text-white mb-6">
                Stake &rarr; Earn &rarr; Trade with Utility
              </h3>

              <div className="grid grid-cols-3 gap-3 md:gap-4 items-center">
                {/* Stake */}
                <div
                  className="rounded-2xl p-4 md:p-5 text-center"
                  style={{
                    background: 'var(--fx-bg-elev)',
                    border: '1px solid rgba(214,169,61,0.28)',
                  }}
                >
                  <div className="feature-icon mx-auto mb-3" style={{ width: 44, height: 44 }}>
                    <Gem size={18} />
                  </div>
                  <div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--fx-text-3)' }}>
                    Step 1
                  </div>
                  <div className="text-sm md:text-base font-bold text-white">Stake</div>
                </div>

                <div className="flex justify-center" style={{ color: 'var(--fx-gold-light)' }}>
                  <ArrowRight size={20} />
                </div>

                {/* Earn */}
                <div
                  className="rounded-2xl p-4 md:p-5 text-center"
                  style={{
                    background: 'var(--fx-bg-elev)',
                    border: '1px solid rgba(214,169,61,0.28)',
                  }}
                >
                  <div className="feature-icon mx-auto mb-3" style={{ width: 44, height: 44 }}>
                    <TrendingUp size={18} />
                  </div>
                  <div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--fx-text-3)' }}>
                    Step 2
                  </div>
                  <div className="text-sm md:text-base font-bold text-white">Earn</div>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-3 gap-3 md:gap-4 items-center">
                <div></div>
                <div className="flex justify-center" style={{ color: 'var(--fx-gold-light)' }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 5v14M5 12l7 7 7-7"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div></div>
              </div>

              {/* Trade with Utility */}
              <div className="mt-2 flex justify-center">
                <div
                  className="rounded-2xl p-4 md:p-5 text-center w-full md:w-3/5"
                  style={{
                    background:
                      'linear-gradient(180deg, rgba(214,169,61,0.16), rgba(214,169,61,0.04))',
                    border: '1px solid rgba(214,169,61,0.45)',
                    boxShadow: '0 16px 40px -16px rgba(214,169,61,0.45)',
                  }}
                >
                  <div className="feature-icon mx-auto mb-3" style={{ width: 44, height: 44 }}>
                    <Activity size={18} />
                  </div>
                  <div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--fx-gold-light)' }}>
                    Step 3
                  </div>
                  <div className="text-sm md:text-base font-bold text-white">Trade with Utility</div>
                </div>
              </div>
            </div>
          </ScrollReveal>

          {/* Right content — solid gold accent tile */}
          <ScrollReveal variant="fadeUp" delay={0.08}>
            <div className="fx-tile-gold h-full p-7 md:p-8 flex flex-col">
              <span className="fx-accent-bar mb-4 relative z-[1]" />
              <h3 className="relative z-[1] text-2xl md:text-[28px] font-bold mb-4 leading-tight" style={{ color: '#1c1608' }}>
                Allocate your assets within the ecosystem to participate in platform activity.
              </h3>
              <p className="relative z-[1] text-base mb-6" style={{ color: 'rgba(28,22,8,0.78)' }}>
                Structured earning opportunities, trading utility, and direct participation
                in ecosystem growth â€” all from assets that would otherwise sit idle.
              </p>

              <ul className="relative z-[1] space-y-3 mb-6">
                {benefits.map((b) => (
                  <li key={b} className="flex items-start gap-3">
                    <CheckCircle2 size={18} className="mt-0.5" style={{ color: '#1c1608' }} />
                    <span className="text-sm md:text-[15px] font-medium" style={{ color: '#1c1608' }}>{b}</span>
                  </li>
                ))}
              </ul>

              <div
                className="relative z-[1] mt-auto rounded-xl p-4 text-xs md:text-sm italic"
                style={{
                  background: 'rgba(28,22,8,0.08)',
                  border: '1px solid rgba(28,22,8,0.2)',
                  color: 'rgba(28,22,8,0.82)',
                }}
              >
                Note: Returns and conditions vary based on duration and system dynamics.
              </div>
            </div>
          </ScrollReveal>

          {/* Image tile — empty space reserved for a real visual */}
          <ScrollReveal variant="fadeUp" delay={0.16}>
            <div className="fx-tile-media h-full min-h-[280px] md:col-span-2 lg:col-span-1">
              <span className="fx-tile-media-label">Image</span>
            </div>
          </ScrollReveal>
        </div>

        <ScrollReveal variant="fadeUp" delay={0.25}>
          <p
            className="mt-10 md:mt-12 text-center text-base md:text-lg italic max-w-2xl mx-auto"
            style={{ color: 'var(--fx-text-2)' }}
          >
            &ldquo;Make your assets work beyond holding.&rdquo;
          </p>
        </ScrollReveal>
      </div>
    </section>
  )
}
