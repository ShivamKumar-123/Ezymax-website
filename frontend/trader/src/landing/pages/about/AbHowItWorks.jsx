import { Wallet, Lock, LayoutDashboard, Activity, Cog } from 'lucide-react'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

const steps = [
  { icon: Wallet,         title: 'Connect Wallet',          desc: 'Users connect compatible wallets to access the ecosystem.' },
  { icon: Lock,            title: 'Deposit Into Protocol',   desc: 'Funds interact with protocol-based systems rather than broker-controlled custody.' },
  { icon: LayoutDashboard, title: 'Create Trading Account', desc: 'Users can create trading environments based on their needs.' },
  { icon: Activity,        title: 'Trade Through Liquidity', desc: 'Execution operates through connected liquidity and execution systems.' },
  { icon: Cog,             title: 'Automated Settlement',    desc: 'Profit, loss, rewards, and ecosystem mechanics are processed by infrastructure.' },
]

export default function AbHowItWorks() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg)' }}>
      <div className="fx-container">
        {/* ── Two-column intro ──────────────────────────────── */}
        <div className="fx-split-intro">
          <ScrollReveal variant="fadeUp">
            <div>
              <span className="fx-eyebrow mb-5">How It Works</span>
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mt-5">
                A Smarter <span className="gradient-text">Trading Flow</span>
              </h2>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <p className="text-base md:text-lg" style={{ color: 'var(--fx-text-2)' }}>
              A normal broker bundles three things together: holding your money, running your trades, and settling them. We split those into separate parts so you can actually see what's happening at each step.
            </p>
          </ScrollReveal>
        </div>

        {/* ── Numbered step cards ───────────────────────────── */}
        <div className="mt-12 md:mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 items-stretch">
          {steps.map((s, i) => {
            const Icon = s.icon
            const isGold = i === 4
            const num = String(i + 1).padStart(2, '0')
            const isWide = i === 4
            return (
              <ScrollReveal
                key={s.title}
                variant="fadeUp"
                delay={i * 0.05}
                className={isWide ? 'sm:col-span-2 lg:col-span-1' : ''}
              >
                {isGold ? (
                  <div className="fx-tile-gold h-full p-7 md:p-8 flex flex-col">
                    <div className="relative z-[1] flex items-center gap-4 mb-4">
                      <span className="text-4xl font-extrabold leading-none" style={{ color: '#1c1608' }}>{num}</span>
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center"
                        style={{ background: 'rgba(28,22,8,0.14)', border: '1px solid rgba(28,22,8,0.22)' }}
                      >
                        <Icon size={20} style={{ color: '#1c1608' }} />
                      </div>
                    </div>
                    <span className="fx-accent-bar mb-4 relative z-[1]" />
                    <h3 className="relative z-[1] text-lg md:text-xl font-bold mb-2 leading-tight" style={{ color: '#1c1608' }}>
                      {s.title}
                    </h3>
                    <p className="relative z-[1] text-sm leading-relaxed" style={{ color: 'rgba(28,22,8,0.78)' }}>
                      {s.desc}
                    </p>
                  </div>
                ) : (
                  <div className="fx-tile h-full p-7 md:p-8 flex flex-col">
                    <div className="flex items-center gap-4 mb-4">
                      <span className="text-4xl font-extrabold leading-none gradient-text">{num}</span>
                      <div className="feature-icon" style={{ width: 48, height: 48 }}>
                        <Icon size={20} />
                      </div>
                    </div>
                    <span className="fx-accent-bar mb-4" />
                    <h3 className="text-lg md:text-xl font-bold text-white mb-2 leading-tight">
                      {s.title}
                    </h3>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--fx-text-2)' }}>
                      {s.desc}
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
            &ldquo;Built around transparency, automation, and user control.&rdquo;
          </p>
        </ScrollReveal>
      </div>
    </section>
  )
}
