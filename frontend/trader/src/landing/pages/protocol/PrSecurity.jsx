import { ShieldCheck, Cog, Eye, UserCog } from 'lucide-react'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

const cards = [
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
        {/* ── Two-column intro ──────────────────────────────── */}
        <div className="fx-split-intro">
          <ScrollReveal variant="fadeUp">
            <div>
              <span className="fx-eyebrow mb-5">Security &amp; Trust</span>
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mt-5">
                Built for <span className="gradient-text">Transparency and Control</span>
              </h2>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <p className="text-base md:text-lg" style={{ color: 'var(--fx-text-2)' }}>
              FX Artha is designed to minimize trust dependency and maximize system-based execution.
            </p>
          </ScrollReveal>
        </div>

        {/* ── Bento: gold flagship tile + dark feature tiles ── */}
        <div className="fx-bento grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mt-10 md:mt-14 items-stretch">
          {/* No Custody — solid gold accent tile */}
          <ScrollReveal variant="fadeUp">
            <div className="fx-tile-gold h-full p-6 md:p-7 flex flex-col">
              <div
                className="relative z-[1] w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                style={{ background: 'rgba(28,22,8,0.14)', border: '1px solid rgba(28,22,8,0.22)' }}
              >
                <ShieldCheck size={20} style={{ color: '#1c1608' }} />
              </div>
              <span className="fx-accent-bar mb-4 relative z-[1]" />
              <h3 className="relative z-[1] text-base md:text-lg font-bold mb-2 leading-tight" style={{ color: '#1c1608' }}>
                No Custody
              </h3>
              <p className="relative z-[1] text-sm leading-relaxed" style={{ color: 'rgba(28,22,8,0.78)' }}>
                We never hold your funds. They live in a smart contract you can verify.
              </p>
            </div>
          </ScrollReveal>

          {cards.map((c, i) => {
            const Icon = c.icon
            return (
              <ScrollReveal key={c.title} variant="fadeUp" delay={(i + 1) * 0.06}>
                <div className="fx-tile h-full p-6 md:p-7 flex flex-col">
                  <div className="feature-icon mb-5" style={{ width: 48, height: 48 }}>
                    <Icon size={20} />
                  </div>
                  <span className="fx-accent-bar mb-4" />
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
