import { Coins, TrendingUp, Sparkles, Activity, ArrowRight } from 'lucide-react'
import SectionHeader from '@/landing/components/SectionHeader'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'
import CtFaqList from '@/landing/pages/copy-trading/CtFaqList'

const steps = [
  {
    icon: Coins,
    accent: '#ecc657',
    title: 'Stake Liquidity',
    desc: 'Commit capital to the protocol contract.',
  },
  {
    icon: TrendingUp,
    accent: '#a78bfa',
    title: 'Earn Protocol Rewards',
    desc: 'Structured rewards accrue over time.',
  },
  {
    icon: Sparkles,
    accent: '#60a5fa',
    title: 'Use Trading Bonus',
    desc: 'If on a locked plan, unlock equivalent trading capital.',
  },
  {
    icon: Activity,
    accent: '#4ade80',
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
        <div className="fx-section-frame">
        <SectionHeader
          badge="Earnings Example"
          title="How It Works in Practice"
          highlight="in Practice"
          subtitle="Multiple earning layers — staking + trading."
        />
        <div className="mt-12 md:mt-16">
          <div className="relative grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-3">
            <div
              className="hidden md:block absolute top-[42px] left-[10%] right-[10%] h-px pointer-events-none"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(90deg, rgba(214,169,61,0.5) 0 6px, transparent 6px 14px)',
              }}
            />
            {steps.map((s, i) => {
              const Icon = s.icon
              return (
                <ScrollReveal key={s.title} variant="fadeUp" delay={i * 0.05}>
                  <div className="relative flex flex-col items-center text-center">
                    <div
                      className="relative w-[84px] h-[84px] rounded-2xl flex items-center justify-center mb-4"
                      style={{
                        background:
                          'linear-gradient(180deg, var(--fx-bg) 0%, var(--fx-bg-elev-2) 100%)',
                        border: `1px solid ${s.accent}55`,
                        boxShadow: `0 1px 0 rgba(255,255,255,0.06) inset, 0 12px 32px -16px ${s.accent}55`,
                      }}
                    >
                      <Icon size={26} style={{ color: s.accent }} />
                      <span
                        className="absolute -top-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{
                          background:
                            'linear-gradient(180deg, var(--fx-gold-light), var(--fx-gold))',
                          color: '#1a1408',
                          boxShadow: '0 6px 16px -6px rgba(214,169,61,0.55)',
                        }}
                      >
                        {i + 1}
                      </span>
                    </div>
                    <h3 className="text-sm md:text-[15px] font-bold text-white mb-1.5 px-1">
                      {s.title}
                    </h3>
                    <p
                      className="text-xs md:text-[13px] leading-relaxed px-1"
                      style={{ color: 'var(--fx-text-2)' }}
                    >
                      {s.desc}
                    </p>
                  </div>
                </ScrollReveal>
              )
            })}
          </div>
        </div>

        <ScrollReveal variant="fadeUp" delay={0.25}>
          <div
            className="mt-12 mx-auto max-w-3xl rounded-2xl p-5 md:p-6 flex flex-wrap items-center justify-between gap-4"
            style={{
              background:
                'linear-gradient(135deg, rgba(214,169,61,0.16) 0%, var(--fx-bg-elev-2) 60%)',
              border: '1px solid rgba(214,169,61,0.40)',
              boxShadow: '0 24px 60px -28px rgba(214,169,61,0.35)',
            }}
          >
            <div className="flex items-center gap-3">
              <div className="feature-icon" style={{ width: 40, height: 40 }}>
                <Sparkles size={16} />
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--fx-gold-light)' }}>
                  Compounded Outcome
                </div>
                <div className="text-sm md:text-base font-bold text-white">
                  Staking reward + trading return (bonus-driven)
                </div>
              </div>
            </div>
            <ArrowRight size={20} style={{ color: 'var(--fx-gold-light)' }} />
          </div>
        </ScrollReveal>

        <ScrollReveal variant="fadeUp" delay={0.3}>
          <div className="mt-8 max-w-3xl mx-auto">
            <CtFaqList items={faq} />
          </div>
        </ScrollReveal>
        </div>
      </div>
    </section>
  )
}
