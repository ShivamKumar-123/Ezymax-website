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
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

const features = [
  {
    icon: Lock,
    title: 'Smart Contract-Based Infrastructure',
    desc: 'Protocol-powered systems designed around transparency and automated settlement.',
  },
  {
    icon: Zap,
    title: 'Modern Trading Experience',
    desc: 'Fast execution, streamlined trading, and flexible trading modes.',
  },
  {
    icon: ShieldCheck,
    title: 'Trade Insurance System',
    desc: 'Optional protection systems designed to support risk management.',
  },
  {
    icon: Gamepad2,
    title: 'Gamified Trading Ecosystem',
    desc: 'XP, rewards, tasks, and progression systems designed for engagement.',
  },
  {
    icon: Copy,
    title: 'Copy Trading Infrastructure',
    desc: 'Connect beginners with experienced traders through transparent performance systems.',
  },
  {
    icon: Gem,
    title: 'Liquidity & Staking Ecosystem',
    desc: 'Participate in protocol-based liquidity systems designed for long-term ecosystem growth.',
  },
  {
    icon: Globe2,
    title: 'Global Accessibility',
    desc: 'Designed for modern digital traders worldwide.',
  },
  {
    icon: Users,
    title: 'Community Growth Model',
    desc: 'Built around long-term ecosystem participation and network expansion.',
  },
]

export default function AbWhatMakes() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg-elev)' }}>
      <div className="fx-container">
        {/* ── Two-column intro ──────────────────────────────── */}
        <div className="fx-split-intro">
          <ScrollReveal variant="fadeUp">
            <div>
              <span className="fx-eyebrow mb-5">What Makes Us Different</span>
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mt-5">
                More Than a <span className="gradient-text">Trading Platform</span>
              </h2>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <p className="text-base md:text-lg" style={{ color: 'var(--fx-text-2)' }}>
              FX Artha combines multiple layers of innovation into one unified ecosystem — each piece exists because something in traditional platforms was missing or broken.
            </p>
          </ScrollReveal>
        </div>

        {/* ── Bento: one gold accent tile + dark fx-tile cards ─ */}
        <div className="fx-bento grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mt-12 md:mt-16 items-stretch">
          {features.map((f, i) => {
            const Icon = f.icon
            const isGold = i === 0
            return (
              <ScrollReveal key={f.title} variant="fadeUp" delay={i * 0.04}>
                {isGold ? (
                  <div className="fx-tile-gold h-full p-7 md:p-8 flex flex-col">
                    <div
                      className="relative z-[1] w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                      style={{ background: 'rgba(28,22,8,0.14)', border: '1px solid rgba(28,22,8,0.22)' }}
                    >
                      <Icon size={20} style={{ color: '#1c1608' }} />
                    </div>
                    <span className="fx-accent-bar mb-4 relative z-[1]" />
                    <h3 className="relative z-[1] text-base md:text-lg font-bold mb-2 leading-tight" style={{ color: '#1c1608' }}>
                      {f.title}
                    </h3>
                    <p className="relative z-[1] text-sm leading-relaxed" style={{ color: 'rgba(28,22,8,0.78)' }}>
                      {f.desc}
                    </p>
                  </div>
                ) : (
                  <div className="fx-tile h-full p-7 md:p-8 flex flex-col">
                    <div className="feature-icon mb-5" style={{ width: 48, height: 48 }}>
                      <Icon size={20} />
                    </div>
                    <span className="fx-accent-bar mb-4" />
                    <h3 className="text-base md:text-lg font-bold text-white mb-2 leading-tight">
                      {f.title}
                    </h3>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--fx-text-2)' }}>
                      {f.desc}
                    </p>
                  </div>
                )}
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
    </section>
  )
}
