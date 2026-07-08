import { Star, TrendingUp } from 'lucide-react'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

const avatars = ['AQ', 'NS', 'ST', 'OF']

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
              account automatically — at your size, pause whenever you want.
            </p>
          </ScrollReveal>
        </div>

        {/* ── Bento grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5 items-stretch">
          {/* Column 1 — avatars (short) + ROI stat (tall) */}
          <div className="flex flex-col gap-4 md:gap-5">
            <ScrollReveal variant="fadeUp">
              <div className="fx-tile p-6 flex items-center gap-4">
                <div className="flex -space-x-3">
                  {avatars.map((a) => (
                    <div
                      key={a}
                      className="w-10 h-10 rounded-full flex items-center justify-center text-[11px] font-bold"
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
                    className="w-10 h-10 rounded-full flex items-center justify-center text-[11px] font-bold"
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
            </ScrollReveal>

            <ScrollReveal variant="fadeUp" delay={0.05} className="flex-1">
              <div className="fx-tile h-full p-6 md:p-7 flex flex-col">
                <p className="text-base md:text-lg font-medium leading-snug" style={{ color: 'var(--fx-text)' }}>
                  Mirror the best performers, at your own size
                </p>
                <div className="mt-auto pt-10">
                  <div className="flex items-end gap-1">
                    <span className="fx-headline text-5xl md:text-6xl leading-none">72</span>
                    <span className="text-2xl md:text-3xl font-bold pb-1" style={{ color: 'var(--fx-gold-light)' }}>
                      %
                    </span>
                  </div>
                  <div className="mt-2 text-sm" style={{ color: 'var(--fx-text-3)' }}>
                    Top trader ROI · last 90 days
                  </div>
                </div>
              </div>
            </ScrollReveal>
          </div>

          {/* Column 2 — volume stat (tall) + status pill (short) */}
          <div className="flex flex-col gap-4 md:gap-5">
            <ScrollReveal variant="fadeUp" delay={0.1} className="flex-1">
              <div className="fx-tile h-full p-6 md:p-7 flex flex-col">
                <p className="text-base md:text-lg font-medium leading-snug" style={{ color: 'var(--fx-text)' }}>
                  Trades copy in automatically through mirrored execution
                </p>
                <div className="mt-auto pt-10">
                  <div className="flex items-end gap-1">
                    <span className="fx-headline text-5xl md:text-6xl leading-none">$40M</span>
                    <span className="text-2xl md:text-3xl font-bold pb-1" style={{ color: 'var(--fx-gold-light)' }}>
                      +
                    </span>
                  </div>
                  <div className="mt-2 text-sm" style={{ color: 'var(--fx-text-3)' }}>
                    Volume mirrored to followers
                  </div>
                </div>
              </div>
            </ScrollReveal>

            <ScrollReveal variant="fadeUp" delay={0.15}>
              <div className="fx-tile p-4 md:p-5 flex items-center gap-2.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span
                    className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
                    style={{ background: '#4ade80' }}
                  />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: '#4ade80' }} />
                </span>
                <span
                  className="text-[11px] md:text-xs font-bold uppercase tracking-[0.16em]"
                  style={{ color: 'var(--fx-text-2)' }}
                >
                  Open for new followers
                </span>
              </div>
            </ScrollReveal>
          </div>

          {/* Column 3 — anchor stat card (gold) */}
          <ScrollReveal variant="fadeUp" delay={0.2} className="h-full">
            <div className="fx-tile-gold relative h-full overflow-hidden p-7 md:p-8 flex flex-col">
              <TrendingUp
                aria-hidden
                size={260}
                strokeWidth={1.25}
                className="absolute -right-8 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: 'rgba(28,22,8,0.10)' }}
              />
              <p
                className="relative z-[1] text-lg md:text-xl font-semibold leading-snug mb-auto"
                style={{ color: '#1c1608' }}
              >
                Thousands mirror verified traders every day — no guesswork, just proven strategy you
                can pause anytime.
              </p>
              <div className="relative z-[1] mt-8 flex items-end justify-between gap-4">
                <div className="flex items-end gap-1">
                  <span className="fx-headline text-5xl md:text-6xl leading-none" style={{ color: '#1c1608' }}>
                    4.8
                  </span>
                  <span className="text-xl md:text-2xl font-bold pb-1" style={{ color: 'rgba(28,22,8,0.6)' }}>
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
            className="mt-10 md:mt-12 text-center text-base md:text-lg italic max-w-2xl mx-auto"
            style={{ color: 'var(--fx-text-2)' }}
          >
            &ldquo;Strategy over speculation.&rdquo;
          </p>
        </ScrollReveal>
      </div>
    </section>
  )
}
