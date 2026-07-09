import { TrendingUp, Bitcoin, Globe2, Briefcase, Copy, Users, Clock } from 'lucide-react'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

const personas = [
  { icon: TrendingUp, title: 'Forex Traders',                  desc: 'Active FX participants seeking transparent execution.' },
  { icon: Bitcoin,    title: 'Crypto Traders',                 desc: 'Digital-asset traders comfortable with protocol-based tools.' },
  { icon: Globe2,     title: 'Web3 Users',                     desc: 'Wallet-native users moving into market trading.' },
  { icon: Briefcase,  title: 'Professional Traders',           desc: 'Experienced operators needing modern infrastructure.' },
  { icon: Copy,       title: 'Copy Traders',                   desc: 'Users following verified strategies automatically.' },
  { icon: Users,      title: 'Community Builders',             desc: 'Educators and leaders growing trading audiences.' },
  { icon: Clock,      title: 'Long-Term Ecosystem Participants', desc: 'Members invested in the protocol over time.' },
]

export default function AbAudience() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg)' }}>
      <div className="fx-container">
        {/* ── Two-column intro ──────────────────────────────── */}
        <div className="fx-split-intro">
          <ScrollReveal variant="fadeUp">
            <div>
              <span className="fx-eyebrow mb-5">Who FX Artha Is For</span>
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mt-5">
                Built for Modern <span className="gradient-text">Digital Traders</span>
              </h2>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <p className="text-base md:text-lg" style={{ color: 'var(--fx-text-2)' }}>
              Whether you've been trading for years, are just starting out, or you're a community leader building an audience — FX Artha is built to feel right at home.
            </p>
          </ScrollReveal>
        </div>

        {/* ── Persona bento: dark tiles + one gold accent tile ── */}
        <div className="mt-12 md:mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 items-stretch">
          {personas.map((p, i) => {
            const Icon = p.icon
            const isGold = i === 0
            const isWide = i === 6
            return (
              <ScrollReveal
                key={p.title}
                variant="fadeUp"
                delay={i * 0.04}
                className={isWide ? 'sm:col-span-2 lg:col-span-1' : ''}
              >
                {isGold ? (
                  <div className="fx-tile-gold h-full p-6 md:p-7 flex flex-col">
                    <div
                      className="relative z-[1] w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                      style={{ background: 'rgba(28,22,8,0.14)', border: '1px solid rgba(28,22,8,0.22)' }}
                    >
                      <Icon size={20} style={{ color: '#1c1608' }} />
                    </div>
                    <span className="fx-accent-bar mb-4 relative z-[1]" />
                    <h3 className="relative z-[1] text-lg md:text-xl font-bold mb-2 leading-tight" style={{ color: '#1c1608' }}>
                      {p.title}
                    </h3>
                    <p className="relative z-[1] text-sm leading-relaxed" style={{ color: 'rgba(28,22,8,0.78)' }}>
                      {p.desc}
                    </p>
                  </div>
                ) : (
                  <div className="fx-tile h-full p-6 md:p-7 flex flex-col">
                    <div className="feature-icon mb-5" style={{ width: 48, height: 48 }}>
                      <Icon size={20} />
                    </div>
                    <span className="fx-accent-bar mb-4" />
                    <h3 className="text-base md:text-lg font-bold text-white mb-2 leading-tight">
                      {p.title}
                    </h3>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--fx-text-2)' }}>
                      {p.desc}
                    </p>
                  </div>
                )}
              </ScrollReveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}
