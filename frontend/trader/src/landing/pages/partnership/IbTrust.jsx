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

        {/* ── Bento: pillar tiles + one gold accent tile ────── */}
        <div className="fx-bento grid-cols-2 md:grid-cols-4 mt-10 md:mt-14 items-stretch">
          {pillars.map((p, i) => {
            const Icon = p.icon
            const isGold = i === 0
            if (isGold) {
              return (
                <ScrollReveal key={p.label} variant="fadeUp" delay={i * 0.06}>
                  <div className="fx-tile-gold h-full p-5 md:p-6 flex flex-col items-center text-center">
                    <div
                      className="relative z-[1] w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                      style={{ background: 'rgba(28,22,8,0.14)', border: '1px solid rgba(28,22,8,0.22)' }}
                    >
                      <Icon size={18} style={{ color: '#1c1608' }} />
                    </div>
                    <div className="relative z-[1] text-sm md:text-[15px] font-bold leading-snug" style={{ color: '#1c1608' }}>
                      {p.label}
                    </div>
                  </div>
                </ScrollReveal>
              )
            }
            return (
              <ScrollReveal key={p.label} variant="fadeUp" delay={i * 0.06}>
                <div className="fx-tile h-full p-5 md:p-6 flex flex-col items-center text-center">
                  <div className="feature-icon mb-4" style={{ width: 44, height: 44 }}>
                    <Icon size={18} />
                  </div>
                  <div className="text-sm md:text-[15px] font-bold text-white leading-snug">
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
