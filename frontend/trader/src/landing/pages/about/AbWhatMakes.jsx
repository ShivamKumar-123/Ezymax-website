import {
  Lock,
  Zap,
  ShieldCheck,
  Gamepad2,
  Copy,
  Gem,
  Globe2,
  Users,
} from 'lucide-react'
import SectionHeader from '@/landing/components/SectionHeader'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

const features = [
  {
    icon: Lock,
    accent: '#ecc657',
    title: 'Smart Contract-Based Infrastructure',
    desc: 'Protocol-powered systems designed around transparency and automated settlement.',
  },
  {
    icon: Zap,
    accent: '#60a5fa',
    title: 'Modern Trading Experience',
    desc: 'Fast execution, streamlined trading, and flexible trading modes.',
  },
  {
    icon: ShieldCheck,
    accent: '#4ade80',
    title: 'Trade Insurance System',
    desc: 'Optional protection systems designed to support risk management.',
  },
  {
    icon: Gamepad2,
    accent: '#a78bfa',
    title: 'Gamified Trading Ecosystem',
    desc: 'XP, rewards, tasks, and progression systems designed for engagement.',
  },
  {
    icon: Copy,
    accent: '#ecc657',
    title: 'Copy Trading Infrastructure',
    desc: 'Connect beginners with experienced traders through transparent performance systems.',
  },
  {
    icon: Gem,
    accent: '#60a5fa',
    title: 'Liquidity & Staking Ecosystem',
    desc: 'Participate in protocol-based liquidity systems designed for long-term ecosystem growth.',
  },
  {
    icon: Globe2,
    accent: '#4ade80',
    title: 'Global Accessibility',
    desc: 'Designed for modern digital traders worldwide.',
  },
  {
    icon: Users,
    accent: '#f59e0b',
    title: 'Community Growth Model',
    desc: 'Built around long-term ecosystem participation and network expansion.',
  },
]

export default function AbWhatMakes() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg-elev)' }}>
      <div className="fx-container">
        <div className="fx-section-frame">
        <SectionHeader
          badge="What Makes Us Different"
          title="More Than a Trading Platform"
          highlight="Trading Platform"
          subtitle="FX Artha combines multiple layers of innovation into one unified ecosystem — each piece exists because something in traditional platforms was missing or broken."
        />
        <div className="mt-12 md:mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6">
          {features.map((f, i) => {
            const Icon = f.icon
            return (
              <ScrollReveal key={f.title} variant="fadeUp" delay={i * 0.04}>
                <div className="glass-card h-full p-6">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                    style={{ background: `${f.accent}1f`, border: `1px solid ${f.accent}55` }}
                  >
                    <Icon size={20} style={{ color: f.accent }} />
                  </div>
                  <h3 className="text-base md:text-lg font-bold text-white mb-2 leading-tight">
                    {f.title}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--fx-text-2)' }}>
                    {f.desc}
                  </p>
                </div>
              </ScrollReveal>
            )
          })}
        </div>

        <ScrollReveal variant="fadeUp" delay={0.3}>
          <p
            className="mt-10 md:mt-12 text-center text-base md:text-lg italic max-w-2xl mx-auto"
            style={{ color: 'var(--fx-text-2)' }}
          >
            &ldquo;FX Artha is designed as an ecosystem — not just a platform.&rdquo;
          </p>
        </ScrollReveal>
        </div>
      </div>
    </section>
  )
}
