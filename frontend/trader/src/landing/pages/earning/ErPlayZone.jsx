import { Dices, Ticket, Gavel } from 'lucide-react'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'
import CtFaqList from '@/landing/pages/copy-trading/CtFaqList'

const features = [
  {
    icon: Dices,
    title: 'Spin',
    desc: 'Quick reward interaction. Spend a few Coins, see what comes up.',
  },
  {
    icon: Ticket,
    title: 'Lottery',
    desc: 'Enter reward-based pools and try your luck.',
  },
  {
    icon: Gavel,
    gold: true,
    title: 'Bidding',
    desc: 'Compete for rewards using Coins. Highest bid wins.',
  },
]

const faq = [
  { q: 'Is this gambling?',          a: 'No. This is a reward-based engagement system using earned Coins.' },
  { q: 'Can I lose real money here?', a: 'No. Only platform-earned Coins are used.' },
]

export default function ErPlayZone() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg)' }}>
      <div className="fx-container">
        {/* ── Two-column intro ──────────────────────────────── */}
        <div className="fx-split-intro">
          <ScrollReveal variant="fadeUp">
            <div>
              <span className="fx-eyebrow mb-5">Play Zone</span>
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mt-5">
                Use Your Rewards in the <span className="gradient-text">Play Zone</span>
              </h2>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <p className="text-base md:text-lg" style={{ color: 'var(--fx-text-2)' }}>
              Your earned Coins can be used to participate in interactive reward experiences.
            </p>
          </ScrollReveal>
        </div>

        {/* ── Bento: 3 engagement tiles (one solid gold) ────── */}
        <div className="fx-bento grid-cols-1 md:grid-cols-3 mt-12 md:mt-16 items-stretch">
          {features.map((f, i) => {
            const Icon = f.icon
            if (f.gold) {
              return (
                <ScrollReveal key={f.title} variant="fadeUp" delay={i * 0.06}>
                  <div className="fx-tile-gold h-full p-6 md:p-7 flex flex-col">
                    <div
                      className="relative z-[1] w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                      style={{ background: 'rgba(28,22,8,0.14)', border: '1px solid rgba(28,22,8,0.22)' }}
                    >
                      <Icon size={22} style={{ color: '#1c1608' }} />
                    </div>
                    <span className="fx-accent-bar mb-4 relative z-[1]" />
                    <h3 className="relative z-[1] text-xl md:text-2xl font-bold mb-2" style={{ color: '#1c1608' }}>{f.title}</h3>
                    <p className="relative z-[1] text-sm md:text-[15px]" style={{ color: 'rgba(28,22,8,0.78)' }}>
                      {f.desc}
                    </p>
                  </div>
                </ScrollReveal>
              )
            }
            return (
              <ScrollReveal key={f.title} variant="fadeUp" delay={i * 0.06}>
                <div className="fx-tile h-full p-6 md:p-7 flex flex-col">
                  <div className="feature-icon mb-5" style={{ width: 48, height: 48 }}>
                    <Icon size={22} />
                  </div>
                  <span className="fx-accent-bar mb-4" />
                  <h3 className="text-xl md:text-2xl font-bold text-white mb-2">{f.title}</h3>
                  <p className="text-sm md:text-[15px]" style={{ color: 'var(--fx-text-2)' }}>
                    {f.desc}
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
            &ldquo;Use your rewards to unlock more opportunities.&rdquo;
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
