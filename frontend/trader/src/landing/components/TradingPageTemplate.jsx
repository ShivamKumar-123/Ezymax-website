import { Link } from 'react-router-dom'
import Button from './Button'
import SectionHeader from './SectionHeader'
import ScrollReveal, { ScrollRevealGroup, ScrollRevealItem } from './animations/ScrollReveal'

/* Reference-styled trading landing template.
   Drives /trading/{forex,crypto,commodities,indices}. Content is passed
   in verbatim by each page; only the layout / visual system changed:
   gold design tokens, bento cards, a reference-style stat strip and
   bracketed image placeholders where a product render would sit. */
const TradingPageTemplate = ({
  title,
  subtitle,
  stats,
  about,
  instruments,
  benefits
}) => {
  return (
    <div className="min-h-screen pt-20">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="fx-section" style={{ background: 'var(--fx-bg)' }}>
        <div className="fx-container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
            <ScrollReveal variant="fadeUp">
              <div>
                <span className="fx-eyebrow mb-6">Markets</span>
                <h1 className="fx-headline text-4xl md:text-5xl lg:text-6xl mt-5 mb-6">
                  {title}
                </h1>
                <p className="text-lg md:text-xl max-w-xl mb-9" style={{ color: 'var(--fx-text-2)' }}>
                  {subtitle}
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Link to="/accounts/demo">
                    <Button variant="primary" icon>Start Trading Now</Button>
                  </Link>
                  <Link to="/accounts/demo">
                    <Button variant="ghost">Open Demo Account</Button>
                  </Link>
                </div>
              </div>
            </ScrollReveal>

            <ScrollReveal variant="fadeUp" delay={0.12}>
              <div className="fx-image-slot fx-image-slot-4x3">
                <span className="fx-image-slot-label">Product Shot</span>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── Stat strip ───────────────────────────────────────── */}
      <section className="fx-section" style={{ paddingTop: 0, background: 'var(--fx-bg)' }}>
        <div className="fx-container">
          <ScrollReveal variant="fadeUp">
            <div className="fx-section-frame fx-section-frame-tight p-0 overflow-hidden">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
                {stats.map((stat, index) => (
                  <div key={index} className="fx-stats-cell">
                    <div
                      className="text-[11px] font-bold uppercase tracking-[0.22em] mb-3"
                      style={{ color: 'var(--fx-text-3)' }}
                    >
                      {String(index + 1).padStart(2, '0')}
                    </div>
                    <div className="text-3xl md:text-4xl font-bold gradient-text mb-1">
                      {stat.value}
                    </div>
                    <div className="text-sm" style={{ color: 'var(--fx-text-2)' }}>
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── About + visual ───────────────────────────────────── */}
      <section className="fx-section" style={{ background: 'var(--fx-bg-elev)' }}>
        <div className="fx-container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <ScrollReveal variant="fadeUp">
              <div className="fx-image-slot fx-image-slot-4x3">
                <span className="fx-image-slot-label">Market Visual</span>
              </div>
            </ScrollReveal>
            <ScrollReveal variant="fadeUp" delay={0.1}>
              <div>
                <span className="fx-eyebrow mb-6">Overview</span>
                <h2 className="fx-headline text-3xl md:text-4xl mt-5 mb-6">{about.title}</h2>
                <p className="text-lg leading-relaxed" style={{ color: 'var(--fx-text-2)' }}>
                  {about.description}
                </p>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── Instruments table ────────────────────────────────── */}
      <section className="fx-section" style={{ background: 'var(--fx-bg)' }}>
        <div className="fx-container">
          <ScrollReveal variant="fadeUp">
            <div className="fx-section-frame">
              <div className="flex items-center gap-3 mb-8">
                <span className="fx-eyebrow">Instruments</span>
              </div>
              <h3 className="fx-headline text-2xl md:text-3xl mb-8">Top Tradable Instruments</h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px]">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--fx-line-strong)' }}>
                      <th className="text-left py-4 text-xs font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--fx-text-3)' }}>Symbol</th>
                      <th className="text-left py-4 text-xs font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--fx-text-3)' }}>Spread</th>
                      <th className="text-left py-4 text-xs font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--fx-text-3)' }}>Leverage</th>
                      <th className="text-left py-4 text-xs font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--fx-text-3)' }}>Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {instruments.map((instrument, index) => (
                      <tr
                        key={index}
                        className="transition-colors hover:bg-white/[0.03]"
                        style={{ borderBottom: '1px solid var(--fx-line)' }}
                      >
                        <td className="py-4 font-semibold" style={{ color: 'var(--fx-gold-light)' }}>{instrument.symbol}</td>
                        <td className="py-4" style={{ color: 'var(--fx-text-2)' }}>{instrument.spread}</td>
                        <td className="py-4" style={{ color: 'var(--fx-text-2)' }}>{instrument.leverage}</td>
                        <td className="py-4" style={{ color: 'var(--fx-text-2)' }}>{instrument.margin}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── Benefits bento ───────────────────────────────────── */}
      <section className="fx-section" style={{ background: 'var(--fx-bg-elev)' }}>
        <div className="fx-container">
          <SectionHeader
            badge="Why FXArtha"
            title="Why Trade with FXArtha"
            highlight="FXArtha"
          />
          <ScrollRevealGroup className="mt-12 md:mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
            {benefits.map((benefit, index) => (
              <ScrollRevealItem key={index}>
                <div className="fx-card h-full p-7 md:p-8">
                  <div className="feature-icon text-2xl mb-6" style={{ width: 56, height: 56 }}>
                    <span>{benefit.icon}</span>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">{benefit.title}</h3>
                  <p style={{ color: 'var(--fx-text-2)' }}>{benefit.description}</p>
                </div>
              </ScrollRevealItem>
            ))}
          </ScrollRevealGroup>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────── */}
      <section className="fx-section" style={{ background: 'var(--fx-bg)' }}>
        <div className="fx-container">
          <ScrollReveal variant="fadeUp">
            <div className="fx-section-frame text-center">
              <div className="fx-glow-gold" />
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mb-6">
                Ready to Start Trading?
              </h2>
              <p className="text-lg md:text-xl mb-9 max-w-2xl mx-auto" style={{ color: 'var(--fx-text-2)' }}>
                Open your account today and access global markets with FXArtha.
              </p>
              <div className="flex justify-center">
                <Link to="/accounts/demo">
                  <Button variant="primary" icon>Open Account Now</Button>
                </Link>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </div>
  )
}

export default TradingPageTemplate
