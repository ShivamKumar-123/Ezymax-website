import { Wallet, Gauge, TrendingUp, Clock } from 'lucide-react'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

/* Leverage worked-example as clean stat cards — one gold-filled accent tile
   (Market Position) sits among the neutral tiles, mirroring the reference. */
const stats = [
  { icon: Wallet,     value: '$100',   label: 'Your Capital' },
  { icon: Gauge,      value: '10×',    label: 'Leverage' },
  { icon: TrendingUp, value: '$1,000', label: 'Market Position', accent: true },
  { icon: Clock,      value: '$0',     label: 'Same-Day Fee' },
]

export default function TxLeverage() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg)' }}>
      <div className="fx-container">
        {/* ── Two-column intro ──────────────────────────────── */}
        <div className="fx-split-intro">
          <ScrollReveal variant="fadeUp">
            <div>
              <span className="fx-eyebrow mb-5">Leverage Rule</span>
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mt-5">
                Leverage, Made <span className="gradient-text">Practical</span>
              </h2>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <p className="text-base md:text-lg" style={{ color: 'var(--fx-text-2)' }}>
              Leverage lets you control a larger position with less capital. The catch most platforms hide — you only owe the fee when you actually hold the position overnight.
            </p>
          </ScrollReveal>
        </div>

        {/* ── Stat cards: the worked example ────────────────── */}
        <div className="mt-12 md:mt-16 grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 items-stretch">
          {stats.map((s, i) => {
            const Icon = s.icon
            return (
              <ScrollReveal key={s.label} variant="fadeUp" delay={i * 0.06}>
                <div
                  className={`h-full p-6 md:p-8 flex flex-col items-center text-center ${
                    s.accent ? 'fx-tile-gold' : 'fx-tile'
                  }`}
                >
                  {s.accent ? (
                    <div
                      className="relative z-[1] mb-5 w-[54px] h-[54px] rounded-2xl flex items-center justify-center"
                      style={{ background: 'rgba(28,22,8,0.14)', border: '1px solid rgba(28,22,8,0.22)' }}
                    >
                      <Icon size={24} style={{ color: '#1c1608' }} />
                    </div>
                  ) : (
                    <div className="feature-icon mb-5" style={{ width: 54, height: 54 }}>
                      <Icon size={24} />
                    </div>
                  )}

                  <div
                    className={`relative z-[1] text-[34px] md:text-[42px] font-extrabold leading-none mb-2 tracking-tight ${
                      s.accent ? '' : 'gradient-text'
                    }`}
                    style={s.accent ? { color: '#1c1608' } : undefined}
                  >
                    {s.value}
                  </div>
                  <div
                    className="relative z-[1] text-[11px] font-bold uppercase tracking-[0.18em]"
                    style={{ color: s.accent ? 'rgba(28,22,8,0.72)' : 'var(--fx-text-3)' }}
                  >
                    {s.label}
                  </div>
                </div>
              </ScrollReveal>
            )
          })}
        </div>

        <ScrollReveal variant="fadeUp" delay={0.3}>
          <p
            className="mt-10 md:mt-12 text-center text-base md:text-lg italic max-w-2xl mx-auto"
            style={{ color: 'var(--fx-text-2)' }}
          >
            &ldquo;You only pay for leverage when you actually use it over time.&rdquo;
          </p>
        </ScrollReveal>
      </div>
    </section>
  )
}
