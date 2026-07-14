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
  { icon: Wallet,           title: 'Connect Wallet',          desc: 'Securely connect your wallet to access the platform.' },
  { icon: UserCheck,        title: 'Access Dashboard (CRM)',  desc: 'Manage your profile, settings, and activity.' },
  { icon: LayoutDashboard,  title: 'Create Trading Account',  desc: 'Choose your platform — FX Artha App or MT5.' },
  { icon: ArrowDownToLine,  title: 'Allocate Funds to Contract', desc: 'Funds are allocated to a secure smart contract layer.' },
  { icon: Activity,         title: 'Execute Trades',          desc: 'Trade normally using your selected trading account.' },
  { icon: Coins,            title: 'Automatic P&L Settlement', desc: 'Profits are credited automatically. Losses are deducted automatically.' },
  { icon: ArrowUpFromLine,  title: 'Withdraw Anytime',        desc: 'Funds are settled directly back to your wallet.' },
]

export default function PrFlow() {
  return (
    <section id="flow" className="fx-section" style={{ background: 'var(--fx-bg-elev)' }}>
      <div className="fx-container">
        {/* ── Two-column intro ──────────────────────────────── */}
        <div className="fx-split-intro">
          <ScrollReveal variant="fadeUp">
            <div>
              <span className="fx-eyebrow mb-5">Step-by-Step Flow</span>
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mt-5">
                From Wallet to Trade — <span className="gradient-text">Step by Step</span>
              </h2>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <p className="text-base md:text-lg" style={{ color: 'var(--fx-text-2)' }}>
              Every step is system-driven. No manual control involved.
            </p>
          </ScrollReveal>
        </div>

        {/* ── Bento: numbered timeline + image tile ─────────── */}
        <div className="fx-bento grid-cols-1 lg:grid-cols-3 mt-10 md:mt-14 items-stretch">
          {/* Numbered vertical timeline */}
          <ScrollReveal variant="fadeUp" className="lg:col-span-2">
            <div className="fx-tile h-full p-6 sm:p-7 md:p-8 flex flex-col">
              <span className="fx-accent-bar mb-4" />
              <h3 className="text-xl md:text-2xl font-bold text-white mb-7">
                From Wallet to Trade — Step by Step
              </h3>

              <div className="relative">
                {/* vertical gradient rail running through the numbered nodes */}
                <span
                  aria-hidden
                  className="absolute left-[23px] top-[24px] bottom-[24px] w-[3px] rounded-full"
                  style={{
                    background:
                      'linear-gradient(180deg, var(--fx-gold-light) 0%, var(--fx-gold) 52%, var(--fx-gold-dark) 100%)',
                    boxShadow: '0 0 16px rgba(214,169,61,0.4)',
                  }}
                />
                <ul className="relative space-y-6 md:space-y-7">
                  {steps.map((s, i) => {
                    const Icon = s.icon
                    return (
                      <li key={s.title} className="relative flex items-start gap-5">
                        <div className="fx-icon-badge shrink-0" style={{ width: 48, height: 48 }}>
                          <span className="text-base font-bold" style={{ color: 'var(--fx-gold-light)' }}>
                            {i + 1}
                          </span>
                        </div>
                        <div className="pt-1.5">
                          <div className="flex items-center gap-2.5 mb-1.5">
                            <Icon size={16} style={{ color: 'var(--fx-gold-light)' }} />
                            <h4 className="text-base md:text-lg font-bold text-white leading-snug">
                              {s.title}
                            </h4>
                          </div>
                          <p className="text-sm leading-relaxed" style={{ color: 'var(--fx-text-2)' }}>
                            {s.desc}
                          </p>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </div>
          </ScrollReveal>

          {/* Image tile */}
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <div className="fx-tile h-full min-h-[280px] overflow-hidden">
              <img
                src="/images/protocol_card.png"
                alt="From wallet to trade"
                className="h-full w-full object-cover"
              />
            </div>
          </ScrollReveal>
        </div>

        <ScrollReveal variant="fadeUp" delay={0.3}>
          <p
            className="mt-10 md:mt-12 text-center text-base md:text-lg italic max-w-2xl mx-auto"
            style={{ color: 'var(--fx-text-2)' }}
          >
            &ldquo;Every step is system-driven. No manual control involved.&rdquo;
          </p>
        </ScrollReveal>
      </div>
    </section>
  )
}
