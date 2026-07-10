import { Activity, Clock, BarChart3 } from 'lucide-react'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'
import CtFaqList from '@/landing/pages/copy-trading/CtFaqList'

const factors = [
  {
    icon: BarChart3,
    title: 'Liquidity Contribution',
    desc: 'How much capital you provide to the protocol.',
  },
  {
    icon: Clock,
    title: 'Duration of Staking',
    desc: 'Longer durations earn structured benefits.',
  },
  {
    icon: Activity,
    title: 'Protocol Activity',
    desc: 'Ecosystem performance drives reward generation.',
  },
]

const faq = [
  { q: 'Are returns guaranteed?',       a: 'No. Rewards depend on protocol performance.' },
  { q: 'When are rewards credited?',    a: 'Based on the system cycle (defined in platform logic).' },
]

export default function StApy() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg-elev)' }}>
      <div className="fx-container">
        {/* ── Two-column intro ──────────────────────────────── */}
        <div className="fx-split-intro-center">
          <ScrollReveal variant="fadeUp">
            <div>
              <span className="fx-eyebrow mb-5">APY &amp; Reward Logic</span>
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mt-5">
                How <span className="gradient-text">Rewards Are Generated</span>
              </h2>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <p className="text-base md:text-lg" style={{ color: 'var(--fx-text-2)' }}>
              Rewards are participation-based, not guaranteed returns.
            </p>
          </ScrollReveal>
        </div>

        <div className="mt-12 md:mt-16 grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-5 items-stretch">
          {factors.map((f, i) => {
            const Icon = f.icon
            return (
              <ScrollReveal key={f.title} variant="fadeUp" delay={i * 0.05}>
                <div className="fx-tile h-full p-7 md:p-8 flex flex-col">
                  <div className="feature-icon mb-5" style={{ width: 48, height: 48 }}>
                    <Icon size={20} />
                  </div>
                  <span className="fx-accent-bar mb-4" />
                  <h3 className="text-base font-bold text-white mb-1.5 leading-tight">
                    {f.title}
                  </h3>
                  <p className="text-xs md:text-[13px] leading-relaxed" style={{ color: 'var(--fx-text-2)' }}>
                    {f.desc}
                  </p>
                </div>
              </ScrollReveal>
            )
          })}
        </div>

        <ScrollReveal variant="fadeUp" delay={0.25}>
          <div className="fx-tile p-6 md:p-8 mt-10 max-w-3xl mx-auto">
            <CtFaqList items={faq} />
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}
