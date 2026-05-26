import { Smartphone, Gift, TrendingUp, KeyRound } from 'lucide-react'
import SectionHeader from '@/landing/components/SectionHeader'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'
import CtFaqList from '@/landing/pages/copy-trading/CtFaqList'

const rewards = [
  { icon: Smartphone, title: 'Gadgets',             desc: 'Phones, accessories, and curated tech.' },
  { icon: TrendingUp, title: 'Platform Benefits',   desc: 'Fee credits, plan boosts, and account perks.' },
  { icon: Gift,       title: 'Trading Advantages',  desc: 'Conditions that you cannot buy with cash alone.' },
  { icon: KeyRound,   title: 'Exclusive Access',    desc: 'Invite-only programs and early features.' },
]

const faq = [
  { q: 'Can rewards be withdrawn as cash?', a: 'Rewards are redeemable based on available options in the store.' },
  { q: 'Do rewards change over time?',      a: 'Yes. The reward catalog is updated regularly.' },
]

export default function ErRewardStore() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg-elev)' }}>
      <div className="fx-container">
        <SectionHeader
          badge="Reward Store"
          title="Redeem What You Earn"
          highlight="Redeem"
          subtitle="Convert your Coins and achievements into real value."
        />

        <div className="mt-12 md:mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {rewards.map((r, i) => {
            const Icon = r.icon
            return (
              <ScrollReveal key={r.title} variant="fadeUp" delay={i * 0.05}>
                <div className="glass-card h-full p-6">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                    style={{
                      background: 'rgba(214,169,61,0.08)',
                      border: '1px solid rgba(214,169,61,0.28)',
                    }}
                  >
                    <Icon size={20} style={{ color: 'var(--fx-gold-light)' }} />
                  </div>
                  <h3 className="text-base md:text-lg font-bold text-white mb-2 leading-tight">{r.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--fx-text-2)' }}>
                    {r.desc}
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
            &ldquo;Your effort translates into real benefits.&rdquo;
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
