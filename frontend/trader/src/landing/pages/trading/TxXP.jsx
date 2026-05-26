import { Zap, ArrowDownRight } from 'lucide-react'
import SectionHeader from '@/landing/components/SectionHeader'
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

export default function TxXP() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg)' }}>
      <div className="fx-container">
        <SectionHeader
          badge="XP Progression"
          title="Your Activity Unlocks Better Conditions"
          highlight="Better Conditions"
          subtitle="Forget 'Gold tier' upgrades and locked-up benefits. We replaced account tiers with XP — every trade you place quietly improves your conditions."
        />

        <ScrollReveal variant="fadeUp">
          <div
            className="mt-12 md:mt-16 rounded-2xl p-6 md:p-8 lg:p-10"
            style={{
              background: 'linear-gradient(180deg, var(--fx-bg-elev-2) 0%, var(--fx-bg-elev) 100%)',
              border: '1px solid var(--fx-line-strong)',
            }}
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
              {/* LEFT — text + benefits */}
              <div className="lg:col-span-4">
                <div className="feature-icon mb-4">
                  <Zap size={20} />
                </div>
                <h3 className="text-xl md:text-2xl font-bold text-white leading-tight mb-3">
                  The more you trade, the better your conditions.
                </h3>
                <p className="text-sm md:text-base mb-5" style={{ color: 'var(--fx-text-2)' }}>
                  XP isn&apos;t a badge — it directly shapes your live trading conditions across all three cost components.
                </p>
                <ul className="space-y-3">
                  {improvements.map((i) => (
                    <li key={i.title} className="flex items-start gap-3">
                      <ArrowDownRight size={16} style={{ color: '#4ade80', marginTop: 3 }} />
                      <div>
                        <div className="text-sm font-bold text-white">{i.title}</div>
                        <div className="text-xs" style={{ color: 'var(--fx-text-3)' }}>{i.desc}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {/* RIGHT — Horizontal level bar */}
              <div className="lg:col-span-8">
                <div className="relative">
                  {/* Glow background line */}
                  <div
                    className="absolute left-0 right-0 h-[6px] rounded-full"
                    style={{
                      top: 22,
                      background:
                        'linear-gradient(90deg, rgba(214,169,61,0.18) 0%, rgba(214,169,61,0.65) 50%, rgba(214,169,61,1) 100%)',
                      boxShadow: '0 0 18px rgba(214,169,61,0.45)',
                    }}
                  />

                  {/* XP floating chip */}
                  <div
                    className="absolute left-1/2 -translate-x-1/2 -top-3 px-3 py-1 rounded-md text-[11px] font-extrabold"
                    style={{
                      background: 'linear-gradient(135deg, var(--fx-gold-light), var(--fx-gold))',
                      color: '#1a1408',
                      letterSpacing: '0.08em',
                      boxShadow: '0 6px 18px rgba(214,169,61,0.45)',
                    }}
                  >
                    XP
                  </div>

                  {/* Level nodes */}
                  <div className="relative grid grid-cols-5 gap-2 pt-12">
                    {levels.map((lv, idx) => {
                      const isLast = idx === levels.length - 1
                      return (
                        <div key={lv.tier} className="flex flex-col items-center text-center">
                          <div
                            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs sm:text-sm font-extrabold mb-2 -mt-[34px]"
                            style={{
                              background: isLast
                                ? 'linear-gradient(135deg, var(--fx-gold-light), var(--fx-gold))'
                                : 'var(--fx-bg-elev-2)',
                              border: isLast
                                ? '2px solid rgba(214,169,61,0.85)'
                                : '2px solid rgba(214,169,61,0.55)',
                              color: isLast ? '#1a1408' : 'var(--fx-gold-light)',
                              boxShadow: isLast ? '0 0 14px rgba(214,169,61,0.6)' : 'none',
                            }}
                          >
                            {lv.tier}
                          </div>
                          <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--fx-gold-light)' }}>
                            Level {lv.tier}
                          </div>
                          <div className="text-[10px] sm:text-[11px]" style={{ color: 'var(--fx-text-3)' }}>
                            {lv.label}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div
                    className="mt-8 text-center text-xs md:text-sm font-semibold"
                    style={{ color: 'var(--fx-gold-light)' }}
                  >
                    More XP &rarr; Lower Costs &rarr; Better Execution
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ScrollReveal>

        <ScrollReveal variant="fadeUp" delay={0.2}>
          <p
            className="mt-10 md:mt-12 text-center text-base md:text-lg italic max-w-2xl mx-auto"
            style={{ color: 'var(--fx-text-2)' }}
          >
            &ldquo;The more you trade, the more efficient your trading becomes.&rdquo;
          </p>
        </ScrollReveal>
      </div>
    </section>
  )
}
