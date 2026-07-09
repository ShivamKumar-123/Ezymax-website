import { Lock, Sparkles, Globe2, BarChart3, Coins, Handshake } from 'lucide-react'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

const benefits = [
  {
    icon: Lock,
    title: 'Smart Contract-Based Infrastructure',
    desc: 'User funds operate through protocol-based settlement.',
  },
  {
    icon: Sparkles,
    title: 'Modern Trading Ecosystem',
    desc: 'Gamification, copy trading, staking, insurance, and rewards.',
  },
  {
    icon: Globe2,
    title: 'Global Growth Opportunity',
    desc: 'Built for modern retail and Web3-native traders.',
  },
  {
    icon: BarChart3,
    title: 'Advanced Partner Dashboard',
    desc: 'Track users, trading activity, and performance analytics.',
  },
  {
    icon: Coins,
    title: 'Performance-Based Rewards',
    desc: 'Earnings aligned with ecosystem activity.',
  },
  {
    icon: Handshake,
    title: 'Long-Term Partnership Model',
    desc: 'Built for scalability and retention.',
  },
]

export default function IbBenefits() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg)' }}>
      <div className="fx-container">
        {/* ── Two-column intro ──────────────────────────────── */}
        <div className="fx-split-intro">
          <ScrollReveal variant="fadeUp">
            <div>
              <span className="fx-eyebrow mb-5">Why FX Artha</span>
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mt-5">
                Why IBs Choose <span className="gradient-text">FX Artha</span>
              </h2>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <p className="text-base md:text-lg" style={{ color: 'var(--fx-text-2)' }}>
              The honest reasons people send their audience here instead of somewhere else.
            </p>
          </ScrollReveal>
        </div>

        {/* ── Bento: dark tiles + one gold accent tile ──────── */}
        <div className="fx-bento grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 mt-10 md:mt-14 items-stretch">
          {benefits.map((b, i) => {
            const Icon = b.icon
            const isGold = i === 0
            if (isGold) {
              return (
                <ScrollReveal key={b.title} variant="fadeUp" delay={i * 0.05}>
                  <div className="fx-tile-gold h-full p-6 md:p-7 flex flex-col">
                    <div
                      className="relative z-[1] w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                      style={{ background: 'rgba(28,22,8,0.14)', border: '1px solid rgba(28,22,8,0.22)' }}
                    >
                      <Icon size={20} style={{ color: '#1c1608' }} />
                    </div>
                    <span className="fx-accent-bar mb-4 relative z-[1]" />
                    <h3 className="relative z-[1] text-base md:text-lg font-bold mb-2 leading-tight" style={{ color: '#1c1608' }}>
                      {b.title}
                    </h3>
                    <p className="relative z-[1] text-sm leading-relaxed" style={{ color: 'rgba(28,22,8,0.78)' }}>
                      {b.desc}
                    </p>
                  </div>
                </ScrollReveal>
              )
            }
            return (
              <ScrollReveal key={b.title} variant="fadeUp" delay={i * 0.05}>
                <div className="fx-tile h-full p-6 md:p-7 flex flex-col">
                  <div className="feature-icon mb-5" style={{ width: 48, height: 48 }}>
                    <Icon size={20} />
                  </div>
                  <span className="fx-accent-bar mb-4" />
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
