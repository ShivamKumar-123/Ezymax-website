import { Calendar, Sliders, Power, Activity, ShieldCheck } from 'lucide-react'
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
        {/* ── Two-column intro ──────────────────────────────── */}
        <div className="fx-split-intro-center">
          <ScrollReveal variant="fadeUp">
            <div>
              <span className="fx-eyebrow mb-5">How It Works</span>
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mt-5">
                Simple and Continuous <span className="gradient-text">Protection</span>
              </h2>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <p className="text-base md:text-lg" style={{ color: 'var(--fx-text-2)' }}>
              Five quick steps and you're protected. Pick a duration and coverage, switch on the plan, then go trade — coverage kicks in automatically on eligible losses.
            </p>
          </ScrollReveal>
        </div>

        {/* ── Bento: numbered timeline + gold summary + image ── */}
        <div className="fx-bento grid-cols-1 md:grid-cols-2 lg:grid-cols-3 mt-10 md:mt-14 items-stretch">
          {/* Numbered vertical timeline */}
          <ScrollReveal variant="fadeUp">
            <div className="fx-tile h-full p-6 sm:p-7 md:p-8 flex flex-col">
              <span className="fx-accent-bar mb-4" />
              <h3 className="text-xl md:text-2xl font-bold text-white mb-7">
                Five steps to continuous protection
              </h3>

              <div className="relative">
                {/* vertical gradient rail running through the numbered nodes */}
                <span
                  aria-hidden
                  className="absolute left-[23px] top-[24px] bottom-[24px] w-[3px] rounded-full"
                  style={{
                    background:
                      'linear-gradient(180deg, var(--fx-gold-light) 0%, var(--fx-gold) 52%, var(--fx-gold-dark) 100%)',
                    boxShadow: '0 0 16px rgba(214,169,61,0.4)',
                  }}
                />
                <ul className="relative space-y-6 md:space-y-7">
                  {steps.map((s, i) => (
                    <li key={s.title} className="relative flex items-start gap-5">
                      <div className="fx-icon-badge shrink-0" style={{ width: 48, height: 48 }}>
                        <span className="text-base font-bold" style={{ color: 'var(--fx-gold-light)' }}>
                          {i + 1}
                        </span>
                      </div>
                      <div className="pt-1.5">
                        <div className="text-base md:text-lg font-bold text-white leading-snug mb-1">
                          {s.title}
                        </div>
                        <div className="text-xs md:text-[13px] leading-relaxed" style={{ color: 'var(--fx-text-2)' }}>
                          {s.desc}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </ScrollReveal>

          {/* Gold summary tile */}
          <ScrollReveal variant="fadeUp" delay={0.08}>
            <div className="fx-tile-gold h-full p-7 md:p-8 flex flex-col">
              <div
                className="relative z-[1] w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                style={{ background: 'rgba(28,22,8,0.14)', border: '1px solid rgba(28,22,8,0.22)' }}
              >
                <ShieldCheck size={20} style={{ color: '#1c1608' }} />
              </div>
              <span className="fx-accent-bar mb-4 relative z-[1]" />
              <h3 className="relative z-[1] text-2xl md:text-[28px] font-bold mb-4 leading-tight" style={{ color: '#1c1608' }}>
                Pick a duration and coverage, switch it on, then trade.
              </h3>
              <p className="relative z-[1] text-base mb-6" style={{ color: 'rgba(28,22,8,0.78)' }}>
                Coverage kicks in automatically on eligible losses during the active period — no
                extra steps once the plan is live.
              </p>
              <div
                className="relative z-[1] mt-auto rounded-xl p-4 text-xs md:text-sm italic"
                style={{
                  background: 'rgba(28,22,8,0.08)',
                  border: '1px solid rgba(28,22,8,0.2)',
                  color: 'rgba(28,22,8,0.82)',
                }}
              >
                One plan. Continuous protection within defined limits.
              </div>
            </div>
          </ScrollReveal>

          {/* Image tile */}
          <ScrollReveal variant="fadeUp" delay={0.16}>
            <div className="fx-tile-media h-full min-h-[280px] md:col-span-2 lg:col-span-1">
              <span className="fx-tile-media-label">Image</span>
            </div>
          </ScrollReveal>
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
    </section>
  )
}
