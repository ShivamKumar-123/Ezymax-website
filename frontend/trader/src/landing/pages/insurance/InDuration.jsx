import { Sun, CalendarDays, CalendarRange } from 'lucide-react'
import SectionHeader from '@/landing/components/SectionHeader'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

const durations = [
  {
    icon: Sun,
    accent: '#4ade80',
    name: 'Daily',
    desc: 'Coverage valid for one trading day.',
    tag: 'Short-term',
  },
  {
    icon: CalendarDays,
    accent: '#60a5fa',
    name: 'Weekly',
    desc: 'Coverage valid across multiple trading sessions.',
    tag: 'Mid-term',
    highlight: true,
  },
  {
    icon: CalendarRange,
    accent: '#a78bfa',
    name: 'Monthly',
    desc: 'Coverage valid for extended trading periods.',
    tag: 'Long-term',
  },
]

export default function InDuration() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg-elev)' }}>
      <div className="fx-container">
        <div className="fx-section-frame">
        <SectionHeader
          badge="Plan Durations"
          title="Flexible Plan Duration"
          highlight="Plan Duration"
          subtitle="Whether you're trading just for the day or settled in for the month, there's a plan that covers exactly the stretch you need."
        />
        <div className="mt-12 md:mt-16 grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
          {durations.map((d, i) => {
            const Icon = d.icon
            return (
              <ScrollReveal key={d.name} variant="fadeUp" delay={i * 0.05}>
                <div
                  className="relative h-full rounded-2xl p-7 md:p-8"
                  style={{
                    background:
                      'linear-gradient(180deg, var(--fx-bg-elev) 0%, var(--fx-bg-elev-2) 100%)',
                    border: `1px solid ${d.accent}55`,
                    boxShadow: d.highlight ? `0 24px 60px -28px ${d.accent}55` : 'none',
                  }}
                >
                  <div className="flex items-center justify-between mb-5">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ background: `${d.accent}1f`, border: `1px solid ${d.accent}55` }}
                    >
                      <Icon size={22} style={{ color: d.accent }} />
                    </div>
                    <span
                      className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase"
                      style={{
                        background: `${d.accent}1f`,
                        color: d.accent,
                        border: `1px solid ${d.accent}55`,
                      }}
                    >
                      {d.tag}
                    </span>
                  </div>
                  <h3 className="text-xl md:text-2xl font-bold text-white mb-2">{d.name}</h3>
                  <p className="text-sm md:text-[15px]" style={{ color: 'var(--fx-text-2)' }}>
                    {d.desc}
                  </p>
                </div>
              </ScrollReveal>
            )
          })}
        </div>

        <ScrollReveal variant="fadeUp" delay={0.2}>
          <p
            className="mt-10 md:mt-12 text-center text-base md:text-lg italic max-w-2xl mx-auto"
            style={{ color: 'var(--fx-text-2)' }}
          >
            &ldquo;Coverage stays active for the selected duration — not per trade.&rdquo;
          </p>
        </ScrollReveal>
        </div>
      </div>
    </section>
  )
}
