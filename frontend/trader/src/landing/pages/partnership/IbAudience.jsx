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
        {/* ── Centered heading ──────────────────────────────── */}
        <ScrollReveal variant="fadeUp">
          <div className="text-center max-w-2xl mx-auto">
            <span className="fx-eyebrow mb-5">Who This Is For</span>
            <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mt-5">
              Designed for Modern <span className="gradient-text">Trading Communities</span>
            </h2>
            <p className="text-base md:text-lg mt-5" style={{ color: 'var(--fx-text-2)' }}>
              If you already do any of this, you're already most of the way there.
            </p>
          </div>
        </ScrollReveal>

        {/* ── Clean dark feature grid ───────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6 mt-12 md:mt-16">
          {audiences.map((a, i) => {
            const Icon = a.icon
            return (
              <ScrollReveal key={a.title} variant="fadeUp" delay={i * 0.04}>
                <div className="fx-tile h-full p-6 md:p-7">
                  <div className="feature-icon mb-5" style={{ width: 46, height: 46 }}>
                    <Icon size={19} />
                  </div>
                  <h3 className="text-base md:text-lg font-bold text-white mb-2 leading-tight">
                    {a.title}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--fx-text-2)' }}>
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
