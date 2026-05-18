import { Receipt, Gauge, Activity } from 'lucide-react'
import SectionHeader from '@/landing/components/SectionHeader'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

const costs = [
  {
    icon: Receipt,
    accent: '#ecc657',
    title: 'Brokerage',
    sub: 'Trading Fee',
    desc: 'Applied when a trade is executed.',
    when: 'Per trade',
  },
  {
    icon: Gauge,
    accent: '#60a5fa',
    title: 'Leverage Fee',
    sub: 'Time-based',
    desc: 'Applies only if leverage is used AND the position is held overnight.',
    when: 'Conditional',
  },
  {
    icon: Activity,
    accent: '#a78bfa',
    title: 'Market Spread',
    sub: 'Execution',
    desc: 'Natural part of market pricing — never artificially inflated. Tightens as you progress.',
    when: 'Market-driven',
  },
]

export default function TxCostStructure() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg-elev)' }}>
      <div className="fx-container">
        <SectionHeader
          badge="Cost Structure"
          title="Clear and Structured Trading Costs"
          highlight="Trading Costs"
          subtitle="Three transparent components — nothing more."
        />

        <div className="mt-12 md:mt-16 grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
          {costs.map((c, i) => {
            const Icon = c.icon
            return (
              <ScrollReveal key={c.title} variant="fadeUp" delay={i * 0.06}>
                <div
                  className="relative h-full rounded-2xl p-6 md:p-7 overflow-hidden"
                  style={{
                    background:
                      'linear-gradient(180deg, var(--fx-bg-elev-2) 0%, var(--fx-bg) 100%)',
                    border: `1px solid ${c.accent}40`,
                  }}
                >
                  <div
                    className="absolute -top-px left-[18%] right-[18%] h-px"
                    style={{
                      background: `linear-gradient(90deg, transparent, ${c.accent}cc, transparent)`,
                    }}
                  />
                  <div className="flex items-center justify-between mb-5">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ background: `${c.accent}1f`, border: `1px solid ${c.accent}55` }}
                    >
                      <Icon size={20} style={{ color: c.accent }} />
                    </div>
                    <span
                      className="text-[10px] font-bold uppercase tracking-[0.22em]"
                      style={{ color: c.accent }}
                    >
                      {c.when}
                    </span>
                  </div>
                  <div className="text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--fx-text-3)' }}>
                    {c.sub}
                  </div>
                  <h3 className="text-xl md:text-2xl font-bold text-white mb-3">{c.title}</h3>
                  <p className="text-sm md:text-[15px]" style={{ color: 'var(--fx-text-2)' }}>
                    {c.desc}
                  </p>
                </div>
              </ScrollReveal>
            )
          })}
        </div>

        <ScrollReveal variant="fadeUp" delay={0.25}>
          <p
            className="mt-10 text-center text-base md:text-lg font-semibold"
            style={{ color: 'var(--fx-gold-light)' }}
          >
            “No hidden layers. Just transparent trading economics.”
          </p>
        </ScrollReveal>
      </div>
    </section>
  )
}
