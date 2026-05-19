import { CheckCircle2, Layers, Power, RotateCcw } from 'lucide-react'
import SectionHeader from '@/landing/components/SectionHeader'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

const groups = [
  {
    icon: CheckCircle2,
    accent: '#4ade80',
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
    accent: '#ecc657',
    title: 'Plan Rules',
    items: [
      'Coverage pool applies across the entire duration',
      'Not calculated separately for each trade',
      'Once coverage limit is reached, plan becomes inactive',
    ],
  },
  {
    icon: Power,
    accent: '#60a5fa',
    title: 'Plan Activation Rules',
    items: [
      'Only one active plan allowed at a time',
      'Activating a new plan automatically deactivates the previous one',
      'New plan becomes active immediately',
    ],
  },
  {
    icon: RotateCcw,
    accent: '#a78bfa',
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
        <SectionHeader
          badge="Rules & Conditions"
          title="Clear Usage Rules"
          highlight="Usage Rules"
          subtitle="The fine print. Read it once and the rest of the page makes sense."
        />

        <div className="mt-12 md:mt-16 grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6">
          {groups.map((g, i) => {
            const Icon = g.icon
            return (
              <ScrollReveal key={g.title} variant="fadeUp" delay={i * 0.06}>
                <div
                  className="h-full rounded-2xl p-6 md:p-7"
                  style={{
                    background:
                      'linear-gradient(180deg, var(--fx-bg-elev) 0%, var(--fx-bg-elev-2) 100%)',
                    border: `1px solid ${g.accent}40`,
                  }}
                >
                  <div className="flex items-center gap-3 mb-5">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center"
                      style={{ background: `${g.accent}1f`, border: `1px solid ${g.accent}55` }}
                    >
                      <Icon size={18} style={{ color: g.accent }} />
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.22em] font-bold" style={{ color: g.accent }}>
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
                        <CheckCircle2 size={16} className="mt-0.5 shrink-0" style={{ color: g.accent }} />
                        <span className="text-sm text-white leading-relaxed">{it}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </ScrollReveal>
            )
          })}
        </div>

      </div>
    </section>
  )
}
