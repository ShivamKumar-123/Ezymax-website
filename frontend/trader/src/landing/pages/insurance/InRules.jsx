import { CheckCircle2, Layers, Power, RotateCcw } from 'lucide-react'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

const groups = [
  {
    icon: CheckCircle2,
    title: 'Eligibility Rules',
    items: [
      'Trade must remain open for a minimum duration (e.g. 5 minutes)',
      'Hedging or opposing trades are not eligible',
      'Applies only to valid and compliant trades',
      'Coverage is applied only on realized losses',
    ],
  },
  {
    icon: Layers,
    title: 'Plan Rules',
    items: [
      'Coverage pool applies across the entire duration',
      'Not calculated separately for each trade',
      'Once coverage limit is reached, plan becomes inactive',
    ],
    highlight: true,
  },
  {
    icon: Power,
    title: 'Plan Activation Rules',
    items: [
      'Only one active plan allowed at a time',
      'Activating a new plan automatically deactivates the previous one',
      'New plan becomes active immediately',
    ],
  },
  {
    icon: RotateCcw,
    title: 'Re-Activation Rules',
    items: [
      'If coverage limit is fully used, you may activate a new plan immediately',
      'Applies to Daily, Weekly, and Monthly plans',
    ],
  },
]

export default function InRules() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg-elev)' }}>
      <div className="fx-container">
        {/* ── Two-column intro ──────────────────────────────── */}
        <div className="fx-split-intro">
          <ScrollReveal variant="fadeUp">
            <div>
              <span className="fx-eyebrow mb-5">Rules &amp; Conditions</span>
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mt-5">
                Clear Usage <span className="gradient-text">Rules</span>
              </h2>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <p className="text-base md:text-lg" style={{ color: 'var(--fx-text-2)' }}>
              The conditions in plain language. Read it once — it's the same set of rules that keeps the system fair for everyone.
            </p>
          </ScrollReveal>
        </div>

        {/* ── Bento: rule cards (Plan Rules = gold accent) ──── */}
        <div className="fx-bento grid-cols-1 lg:grid-cols-2 mt-12 md:mt-16 items-stretch">
          {groups.map((g, i) => {
            const Icon = g.icon
            if (g.highlight) {
              return (
                <ScrollReveal key={g.title} variant="fadeUp" delay={i * 0.06}>
                  <div className="fx-tile-gold h-full p-6 md:p-7 flex flex-col">
                    <div className="relative z-[1] flex items-center gap-3 mb-5">
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center"
                        style={{ background: 'rgba(28,22,8,0.14)', border: '1px solid rgba(28,22,8,0.22)' }}
                      >
                        <Icon size={18} style={{ color: '#1c1608' }} />
                      </div>
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.22em] font-bold" style={{ color: 'rgba(28,22,8,0.7)' }}>
                          Group
                        </div>
                        <h3 className="text-lg md:text-xl font-bold" style={{ color: '#1c1608' }}>{g.title}</h3>
                      </div>
                    </div>
                    <ul className="relative z-[1] space-y-3">
                      {g.items.map((it) => (
                        <li
                          key={it}
                          className="flex items-start gap-3 rounded-xl px-4 py-3"
                          style={{
                            background: 'rgba(28,22,8,0.08)',
                            border: '1px solid rgba(28,22,8,0.2)',
                          }}
                        >
                          <CheckCircle2 size={16} className="mt-0.5 shrink-0" style={{ color: '#1c1608' }} />
                          <span className="text-sm font-medium leading-relaxed" style={{ color: '#1c1608' }}>{it}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </ScrollReveal>
              )
            }
            return (
              <ScrollReveal key={g.title} variant="fadeUp" delay={i * 0.06}>
                <div className="fx-tile h-full p-6 md:p-7 flex flex-col">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="feature-icon" style={{ width: 44, height: 44 }}>
                      <Icon size={18} />
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.22em] font-bold" style={{ color: 'var(--fx-gold-light)' }}>
                        Group
                      </div>
                      <h3 className="text-lg md:text-xl font-bold text-white">{g.title}</h3>
                    </div>
                  </div>
                  <ul className="space-y-3">
                    {g.items.map((it) => (
                      <li
                        key={it}
                        className="flex items-start gap-3 rounded-xl px-4 py-3"
                        style={{
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid var(--fx-line-strong)',
                        }}
                      >
                        <CheckCircle2 size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--fx-gold-light)' }} />
                        <span className="text-sm text-white leading-relaxed">{it}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </ScrollReveal>
            )
          })}
        </div>

        <ScrollReveal variant="fadeUp" delay={0.25}>
          <p
            className="mt-10 md:mt-12 text-center text-base md:text-lg italic max-w-2xl mx-auto"
            style={{ color: 'var(--fx-text-2)' }}
          >
            &ldquo;Structured rules ensure fairness and sustainability.&rdquo;
          </p>
        </ScrollReveal>
      </div>
    </section>
  )
}
