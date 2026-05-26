import { Zap, Coins, Diamond, CheckCircle2 } from 'lucide-react'
import SectionHeader from '@/landing/components/SectionHeader'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'
import CtFaqList from '@/landing/pages/copy-trading/CtFaqList'

const elements = [
  {
    icon: Zap,
    accent: '#a78bfa',
    title: 'XP',
    sub: 'Experience Points',
    tagline: 'Your growth indicator',
    bullets: [
      'Earned from trading, tasks, and platform activity',
      'Helps you progress through levels',
      'Reduces trading cost over time',
    ],
  },
  {
    icon: Coins,
    accent: '#ecc657',
    title: 'Coins',
    sub: 'Reward Currency',
    tagline: 'Your usable reward currency',
    bullets: [
      'Earned through engagement',
      'Used in Play Zone and Reward Store',
    ],
  },
  {
    icon: Diamond,
    accent: '#60a5fa',
    title: 'PS',
    sub: 'Prestige Score',
    tagline: 'Your ecosystem reputation',
    bullets: [
      'Reflects long-term activity and consistency',
      'Unlocks advanced benefits and access',
    ],
  },
]

const faq = [
  { q: 'What is XP used for?',           a: 'XP helps you level up and unlock better trading conditions.' },
  { q: 'What are Coins used for?',       a: 'Coins can be used to participate in reward-based activities and redeem items.' },
  { q: 'What is Prestige Score (PS)?',   a: 'PS represents your long-term contribution and unlocks higher-tier ecosystem benefits.' },
]

export default function ErRewardSystem() {
  return (
    <section id="rewards" className="fx-section" style={{ background: 'var(--fx-bg)' }}>
      <div className="fx-container">
        <SectionHeader
          badge="Reward System"
          title="Understanding Your Rewards"
          highlight="Your Rewards"
          subtitle="FX Artha uses a structured reward system to recognize your activity and progress. Three pieces, each doing a different job."
        />

        <div className="mt-12 md:mt-16 grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
          {elements.map((el, i) => {
            const Icon = el.icon
            return (
              <ScrollReveal key={el.title} variant="fadeUp" delay={i * 0.06}>
                <div
                  className="relative h-full rounded-2xl p-6 md:p-7 overflow-hidden"
                  style={{
                    background:
                      'linear-gradient(180deg, var(--fx-bg-elev) 0%, var(--fx-bg-elev-2) 100%)',
                    border: `1px solid ${el.accent}45`,
                  }}
                >
                  <div
                    className="absolute -top-px left-[18%] right-[18%] h-px"
                    style={{
                      background: `linear-gradient(90deg, transparent, ${el.accent}cc, transparent)`,
                    }}
                  />
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                    style={{ background: `${el.accent}1f`, border: `1px solid ${el.accent}55` }}
                  >
                    <Icon size={20} style={{ color: el.accent }} />
                  </div>
                  <div className="text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--fx-text-3)' }}>
                    {el.sub}
                  </div>
                  <h3 className="text-2xl md:text-[28px] font-bold text-white mb-1">{el.title}</h3>
                  <p className="text-sm font-semibold mb-4" style={{ color: el.accent }}>
                    {el.tagline}
                  </p>
                  <ul className="space-y-2">
                    {el.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2.5">
                        <CheckCircle2 size={15} className="mt-0.5 shrink-0" style={{ color: el.accent }} />
                        <span className="text-sm" style={{ color: 'var(--fx-text-2)' }}>
                          {b}
                        </span>
                      </li>
                    ))}
                  </ul>
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
            &ldquo;Every action contributes to your growth inside the ecosystem.&rdquo;
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
