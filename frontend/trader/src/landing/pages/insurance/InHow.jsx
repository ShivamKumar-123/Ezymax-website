import { Calendar, Sliders, Power, Activity, ShieldCheck } from 'lucide-react'
import SectionHeader from '@/landing/components/SectionHeader'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

const steps = [
  { icon: Calendar,    title: 'Choose Plan Duration', desc: 'Daily, Weekly, or Monthly.' },
  { icon: Sliders,     title: 'Select Coverage Level', desc: 'Pick a percentage of loss coverage.' },
  { icon: Power,       title: 'Activate Plan',        desc: 'Your protection becomes active instantly.' },
  { icon: Activity,    title: 'Trade Normally',       desc: 'All eligible trades during the active period are covered.' },
  { icon: ShieldCheck, title: 'Coverage Applies',     desc: 'Losses are covered automatically based on plan rules and limits.' },
]

export default function InHow() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg-elev)' }}>
      <div className="fx-container">
        <div className="fx-section-frame">
        <SectionHeader
          badge="How It Works"
          title="Simple and Continuous Protection"
          highlight="Continuous Protection"
          subtitle="Five quick steps and you're protected. Pick a duration and coverage, switch on the plan, then go trade — coverage kicks in automatically on eligible losses."
        />
        <div className="mt-12 md:mt-16">
          <div className="relative grid grid-cols-2 md:grid-cols-5 gap-4 md:gap-3">
            <div
              className="hidden md:block absolute top-[42px] left-[8%] right-[8%] h-px pointer-events-none"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(90deg, rgba(214,169,61,0.5) 0 6px, transparent 6px 14px)',
              }}
            />
            {steps.map((s, i) => {
              const Icon = s.icon
              return (
                <ScrollReveal key={s.title} variant="fadeUp" delay={i * 0.05}>
                  <div className="relative flex flex-col items-center text-center">
                    <div
                      className="relative w-[84px] h-[84px] rounded-2xl flex items-center justify-center mb-4"
                      style={{
                        background:
                          'linear-gradient(180deg, var(--fx-bg) 0%, var(--fx-bg-elev-2) 100%)',
                        border: '1px solid rgba(214,169,61,0.28)',
                        boxShadow:
                          '0 1px 0 rgba(255,255,255,0.06) inset, 0 12px 32px -16px rgba(214,169,61,0.32)',
                      }}
                    >
                      <Icon size={26} style={{ color: 'var(--fx-gold-light)' }} />
                      <span
                        className="absolute -top-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{
                          background:
                            'linear-gradient(180deg, var(--fx-gold-light), var(--fx-gold))',
                          color: '#1a1408',
                          boxShadow: '0 6px 16px -6px rgba(214,169,61,0.55)',
                        }}
                      >
                        {i + 1}
                      </span>
                    </div>
                    <h3 className="text-sm md:text-[15px] font-bold text-white mb-1.5 px-1">
                      {s.title}
                    </h3>
                    <p
                      className="text-xs md:text-[13px] leading-relaxed px-1"
                      style={{ color: 'var(--fx-text-2)' }}
                    >
                      {s.desc}
                    </p>
                  </div>
                </ScrollReveal>
              )
            })}
          </div>
        </div>

        <ScrollReveal variant="fadeUp" delay={0.3}>
          <p
            className="mt-10 md:mt-12 text-center text-base md:text-lg italic max-w-2xl mx-auto"
            style={{ color: 'var(--fx-text-2)' }}
          >
            &ldquo;One plan. Continuous protection within defined limits.&rdquo;
          </p>
        </ScrollReveal>
        </div>
      </div>
    </section>
  )
}
