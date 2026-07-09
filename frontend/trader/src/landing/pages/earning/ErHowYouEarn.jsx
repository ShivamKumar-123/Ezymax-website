import { TrendingUp, Users, Target, Gamepad2 } from 'lucide-react'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'
import CtFaqList from '@/landing/pages/copy-trading/CtFaqList'

const sources = [
  {
    icon: TrendingUp,
    title: 'Trading Activity',
    desc: 'Earn XP, Coins, and PS based on your trading volume and consistency. Higher activity = higher rewards.',
  },
  {
    icon: Users,
    title: 'Referrals',
    desc: 'Invite users to the platform and earn rewards based on their activity.',
  },
  {
    icon: Target,
    title: 'Tasks & Missions',
    desc: 'Daily and weekly tasks. Simple actions trigger instant rewards.',
  },
  {
    icon: Gamepad2,
    title: 'Platform Engagement',
    desc: 'Participate in features like the Play Zone. Stay active to earn more.',
  },
]

const faq = [
  { q: 'Do I earn rewards only when I profit?',          a: 'No. Rewards are based on activity like trading volume and engagement.' },
  { q: 'Does higher trading volume give more rewards?',  a: 'Yes. Trading volume is a key factor in reward calculation.' },
  { q: 'Can beginners also earn rewards?',               a: 'Yes. Even small actions like login and tasks generate rewards.' },
]

export default function ErHowYouEarn() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg-elev)' }}>
      <div className="fx-container">
        {/* ── Two-column intro ──────────────────────────────── */}
        <div className="fx-split-intro">
          <ScrollReveal variant="fadeUp">
            <div>
              <span className="fx-eyebrow mb-5">How You Earn</span>
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mt-5">
                <span className="gradient-text">Multiple Ways</span> to Earn Rewards
              </h2>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <p className="text-base md:text-lg" style={{ color: 'var(--fx-text-2)' }}>
              You earn rewards not just by trading — but by participating in the ecosystem.
            </p>
          </ScrollReveal>
        </div>

        {/* ── Numbered process cards ────────────────────────── */}
        <div className="fx-bento grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mt-10 md:mt-14 items-stretch">
          {sources.map((s, i) => {
            const Icon = s.icon
            return (
              <ScrollReveal key={s.title} variant="fadeUp" delay={i * 0.05}>
                <div className="fx-tile h-full p-7 md:p-8 flex flex-col">
                  <div className="flex items-center justify-between mb-5">
                    <div className="feature-icon" style={{ width: 48, height: 48 }}>
                      <Icon size={20} />
                    </div>
                    <span className="text-3xl md:text-4xl font-bold gradient-text leading-none">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <span className="fx-accent-bar mb-4" />
                  <h3 className="text-base md:text-lg font-bold text-white mb-2 leading-tight">{s.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--fx-text-2)' }}>
                    {s.desc}
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
            &ldquo;Your activity drives your rewards — not just outcomes.&rdquo;
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
