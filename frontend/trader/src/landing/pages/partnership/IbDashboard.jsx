import {
  Users,
  Activity,
  Coins,
  TrendingUp,
  History,
  Eye,
} from 'lucide-react'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'
import CtFaqList from '@/landing/pages/copy-trading/CtFaqList'

const widgets = [
  { icon: Users,      title: 'User Analytics',       desc: 'See who you brought in and which of them are actively trading.' },
  { icon: Activity,   title: 'Trading Volume',       desc: 'Rolling volume from your network, broken down by symbol and account.' },
  { icon: Coins,      title: 'Reward Tracking',      desc: 'What you have earned this period and how it was calculated.' },
  { icon: TrendingUp, title: 'Performance Overview', desc: 'Headline numbers for your network compared to last period.' },
  { icon: Eye,        title: 'Referral Monitoring',  desc: 'Live view of new sign-ups coming through your links.' },
  { icon: History,    title: 'Commission History',   desc: 'Full payout history with date, amount, and reference.' },
]

const faq = [
  { q: 'Can I track my network in real time?', a: 'Yes, through the IB dashboard.' },
  { q: 'Can I manage multiple communities?',   a: 'Yes, depending on partnership structure.' },
]

export default function IbDashboard() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg-elev)' }}>
      <div className="fx-container">
        {/* ── Two-column intro ──────────────────────────────── */}
        <div className="fx-split-intro">
          <ScrollReveal variant="fadeUp">
            <div>
              <span className="fx-eyebrow mb-5">Dashboard Preview</span>
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mt-5">
                Built for <span className="gradient-text">Professional Partners</span>
              </h2>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <p className="text-base md:text-lg" style={{ color: 'var(--fx-text-2)' }}>
              What you actually see when you log in on the partner side.
            </p>
          </ScrollReveal>
        </div>

        {/* ── Dashboard image placeholder ───────────────────── */}
        <ScrollReveal variant="fadeUp">
          <div className="fx-tile-media h-full min-h-[280px] mt-10 md:mt-14">
            <span className="fx-tile-media-label">Image</span>
          </div>
        </ScrollReveal>

        {/* ── Bento: dark tiles + one gold accent tile ──────── */}
        <div className="fx-bento grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 mt-6 md:mt-8 items-stretch">
          {widgets.map((w, i) => {
            const Icon = w.icon
            const isGold = i === 0
            if (isGold) {
              return (
                <ScrollReveal key={w.title} variant="fadeUp" delay={i * 0.04}>
                  <div className="fx-tile-gold h-full p-6 flex flex-col">
                    <div
                      className="relative z-[1] w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                      style={{ background: 'rgba(28,22,8,0.14)', border: '1px solid rgba(28,22,8,0.22)' }}
                    >
                      <Icon size={18} style={{ color: '#1c1608' }} />
                    </div>
                    <span className="fx-accent-bar mb-4 relative z-[1]" />
                    <h3 className="relative z-[1] text-base md:text-lg font-bold mb-2 leading-tight" style={{ color: '#1c1608' }}>{w.title}</h3>
                    <p className="relative z-[1] text-sm leading-relaxed" style={{ color: 'rgba(28,22,8,0.78)' }}>
                      {w.desc}
                    </p>
                  </div>
                </ScrollReveal>
              )
            }
            return (
              <ScrollReveal key={w.title} variant="fadeUp" delay={i * 0.04}>
                <div className="fx-tile h-full p-6 flex flex-col">
                  <div className="feature-icon mb-4" style={{ width: 44, height: 44 }}>
                    <Icon size={18} />
                  </div>
                  <span className="fx-accent-bar mb-4" />
                  <h3 className="text-base md:text-lg font-bold text-white mb-2 leading-tight">{w.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--fx-text-2)' }}>
                    {w.desc}
                  </p>
                </div>
              </ScrollReveal>
            )
          })}
        </div>

        <ScrollReveal variant="fadeUp" delay={0.25}>
          <div className="mt-10 max-w-3xl mx-auto">
            <CtFaqList items={faq} />
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}
