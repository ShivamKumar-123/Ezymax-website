import { Scale, Clock, Moon, CheckCircle2, XCircle, Sun } from 'lucide-react'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

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

        <div className="mt-12 md:mt-16 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-stretch">
          {/* LEFT — Explanation + example */}
          <ScrollReveal variant="fadeUp">
            <div className="fx-tile h-full p-7 md:p-8">
              <div className="feature-icon mb-5" style={{ width: 48, height: 48 }}>
                <Scale size={20} />
              </div>
              <span className="fx-accent-bar mb-4" />
              <h3 className="text-2xl md:text-[28px] font-bold text-white mb-4 leading-tight">
                Control more with less — pay only when it matters.
              </h3>
              <p className="text-base mb-6" style={{ color: 'var(--fx-text-2)' }}>
                A simple example shows how the math works:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="fx-stat-chart p-5 flex flex-col">
                  <div className="fx-chart-curve" />
                  <div className="relative z-[1] text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--fx-text-3)' }}>
                    Your Capital
                  </div>
                  <div className="relative z-[1] text-3xl md:text-4xl font-bold gradient-text">$100</div>
                </div>
                <div className="fx-stat-chart p-5 flex flex-col">
                  <div className="fx-chart-curve" />
                  <div className="relative z-[1] text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--fx-text-3)' }}>
                    Leverage
                  </div>
                  <div className="relative z-[1] text-3xl md:text-4xl font-bold gradient-text">10Ã—</div>
                </div>
                <div className="fx-stat-chart p-5 flex flex-col">
                  <div className="fx-chart-curve" />
                  <div className="relative z-[1] text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--fx-text-3)' }}>
                    Position
                  </div>
                  <div className="relative z-[1] text-3xl md:text-4xl font-bold gradient-text">$1,000</div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <CheckCircle2 size={18} style={{ color: 'var(--fx-gold-light)' }} />
                  <span className="text-sm md:text-[15px] text-white">
                    Close trade <b>same day</b> → <span style={{ color: 'var(--fx-gold-light)' }}>No leverage fee</span>
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <XCircle size={18} style={{ color: '#f87171' }} />
                  <span className="text-sm md:text-[15px] text-white">
                    Hold <b>overnight</b> → <span style={{ color: '#f87171' }}>Leverage fee applies</span>
                  </span>
                </div>
              </div>
            </div>
          </ScrollReveal>

          {/* RIGHT — Timeline visual */}
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <div className="fx-tile relative h-full p-7 md:p-8 overflow-hidden">
              <div className="absolute inset-0 fx-grid-bg" />
              <div className="relative">
                <div className="text-[11px] font-bold uppercase tracking-[0.22em] mb-6" style={{ color: 'var(--fx-gold-light)' }}>
                  Leverage Fee Timeline
                </div>

                {/* Timeline node 1 */}
                <TimelineNode
                  icon={Clock}
                  iconColor="#ecc657"
                  ring="rgba(214,169,61,0.45)"
                  title="Open Trade"
                  desc="Leverage activated, no fee yet."
                  showLine
                />

                {/* Branch row — Day vs Night */}
                <div className="grid grid-cols-2 gap-4 my-1 ml-[44px] pl-3"
                     style={{ borderLeft: '2px dashed rgba(214,169,61,0.35)' }}>
                  {/* Day branch */}
                  <div
                    className="rounded-xl p-4"
                    style={{
                      background: 'rgba(214,169,61,0.08)',
                      border: '1px solid rgba(214,169,61,0.35)',
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Sun size={14} style={{ color: 'var(--fx-gold-light)' }} />
                      <span className="text-[11px] uppercase tracking-wider font-bold" style={{ color: 'var(--fx-gold-light)' }}>
                        Same Day
                      </span>
                    </div>
                    <div className="text-sm font-bold text-white mb-1">Close before end of day</div>
                    <div className="text-xs" style={{ color: 'var(--fx-gold-light)' }}>
                      No leverage fee
                    </div>
                  </div>

                  {/* Night branch */}
                  <div
                    className="rounded-xl p-4"
                    style={{
                      background: 'rgba(248,113,113,0.08)',
                      border: '1px solid rgba(248,113,113,0.35)',
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Moon size={14} style={{ color: '#f87171' }} />
                      <span className="text-[11px] uppercase tracking-wider font-bold" style={{ color: '#f87171' }}>
                        Overnight
                      </span>
                    </div>
                    <div className="text-sm font-bold text-white mb-1">Position held past 00:00</div>
                    <div className="text-xs" style={{ color: '#f87171' }}>
                      Leverage fee charged
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>

        <ScrollReveal variant="fadeUp" delay={0.2}>
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

function TimelineNode({ icon: Icon, iconColor, ring, title, desc, showLine }) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex flex-col items-center">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
          style={{
            background: 'var(--fx-bg)',
            border: `1px solid ${ring}`,
            boxShadow: `0 0 0 4px ${ring.replace(/0\.\d+/, '0.10')}`,
          }}
        >
          <Icon size={16} style={{ color: iconColor }} />
        </div>
        {showLine && (
          <div
            className="w-px h-6 mt-1"
            style={{ background: 'rgba(214,169,61,0.35)' }}
          />
        )}
      </div>
      <div className="pt-1.5">
        <div className="text-sm md:text-base font-bold text-white">{title}</div>
        <div className="text-xs md:text-sm" style={{ color: 'var(--fx-text-2)' }}>
          {desc}
        </div>
      </div>
    </div>
  )
}
