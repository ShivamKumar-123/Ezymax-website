import { Award, Trophy, Gem, CheckCircle2, Info } from 'lucide-react'
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
        {/* ── Two-column intro ──────────────────────────────── */}
        <div className="fx-split-intro">
          <ScrollReveal variant="fadeUp">
            <div>
              <span className="fx-eyebrow mb-5">Locked Plans</span>
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mt-5">
                <span className="gradient-text">Long-Term</span> Staking Plans
              </h2>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <p className="text-base md:text-lg" style={{ color: 'var(--fx-text-2)' }}>
              Choose your commitment duration and unlock enhanced rewards.
            </p>
          </ScrollReveal>
        </div>

        <div className="mt-12 md:mt-16 grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6 items-stretch">
          {plans.map((p, i) => {
            const Icon = p.icon
            const gold = p.highlight
            return (
              <ScrollReveal key={p.label} variant="fadeUp" delay={i * 0.06}>
                <div className={`${gold ? 'fx-tile-gold' : 'fx-tile'} relative h-full p-7 md:p-8 flex flex-col`}>
                  {gold && (
                    <span
                      className="absolute top-4 right-4 z-[1] px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.18em]"
                      style={{
                        background: 'linear-gradient(180deg, #2a2210, #14100a)',
                        color: 'var(--fx-gold-light)',
                        boxShadow: '0 6px 16px -6px rgba(0,0,0,0.55)',
                      }}
                    >
                      Most Popular
                    </span>
                  )}
                  {gold ? (
                    <div
                      className="relative z-[1] w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                      style={{ background: 'rgba(28,22,8,0.14)', border: '1px solid rgba(28,22,8,0.22)' }}
                    >
                      <Icon size={20} style={{ color: '#1c1608' }} />
                    </div>
                  ) : (
                    <div className="feature-icon mb-5" style={{ width: 48, height: 48 }}>
                      <Icon size={20} />
                    </div>
                  )}
                  <span className="fx-accent-bar mb-4 relative z-[1]" />
                  <div
                    className="relative z-[1] text-[11px] uppercase tracking-wider mb-1"
                    style={{ color: gold ? 'rgba(28,22,8,0.7)' : 'var(--fx-text-3)' }}
                  >
                    {p.sub}
                  </div>
                  <h3
                    className="relative z-[1] text-xl md:text-2xl font-bold mb-4"
                    style={{ color: gold ? '#1c1608' : '#fff' }}
                  >
                    {p.label}
                  </h3>

                  <ul className="relative z-[1] space-y-2.5 mb-6 flex-1">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-center gap-2.5">
                        <CheckCircle2 size={15} style={{ color: gold ? '#1c1608' : 'var(--fx-gold-light)' }} />
                        <span className="text-sm" style={{ color: gold ? '#1c1608' : '#fff' }}>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <div
                    className="relative z-[1] rounded-xl px-3 py-2.5 text-xs"
                    style={{
                      background: gold ? 'rgba(28,22,8,0.10)' : 'rgba(255,255,255,0.03)',
                      border: gold ? '1px solid rgba(28,22,8,0.2)' : '1px solid var(--fx-line-strong)',
                      color: gold ? 'rgba(28,22,8,0.78)' : 'var(--fx-text-3)',
                    }}
                  >
                    Lock duration:{' '}
                    <span className="font-semibold" style={{ color: gold ? '#1c1608' : '#fff' }}>
                      {p.label.split(' ')[0]}
                    </span>
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
          <div className="fx-tile p-6 md:p-8 mt-8 max-w-3xl mx-auto">
            <CtFaqList items={faq} />
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}
