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
import SectionHeader from '@/landing/components/SectionHeader'
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
        <SectionHeader
          badge="Who This Is For"
          title="Designed for Modern Trading Communities"
          highlight="Trading Communities"
          subtitle="If you grow traders, you can grow with FX Artha."
        />

        <div className="mt-12 md:mt-16 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
          {audiences.map((a, i) => {
            const Icon = a.icon
            return (
              <ScrollReveal key={a.title} variant="fadeUp" delay={i * 0.04}>
                <div className="glass-card h-full p-5 md:p-6">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                    style={{
                      background: 'rgba(214,169,61,0.08)',
                      border: '1px solid rgba(214,169,61,0.28)',
                    }}
                  >
                    <Icon size={18} style={{ color: 'var(--fx-gold-light)' }} />
                  </div>
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
