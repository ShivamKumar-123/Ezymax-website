import { ShieldCheck, Cog, Eye, UserCog } from 'lucide-react'
import SectionHeader from '@/landing/components/SectionHeader'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

const cards = [
  {
    icon: ShieldCheck,
    title: 'No Custody',
    desc: 'We never hold your funds. They live in a smart contract you can verify.',
  },
  {
    icon: Cog,
    title: 'Automated Execution',
    desc: 'Trades execute based on predefined system logic — not human approvals.',
  },
  {
    icon: Eye,
    title: 'Transparent Flow',
    desc: 'Every action is visible and verifiable in the system.',
  },
  {
    icon: UserCog,
    title: 'User Security',
    desc: 'You control your wallet and access at all times.',
  },
]

export default function PrSecurity() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg-elev)' }}>
      <div className="fx-container">
        <SectionHeader
          badge="Security & Trust"
          title="Built for Transparency and Control"
          highlight="Transparency and Control"
          subtitle="FX Artha is designed to minimize trust dependency and maximize system-based execution."
        />

        <div className="mt-12 md:mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {cards.map((c, i) => {
            const Icon = c.icon
            return (
              <ScrollReveal key={c.title} variant="fadeUp" delay={i * 0.05}>
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
                  <h3 className="text-base md:text-lg font-bold text-white mb-2 leading-tight">{c.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--fx-text-2)' }}>
                    {c.desc}
                  </p>
                </div>
              </ScrollReveal>
            )
          })}
        </div>

        <ScrollReveal variant="fadeUp" delay={0.25}>
          <p
            className="mt-8 mx-auto max-w-2xl text-center text-xs md:text-sm italic"
            style={{ color: 'var(--fx-text-3)' }}
          >
            Security depends on both system architecture and user responsibility (wallet security, access control).
          </p>
        </ScrollReveal>
      </div>
    </section>
  )
}
