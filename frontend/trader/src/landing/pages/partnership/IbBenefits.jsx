import { Lock, Sparkles, Globe2, BarChart3, Coins, Handshake } from 'lucide-react'
import SectionHeader from '@/landing/components/SectionHeader'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

const benefits = [
  {
    icon: Lock,
    accent: '#ecc657',
    title: 'Smart Contract-Based Infrastructure',
    desc: 'User funds operate through protocol-based settlement.',
  },
  {
    icon: Sparkles,
    accent: '#a78bfa',
    title: 'Modern Trading Ecosystem',
    desc: 'Gamification, copy trading, staking, insurance, and rewards.',
  },
  {
    icon: Globe2,
    accent: '#60a5fa',
    title: 'Global Growth Opportunity',
    desc: 'Built for modern retail and Web3-native traders.',
  },
  {
    icon: BarChart3,
    accent: '#4ade80',
    title: 'Advanced Partner Dashboard',
    desc: 'Track users, trading activity, and performance analytics.',
  },
  {
    icon: Coins,
    accent: '#ecc657',
    title: 'Performance-Based Rewards',
    desc: 'Earnings aligned with ecosystem activity.',
  },
  {
    icon: Handshake,
    accent: '#f59e0b',
    title: 'Long-Term Partnership Model',
    desc: 'Built for scalability and retention.',
  },
]

export default function IbBenefits() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg)' }}>
      <div className="fx-container">
        <SectionHeader
          badge="Why FX Artha"
          title="Why IBs Choose FX Artha"
          highlight="FX Artha"
          subtitle="The honest reasons people send their audience here instead of somewhere else."
        />

        <div className="mt-12 md:mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
          {benefits.map((b, i) => {
            const Icon = b.icon
            return (
              <ScrollReveal key={b.title} variant="fadeUp" delay={i * 0.05}>
                <div className="glass-card h-full p-6 md:p-7">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                    style={{ background: `${b.accent}1f`, border: `1px solid ${b.accent}55` }}
                  >
                    <Icon size={20} style={{ color: b.accent }} />
                  </div>
                  <h3 className="text-base md:text-lg font-bold text-white mb-2 leading-tight">{b.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--fx-text-2)' }}>
                    {b.desc}
                  </p>
                </div>
              </ScrollReveal>
            )
          })}
        </div>

      </div>
    </section>
  )
}
