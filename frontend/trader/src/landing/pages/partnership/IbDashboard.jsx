import {
  Users,
  Activity,
  Coins,
  TrendingUp,
  History,
  Eye,
  CheckCircle,
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

        {/* ── Why choose: checklist + dashboard image ───────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 mt-10 md:mt-14 items-stretch">
          {/* LEFT — checklist */}
          <ScrollReveal variant="fadeUp">
            <ul className="space-y-5">
              {widgets.map((w) => (
                <li key={w.title} className="flex items-start gap-4">
                  <CheckCircle
                    size={22}
                    className="shrink-0 mt-0.5"
                    style={{ color: 'var(--fx-gold-light)' }}
                  />
                  <div>
                    <h3 className="text-base md:text-lg font-bold text-white leading-snug">
                      {w.title}
                    </h3>
                    <p className="text-sm md:text-[15px] leading-relaxed mt-1" style={{ color: 'var(--fx-text-2)' }}>
                      {w.desc}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </ScrollReveal>

          {/* RIGHT — dashboard image */}
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <div className="fx-tile h-full min-h-[320px] overflow-hidden">
              <img
                src="/images/partnership_card.png"
                alt="Partner dashboard"
                className="h-full w-full object-cover"
              />
            </div>
          </ScrollReveal>
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
