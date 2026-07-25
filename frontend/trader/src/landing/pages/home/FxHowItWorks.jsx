import {
  Wallet,
  UserCheck,
  LayoutDashboard,
  ArrowDownToLine,
  Activity,
  Coins,
  ArrowUpFromLine,
} from 'lucide-react'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

const steps = [
  {
    icon: Wallet,
    title: 'Connect Your Wallet',
    desc: 'Securely connect your wallet to begin.',
  },
  {
    icon: UserCheck,
    title: 'Complete Your Profile',
    desc: 'Access your dashboard, manage settings, and prepare your account.',
  },
  {
    icon: LayoutDashboard,
    title: 'Create Trading Account',
    desc: 'Use FX Artha App or connect external environment (e.g., MT5).',
  },
  {
    icon: ArrowDownToLine,
    title: 'Allocate Funds',
    desc: 'Move funds into the trading contract — not to a broker.',
  },
  {
    icon: Activity,
    title: 'Start Trading',
    desc: 'Execute trades using your selected trading account.',
  },
  {
    icon: Coins,
    title: 'Automatic P&L',
    desc: 'Profits credited and losses adjusted automatically.',
  },
  {
    icon: ArrowUpFromLine,
    title: 'Withdraw Anytime',
    desc: 'Direct settlement back to your wallet without delays.',
  },
]

export default function FxHowItWorks() {
  return (
    <section
      id="how-it-works"
      className="fx-section"
      style={{ background: 'var(--fx-bg-elev)' }}
    >
      <div className="fx-container">
        {/* ── Two-column intro ──────────────────────────────── */}
        <div className="fx-split-intro">
          <ScrollReveal variant="fadeUp">
            <div>
              <span className="fx-eyebrow mb-5">How It Works</span>
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mt-5">
                From Wallet to Trade — A <span className="gradient-text">Seamless Flow</span>
              </h2>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <p className="text-base md:text-lg" style={{ color: 'var(--fx-text-2)' }}>
              From the moment you connect a wallet to the moment a profit lands back in it — here is what actually happens.
            </p>
          </ScrollReveal>
        </div>

        {/* ── Seven stations threaded on one continuous rail ── */}
        <div className="mt-14 md:mt-20">
          <div className="fx-station-grid grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-7 gap-x-7 gap-y-12 md:gap-y-14">
            {steps.map((step, i) => {
              const Icon = step.icon
              return (
              <ScrollReveal key={step.title} variant="fadeUp" delay={i * 0.06}>
                <div className="fx-station">
                  <div className="fx-station-node fx-icon-badge">
                    <Icon size={22} />
                  </div>
                  <h3 className="fx-station-title">{step.title}</h3>
                  <p className="fx-station-desc">{step.desc}</p>
                </div>
              </ScrollReveal>
              )
            })}
          </div>
        </div>

        <ScrollReveal variant="fadeUp" delay={0.3}>
          <p
            className="mt-10 md:mt-12 text-center text-base md:text-lg italic max-w-2xl mx-auto fx-quote"
            style={{ color: 'var(--fx-text-2)' }}
          >
            &ldquo;Structured flow. No manual control. Fully system-driven.&rdquo;
          </p>
        </ScrollReveal>
      </div>
    </section>
  )
}
