import { Zap, Coins, Diamond, CheckCircle2 } from 'lucide-react'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'
import CtFaqList from '@/landing/pages/copy-trading/CtFaqList'

const elements = [
  {
    icon: Zap,
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
    gold: true,
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
        {/* ── Two-column intro ──────────────────────────────── */}
        <div className="fx-split-intro">
          <ScrollReveal variant="fadeUp">
            <div>
              <span className="fx-eyebrow mb-5">Reward System</span>
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mt-5">
                Understanding <span className="gradient-text">Your Rewards</span>
              </h2>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <p className="text-base md:text-lg" style={{ color: 'var(--fx-text-2)' }}>
              FX Artha uses a structured reward system to recognize your activity and progress. Three pieces, each doing a different job.
            </p>
          </ScrollReveal>
        </div>

        {/* ── Bento: 3 reward tiles (one solid gold) ────────── */}
        <div className="fx-bento grid-cols-1 md:grid-cols-3 mt-12 md:mt-16 items-stretch">
          {elements.map((el, i) => {
            const Icon = el.icon
            if (el.gold) {
              return (
                <ScrollReveal key={el.title} variant="fadeUp" delay={i * 0.06}>
                  <div className="fx-tile-gold h-full p-6 md:p-7 flex flex-col">
                    <div className="relative z-[1] flex items-center justify-between mb-5">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center"
                        style={{ background: 'rgba(28,22,8,0.14)', border: '1px solid rgba(28,22,8,0.22)' }}
                      >
                        <Icon size={20} style={{ color: '#1c1608' }} />
                      </div>
                      <span
                        className="text-[11px] uppercase tracking-wider"
                        style={{ color: 'rgba(28,22,8,0.7)' }}
                      >
                        {el.sub}
                      </span>
                    </div>
                    <span className="fx-accent-bar mb-4 relative z-[1]" />
                    <h3 className="relative z-[1] text-2xl md:text-[28px] font-bold mb-1" style={{ color: '#1c1608' }}>
                      {el.title}
                    </h3>
                    <p className="relative z-[1] text-sm font-semibold mb-4" style={{ color: 'rgba(28,22,8,0.82)' }}>
                      {el.tagline}
                    </p>
                    <ul className="relative z-[1] space-y-2 mt-auto">
                      {el.bullets.map((b) => (
                        <li key={b} className="flex items-start gap-2.5">
                          <CheckCircle2 size={15} className="mt-0.5 shrink-0" style={{ color: '#1c1608' }} />
                          <span className="text-sm" style={{ color: 'rgba(28,22,8,0.78)' }}>
                            {b}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </ScrollReveal>
              )
            }
            return (
              <ScrollReveal key={el.title} variant="fadeUp" delay={i * 0.06}>
                <div className="fx-tile h-full p-6 md:p-7 flex flex-col">
                  <div className="flex items-center justify-between mb-5">
                    <div className="feature-icon" style={{ width: 48, height: 48 }}>
                      <Icon size={20} />
                    </div>
                    <span className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--fx-text-3)' }}>
                      {el.sub}
                    </span>
                  </div>
                  <span className="fx-accent-bar mb-4" />
                  <h3 className="text-2xl md:text-[28px] font-bold text-white mb-1">{el.title}</h3>
                  <p className="text-sm font-semibold mb-4" style={{ color: 'var(--fx-gold-light)' }}>
                    {el.tagline}
                  </p>
                  <ul className="space-y-2 mt-auto">
                    {el.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2.5">
                        <CheckCircle2 size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--fx-gold-light)' }} />
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
