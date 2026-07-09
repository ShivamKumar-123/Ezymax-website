import {
  GraduationCap,
  Users,
  Mic,
  BookOpenCheck,
  Globe2,
  Activity,
  School,
  MapPin,
} from 'lucide-react'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

const audiences = [
  { icon: GraduationCap, title: 'Trading Educators',  desc: 'Course creators and structured learning programs.' },
  { icon: Users,         title: 'Community Leaders',  desc: 'Discord, Telegram, and forum-based groups.' },
  { icon: Mic,           title: 'Influencers',        desc: 'Public-facing creators with engaged audiences.' },
  { icon: BookOpenCheck, title: 'Forex Educators',    desc: 'Specialised FX and CFD knowledge providers.' },
  { icon: Globe2,        title: 'Web3 Communities',   desc: 'DAOs, on-chain groups, and crypto-native networks.' },
  { icon: Activity,      title: 'Signal Providers',   desc: 'Analytical and trade-call publishers.' },
  { icon: School,        title: 'Trading Academies',  desc: 'Institutions training new market participants.' },
  { icon: MapPin,        title: 'Regional Partners',  desc: 'Local representatives building country networks.' },
]

export default function IbAudience() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg)' }}>
      <div className="fx-container">
        {/* ── Two-column intro ──────────────────────────────── */}
        <div className="fx-split-intro">
          <ScrollReveal variant="fadeUp">
            <div>
              <span className="fx-eyebrow mb-5">Who This Is For</span>
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mt-5">
                Designed for Modern <span className="gradient-text">Trading Communities</span>
              </h2>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <p className="text-base md:text-lg" style={{ color: 'var(--fx-text-2)' }}>
              If you already do any of this, you're already most of the way there.
            </p>
          </ScrollReveal>
        </div>

        {/* ── Bento: dark tiles + one gold accent tile ──────── */}
        <div className="fx-bento grid-cols-2 md:grid-cols-3 lg:grid-cols-4 mt-10 md:mt-14 items-stretch">
          {audiences.map((a, i) => {
            const Icon = a.icon
            const isGold = i === 0
            if (isGold) {
              return (
                <ScrollReveal key={a.title} variant="fadeUp" delay={i * 0.04}>
                  <div className="fx-tile-gold h-full p-5 md:p-6 flex flex-col">
                    <div
                      className="relative z-[1] w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                      style={{ background: 'rgba(28,22,8,0.14)', border: '1px solid rgba(28,22,8,0.22)' }}
                    >
                      <Icon size={18} style={{ color: '#1c1608' }} />
                    </div>
                    <span className="fx-accent-bar mb-4 relative z-[1]" />
                    <h3 className="relative z-[1] text-sm md:text-base font-bold mb-1.5 leading-tight" style={{ color: '#1c1608' }}>
                      {a.title}
                    </h3>
                    <p className="relative z-[1] text-xs md:text-[13px] leading-relaxed" style={{ color: 'rgba(28,22,8,0.78)' }}>
                      {a.desc}
                    </p>
                  </div>
                </ScrollReveal>
              )
            }
            return (
              <ScrollReveal key={a.title} variant="fadeUp" delay={i * 0.04}>
                <div className="fx-tile h-full p-5 md:p-6 flex flex-col">
                  <div className="feature-icon mb-4" style={{ width: 44, height: 44 }}>
                    <Icon size={18} />
                  </div>
                  <span className="fx-accent-bar mb-4" />
                  <h3 className="text-sm md:text-base font-bold text-white mb-1.5 leading-tight">
                    {a.title}
                  </h3>
                  <p className="text-xs md:text-[13px] leading-relaxed" style={{ color: 'var(--fx-text-2)' }}>
                    {a.desc}
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
