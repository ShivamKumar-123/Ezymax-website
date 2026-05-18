import { TrendingUp, Bitcoin, Globe2, Briefcase, Copy, Users, Clock } from 'lucide-react'
import SectionHeader from '@/landing/components/SectionHeader'
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
        <SectionHeader
          badge="Who FX Artha Is For"
          title="Built for Modern Digital Traders"
          highlight="Digital Traders"
          subtitle="Whether you are an experienced trader, a beginner, a community leader, or a digital finance enthusiast — FX Artha is designed for a connected ecosystem experience."
        />

        <div className="mt-12 md:mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
          {personas.map((p, i) => {
            const Icon = p.icon
            const isWide = i === 6
            return (
              <ScrollReveal
                key={p.title}
                variant="fadeUp"
                delay={i * 0.04}
                className={isWide ? 'sm:col-span-2 lg:col-span-1' : ''}
              >
                <div className="glass-card h-full p-5 md:p-6 flex items-start gap-4">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                    style={{
                      background: 'rgba(214,169,61,0.08)',
                      border: '1px solid rgba(214,169,61,0.28)',
                    }}
                  >
                    <Icon size={18} style={{ color: 'var(--fx-gold-light)' }} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm md:text-base font-bold text-white mb-1 leading-tight">
                      {p.title}
                    </h3>
                    <p className="text-xs md:text-[13px] leading-relaxed" style={{ color: 'var(--fx-text-2)' }}>
                      {p.desc}
                    </p>
                  </div>
                </div>
              </ScrollReveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}
