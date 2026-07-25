import { Star, TrendingUp, Quote } from 'lucide-react'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

const avatars = ['AQ', 'NS', 'ST', 'OF']

const stats = [
  {
    lead: 'Mirror the best performers, at your own size',
    value: '72',
    unit: '%',
    label: 'Top trader ROI · last 90 days',
  },
  {
    lead: 'Trades copy in automatically through mirrored execution',
    value: '$40M',
    unit: '+',
    label: 'Volume mirrored to followers',
  },
]

export default function FxCopyTrading() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg-elev)' }}>
      <div className="fx-container">
        {/* ── Header: two-tone title left, intro right ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-12 items-start mb-10 md:mb-14">
          <ScrollReveal variant="fadeUp">
            <div>
              <span className="fx-eyebrow mb-5">Copy Trading</span>
              <h2 className="fx-headline text-4xl md:text-5xl lg:text-6xl mt-5 leading-[1.05]">
                <span style={{ color: 'var(--fx-text-3)' }}>Access proven experience</span>
                <br />
                Without the guesswork
              </h2>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <p
              className="text-base md:text-lg lg:pt-4 lg:max-w-sm lg:ml-auto"
              style={{ color: 'var(--fx-text-2)' }}
            >
              Pick a trader whose track record you actually trust. Their trades mirror into your
              account automatically &mdash; at your size, pause whenever you want.
            </p>
          </ScrollReveal>
        </div>

        {/* ── Body: metrics dashboard panel + testimonial card ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-5 items-stretch">
          {/* LEFT — one cohesive metrics panel */}
          <ScrollReveal variant="fadeUp" className="lg:col-span-7">
            <div className="fx-tile h-full p-6 sm:p-8 md:p-9 flex flex-col">
              {/* panel header: verified traders + live status */}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex -space-x-3">
                    {avatars.map((a) => (
                      <div
                        key={a}
                        className="w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold"
                        style={{
                          background: 'linear-gradient(180deg, var(--fx-gold-light), var(--fx-gold))',
                          color: '#1a1408',
                          border: '2px solid var(--fx-bg-elev)',
                        }}
                      >
                        {a}
                      </div>
                    ))}
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold"
                      style={{
                        background: 'var(--fx-bg-elev-2)',
                        color: 'var(--fx-gold-light)',
                        border: '2px solid var(--fx-bg-elev)',
                      }}
                    >
                      +
                    </div>
                  </div>
                  <div
                    className="text-[11px] font-bold uppercase tracking-[0.18em] leading-tight"
                    style={{ color: 'var(--fx-text-3)' }}
                  >
                    500+ Verified Traders
                  </div>
                </div>

                <div
                  className="inline-flex items-center gap-2.5 rounded-full px-3.5 py-2"
                  style={{ background: 'var(--fx-bg)', border: '1px solid var(--fx-line)' }}
                >
                  <span className="relative flex h-2 w-2">
                    <span
                      className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
                      style={{ background: '#4ade80' }}
                    />
                    <span
                      className="relative inline-flex rounded-full h-2 w-2"
                      style={{ background: '#4ade80' }}
                    />
                  </span>
                  <span
                    className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.16em]"
                    style={{ color: 'var(--fx-text-2)' }}
                  >
                    Open for new followers
                  </span>
                </div>
              </div>

              <div className="mt-7 md:mt-8" style={{ borderTop: '1px solid var(--fx-line)' }} />

              {/* two stats split by a vertical rule */}
              <div className="mt-7 md:mt-8 flex-1 grid grid-cols-1 sm:grid-cols-2">
                {stats.map((s, i) => (
                  <div
                    key={s.value}
                    className={`flex flex-col ${
                      i === 1
                        ? 'sm:pl-8 md:pl-10 mt-8 sm:mt-0 pt-8 sm:pt-0 border-t sm:border-t-0 sm:border-l border-[color:var(--fx-line)]'
                        : 'sm:pr-8 md:pr-10'
                    }`}
                  >
                    <p
                      className="text-[15px] md:text-base font-medium leading-snug"
                      style={{ color: 'var(--fx-text)' }}
                    >
                      {s.lead}
                    </p>
                    <div className="mt-auto pt-8">
                      <div className="flex items-end gap-1">
                        <span className="fx-headline text-5xl md:text-6xl leading-none tabular-nums">
                          {s.value}
                        </span>
                        <span
                          className="text-2xl md:text-3xl font-bold pb-1"
                          style={{ color: 'var(--fx-gold-light)' }}
                        >
                          {s.unit}
                        </span>
                      </div>
                      <div
                        className="mt-2.5 text-xs md:text-[13px]"
                        style={{ color: 'var(--fx-text-3)' }}
                      >
                        {s.label}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </ScrollReveal>

          {/* RIGHT — testimonial anchor card (gold) */}
          <ScrollReveal variant="fadeUp" delay={0.12} className="lg:col-span-5">
            <div className="fx-tile-gold relative h-full overflow-hidden p-7 md:p-9 flex flex-col">
              <TrendingUp
                aria-hidden
                size={260}
                strokeWidth={1.25}
                className="absolute -right-10 -bottom-6 pointer-events-none"
                style={{ color: 'rgba(28,22,8,0.09)' }}
              />

              <Quote
                aria-hidden
                size={30}
                className="relative z-[1]"
                style={{ color: 'rgba(28,22,8,0.32)', fill: 'rgba(28,22,8,0.32)' }}
              />

              <p
                className="relative z-[1] mt-5 text-lg md:text-xl font-semibold leading-snug mb-auto"
                style={{ color: '#1c1608' }}
              >
                Thousands mirror verified traders every day &mdash; no guesswork, just proven
                strategy you can pause anytime.
              </p>

              <div
                className="relative z-[1] mt-8 pt-6 flex items-end justify-between gap-4"
                style={{ borderTop: '1px solid rgba(28,22,8,0.18)' }}
              >
                <div className="flex items-end gap-1">
                  <span
                    className="fx-headline text-5xl md:text-6xl leading-none"
                    style={{ color: '#1c1608' }}
                  >
                    4.8
                  </span>
                  <span
                    className="text-xl md:text-2xl font-bold pb-1"
                    style={{ color: 'rgba(28,22,8,0.6)' }}
                  >
                    /5
                  </span>
                </div>
                <div className="text-right">
                  <div className="flex gap-0.5 justify-end mb-1.5">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <Star key={i} size={14} style={{ color: '#1c1608', fill: '#1c1608' }} />
                    ))}
                  </div>
                  <div
                    className="text-[10px] font-bold uppercase tracking-[0.16em] leading-tight"
                    style={{ color: 'rgba(28,22,8,0.72)' }}
                  >
                    Rated by copiers
                    <br />
                    worldwide
                  </div>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>

        <ScrollReveal variant="fadeUp" delay={0.3}>
          <p
            className="mt-10 md:mt-12 text-center text-base md:text-lg italic max-w-2xl mx-auto fx-quote"
            style={{ color: 'var(--fx-text-2)' }}
          >
            &ldquo;Strategy over speculation.&rdquo;
          </p>
        </ScrollReveal>
      </div>
    </section>
  )
}
