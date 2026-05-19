import { Activity, Clock, BarChart3 } from 'lucide-react'
import SectionHeader from '@/landing/components/SectionHeader'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'
import CtFaqList from '@/landing/pages/copy-trading/CtFaqList'

const factors = [
  {
    icon: BarChart3,
    accent: '#ecc657',
    title: 'Liquidity Contribution',
    desc: 'How much capital you provide to the protocol.',
  },
  {
    icon: Clock,
    accent: '#60a5fa',
    title: 'Duration of Staking',
    desc: 'Longer durations earn structured benefits.',
  },
  {
    icon: Activity,
    accent: '#a78bfa',
    title: 'Protocol Activity',
    desc: 'Ecosystem performance drives reward generation.',
  },
]

const faq = [
  { q: 'Are returns guaranteed?',       a: 'No. Rewards depend on protocol performance.' },
  { q: 'When are rewards credited?',    a: 'Based on the system cycle (defined in platform logic).' },
]

export default function StApy() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg-elev)' }}>
      <div className="fx-container">
        <SectionHeader
          badge="APY & Reward Logic"
          title="How Rewards Are Generated"
          highlight="Rewards Are Generated"
          subtitle="Rewards are participation-based, not guaranteed returns."
        />

        <div className="mt-12 md:mt-16 grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-5">
          {factors.map((f, i) => {
            const Icon = f.icon
            return (
              <ScrollReveal key={f.title} variant="fadeUp" delay={i * 0.05}>
                <div className="glass-card h-full p-5 md:p-6">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                    style={{ background: `${f.accent}1f`, border: `1px solid ${f.accent}55` }}
                  >
                    <Icon size={18} style={{ color: f.accent }} />
                  </div>
                  <h3 className="text-base font-bold text-white mb-1.5 leading-tight">
                    {f.title}
                  </h3>
                  <p className="text-xs md:text-[13px] leading-relaxed" style={{ color: 'var(--fx-text-2)' }}>
                    {f.desc}
                  </p>
                </div>
              </ScrollReveal>
            )
          })}
        </div>

        <ScrollReveal variant="fadeUp" delay={0.25}>
          <div className="mt-10 max-w-3xl mx-auto">
            <CtFaqList items={faq} />
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}
