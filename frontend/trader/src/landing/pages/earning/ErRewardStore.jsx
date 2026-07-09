import { Smartphone, Gift, TrendingUp, KeyRound } from 'lucide-react'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'
import CtFaqList from '@/landing/pages/copy-trading/CtFaqList'

const rewards = [
  { icon: Smartphone, title: 'Gadgets',             desc: 'Phones, accessories, and curated tech.' },
  { icon: TrendingUp, title: 'Platform Benefits',   desc: 'Fee credits, plan boosts, and account perks.', gold: true },
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
        {/* ── Two-column intro ──────────────────────────────── */}
        <div className="fx-split-intro">
          <ScrollReveal variant="fadeUp">
            <div>
              <span className="fx-eyebrow mb-5">Reward Store</span>
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mt-5">
                <span className="gradient-text">Redeem</span> What You Earn
              </h2>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <p className="text-base md:text-lg" style={{ color: 'var(--fx-text-2)' }}>
              Convert your Coins and achievements into real value.
            </p>
          </ScrollReveal>
        </div>

        {/* ── Store grid: product tiles (one solid gold) ────── */}
        <div className="fx-bento grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mt-12 md:mt-16 items-stretch">
          {rewards.map((r, i) => {
            const Icon = r.icon
            if (r.gold) {
              return (
                <ScrollReveal key={r.title} variant="fadeUp" delay={i * 0.05}>
                  <div className="fx-tile-gold h-full flex flex-col overflow-hidden">
                    <div
                      className="relative z-[1] w-full flex items-center justify-center"
                      style={{ height: 160, background: 'rgba(28,22,8,0.08)', borderBottom: '1px solid rgba(28,22,8,0.16)' }}
                    >
                      <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center"
                        style={{ background: 'rgba(28,22,8,0.14)', border: '1px solid rgba(28,22,8,0.22)' }}
                      >
                        <Icon size={24} style={{ color: '#1c1608' }} />
                      </div>
                    </div>
                    <div className="relative z-[1] p-6 flex flex-col">
                      <span className="fx-accent-bar mb-4" />
                      <h3 className="text-base md:text-lg font-bold mb-2 leading-tight" style={{ color: '#1c1608' }}>{r.title}</h3>
                      <p className="text-sm leading-relaxed" style={{ color: 'rgba(28,22,8,0.78)' }}>
                        {r.desc}
                      </p>
                    </div>
                  </div>
                </ScrollReveal>
              )
            }
            return (
              <ScrollReveal key={r.title} variant="fadeUp" delay={i * 0.05}>
                <div className="fx-tile h-full flex flex-col overflow-hidden">
                  <div className="fx-tile-media" style={{ minHeight: 160 }}>
                    <span className="fx-tile-media-label">Image</span>
                    <div className="absolute inset-0 flex items-center justify-center z-[2]">
                      <div className="feature-icon" style={{ width: 48, height: 48 }}>
                        <Icon size={20} />
                      </div>
                    </div>
                  </div>
                  <div className="p-6 flex flex-col">
                    <span className="fx-accent-bar mb-4" />
                    <h3 className="text-base md:text-lg font-bold text-white mb-2 leading-tight">{r.title}</h3>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--fx-text-2)' }}>
                      {r.desc}
                    </p>
                  </div>
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
