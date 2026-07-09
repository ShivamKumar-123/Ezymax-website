import { Fragment } from 'react'
import Icon3D from '@/landing/components/Icons3d'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

const steps = [
  {
    icon: 'wallet',
    title: 'Connect Your Wallet',
    desc: 'Securely connect your wallet to begin.',
  },
  {
    icon: 'profile',
    title: 'Complete Your Profile',
    desc: 'Access your dashboard, manage settings, and prepare your account.',
  },
  {
    icon: 'dashboard',
    title: 'Create Trading Account',
    desc: 'Use FX Artha App or connect external environment (e.g., MT5).',
  },
  {
    icon: 'allocate',
    title: 'Allocate Funds',
    desc: 'Move funds into the trading contract — not to a broker.',
  },
  {
    icon: 'trading',
    title: 'Start Trading',
    desc: 'Execute trades using your selected trading account.',
  },
  {
    icon: 'coins',
    title: 'Automatic P&L',
    desc: 'Profits credited and losses adjusted automatically.',
  },
  {
    icon: 'withdraw',
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

        {/* ── Interlocking puzzle-step chain (scrolls on smaller screens) ── */}
        <div className="mt-12 md:mt-16 xl:overflow-visible">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 xl:flex xl:items-stretch xl:gap-0 xl:min-w-0 py-2">
            {steps.map((step, i) => {
              const isLast = i === steps.length - 1
              return (
                <Fragment key={step.title}>
                  <ScrollReveal
                    variant="fadeUp"
                    delay={i * 0.05}
                    className="basis-[190px] shrink-0 xl:basis-0 xl:grow xl:min-w-0"
                  >
                    <div className="fx-puzzle-piece h-full px-4 py-7 md:py-8 flex flex-col items-center text-center">
                      <div className="fx-icon-badge mb-4" style={{ width: 60, height: 60 }}>
                        <Icon3D name={step.icon} size={40} />
                      </div>
                      <span className="fx-puzzle-divider mb-3.5" />
                      <h3 className="text-[12px] md:text-[13px] font-bold uppercase tracking-[0.14em] text-white leading-snug mb-2.5">
                        {step.title}
                      </h3>
                      <p className="text-xs leading-relaxed" style={{ color: 'var(--fx-text-2)' }}>
                        {step.desc}
                      </p>
                    </div>
                  </ScrollReveal>

                  {!isLast && (
                    <div className="relative z-[3] w-5 md:w-4 shrink-0 hidden xl:block" aria-hidden="true">
                      <span
                        className={`fx-puzzle-neck ${i % 2 === 0 ? 'fx-puzzle-neck-top' : 'fx-puzzle-neck-bottom'}`}
                      />
                    </div>
                  )}
                </Fragment>
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
