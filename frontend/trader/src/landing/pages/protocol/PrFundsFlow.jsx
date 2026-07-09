import { Wallet, UserCheck, BarChart3, Lock, Cog, TrendingUp } from 'lucide-react'
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
        {/* ── Two-column intro ──────────────────────────────── */}
        <div className="fx-split-intro">
          <ScrollReveal variant="fadeUp">
            <div>
              <span className="fx-eyebrow mb-5">How Funds Move</span>
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mt-5">
                How Funds Move <span className="gradient-text">Inside the System</span>
              </h2>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <p className="text-base md:text-lg" style={{ color: 'var(--fx-text-2)' }}>
              Your funds move through a structured smart-contract flow. Trades are executed, results are calculated, and balance is updated in real-time.
            </p>
          </ScrollReveal>
        </div>

        {/* ── Bento: flow tile + image tile ─────────────────── */}
        <div className="fx-bento grid-cols-1 lg:grid-cols-3 mt-10 md:mt-14 items-stretch">
          {/* Funds flow diagram */}
          <ScrollReveal variant="fadeUp" className="lg:col-span-2">
            <div className="fx-tile h-full p-6 md:p-8 flex flex-col md:overflow-x-auto">
              <span className="fx-accent-bar mb-6" />
              <div className="flex flex-wrap md:flex-nowrap items-center gap-4 md:gap-2 md:min-w-0 justify-center md:justify-between">
                {stages.map((s, i) => {
                  const Icon = s.icon
                  const isLast = i === stages.length - 1
                  return (
                    <div key={i} className="flex items-center gap-3 md:gap-2">
                      <div className="flex flex-col items-center gap-2 min-w-[88px]">
                        <div className="feature-icon" style={{ width: 48, height: 48 }}>
                          <Icon size={20} />
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

              <p className="mt-auto pt-6 text-center text-xs md:text-sm" style={{ color: 'var(--fx-text-3)' }}>
                Funds move only based on trading outcomes. No manual intervention.
              </p>
            </div>
          </ScrollReveal>

          {/* Image tile */}
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <div className="fx-tile-media h-full min-h-[280px]">
              <span className="fx-tile-media-label">Image</span>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  )
}
