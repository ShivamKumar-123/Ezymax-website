import {
  Lock,
  Cog,
  Activity,
  Wallet,
  ShieldCheck,
  BarChart3,
} from 'lucide-react'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

const pillars = [
  { icon: Lock,        title: 'Smart Contract Infrastructure', desc: 'Protocol-based settlement logic for verifiable execution.' },
  { icon: Cog,         title: 'Automated Settlement Logic',    desc: 'Profit, loss, and rewards settle by system, not by approval.' },
  { icon: Activity,    title: 'Real-Time Monitoring',          desc: 'Live visibility into positions, exposure, and protocol state.' },
  { icon: Wallet,      title: 'Wallet Connectivity',           desc: 'You stay in control through your own wallet.' },
  { icon: ShieldCheck, title: 'Risk Management Systems',       desc: 'Pre-trade controls and protection layers built in.' },
  { icon: BarChart3,   title: 'Transparent Analytics',         desc: 'Every action mapped to clear, queryable data.' },
]

export default function AbSecurity() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg-elev)' }}>
      <div className="fx-container">
        {/* ── Two-column intro ──────────────────────────────── */}
        <div className="fx-split-intro">
          <ScrollReveal variant="fadeUp">
            <div>
              <span className="fx-eyebrow mb-5">Security & Transparency</span>
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mt-5">
                Designed Around <span className="gradient-text">Trust</span>
              </h2>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <p className="text-base md:text-lg" style={{ color: 'var(--fx-text-2)' }}>
              The architecture leans on transparent systems, protocol-based infrastructure, and smart-contract logic — not on asking you to take our word for it.
            </p>
          </ScrollReveal>
        </div>

        {/* ── Pillar bento: dark tiles + one gold accent tile ── */}
        <div className="mt-12 md:mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6 items-stretch">
          {pillars.map((p, i) => {
            const Icon = p.icon
            const isGold = i === 0
            return (
              <ScrollReveal key={p.title} variant="fadeUp" delay={i * 0.04}>
                {isGold ? (
                  <div className="fx-tile-gold h-full p-6 md:p-7 flex flex-col">
                    <div
                      className="relative z-[1] w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                      style={{ background: 'rgba(28,22,8,0.14)', border: '1px solid rgba(28,22,8,0.22)' }}
                    >
                      <Icon size={20} style={{ color: '#1c1608' }} />
                    </div>
                    <span className="fx-accent-bar mb-4 relative z-[1]" />
                    <h3 className="relative z-[1] text-base md:text-lg font-bold mb-2 leading-tight" style={{ color: '#1c1608' }}>
                      {p.title}
                    </h3>
                    <p className="relative z-[1] text-sm leading-relaxed" style={{ color: 'rgba(28,22,8,0.78)' }}>
                      {p.desc}
                    </p>
                  </div>
                ) : (
                  <div className="fx-tile h-full p-6 md:p-7 flex flex-col">
                    <div className="feature-icon mb-5" style={{ width: 48, height: 48 }}>
                      <Icon size={20} />
                    </div>
                    <span className="fx-accent-bar mb-4" />
                    <h3 className="text-base md:text-lg font-bold text-white mb-2 leading-tight">
                      {p.title}
                    </h3>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--fx-text-2)' }}>
                      {p.desc}
                    </p>
                  </div>
                )}
              </ScrollReveal>
            )
          })}
        </div>

        <ScrollReveal variant="fadeUp" delay={0.3}>
          <p
            className="mt-10 md:mt-12 text-center text-base md:text-lg italic max-w-2xl mx-auto"
            style={{ color: 'var(--fx-text-2)' }}
          >
            &ldquo;Trust is built through systems — not promises.&rdquo;
          </p>
        </ScrollReveal>
      </div>
    </section>
  )
}
