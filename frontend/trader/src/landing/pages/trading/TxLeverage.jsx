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

        {/* ── Stat cards: the worked example ──────────────────
             Each card is dark at rest and flips fully gold on hover; the
             accent card (Market Position) is gold at rest via the same rule,
             so hovered and accent can never drift apart. Colours are driven
             by custom properties so one rule recolours the whole card. */}
        <div className="mt-12 md:mt-16 grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 items-stretch">
          {stats.map((s, i) => {
            const Icon = s.icon
            return (
              <ScrollReveal key={s.label} variant="fadeUp" delay={i * 0.06}>
                <div
                  className={`fx-stat-card${s.accent ? ' fx-stat-card-accent' : ''} h-full p-6 md:p-8 flex flex-col items-center text-center`}
                >
                  <div className="fx-stat-icon mb-5">
                    <Icon size={24} strokeWidth={1.75} />
                  </div>

                  <div className="fx-stat-value gradient-text text-[34px] md:text-[42px] font-extrabold leading-none mb-2 tracking-tight">
                    {s.value}
                  </div>
                  <div className="fx-stat-label text-[11px] font-bold uppercase tracking-[0.18em]">
                    {s.label}
                  </div>
                </div>
              </ScrollReveal>
            )
          })}
        </div>

        <ScrollReveal variant="fadeUp" delay={0.3}>
          <p
            className="mt-10 md:mt-12 text-center text-base md:text-lg italic max-w-2xl mx-auto fx-quote"
            style={{ color: 'var(--fx-text-2)' }}
          >
            &ldquo;You only pay for leverage when you actually use it over time.&rdquo;
          </p>
        </ScrollReveal>
      </div>
    </section>
  )
}
