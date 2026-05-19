import { Shield, ShieldCheck, ShieldPlus, Crown, Info } from 'lucide-react'
import SectionHeader from '@/landing/components/SectionHeader'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

const tiers = [
  {
    icon: Shield,
    name: 'Basic',
    cover: 20,
    accent: '#4ade80',
    desc: 'Foundational cushion for occasional protection.',
  },
  {
    icon: ShieldCheck,
    name: 'Smart',
    cover: 30,
    accent: '#60a5fa',
    desc: 'Balanced coverage for regular trading activity.',
  },
  {
    icon: ShieldPlus,
    name: 'Advanced',
    cover: 40,
    accent: '#a78bfa',
    desc: 'Stronger protection for active traders.',
  },
  {
    icon: Crown,
    name: 'Pro',
    cover: 50,
    accent: '#ecc657',
    desc: 'Maximum coverage for serious participants.',
    highlight: true,
  },
]

export default function InCoverage() {
  return (
    <section id="coverage" className="fx-section" style={{ background: 'var(--fx-bg)' }}>
      <div className="fx-container">
        <SectionHeader
          badge="Coverage Levels"
          title="Choose Your Coverage Strength"
          highlight="Coverage Strength"
          subtitle="Coverage scales by tier — coverage is subject to internal limits and safeguards."
        />

        <div className="mt-12 md:mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6">
          {tiers.map((t, i) => {
            const Icon = t.icon
            return (
              <ScrollReveal key={t.name} variant="fadeUp" delay={i * 0.05}>
                <div
                  className="relative h-full rounded-2xl p-6 md:p-7 overflow-hidden flex flex-col"
                  style={{
                    background: t.highlight
                      ? 'linear-gradient(180deg, rgba(214,169,61,0.14) 0%, rgba(214,169,61,0.03) 60%), var(--fx-bg-elev)'
                      : 'linear-gradient(180deg, var(--fx-bg-elev) 0%, var(--fx-bg-elev-2) 100%)',
                    border: `1px solid ${t.accent}55`,
                    boxShadow: t.highlight ? '0 30px 70px -28px rgba(214,169,61,0.45)' : 'none',
                  }}
                >
                  <div
                    className="absolute -top-px left-[18%] right-[18%] h-px"
                    style={{
                      background: `linear-gradient(90deg, transparent, ${t.accent}cc, transparent)`,
                    }}
                  />
                  <div className="flex items-center justify-between mb-5">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ background: `${t.accent}1f`, border: `1px solid ${t.accent}55` }}
                    >
                      <Icon size={20} style={{ color: t.accent }} />
                    </div>
                    <span
                      className="text-[10px] font-bold uppercase tracking-[0.22em]"
                      style={{ color: t.accent }}
                    >
                      Tier
                    </span>
                  </div>

                  <div className="text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--fx-text-3)' }}>
                    {t.name}
                  </div>
                  <div className="text-4xl md:text-5xl font-extrabold mb-2" style={{ color: t.highlight ? undefined : '#fff' }}>
                    {t.highlight ? (
                      <span className="gradient-text">Up to {t.cover}%</span>
                    ) : (
                      <span style={{ color: '#fff' }}>Up to {t.cover}%</span>
                    )}
                  </div>
                  <div className="text-[11px] uppercase tracking-wider mb-4" style={{ color: 'var(--fx-text-3)' }}>
                    Loss Coverage
                  </div>

                  <p className="text-xs md:text-[13px] leading-relaxed flex-1 mb-2" style={{ color: 'var(--fx-text-2)' }}>
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
