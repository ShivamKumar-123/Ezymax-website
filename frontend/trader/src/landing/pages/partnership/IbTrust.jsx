import { Lock, Eye, Wallet, BarChart3 } from 'lucide-react'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

const pillars = [
  { icon: Lock,      label: 'Smart contract-based settlement' },
  { icon: Eye,       label: 'Transparent reward logic' },
  { icon: BarChart3, label: 'Real-time analytics' },
  { icon: Wallet,    label: 'User-controlled wallet connectivity' },
]

export default function IbTrust() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg-elev)' }}>
      <div className="fx-container">
        {/* ── Two-column intro ──────────────────────────────── */}
        <div className="fx-split-intro">
          <ScrollReveal variant="fadeUp">
            <div>
              <span className="fx-eyebrow mb-5">Trust &amp; Transparency</span>
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mt-5">
                Built Around <span className="gradient-text">Transparency</span>
              </h2>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <p className="text-base md:text-lg" style={{ color: 'var(--fx-text-2)' }}>
              The bits you can actually inspect: the contract, the reward math, the dashboard, and your own wallet.
            </p>
          </ScrollReveal>
        </div>

        {/* ── Clean dark pillar cards ───────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6 mt-10 md:mt-14">
          {pillars.map((p, i) => {
            const Icon = p.icon
            return (
              <ScrollReveal key={p.label} variant="fadeUp" delay={i * 0.06}>
                <div className="fx-tile h-full p-6 md:p-7 flex flex-col">
                  <div className="feature-icon mb-5" style={{ width: 46, height: 46 }}>
                    <Icon size={19} />
                  </div>
                  <span className="fx-accent-bar mb-4" />
                  <div className="text-base md:text-[17px] font-bold text-white leading-snug">
                    {p.label}
                  </div>
                </div>
              </ScrollReveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}
