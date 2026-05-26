import { Award, Trophy, Gem, CheckCircle2, Info } from 'lucide-react'
import SectionHeader from '@/landing/components/SectionHeader'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'
import CtFaqList from '@/landing/pages/copy-trading/CtFaqList'

const plans = [
  {
    icon: Award,
    label: '1 Year Plan',
    sub: 'Medium-term participation',
    features: [
      'Structured reward rate',
      'Eligible for trading bonus',
      'Balanced commitment',
    ],
    accent: 'rgba(214,169,61,0.50)',
    highlight: false,
  },
  {
    icon: Trophy,
    label: '2 Year Plan',
    sub: 'Higher commitment',
    features: [
      'Enhanced reward structure',
      'Higher ecosystem benefits',
      'Eligible for trading bonus',
    ],
    accent: 'rgba(214,169,61,0.85)',
    highlight: true,
  },
  {
    icon: Gem,
    label: '3 Year Plan',
    sub: 'Long-term participation',
    features: [
      'Maximum reward potential',
      'Full benefit access',
      'Eligible for trading bonus',
    ],
    accent: 'rgba(214,169,61,0.50)',
    highlight: false,
  },
]

const faq = [
  { q: 'Is APY fixed?', a: 'It is structured but may vary depending on protocol conditions.' },
]

export default function StPlans() {
  return (
    <section id="plans" className="fx-section" style={{ background: 'var(--fx-bg)' }}>
      <div className="fx-container">
        <SectionHeader
          badge="Locked Plans"
          title="Long-Term Staking Plans"
          highlight="Long-Term"
          subtitle="Choose your commitment duration and unlock enhanced rewards."
        />

        <div className="mt-12 md:mt-16 grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
          {plans.map((p, i) => {
            const Icon = p.icon
            return (
              <ScrollReveal key={p.label} variant="fadeUp" delay={i * 0.06}>
                <div
                  className="relative h-full rounded-2xl p-7 md:p-8 overflow-hidden flex flex-col"
                  style={{
                    background: p.highlight
                      ? 'linear-gradient(180deg, rgba(214,169,61,0.14) 0%, rgba(214,169,61,0.03) 60%), var(--fx-bg-elev)'
                      : 'linear-gradient(180deg, var(--fx-bg-elev) 0%, var(--fx-bg-elev-2) 100%)',
                    border: `1px solid ${p.accent}`,
                    boxShadow: p.highlight ? '0 30px 70px -28px rgba(214,169,61,0.45)' : 'none',
                  }}
                >
                  <div
                    className="absolute -top-px left-[18%] right-[18%] h-px"
                    style={{
                      background: `linear-gradient(90deg, transparent, ${p.accent}, transparent)`,
                    }}
                  />
                  {p.highlight && (
                    <span
                      className="absolute top-4 right-4 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.18em]"
                      style={{
                        background:
                          'linear-gradient(180deg, var(--fx-gold-light), var(--fx-gold))',
                        color: '#1a1408',
                        boxShadow: '0 6px 16px -6px rgba(214,169,61,0.55)',
                      }}
                    >
                      Most Popular
                    </span>
                  )}
                  <div className="feature-icon mb-5" style={{ width: 44, height: 44 }}>
                    <Icon size={20} />
                  </div>
                  <div className="text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--fx-text-3)' }}>
                    {p.sub}
                  </div>
                  <h3 className="text-xl md:text-2xl font-bold text-white mb-4">{p.label}</h3>

                  <ul className="space-y-2.5 mb-6 flex-1">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-center gap-2.5">
                        <CheckCircle2 size={15} style={{ color: 'var(--fx-gold-light)' }} />
                        <span className="text-sm text-white">{f}</span>
                      </li>
                    ))}
                  </ul>

                  <div
                    className="rounded-xl px-3 py-2.5 text-xs"
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--fx-line-strong)',
                      color: 'var(--fx-text-3)',
                    }}
                  >
                    Lock duration: <span className="text-white font-semibold">{p.label.split(' ')[0]}</span>
                  </div>
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
            Exact reward rates (APY) may vary based on protocol conditions.
          </div>
        </ScrollReveal>

        <ScrollReveal variant="fadeUp" delay={0.3}>
          <div className="mt-8 max-w-3xl mx-auto">
            <CtFaqList items={faq} />
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}
