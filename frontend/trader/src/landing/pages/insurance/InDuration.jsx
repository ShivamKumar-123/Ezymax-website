import { Sun, CalendarDays, CalendarRange } from 'lucide-react'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

const durations = [
  {
    icon: Sun,
    name: 'Daily',
    desc: 'Coverage valid for one trading day.',
    tag: 'Short-term',
  },
  {
    icon: CalendarDays,
    name: 'Weekly',
    desc: 'Coverage valid across multiple trading sessions.',
    tag: 'Mid-term',
    highlight: true,
  },
  {
    icon: CalendarRange,
    name: 'Monthly',
    desc: 'Coverage valid for extended trading periods.',
    tag: 'Long-term',
  },
]

export default function InDuration() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg-elev)' }}>
      <div className="fx-container">
        {/* ── Two-column intro ──────────────────────────────── */}
        <div className="fx-split-intro">
          <ScrollReveal variant="fadeUp">
            <div>
              <span className="fx-eyebrow mb-5">Plan Durations</span>
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mt-5">
                Flexible Plan <span className="gradient-text">Duration</span>
              </h2>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <p className="text-base md:text-lg" style={{ color: 'var(--fx-text-2)' }}>
              Whether you're trading just for the day or settled in for the month, there's a plan that covers exactly the stretch you need.
            </p>
          </ScrollReveal>
        </div>

        {/* ── Bento: duration cards (Weekly = gold accent) ──── */}
        <div className="fx-bento grid-cols-1 md:grid-cols-3 mt-12 md:mt-16 items-stretch">
          {durations.map((d, i) => {
            const Icon = d.icon
            if (d.highlight) {
              return (
                <ScrollReveal key={d.name} variant="fadeUp" delay={i * 0.05}>
                  <div className="fx-tile-gold h-full p-7 md:p-8 flex flex-col">
                    <div className="relative z-[1] flex items-center justify-between mb-5">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center"
                        style={{ background: 'rgba(28,22,8,0.14)', border: '1px solid rgba(28,22,8,0.22)' }}
                      >
                        <Icon size={22} style={{ color: '#1c1608' }} />
                      </div>
                      <span
                        className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase"
                        style={{
                          background: 'rgba(28,22,8,0.12)',
                          color: '#1c1608',
                          border: '1px solid rgba(28,22,8,0.24)',
                        }}
                      >
                        {d.tag}
                      </span>
                    </div>
                    <span className="fx-accent-bar mb-4 relative z-[1]" />
                    <h3 className="relative z-[1] text-xl md:text-2xl font-bold mb-2" style={{ color: '#1c1608' }}>{d.name}</h3>
                    <p className="relative z-[1] text-sm md:text-[15px]" style={{ color: 'rgba(28,22,8,0.78)' }}>
                      {d.desc}
                    </p>
                  </div>
                </ScrollReveal>
              )
            }
            return (
              <ScrollReveal key={d.name} variant="fadeUp" delay={i * 0.05}>
                <div className="fx-tile h-full p-7 md:p-8 flex flex-col">
                  <div className="flex items-center justify-between mb-5">
                    <div className="feature-icon" style={{ width: 48, height: 48 }}>
                      <Icon size={22} />
                    </div>
                    <span
                      className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase"
                      style={{
                        background: 'rgba(214,169,61,0.12)',
                        color: 'var(--fx-gold-light)',
                        border: '1px solid rgba(214,169,61,0.35)',
                      }}
                    >
                      {d.tag}
                    </span>
                  </div>
                  <span className="fx-accent-bar mb-4" />
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
    </section>
  )
}
