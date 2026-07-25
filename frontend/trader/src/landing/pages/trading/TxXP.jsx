import { TrendingUp } from 'lucide-react'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

const improvements = [
  { title: 'Lower Brokerage',     desc: 'Fees reduce as your XP increases.' },
  { title: 'Lower Leverage Fees', desc: 'Pay less as you progress.' },
  { title: 'Tighter Spreads',     desc: 'Better execution at every level.' },
]

const levels = [
  { tier: '1',   label: 'New Trader' },
  { tier: '2',   label: 'Active Trader' },
  { tier: '3',   label: 'Skilled Trader' },
  { tier: '4',   label: 'Advanced Trader' },
  { tier: '5+',  label: 'Elite Trader' },
]

const heights = ['42%', '57%', '72%', '86%', '100%']

export default function TxXP() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg)' }}>
      <div className="fx-container">
        {/* ── Two-column intro ──────────────────────────────── */}
        <div className="fx-split-intro">
          <ScrollReveal variant="fadeUp">
            <div>
              <span className="fx-eyebrow mb-5">XP Progression</span>
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mt-5">
                Your Activity Unlocks <span className="gradient-text">Better Conditions</span>
              </h2>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <p className="text-base md:text-lg" style={{ color: 'var(--fx-text-2)' }}>
              Forget 'Gold tier' upgrades and locked-up benefits. We replaced account tiers with XP — every trade you place quietly improves your conditions.
            </p>
          </ScrollReveal>
        </div>

        <ScrollReveal variant="fadeUp">
          <div className="fx-tile mt-12 md:mt-16 p-6 md:p-8 lg:p-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
              {/* LEFT — minimal: heading, one line, a clean ruled list */}
              <div className="lg:col-span-4">
                <h3 className="text-xl md:text-2xl font-bold text-white leading-tight">
                  The more you trade, the better your conditions.
                </h3>
                <p className="mt-4 text-sm md:text-base" style={{ color: 'var(--fx-text-2)' }}>
                  XP isn&apos;t a badge — it directly shapes your live trading conditions across all three cost components.
                </p>
                <ul className="mt-8">
                  {improvements.map((it, idx) => (
                    <li
                      key={it.title}
                      className="py-4"
                      style={{
                        borderTop: '1px solid var(--fx-line)',
                        borderBottom:
                          idx === improvements.length - 1 ? '1px solid var(--fx-line)' : 'none',
                      }}
                    >
                      <div className="text-sm md:text-[15px] font-semibold text-white">
                        {it.title}
                      </div>
                      <div
                        className="mt-1 text-xs md:text-[13px]"
                        style={{ color: 'var(--fx-text-3)' }}
                      >
                        {it.desc}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {/* RIGHT — Ascending XP ladder; each level rises in one-by-one */}
              <div className="lg:col-span-8">
                <div className="flex items-end gap-2 sm:gap-3 md:gap-4 h-[200px] md:h-[236px]">
                  {levels.map((lv, idx) => {
                    const isLast = idx === levels.length - 1
                    return (
                      <ScrollReveal
                        key={lv.tier}
                        variant="fadeUp"
                        delay={idx * 0.14}
                        className="flex-1 min-w-0 h-full flex flex-col items-center justify-end"
                      >
                        <div
                          className="text-base md:text-xl font-extrabold leading-none mb-2.5 tracking-tight"
                          style={{ color: isLast ? 'var(--fx-gold-light)' : undefined }}
                        >
                          <span className={isLast ? '' : 'gradient-text'}>
                            {String(lv.tier).padStart(2, '0')}
                          </span>
                        </div>
                        <div
                          className="w-full rounded-t-xl relative overflow-hidden"
                          style={{
                            height: heights[idx],
                            background: isLast
                              ? 'linear-gradient(180deg, #f7d873 0%, var(--fx-gold) 58%, var(--fx-gold-dark) 100%)'
                              : 'linear-gradient(180deg, rgba(221,169,46,0.5) 0%, rgba(221,169,46,0.08) 100%)',
                            border: '1px solid rgba(221,169,46,0.4)',
                            borderBottom: 'none',
                            boxShadow: isLast
                              ? '0 0 32px rgba(221,169,46,0.5)'
                              : 'inset 0 1px 0 rgba(255,255,255,0.06)',
                          }}
                        >
                          {/* top sheen */}
                          <div
                            className="absolute inset-x-0 top-0 h-1/3 pointer-events-none"
                            style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0))' }}
                          />
                        </div>
                      </ScrollReveal>
                    )
                  })}
                </div>

                {/* Baseline */}
                <div
                  className="h-px w-full"
                  style={{ background: 'linear-gradient(90deg, rgba(221,169,46,0.08), rgba(221,169,46,0.55), rgba(221,169,46,0.08))' }}
                />

                {/* Level labels — reveal in step with their bars */}
                <div className="flex gap-2 sm:gap-3 md:gap-4 mt-3">
                  {levels.map((lv, idx) => (
                    <ScrollReveal
                      key={lv.tier}
                      variant="fadeUp"
                      delay={idx * 0.14 + 0.05}
                      className="flex-1 min-w-0 text-center"
                    >
                      <div
                        className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider"
                        style={{ color: 'var(--fx-gold-light)' }}
                      >
                        Level {lv.tier}
                      </div>
                      <div className="text-[10px] sm:text-xs font-semibold text-white leading-tight mt-0.5">
                        {lv.label}
                      </div>
                    </ScrollReveal>
                  ))}
                </div>

                <div
                  className="mt-7 pt-5 flex items-center gap-2 text-xs md:text-sm font-semibold"
                  style={{ color: 'var(--fx-gold-light)', borderTop: '1px solid var(--fx-line)' }}
                >
                  <TrendingUp size={16} />
                  More XP &rarr; Lower Costs &rarr; Better Execution
                </div>
              </div>
            </div>
          </div>
        </ScrollReveal>

        <ScrollReveal variant="fadeUp" delay={0.2}>
          <p
            className="mt-10 md:mt-12 text-center text-base md:text-lg italic max-w-2xl mx-auto fx-quote"
            style={{ color: 'var(--fx-text-2)' }}
          >
            &ldquo;The more you trade, the more efficient your trading becomes.&rdquo;
          </p>
        </ScrollReveal>
      </div>
    </section>
  )
}
