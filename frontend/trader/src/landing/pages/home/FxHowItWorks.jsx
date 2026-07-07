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
    desc: 'Move funds into the trading contract â€” not to a broker.',
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
                From Wallet to Trade â€” A <span className="gradient-text">Seamless Flow</span>
              </h2>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <p className="text-base md:text-lg" style={{ color: 'var(--fx-text-2)' }}>
              From the moment you connect a wallet to the moment a profit lands back in it â€” here is what actually happens.
            </p>
          </ScrollReveal>
        </div>

        {/* â”€â”€ Horizontal step rail (scrolls on mobile) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div className="mt-12 md:mt-16 -mx-6 md:mx-0 px-6 md:px-0 overflow-x-auto md:overflow-visible">
          <div className="relative grid grid-flow-col md:grid-flow-row auto-cols-[260px] md:auto-cols-auto md:grid-cols-7 gap-4 md:gap-3 min-w-max md:min-w-0">
            {/* Connecting line (desktop only) */}
            <div
              className="hidden md:block absolute top-[42px] left-[7%] right-[7%] h-px pointer-events-none"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(90deg, rgba(214,169,61,0.5) 0 6px, transparent 6px 14px)',
              }}
            />

            {steps.map((step, i) => {
              const Icon = step.icon
              return (
                <ScrollReveal key={step.title} variant="fadeUp" delay={i * 0.05}>
                  <div className="relative flex flex-col items-center text-center">
                    <div
                      className="relative w-[84px] h-[84px] rounded-2xl flex items-center justify-center mb-4 group"
                      style={{
                        background:
                          'linear-gradient(180deg, var(--fx-bg) 0%, var(--fx-bg-elev-2) 100%)',
                        border: '1px solid rgba(214,169,61,0.28)',
                        boxShadow:
                          '0 1px 0 rgba(255,255,255,0.06) inset, 0 12px 32px -16px rgba(214,169,61,0.32)',
                      }}
                    >
                      <Icon size={28} style={{ color: 'var(--fx-gold-light)' }} />
                      <span
                        className="absolute -top-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{
                          background:
                            'linear-gradient(180deg, var(--fx-gold-light), var(--fx-gold))',
                          color: '#1a1408',
                          boxShadow: '0 6px 16px -6px rgba(214,169,61,0.55)',
                        }}
                      >
                        {i + 1}
                      </span>
                    </div>
                    <h3 className="text-sm md:text-[15px] font-bold text-white leading-tight mb-1.5 px-1">
                      {step.title}
                    </h3>
                    <p
                      className="text-xs md:text-[13px] leading-relaxed px-1"
                      style={{ color: 'var(--fx-text-2)' }}
                    >
                      {step.desc}
                    </p>
                  </div>
                </ScrollReveal>
              )
            })}
          </div>
        </div>

        <ScrollReveal variant="fadeUp" delay={0.3}>
          <p
            className="mt-10 md:mt-12 text-center text-base md:text-lg italic max-w-2xl mx-auto"
            style={{ color: 'var(--fx-text-2)' }}
          >
            &ldquo;Structured flow. No manual control. Fully system-driven.&rdquo;
          </p>
        </ScrollReveal>
      </div>
    </section>
  )
}
