import { Receipt, Gauge, Activity, Ban, EyeOff, Moon } from 'lucide-react'
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

const guarantees = [
  { icon: Ban,    title: 'No Swap Charges',     sub: "We don't charge swap." },
  { icon: EyeOff, title: 'No Hidden Fees',      sub: 'Zero hidden costs.' },
  { icon: Moon,   title: 'No Overnight Penalty',sub: 'Only the fair leverage fee — nothing extra.' },
]

export default function TxCostStructure() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg-elev)' }}>
      <div className="fx-container">
        <SectionHeader
          badge="Cost Structure"
          title="Clear and Structured Trading Costs"
          highlight="Trading Costs"
          subtitle="We've boiled trading costs down to three pieces. No layered fees, no surprise line items at the end of the month."
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

        {/* No-X guarantees row */}
        <ScrollReveal variant="fadeUp" delay={0.2}>
          <div className="mt-6 md:mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            {guarantees.map(({ icon: Icon, title, sub }) => (
              <div
                key={title}
                className="rounded-xl p-4 flex items-center gap-3"
                style={{
                  background: 'rgba(74,222,128,0.04)',
                  border: '1px solid rgba(74,222,128,0.22)',
                }}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    background: 'rgba(74,222,128,0.12)',
                    border: '1px solid rgba(74,222,128,0.35)',
                  }}
                >
                  <Icon size={18} style={{ color: '#4ade80' }} />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-white leading-tight">{title}</div>
                  <div className="text-[11px] leading-tight mt-0.5" style={{ color: 'var(--fx-text-3)' }}>
                    {sub}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollReveal>

        <ScrollReveal variant="fadeUp" delay={0.28}>
          <p
            className="mt-10 md:mt-12 text-center text-base md:text-lg italic max-w-2xl mx-auto"
            style={{ color: 'var(--fx-text-2)' }}
          >
            &ldquo;No hidden layers. Just transparent trading economics.&rdquo;
          </p>
        </ScrollReveal>
      </div>
    </section>
  )
}
