import { Shield, ShieldCheck, ShieldPlus, Crown, Info } from 'lucide-react'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

const tiers = [
  {
    icon: Shield,
    name: 'Basic',
    cover: 20,
    desc: 'Foundational cushion for occasional protection.',
  },
  {
    icon: ShieldCheck,
    name: 'Smart',
    cover: 30,
    desc: 'Balanced coverage for regular trading activity.',
  },
  {
    icon: ShieldPlus,
    name: 'Advanced',
    cover: 40,
    desc: 'Stronger protection for active traders.',
  },
  {
    icon: Crown,
    name: 'Pro',
    cover: 50,
    desc: 'Maximum coverage for serious participants.',
    highlight: true,
  },
]

export default function InCoverage() {
  return (
    <section id="coverage" className="fx-section" style={{ background: 'var(--fx-bg)' }}>
      <div className="fx-container">
        {/* ── Two-column intro ──────────────────────────────── */}
        <div className="fx-split-intro-center">
          <ScrollReveal variant="fadeUp">
            <div>
              <span className="fx-eyebrow mb-5">Coverage Levels</span>
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mt-5">
                Choose Your Coverage <span className="gradient-text">Strength</span>
              </h2>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <p className="text-base md:text-lg" style={{ color: 'var(--fx-text-2)' }}>
              Four levels, from a basic cushion to maximum cover. Pick what matches how active you are — and how much loss you'd rather not absorb yourself.
            </p>
          </ScrollReveal>
        </div>

        {/* ── Big-number coverage tiers ─────────────────────── */}
        <div className="mt-12 md:mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6 items-stretch">
          {tiers.map((t, i) => {
            const Icon = t.icon
            if (t.highlight) {
              return (
                <ScrollReveal key={t.name} variant="fadeUp" delay={i * 0.05}>
                  <div className="fx-tile-gold h-full p-6 md:p-7 flex flex-col">
                    <div
                      className="relative z-[1] w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                      style={{ background: 'rgba(28,22,8,0.14)', border: '1px solid rgba(28,22,8,0.22)' }}
                    >
                      <Icon size={20} style={{ color: '#1c1608' }} />
                    </div>
                    <span className="fx-accent-bar mb-4 relative z-[1]" />
                    <div className="relative z-[1] text-[11px] uppercase tracking-wider mb-1" style={{ color: 'rgba(28,22,8,0.7)' }}>
                      {t.name}
                    </div>
                    <div className="relative z-[1] text-4xl md:text-5xl font-extrabold mb-2" style={{ color: '#1c1608' }}>
                      Up to {t.cover}%
                    </div>
                    <div className="relative z-[1] text-[11px] uppercase tracking-wider mb-4" style={{ color: 'rgba(28,22,8,0.7)' }}>
                      Loss Coverage
                    </div>
                    <p className="relative z-[1] text-xs md:text-[13px] leading-relaxed" style={{ color: 'rgba(28,22,8,0.78)' }}>
                      {t.desc}
                    </p>
                  </div>
                </ScrollReveal>
              )
            }
            return (
              <ScrollReveal key={t.name} variant="fadeUp" delay={i * 0.05}>
                <div className="fx-stat-chart h-full p-6 md:p-7 flex flex-col">
                  <div className="fx-chart-curve" />
                  <div className="relative z-[1] flex items-center justify-between mb-5">
                    <div className="feature-icon" style={{ width: 48, height: 48 }}>
                      <Icon size={20} />
                    </div>
                    <span
                      className="text-[10px] font-bold uppercase tracking-[0.22em]"
                      style={{ color: 'var(--fx-gold-light)' }}
                    >
                      Tier
                    </span>
                  </div>

                  <div className="relative z-[1] text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--fx-text-3)' }}>
                    {t.name}
                  </div>
                  <div className="relative z-[1] text-4xl md:text-5xl font-extrabold mb-2 gradient-text">
                    Up to {t.cover}%
                  </div>
                  <div className="relative z-[1] text-[11px] uppercase tracking-wider mb-4" style={{ color: 'var(--fx-text-3)' }}>
                    Loss Coverage
                  </div>

                  <p className="relative z-[1] text-xs md:text-[13px] leading-relaxed" style={{ color: 'var(--fx-text-2)' }}>
                    {t.desc}
                  </p>
                </div>
              </ScrollReveal>
            )
          })}
        </div>

        <ScrollReveal variant="fadeUp" delay={0.25}>
          <div
            className="mt-8 mx-auto max-w-3xl rounded-xl px-4 py-3 text-sm flex items-center gap-3"
            style={{
              background: 'rgba(214,169,61,0.05)',
              border: '1px solid rgba(214,169,61,0.22)',
              color: 'var(--fx-text-2)',
            }}
          >
            <Info size={16} style={{ color: 'var(--fx-gold-light)' }} className="shrink-0" />
            Coverage is subject to internal limits and safeguards. Terms &amp; conditions apply.
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}
