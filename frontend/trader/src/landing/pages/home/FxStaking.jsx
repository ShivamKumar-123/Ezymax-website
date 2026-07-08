import { Gem, TrendingUp, Activity, CheckCircle2 } from 'lucide-react'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

const benefits = [
  'Structured earning opportunities',
  'Additional trading utility',
  'Participation in ecosystem growth',
]

const flow = [
  { icon: Gem, label: 'Step 1', title: 'Stake' },
  { icon: TrendingUp, label: 'Step 2', title: 'Earn' },
  { icon: Activity, label: 'Step 3', title: 'Trade with Utility', highlight: true },
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
              Put the assets you're already holding to work inside the ecosystem — without forcing you to choose between earning and being able to trade.
            </p>
          </ScrollReveal>
        </div>

        {/* ── Bento: step tile + gold content tile + image tile ─ */}
        <div className="fx-bento grid-cols-1 md:grid-cols-2 lg:grid-cols-3 mt-10 md:mt-14 items-stretch">
          {/* Step flow — modern vertical timeline */}
          <ScrollReveal variant="fadeUp">
            <div className="fx-tile h-full p-7 md:p-8 flex flex-col">
              <span className="fx-accent-bar mb-4" />
              <h3 className="text-xl md:text-2xl font-bold text-white mb-7">
                Stake &rarr; Earn &rarr; Trade with Utility
              </h3>

              <div className="relative">
                {/* vertical gradient rail running through the numbered nodes */}
                <span
                  aria-hidden
                  className="absolute left-[23px] top-[24px] bottom-[24px] w-[3px] rounded-full"
                  style={{
                    background:
                      'linear-gradient(180deg, var(--fx-gold-light) 0%, var(--fx-gold) 52%, var(--fx-gold-dark) 100%)',
                    boxShadow: '0 0 16px rgba(214,169,61,0.4)',
                  }}
                />
                <ul className="relative space-y-6 md:space-y-7">
                  {flow.map((s, i) => (
                    <li key={s.title} className="relative flex items-start gap-5">
                      {s.highlight ? (
                        <div
                          className="shrink-0 flex items-center justify-center rounded-full text-base font-extrabold"
                          style={{
                            width: 48,
                            height: 48,
                            background:
                              'linear-gradient(180deg, #fbeaa8 0%, #ecc657 55%, #b6842a 100%)',
                            color: '#1c1608',
                            border: '1px solid rgba(255,255,255,0.3)',
                            boxShadow:
                              '0 0 0 5px rgba(214,169,61,0.14), 0 14px 30px -10px rgba(214,169,61,0.6)',
                          }}
                        >
                          {i + 1}
                        </div>
                      ) : (
                        <div className="fx-icon-badge shrink-0" style={{ width: 48, height: 48 }}>
                          <span className="text-base font-bold" style={{ color: 'var(--fx-gold-light)' }}>
                            {i + 1}
                          </span>
                        </div>
                      )}
                      <div className="pt-1.5">
                        <div
                          className="text-[11px] font-bold uppercase tracking-[0.22em] mb-1.5"
                          style={{ color: 'var(--fx-gold-light)' }}
                        >
                          {s.label}
                        </div>
                        <div className="text-base md:text-lg font-bold text-white leading-snug">
                          {s.title}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
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
                in ecosystem growth — all from assets that would otherwise sit idle.
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

          {/* Image tile */}
          <ScrollReveal variant="fadeUp" delay={0.16}>
            <div className="fx-tile-media h-full min-h-[280px] md:col-span-2 lg:col-span-1">
              <img
                src="/images/hero_card3.png"
                alt="Stake, earn, and trade with utility across the FX Artha ecosystem"
                className="absolute inset-0 w-full h-full object-cover"
              />
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
