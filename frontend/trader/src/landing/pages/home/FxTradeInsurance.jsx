import { Link } from 'react-router-dom'
import { ShieldCheck, ArrowRight, CheckCircle2, Info } from 'lucide-react'
import SectionHeader from '@/landing/components/SectionHeader'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

const benefits = [
  'Partial loss coverage',
  'Risk management support',
  'Trade confidence',
]

const tiers = [
  { name: 'Minimal',  cover: '15%', cap: '$250',  accent: 'rgba(148,163,184,0.6)' },
  { name: 'Standard', cover: '30%', cap: '$750',  accent: 'rgba(96,165,250,0.7)' },
  { name: 'Advanced', cover: '50%', cap: '$2,000', accent: 'rgba(167,139,250,0.7)' },
  { name: 'Max',      cover: '75%', cap: '$5,000', accent: 'rgba(236,198,87,0.85)' },
]

export default function FxTradeInsurance() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg-elev)' }}>
      <div className="fx-container">
        <SectionHeader
          badge="Trade Insurance"
          title="Add an Extra Layer of Protection"
          highlight="Protection"
          subtitle="Trade with awareness. Not uncertainty."
        />

        <div className="mt-12 md:mt-16 grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-10 items-stretch">
          {/* ── Left content (40%) ──────────────────────────────── */}
          <ScrollReveal variant="fadeUp" className="lg:col-span-2">
            <div
              className="h-full rounded-2xl p-7 md:p-8"
              style={{
                background: 'linear-gradient(180deg, var(--fx-bg-elev-2) 0%, var(--fx-bg-elev) 100%)',
                border: '1px solid var(--fx-line-strong)',
              }}
            >
              <div className="feature-icon mb-5">
                <ShieldCheck size={20} />
              </div>
              <h3 className="text-2xl md:text-[28px] font-bold text-white mb-4 leading-tight">
                Activate before placing a trade
              </h3>
              <p className="text-sm md:text-base mb-6" style={{ color: 'var(--fx-text-2)' }}>
                Reduce downside risk by enabling protection on eligible trades. Based on
                defined trading rules — no hedging required.
              </p>

              <ul className="space-y-3 mb-7">
                {benefits.map((b) => (
                  <li key={b} className="flex items-center gap-3">
                    <CheckCircle2 size={18} style={{ color: 'var(--fx-gold-light)' }} />
                    <span className="text-sm text-white">{b}</span>
                  </li>
                ))}
              </ul>

              <Link to="/insurance" className="fx-btn-primary">
                Explore Trade Protection
                <ArrowRight size={16} />
              </Link>
            </div>
          </ScrollReveal>

          {/* ── Right tier grid (60%) ──────────────────────────── */}
          <div className="lg:col-span-3 grid grid-cols-2 gap-4 md:gap-5">
            {tiers.map((tier, i) => (
              <ScrollReveal key={tier.name} variant="fadeUp" delay={i * 0.06}>
                <div
                  className="relative h-full rounded-2xl p-5 md:p-6 overflow-hidden"
                  style={{
                    background:
                      'linear-gradient(180deg, var(--fx-bg-elev-2) 0%, var(--fx-bg) 100%)',
                    border: `1px solid ${tier.accent}`,
                  }}
                >
                  <div
                    className="absolute -top-px left-[18%] right-[18%] h-px"
                    style={{
                      background: `linear-gradient(90deg, transparent, ${tier.accent}, transparent)`,
                    }}
                  />
                  <div className="flex items-center justify-between mb-5">
                    <span
                      className="text-[11px] font-bold uppercase tracking-[0.22em]"
                      style={{ color: 'var(--fx-text-3)' }}
                    >
                      Tier
                    </span>
                    <span
                      className="text-[11px] font-bold uppercase tracking-[0.22em]"
                      style={{ color: tier.accent }}
                    >
                      {tier.name}
                    </span>
                  </div>

                  <div className="mb-4">
                    <div
                      className="text-[11px] uppercase tracking-wider mb-1"
                      style={{ color: 'var(--fx-text-3)' }}
                    >
                      Loss Cover
                    </div>
                    <div className="text-3xl md:text-4xl font-bold gradient-text">
                      {tier.cover}
                    </div>
                  </div>
                  <div
                    className="pt-3 flex justify-between items-center"
                    style={{ borderTop: '1px solid var(--fx-line)' }}
                  >
                    <span className="text-xs" style={{ color: 'var(--fx-text-3)' }}>
                      Max Cap
                    </span>
                    <span className="text-sm font-bold text-white">{tier.cap}</span>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>

        <ScrollReveal variant="fadeUp" delay={0.2}>
          <p
            className="mt-8 text-center text-xs md:text-sm inline-flex items-center gap-2 justify-center w-full"
            style={{ color: 'var(--fx-text-3)' }}
          >
            <Info size={14} /> Applicable on eligible trades · No hedging · Trade conditions apply
          </p>
        </ScrollReveal>
      </div>
    </section>
  )
}
