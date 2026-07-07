import { Link } from 'react-router-dom'
import { ShieldCheck, ArrowRight, CheckCircle2, Info } from 'lucide-react'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

const benefits = [
  'Partial loss coverage',
  'Risk management support',
  'Trade confidence',
]

const tiers = [
  { name: 'Minimal',  cover: '15%', cap: '$250' },
  { name: 'Standard', cover: '30%', cap: '$750' },
  { name: 'Advanced', cover: '50%', cap: '$2,000' },
  { name: 'Max',      cover: '75%', cap: '$5,000' },
]

export default function FxTradeInsurance() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg-elev)' }}>
      <div className="fx-container">
        {/* ── Two-column intro ──────────────────────────────── */}
        <div className="fx-split-intro">
          <ScrollReveal variant="fadeUp">
            <div>
              <span className="fx-eyebrow mb-5">Trade Insurance</span>
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mt-5">
                Add an Extra Layer of <span className="gradient-text">Protection</span>
              </h2>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <p className="text-base md:text-lg" style={{ color: 'var(--fx-text-2)' }}>
              Before you place a trade you can flip on a cushion that absorbs part of the loss if it goes wrong.
            </p>
          </ScrollReveal>
        </div>

        {/* ── Bento: gold tile + 2x2 stat-chart grid ────────── */}
        <div className="fx-bento grid-cols-1 lg:grid-cols-5 mt-12 md:mt-16 items-stretch">
          {/* ── Gold accent block ─────────────────────────────── */}
          <ScrollReveal variant="fadeUp" className="lg:col-span-2">
            <div className="fx-tile-gold h-full p-7 md:p-8 flex flex-col">
              <div
                className="relative z-[1] w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                style={{ background: 'rgba(28,22,8,0.14)', border: '1px solid rgba(28,22,8,0.22)' }}
              >
                <ShieldCheck size={20} style={{ color: '#1c1608' }} />
              </div>
              <span className="fx-accent-bar mb-4 relative z-[1]" />
              <h3 className="relative z-[1] text-2xl md:text-[28px] font-bold mb-4 leading-tight" style={{ color: '#1c1608' }}>
                Activate before placing a trade
              </h3>
              <p className="relative z-[1] text-sm md:text-base mb-6" style={{ color: 'rgba(28,22,8,0.78)' }}>
                Reduce downside risk by enabling protection on eligible trades. Based on
                defined trading rules — no hedging required.
              </p>

              <ul className="relative z-[1] space-y-3 mb-7">
                {benefits.map((b) => (
                  <li key={b} className="flex items-center gap-3">
                    <CheckCircle2 size={18} style={{ color: '#1c1608' }} />
                    <span className="text-sm font-medium" style={{ color: '#1c1608' }}>{b}</span>
                  </li>
                ))}
              </ul>

              <Link to="/insurance" className="fx-btn-primary relative z-[1] mt-auto">
                Explore Trade Protection
                <ArrowRight size={16} />
              </Link>
            </div>
          </ScrollReveal>

          {/* ── Right: 2x2 stat-chart tier grid ───────────────── */}
          <div className="lg:col-span-3 grid grid-cols-2 gap-4 md:gap-5">
            {tiers.map((tier, i) => (
              <ScrollReveal key={tier.name} variant="fadeUp" delay={i * 0.06}>
                <div className="fx-stat-chart h-full p-5 md:p-6 flex flex-col">
                  <div className="fx-chart-curve" />
                  <div className="relative z-[1] flex items-center justify-between mb-5">
                    <span
                      className="text-[11px] font-bold uppercase tracking-[0.22em]"
                      style={{ color: 'var(--fx-text-3)' }}
                    >
                      Tier
                    </span>
                    <span
                      className="text-[11px] font-bold uppercase tracking-[0.22em]"
                      style={{ color: 'var(--fx-gold-light)' }}
                    >
                      {tier.name}
                    </span>
                  </div>

                  <div className="relative z-[1] mb-4">
                    <div
                      className="text-[11px] uppercase tracking-wider mb-1"
                      style={{ color: 'var(--fx-text-3)' }}
                    >
                      Loss Cover
                    </div>
                    <div className="text-4xl font-bold gradient-text">
                      {tier.cover}
                    </div>
                  </div>
                  <div
                    className="relative z-[1] mt-auto pt-3 flex justify-between items-center"
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

        <ScrollReveal variant="fadeUp" delay={0.3}>
          <p
            className="mt-8 md:mt-10 text-center text-base md:text-lg italic max-w-2xl mx-auto"
            style={{ color: 'var(--fx-text-2)' }}
          >
            &ldquo;Trade with awareness. Not uncertainty.&rdquo;
          </p>
        </ScrollReveal>
      </div>
    </section>
  )
}
