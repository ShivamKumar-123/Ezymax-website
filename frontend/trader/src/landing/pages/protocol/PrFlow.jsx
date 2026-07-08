import {
  Wallet,
  UserCheck,
  LayoutDashboard,
  ArrowDownToLine,
  Activity,
  Coins,
  ArrowUpFromLine,
} from 'lucide-react'
import SectionHeader from '@/landing/components/SectionHeader'
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
        <div className="fx-section-frame">
        <SectionHeader
          badge="Step-by-Step Flow"
          title="From Wallet to Trade — Step by Step"
          highlight="Step by Step"
          subtitle="Every step is system-driven. No manual control involved."
        />
        <div className="mt-12 md:mt-16 -mx-6 md:mx-0 px-6 md:px-0 overflow-x-auto md:overflow-visible">
          <div className="relative grid grid-flow-col md:grid-flow-row auto-cols-[240px] md:auto-cols-auto md:grid-cols-7 gap-4 md:gap-3 min-w-max md:min-w-0">
            <div
              className="hidden md:block absolute top-[42px] left-[7%] right-[7%] h-px pointer-events-none"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(90deg, rgba(214,169,61,0.5) 0 6px, transparent 6px 14px)',
              }}
            />
            {steps.map((s, i) => {
              const Icon = s.icon
              return (
                <ScrollReveal key={s.title} variant="fadeUp" delay={i * 0.05}>
                  <div className="relative flex flex-col items-center text-center">
                    <div
                      className="relative w-[84px] h-[84px] rounded-2xl flex items-center justify-center mb-4"
                      style={{
                        background:
                          'linear-gradient(180deg, var(--fx-bg) 0%, var(--fx-bg-elev-2) 100%)',
                        border: '1px solid rgba(214,169,61,0.28)',
                        boxShadow:
                          '0 1px 0 rgba(255,255,255,0.06) inset, 0 12px 32px -16px rgba(214,169,61,0.32)',
                      }}
                    >
                      <Icon size={26} style={{ color: 'var(--fx-gold-light)' }} />
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
                    <h3 className="text-sm md:text-[15px] font-bold text-white mb-1.5 px-1">
                      {s.title}
                    </h3>
                    <p
                      className="text-xs md:text-[13px] leading-relaxed px-1"
                      style={{ color: 'var(--fx-text-2)' }}
                    >
                      {s.desc}
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
            &ldquo;Every step is system-driven. No manual control involved.&rdquo;
          </p>
        </ScrollReveal>
        </div>
      </div>
    </section>
  )
}
