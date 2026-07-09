import {
  Sliders,
  Activity,
  Clock3,
  Eye,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

const features = [
  { icon: Clock3,   label: 'Select plan duration' },
  { icon: Sliders,  label: 'Choose coverage level' },
  { icon: Activity, label: 'View active plan status' },
  { icon: Eye,      label: 'Track coverage usage' },
  { icon: ShieldCheck, label: 'Monitor plan expiry' },
]

export default function InUX() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg)' }}>
      <div className="fx-container">
        {/* ── Two-column intro ──────────────────────────────── */}
        <div className="fx-split-intro">
          <ScrollReveal variant="fadeUp">
            <div>
              <span className="fx-eyebrow mb-5">User Experience</span>
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mt-5">
                Simple and Transparent <span className="gradient-text">Experience</span>
              </h2>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <p className="text-base md:text-lg" style={{ color: 'var(--fx-text-2)' }}>
              The plan lives right inside your trading dashboard — switch durations, change coverage, watch your pool draw down, all without leaving the chart.
            </p>
          </ScrollReveal>
        </div>

        <div className="mt-12 md:mt-16 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
          {/* LEFT — features (gold accent tile) */}
          <ScrollReveal variant="fadeUp" className="lg:col-span-5">
            <div className="fx-tile-gold h-full p-7 md:p-8 flex flex-col">
              <span className="fx-accent-bar mb-4 relative z-[1]" />
              <p className="relative z-[1] text-base mb-6" style={{ color: '#1c1608' }}>
                Inside the trading dashboard, you can manage and monitor your active plan in
                real time.
              </p>
              <ul className="relative z-[1] space-y-3">
                {features.map(({ icon: Icon, label }) => (
                  <li
                    key={label}
                    className="flex items-center gap-3 rounded-xl px-4 py-3"
                    style={{
                      background: 'rgba(28,22,8,0.08)',
                      border: '1px solid rgba(28,22,8,0.2)',
                    }}
                  >
                    <Icon size={16} style={{ color: '#1c1608' }} />
                    <span className="text-sm md:text-[15px] font-medium" style={{ color: '#1c1608' }}>{label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </ScrollReveal>

          {/* RIGHT — UI mock */}
          <ScrollReveal variant="fadeUp" delay={0.1} className="lg:col-span-7">
            <div className="fx-tile h-full">
              {/* Mock header */}
              <div
                className="flex items-center justify-between px-5 md:px-6 py-3.5"
                style={{
                  background: 'rgba(214,169,61,0.04)',
                  borderBottom: '1px solid var(--fx-line)',
                }}
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck size={14} style={{ color: 'var(--fx-gold-light)' }} />
                  <span className="text-[11px] uppercase tracking-[0.22em] font-bold" style={{ color: 'var(--fx-gold-light)' }}>
                    Trade Insurance Panel
                  </span>
                </div>
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider"
                  style={{
                    background: 'rgba(214,169,61,0.18)',
                    color: 'var(--fx-gold-light)',
                    border: '1px solid rgba(214,169,61,0.45)',
                  }}
                >
                  ACTIVE
                </span>
              </div>

              <div className="p-5 md:p-6 space-y-5">
                {/* Plan selector pills */}
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.22em] mb-2" style={{ color: 'var(--fx-text-3)' }}>
                    Plan Duration
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {['Daily', 'Weekly', 'Monthly'].map((p) => {
                      const active = p === 'Weekly'
                      return (
                        <div
                          key={p}
                          className="rounded-lg px-3 py-2.5 text-center text-sm font-semibold"
                          style={{
                            background: active ? 'rgba(214,169,61,0.18)' : 'rgba(255,255,255,0.03)',
                            color: active ? 'var(--fx-gold-light)' : 'var(--fx-text-2)',
                            border: active
                              ? '1px solid rgba(214,169,61,0.55)'
                              : '1px solid var(--fx-line-strong)',
                          }}
                        >
                          {p}
                          {active && (
                            <CheckCircle2 size={11} className="inline ml-1.5" style={{ color: 'var(--fx-gold-light)' }} />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Coverage selector pills */}
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.22em] mb-2" style={{ color: 'var(--fx-text-3)' }}>
                    Coverage Level
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { name: 'Basic',    cover: '20%' },
                      { name: 'Smart',    cover: '30%' },
                      { name: 'Advanced', cover: '40%' },
                      { name: 'Pro',      cover: '50%' },
                    ].map((c) => {
                      const active = c.name === 'Smart'
                      return (
                        <div
                          key={c.name}
                          className="rounded-lg px-2 py-2 text-center"
                          style={{
                            background: active ? 'rgba(214,169,61,0.18)' : 'rgba(255,255,255,0.03)',
                            color: active ? 'var(--fx-gold-light)' : 'var(--fx-text-2)',
                            border: active
                              ? '1px solid rgba(214,169,61,0.55)'
                              : '1px solid var(--fx-line-strong)',
                          }}
                        >
                          <div className="text-[10px] uppercase tracking-wider">{c.name}</div>
                          <div className="text-sm font-bold">{c.cover}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Coverage bar */}
                <div>
                  <div className="flex items-center justify-between text-[11px] mb-1.5">
                    <span style={{ color: 'var(--fx-text-3)' }}>Coverage Pool Remaining</span>
                    <span className="font-bold text-white">$1,800 / $3,000</span>
                  </div>
                  <div className="h-3 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: '60%',
                        background:
                          'linear-gradient(90deg, var(--fx-gold-light), var(--fx-gold))',
                        boxShadow: '0 0 12px rgba(214,169,61,0.55)',
                      }}
                    />
                  </div>
                </div>

                {/* Expiry */}
                <div
                  className="rounded-xl px-4 py-3 flex items-center justify-between"
                  style={{
                    background: 'rgba(214,169,61,0.08)',
                    border: '1px solid rgba(214,169,61,0.30)',
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <Clock3 size={15} style={{ color: 'var(--fx-gold-light)' }} />
                    <span className="text-sm font-semibold text-white">Plan Expiry</span>
                  </div>
                  <span className="text-sm font-bold" style={{ color: 'var(--fx-gold-light)' }}>
                    4d 12h 36m
                  </span>
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
            &ldquo;Full visibility. No guesswork.&rdquo;
          </p>
        </ScrollReveal>
      </div>
    </section>
  )
}
