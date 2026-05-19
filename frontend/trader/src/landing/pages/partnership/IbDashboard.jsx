import {
  Users,
  Activity,
  Coins,
  TrendingUp,
  History,
  Eye,
} from 'lucide-react'
import SectionHeader from '@/landing/components/SectionHeader'
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
        <SectionHeader
          badge="Dashboard Preview"
          title="Built for Professional Partners"
          highlight="Professional Partners"
          subtitle="What you actually see when you log in on the partner side."
        />

        <div className="mt-12 md:mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
          {widgets.map((w, i) => {
            const Icon = w.icon
            return (
              <ScrollReveal key={w.title} variant="fadeUp" delay={i * 0.04}>
                <div className="glass-card h-full p-6">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                    style={{
                      background: 'rgba(214,169,61,0.08)',
                      border: '1px solid rgba(214,169,61,0.28)',
                    }}
                  >
                    <Icon size={18} style={{ color: 'var(--fx-gold-light)' }} />
                  </div>
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
