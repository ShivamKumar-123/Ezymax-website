import { Smartphone, Plane, Sparkles, Trophy } from 'lucide-react'
import SectionHeader from '@/landing/components/SectionHeader'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'
import CtFaqList from '@/landing/pages/copy-trading/CtFaqList'

const examples = [
  { icon: Smartphone, title: 'Smartphones',           desc: 'Latest-gen devices, no strings attached.' },
  { icon: Plane,      title: 'Travel Opportunities',  desc: 'Trips paid for by your activity on the platform.' },
  { icon: Sparkles,   title: 'Exclusive Experiences', desc: 'Events and access reserved for top participants.' },
  { icon: Trophy,     title: 'Long-Term Tiers',       desc: 'Status tiers that compound over months of activity.' },
]

const faq = [
  { q: 'How do I qualify for big rewards?', a: 'Through consistent activity, higher XP, and strong participation.' },
]

export default function ErBigRewards() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg-elev)' }}>
      <div className="fx-container">
        <SectionHeader
          badge="Big Rewards"
          title="Unlock Premium Rewards"
          highlight="Premium Rewards"
          subtitle="High engagement and performance unlock access to larger rewards."
        />

        <div className="mt-12 md:mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {examples.map((ex, i) => {
            const Icon = ex.icon
            return (
              <ScrollReveal key={ex.title} variant="fadeUp" delay={i * 0.05}>
                <div
                  className="relative h-full rounded-2xl p-6 overflow-hidden"
                  style={{
                    background:
                      'linear-gradient(180deg, rgba(214,169,61,0.10) 0%, rgba(214,169,61,0.02) 60%), var(--fx-bg-elev)',
                    border: '1px solid rgba(214,169,61,0.35)',
                  }}
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                    style={{
                      background: 'rgba(214,169,61,0.18)',
                      border: '1px solid rgba(214,169,61,0.45)',
                    }}
                  >
                    <Icon size={20} style={{ color: 'var(--fx-gold-light)' }} />
                  </div>
                  <h3 className="text-base md:text-lg font-bold text-white mb-2 leading-tight">{ex.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--fx-text-2)' }}>
                    {ex.desc}
                  </p>
                </div>
              </ScrollReveal>
            )
          })}
        </div>

        <ScrollReveal variant="fadeUp" delay={0.25}>
          <p
            className="mt-10 md:mt-12 text-center text-base md:text-lg italic max-w-2xl mx-auto"
            style={{ color: 'var(--fx-text-2)' }}
          >
            &ldquo;The more you progress, the bigger the rewards.&rdquo;
          </p>
        </ScrollReveal>

        <ScrollReveal variant="fadeUp" delay={0.3}>
          <div className="mt-8 max-w-3xl mx-auto">
            <CtFaqList items={faq} />
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}
