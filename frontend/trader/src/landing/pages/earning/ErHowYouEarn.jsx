import { TrendingUp, Users, Target, Gamepad2, CheckCircle2 } from 'lucide-react'
import SectionHeader from '@/landing/components/SectionHeader'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'
import CtFaqList from '@/landing/pages/copy-trading/CtFaqList'

const sources = [
  {
    icon: TrendingUp,
    accent: '#4ade80',
    title: 'Trading Activity',
    desc: 'Earn XP, Coins, and PS based on your trading volume and consistency. Higher activity = higher rewards.',
  },
  {
    icon: Users,
    accent: '#a78bfa',
    title: 'Referrals',
    desc: 'Invite users to the platform and earn rewards based on their activity.',
  },
  {
    icon: Target,
    accent: '#60a5fa',
    title: 'Tasks & Missions',
    desc: 'Daily and weekly tasks. Simple actions trigger instant rewards.',
  },
  {
    icon: Gamepad2,
    accent: '#ecc657',
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
        <SectionHeader
          badge="How You Earn"
          title="Multiple Ways to Earn Rewards"
          highlight="Multiple Ways"
          subtitle="You earn rewards not just by trading — but by participating in the ecosystem."
        />

        <div className="mt-12 md:mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {sources.map((s, i) => {
            const Icon = s.icon
            return (
              <ScrollReveal key={s.title} variant="fadeUp" delay={i * 0.05}>
                <div className="glass-card h-full p-6">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                    style={{ background: `${s.accent}1f`, border: `1px solid ${s.accent}55` }}
                  >
                    <Icon size={20} style={{ color: s.accent }} />
                  </div>
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
