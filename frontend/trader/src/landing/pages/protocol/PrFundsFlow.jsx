import { Wallet, UserCheck, BarChart3, Lock, Cog, TrendingUp } from 'lucide-react'
import SectionHeader from '@/landing/components/SectionHeader'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

const stages = [
  { icon: Wallet,     label: 'Your Wallet' },
  { icon: UserCheck,  label: 'CRM Dashboard' },
  { icon: BarChart3,  label: 'Trading Account' },
  { icon: Lock,       label: 'Smart Contract' },
  { icon: Cog,        label: 'Trade Engine' },
  { icon: TrendingUp, label: 'Result' },
  { icon: Wallet,     label: 'Back to Wallet' },
]

export default function PrFundsFlow() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg)' }}>
      <div className="fx-container">
        <div className="fx-section-frame">
        <SectionHeader
          badge="How Funds Move"
          title="How Funds Move Inside the System"
          highlight="Inside the System"
          subtitle="Your funds move through a structured smart-contract flow. Trades are executed, results are calculated, and balance is updated in real-time."
        />
        <ScrollReveal variant="fadeUp">
          <div
            className="mt-12 md:mt-16 rounded-2xl p-6 md:p-10 md:overflow-x-auto"
            style={{
              background:
                'linear-gradient(160deg, rgba(214,169,61,0.06) 0%, var(--fx-bg-elev-2) 60%)',
              border: '1px solid rgba(214,169,61,0.22)',
            }}
          >
            <div className="flex flex-wrap md:flex-nowrap items-center gap-4 md:gap-2 md:min-w-0 justify-center md:justify-between">
              {stages.map((s, i) => {
                const Icon = s.icon
                const isLast = i === stages.length - 1
                return (
                  <div key={i} className="flex items-center gap-3 md:gap-2">
                    <div className="flex flex-col items-center gap-2 min-w-[88px]">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center"
                        style={{
                          background:
                            'rgba(214,169,61,0.08)',
                          border: '1px solid rgba(214,169,61,0.32)',
                          boxShadow: '0 12px 32px -16px rgba(214,169,61,0.4)',
                        }}
                      >
                        <Icon size={20} style={{ color: 'var(--fx-gold-light)' }} />
                      </div>
                      <span className="text-[11px] md:text-xs font-semibold text-white text-center leading-tight">
                        {s.label}
                      </span>
                    </div>
                    {!isLast && (
                      <svg width="22" height="14" viewBox="0 0 22 14" fill="none" aria-hidden className="hidden md:block" style={{ color: 'var(--fx-gold-light)' }}>
                        <path
                          d="M0 7 L18 7 M14 3 L18 7 L14 11"
                          stroke="currentColor"
                          strokeWidth="1.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>
                )
              })}
            </div>

            <p className="mt-6 text-center text-xs md:text-sm" style={{ color: 'var(--fx-text-3)' }}>
              Funds move only based on trading outcomes. No manual intervention.
            </p>
          </div>
        </ScrollReveal>
        </div>
      </div>
    </section>
  )
}
