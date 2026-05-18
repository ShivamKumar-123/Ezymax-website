import { Wallet, Lock, LayoutDashboard, Activity, Cog } from 'lucide-react'
import SectionHeader from '@/landing/components/SectionHeader'
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
        <SectionHeader
          badge="How It Works"
          title="A Smarter Trading Flow"
          highlight="Smarter Trading Flow"
          subtitle="FX Artha separates fund custody, settlement, and trading infrastructure to create a more modern trading architecture."
        />

        <div className="mt-12 md:mt-16 -mx-6 md:mx-0 px-6 md:px-0 overflow-x-auto md:overflow-visible">
          <div className="relative grid grid-flow-col md:grid-flow-row auto-cols-[240px] md:auto-cols-auto md:grid-cols-5 gap-4 md:gap-3 min-w-max md:min-w-0">
            <div
              className="hidden md:block absolute top-[42px] left-[8%] right-[8%] h-px pointer-events-none"
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

        <ScrollReveal variant="fadeUp" delay={0.25}>
          <p
            className="mt-10 text-center text-base md:text-lg font-semibold"
            style={{ color: 'var(--fx-gold-light)' }}
          >
            “Built around transparency, automation, and user control.”
          </p>
        </ScrollReveal>
      </div>
    </section>
  )
}
