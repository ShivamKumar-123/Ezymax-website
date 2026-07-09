import { Receipt, Gauge, Activity, Ban, EyeOff, Moon } from 'lucide-react'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

const costs = [
  {
    icon: Receipt,
    title: 'Brokerage',
    sub: 'Trading Fee',
    desc: 'Applied when a trade is executed.',
    when: 'Per trade',
    gold: true,
  },
  {
    icon: Gauge,
    title: 'Leverage Fee',
    sub: 'Time-based',
    desc: 'Applies only if leverage is used AND the position is held overnight.',
    when: 'Conditional',
  },
  {
    icon: Activity,
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
        {/* ── Two-column intro ──────────────────────────────── */}
        <div className="fx-split-intro">
          <ScrollReveal variant="fadeUp">
            <div>
              <span className="fx-eyebrow mb-5">Cost Structure</span>
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mt-5">
                Clear and Structured <span className="gradient-text">Trading Costs</span>
              </h2>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <p className="text-base md:text-lg" style={{ color: 'var(--fx-text-2)' }}>
              We've boiled trading costs down to three pieces. No layered fees, no surprise line items at the end of the month.
            </p>
          </ScrollReveal>
        </div>

        {/* ── Bento: three cost tiles (one gold) ────────────── */}
        <div className="fx-bento grid-cols-1 md:grid-cols-3 mt-12 md:mt-16 items-stretch">
          {costs.map((c, i) => {
            const Icon = c.icon
            if (c.gold) {
              return (
                <ScrollReveal key={c.title} variant="fadeUp" delay={i * 0.06}>
                  <div className="fx-tile-gold h-full p-7 md:p-8 flex flex-col">
                    <div className="relative z-[1] flex items-center justify-between mb-5">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center"
                        style={{ background: 'rgba(28,22,8,0.14)', border: '1px solid rgba(28,22,8,0.22)' }}
                      >
                        <Icon size={20} style={{ color: '#1c1608' }} />
                      </div>
                      <span
                        className="text-[10px] font-bold uppercase tracking-[0.22em]"
                        style={{ color: '#1c1608' }}
                      >
                        {c.when}
                      </span>
                    </div>
                    <span className="fx-accent-bar mb-4 relative z-[1]" />
                    <div className="relative z-[1] text-[11px] uppercase tracking-wider mb-1" style={{ color: 'rgba(28,22,8,0.7)' }}>
                      {c.sub}
                    </div>
                    <h3 className="relative z-[1] text-xl md:text-2xl font-bold mb-3" style={{ color: '#1c1608' }}>{c.title}</h3>
                    <p className="relative z-[1] text-sm md:text-[15px]" style={{ color: 'rgba(28,22,8,0.78)' }}>
                      {c.desc}
                    </p>
                  </div>
                </ScrollReveal>
              )
            }
            return (
              <ScrollReveal key={c.title} variant="fadeUp" delay={i * 0.06}>
                <div className="fx-tile h-full p-7 md:p-8 flex flex-col">
                  <div className="flex items-center justify-between mb-5">
                    <div className="feature-icon" style={{ width: 48, height: 48 }}>
                      <Icon size={20} />
                    </div>
                    <span
                      className="text-[10px] font-bold uppercase tracking-[0.22em]"
                      style={{ color: 'var(--fx-gold-light)' }}
                    >
                      {c.when}
                    </span>
                  </div>
                  <span className="fx-accent-bar mb-4" />
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
                className="fx-tile p-4 flex items-center gap-3"
              >
                <div className="feature-icon shrink-0" style={{ width: 40, height: 40 }}>
                  <Icon size={18} />
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
