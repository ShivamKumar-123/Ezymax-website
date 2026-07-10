import { Coins, TrendingUp, Sparkles, Activity, ArrowRight } from 'lucide-react'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'
import CtFaqList from '@/landing/pages/copy-trading/CtFaqList'

const steps = [
  {
    icon: Coins,
    title: 'Stake Liquidity',
    desc: 'Commit capital to the protocol contract.',
  },
  {
    icon: TrendingUp,
    title: 'Earn Protocol Rewards',
    desc: 'Structured rewards accrue over time.',
  },
  {
    icon: Sparkles,
    title: 'Use Trading Bonus',
    desc: 'If on a locked plan, unlock equivalent trading capital.',
  },
  {
    icon: Activity,
    title: 'Earn From Trading',
    desc: 'Additional returns from trading activity.',
  },
]

const faq = [
  { q: 'Do I earn only from staking?', a: 'No. You can also earn from trading (if bonus is used).' },
]

export default function StExample() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg)' }}>
      <div className="fx-container">
        {/* ── Two-column intro ──────────────────────────────── */}
        <div className="fx-split-intro-center">
          <ScrollReveal variant="fadeUp">
            <div>
              <span className="fx-eyebrow mb-5">Earnings Example</span>
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mt-5">
                How It Works <span className="gradient-text">in Practice</span>
              </h2>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <p className="text-base md:text-lg" style={{ color: 'var(--fx-text-2)' }}>
              Multiple earning layers — staking + trading.
            </p>
          </ScrollReveal>
        </div>

        <div className="mt-12 md:mt-16 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 md:gap-5 items-stretch">
          {steps.map((s, i) => {
            const Icon = s.icon
            return (
              <ScrollReveal key={s.title} variant="fadeUp" delay={i * 0.05}>
                <div className="fx-stat-chart h-full p-6 md:p-7 flex flex-col">
                  <div className="fx-chart-curve" />
                  <div className="relative z-[1] flex items-center justify-between mb-4">
                    <div className="feature-icon" style={{ width: 44, height: 44 }}>
                      <Icon size={18} />
                    </div>
                    <span
                      className="text-[11px] font-bold uppercase tracking-[0.22em]"
                      style={{ color: 'var(--fx-gold-light)' }}
                    >
                      Step
                    </span>
                  </div>
                  <div className="relative z-[1] text-4xl font-bold gradient-text mb-3">
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <h3 className="relative z-[1] text-sm md:text-[15px] font-bold text-white mb-1.5">
                    {s.title}
                  </h3>
                  <p
                    className="relative z-[1] text-xs md:text-[13px] leading-relaxed mt-auto"
                    style={{ color: 'var(--fx-text-2)' }}
                  >
                    {s.desc}
                  </p>
                </div>
              </ScrollReveal>
            )
          })}
        </div>

        <ScrollReveal variant="fadeUp" delay={0.25}>
          <div className="fx-tile-gold mt-12 mx-auto max-w-3xl p-5 md:p-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 relative z-[1]">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(28,22,8,0.14)', border: '1px solid rgba(28,22,8,0.22)' }}
              >
                <Sparkles size={16} style={{ color: '#1c1608' }} />
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider" style={{ color: 'rgba(28,22,8,0.78)' }}>
                  Compounded Outcome
                </div>
                <div className="text-sm md:text-base font-bold" style={{ color: '#1c1608' }}>
                  Staking reward + trading return (bonus-driven)
                </div>
              </div>
            </div>
            <ArrowRight size={20} className="relative z-[1]" style={{ color: '#1c1608' }} />
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
