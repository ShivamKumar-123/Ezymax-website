import { Dices, Ticket, Gavel } from 'lucide-react'
import SectionHeader from '@/landing/components/SectionHeader'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'
import CtFaqList from '@/landing/pages/copy-trading/CtFaqList'

const features = [
  {
    icon: Dices,
    accent: '#a78bfa',
    title: 'Spin',
    desc: 'Quick reward interaction. Spend a few Coins, see what comes up.',
  },
  {
    icon: Ticket,
    accent: '#60a5fa',
    title: 'Lottery',
    desc: 'Enter reward-based pools and try your luck.',
  },
  {
    icon: Gavel,
    accent: '#ecc657',
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
        <SectionHeader
          badge="Play Zone"
          title="Use Your Rewards in the Play Zone"
          highlight="Play Zone"
          subtitle="Your earned Coins can be used to participate in interactive reward experiences."
        />

        <div className="mt-12 md:mt-16 grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
          {features.map((f, i) => {
            const Icon = f.icon
            return (
              <ScrollReveal key={f.title} variant="fadeUp" delay={i * 0.06}>
                <div
                  className="relative h-full rounded-2xl p-6 md:p-7 overflow-hidden"
                  style={{
                    background:
                      'linear-gradient(180deg, var(--fx-bg-elev) 0%, var(--fx-bg-elev-2) 100%)',
                    border: `1px solid ${f.accent}45`,
                  }}
                >
                  <div
                    className="absolute -top-px left-[18%] right-[18%] h-px"
                    style={{
                      background: `linear-gradient(90deg, transparent, ${f.accent}cc, transparent)`,
                    }}
                  />
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                    style={{ background: `${f.accent}1f`, border: `1px solid ${f.accent}55` }}
                  >
                    <Icon size={22} style={{ color: f.accent }} />
                  </div>
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
