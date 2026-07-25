import { Link } from 'react-router-dom'
import { ShieldCheck, ArrowRight, CheckCircle2, Info } from 'lucide-react'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

const benefits = ['Partial loss coverage', 'Risk management support', 'Trade confidence']

/* Heights rise with the coverage figure so the row reads as a ladder:
   the shape itself carries the meaning before you read a single number. */
const tiers = [
  { name: 'Minimal', cover: '15%', cap: '$250', h: 208 },
  { name: 'Standard', cover: '30%', cap: '$750', h: 248 },
  { name: 'Advanced', cover: '50%', cap: '$2,000', h: 296 },
  { name: 'Max', cover: '75%', cap: '$5,000', h: 344, top: true },
]

export default function FxTradeInsurance() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg-elev)' }}>
      <div className="fx-container">
        {/* ── Editorial header, baseline-aligned under a hairline rule ── */}
        <div
          className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-end pb-8 md:pb-10"
          style={{ borderBottom: '1px solid var(--fx-line)' }}
        >
          <ScrollReveal variant="fadeUp" className="lg:col-span-7">
            <div>
              <span className="fx-eyebrow">Trade Insurance</span>
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-[46px] mt-6 leading-[1.08]">
                Add an Extra Layer of <span className="gradient-text">Protection</span>
              </h2>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1} className="lg:col-span-5">
            <p className="text-base md:text-lg" style={{ color: 'var(--fx-text-2)' }}>
              Before you place a trade you can flip on a cushion that absorbs part of the loss if
              it goes wrong.
            </p>
          </ScrollReveal>
        </div>

        {/* ── Coverage ladder ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 items-end mt-12 md:mt-16">
          {tiers.map((t, i) => (
            <ScrollReveal key={t.name} variant="fadeUp" delay={i * 0.07}>
              <div
                className={`fx-tier${t.top ? ' fx-tier-top' : ''} relative rounded-2xl p-5 md:p-6 flex flex-col justify-between overflow-hidden hover:-translate-y-1.5`}
                style={{ minHeight: t.h }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="text-[10px] font-bold uppercase tracking-[0.22em]"
                    style={{ color: 'var(--tier-label)' }}
                  >
                    Tier
                  </span>
                  <span
                    className="text-[10px] font-bold uppercase tracking-[0.22em]"
                    style={{ color: 'var(--tier-name)' }}
                  >
                    {t.name}
                  </span>
                </div>

                <div>
                  <div
                    className="text-[10px] uppercase tracking-wider mb-1.5"
                    style={{ color: 'var(--tier-label)' }}
                  >
                    Loss Cover
                  </div>
                  <div className="fx-tier-value gradient-text text-4xl md:text-5xl font-bold leading-none">
                    {t.cover}
                  </div>
                  <div
                    className="mt-5 pt-3 flex items-center justify-between"
                    style={{ borderTop: '1px solid var(--tier-line)' }}
                  >
                    <span className="text-xs" style={{ color: 'var(--tier-label)' }}>
                      Max Cap
                    </span>
                    <span className="text-sm font-bold" style={{ color: 'var(--tier-cap)' }}>
                      {t.cap}
                    </span>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>

        {/* ── Activation band ── */}
        <ScrollReveal variant="fadeUp" delay={0.12}>
          <div
            className="relative mt-5 md:mt-6 rounded-2xl overflow-hidden p-7 md:p-9"
            style={{ background: 'var(--fx-bg)', border: '1px solid var(--fx-line)' }}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute top-0 left-[6%] right-[6%] h-px"
              style={{
                background:
                  'linear-gradient(90deg, transparent, var(--fx-gold-light), transparent)',
              }}
            />
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
              <div className="lg:col-span-6 flex items-start gap-4">
                <div className="fx-icon-badge shrink-0" style={{ width: 48, height: 48 }}>
                  <ShieldCheck size={20} style={{ color: 'var(--fx-gold-light)' }} />
                </div>
                <div>
                  <h3 className="text-xl md:text-2xl font-bold text-white leading-snug">
                    Activate before placing a trade
                  </h3>
                  <p className="mt-2.5 text-sm md:text-base" style={{ color: 'var(--fx-text-2)' }}>
                    Reduce downside risk by enabling protection on eligible trades. Based on
                    defined trading rules — no hedging required.
                  </p>
                </div>
              </div>

              <ul className="lg:col-span-3 space-y-3">
                {benefits.map((b) => (
                  <li
                    key={b}
                    className="flex items-center gap-2.5 text-sm"
                    style={{ color: 'var(--fx-text-2)' }}
                  >
                    <CheckCircle2 size={16} className="shrink-0" style={{ color: 'var(--fx-gold-light)' }} />
                    {b}
                  </li>
                ))}
              </ul>

              <div className="lg:col-span-3 lg:justify-self-end">
                <Link to="/insurance" className="fx-btn-primary justify-center whitespace-nowrap">
                  Explore Trade Protection
                  <ArrowRight size={16} className="shrink-0" />
                </Link>
              </div>
            </div>
          </div>
        </ScrollReveal>

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
            className="mt-8 md:mt-10 text-center text-base md:text-lg italic max-w-2xl mx-auto fx-quote"
            style={{ color: 'var(--fx-text-2)' }}
          >
            &ldquo;Trade with awareness. Not uncertainty.&rdquo;
          </p>
        </ScrollReveal>
      </div>
    </section>
  )
}
