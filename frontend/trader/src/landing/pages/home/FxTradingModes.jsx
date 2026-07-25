import ScrollReveal from '@/landing/components/animations/ScrollReveal'

const modes = [
  {
    n: '01',
    title: 'Fully Funded Trading',
    desc: 'Trade using your available capital without leverage.',
    features: ['No borrowing', 'No overnight costs', 'Clear risk exposure'],
    accent: true,
  },
  {
    n: '02',
    title: 'Leveraged Trading',
    desc: 'Access larger positions using leverage based on your preference.',
    features: [
      'Adjustable leverage',
      'Optimized capital usage',
      'Transparent cost on leveraged exposure',
    ],
    note: 'Costs apply only when leverage is used.',
  },
]

export default function FxTradingModes() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg)' }}>
      <div className="fx-container">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
          {/* ── Left: editorial column + anchored visual ── */}
          <div className="lg:col-span-5">
            <ScrollReveal variant="fadeUp">
              <div>
                <span className="fx-eyebrow">Trading Modes</span>
                <h2 className="fx-headline text-3xl md:text-4xl lg:text-[44px] mt-6 leading-[1.08]">
                  Flexible Trading Built Around{' '}
                  <span className="gradient-text">Your Strategy</span>
                </h2>
                <p
                  className="mt-6 text-base md:text-lg max-w-md"
                  style={{ color: 'var(--fx-text-2)' }}
                >
                  Two ways to trade. Same platform, same fair rules — pick whichever matches how
                  much risk you're willing to carry today.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal variant="fadeUp" delay={0.12}>
              <figure
                className="relative mt-10 lg:mt-12 rounded-[1.25rem] overflow-hidden"
                style={{ border: '1px solid var(--fx-line)' }}
              >
                <img
                  src="/images/hero_card1.png"
                  alt="Flexible trading"
                  className="w-full h-[240px] lg:h-[320px] object-cover"
                />
                {/* veil so the image seats into the page instead of floating */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      'linear-gradient(180deg, rgba(8,9,11,0) 40%, rgba(8,9,11,0.8) 100%)',
                  }}
                />
              </figure>
            </ScrollReveal>
          </div>

          {/* ── Right: the two modes as hairline-separated editorial rows ── */}
          <div className="lg:col-span-7 lg:pt-2">
            {modes.map((m, i) => (
              <ScrollReveal key={m.title} variant="fadeUp" delay={0.08 * (i + 1)}>
                <article
                  className="group relative py-9 md:py-11"
                  style={{
                    borderTop: '1px solid var(--fx-line)',
                    borderBottom:
                      i === modes.length - 1 ? '1px solid var(--fx-line)' : 'none',
                  }}
                >
                  {/* warm wash that bleeds in from the left on hover */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0 -left-5 -right-5 rounded-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                    style={{
                      background:
                        'linear-gradient(90deg, rgba(221,169,46,0.08), rgba(221,169,46,0) 58%)',
                    }}
                  />
                  {/* gold tick that draws along the top rule on hover */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute left-0 top-0 h-px w-0 transition-all duration-500 group-hover:w-24"
                    style={{
                      background:
                        'linear-gradient(90deg, var(--fx-gold-light), rgba(221,169,46,0))',
                    }}
                  />

                  <div className="relative flex items-start gap-5 md:gap-8">
                    <span
                      className={`shrink-0 text-[34px] md:text-[44px] font-bold leading-none tabular-nums transition-opacity duration-300 ${
                        m.accent ? 'gradient-text' : 'opacity-45 group-hover:opacity-70'
                      }`}
                      style={m.accent ? undefined : { color: 'var(--fx-text-3)' }}
                    >
                      {m.n}
                    </span>

                    <div className="min-w-0">
                      <h3 className="text-xl md:text-2xl font-bold text-white leading-snug">
                        {m.title}
                      </h3>
                      <p className="mt-2.5 text-base" style={{ color: 'var(--fx-text-2)' }}>
                        {m.desc}
                      </p>

                      <ul className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2.5">
                        {m.features.map((f) => (
                          <li
                            key={f}
                            className="flex items-center gap-2 text-sm"
                            style={{ color: 'var(--fx-text-2)' }}
                          >
                            <span
                              className="w-1 h-1 rounded-full shrink-0"
                              style={{ background: 'var(--fx-gold)' }}
                            />
                            {f}
                          </li>
                        ))}
                      </ul>

                      {m.note && (
                        <p
                          className="mt-5 text-xs italic"
                          style={{ color: 'var(--fx-text-3)' }}
                        >
                          {m.note}
                        </p>
                      )}
                    </div>
                  </div>
                </article>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
