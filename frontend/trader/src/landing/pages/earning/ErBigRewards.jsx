import { Smartphone, Plane, Sparkles, Trophy } from 'lucide-react'
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
        {/* ── Two-column intro ──────────────────────────────── */}
        <div className="fx-split-intro">
          <ScrollReveal variant="fadeUp">
            <div>
              <span className="fx-eyebrow mb-5">Big Rewards</span>
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mt-5">
                Unlock <span className="gradient-text">Premium Rewards</span>
              </h2>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <p className="text-base md:text-lg" style={{ color: 'var(--fx-text-2)' }}>
              High engagement and performance unlock access to larger rewards.
            </p>
          </ScrollReveal>
        </div>

        {/* ── Big-reward stat-chart tiles ───────────────────── */}
        <div className="fx-bento grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mt-10 md:mt-14 items-stretch">
          {examples.map((ex, i) => {
            const Icon = ex.icon
            return (
              <ScrollReveal key={ex.title} variant="fadeUp" delay={i * 0.05}>
                <div className="fx-stat-chart h-full p-6 md:p-7 flex flex-col">
                  <div className="fx-chart-curve" />
                  <div className="relative z-[1] feature-icon mb-5" style={{ width: 48, height: 48 }}>
                    <Icon size={20} />
                  </div>
                  <h3 className="relative z-[1] text-lg md:text-xl font-bold text-white mb-2 leading-tight">{ex.title}</h3>
                  <p className="relative z-[1] text-sm leading-relaxed mt-auto" style={{ color: 'var(--fx-text-2)' }}>
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
