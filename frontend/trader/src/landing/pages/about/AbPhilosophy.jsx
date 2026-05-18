import { CheckCircle2, Eye, Sliders, Cog, Sparkles, Quote } from 'lucide-react'
import SectionHeader from '@/landing/components/SectionHeader'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

const deserves = [
  { icon: Eye,      label: 'More transparency' },
  { icon: Sliders,  label: 'More flexibility' },
  { icon: Cog,      label: 'Better infrastructure' },
  { icon: Sparkles, label: 'More engaging ecosystems' },
]

const layers = ['Financial technology', 'Automation', 'Blockchain infrastructure', 'User-centric design']

export default function AbPhilosophy() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg)' }}>
      <div className="fx-container">
        <SectionHeader
          badge="Our Philosophy"
          title="Trader-First Thinking"
          highlight="Trader-First"
          subtitle="FX Artha is being built around a simple idea — modern traders deserve more."
        />

        <div className="mt-12 md:mt-16 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-stretch">
          {/* LEFT — text */}
          <ScrollReveal variant="fadeUp">
            <div
              className="h-full rounded-2xl p-7 md:p-8"
              style={{
                background:
                  'linear-gradient(180deg, var(--fx-bg-elev-2) 0%, var(--fx-bg-elev) 100%)',
                border: '1px solid var(--fx-line-strong)',
              }}
            >
              <div className="text-[11px] font-bold uppercase tracking-[0.22em] mb-4" style={{ color: 'var(--fx-gold-light)' }}>
                Modern traders deserve
              </div>
              <ul className="space-y-3 mb-7">
                {deserves.map(({ icon: Icon, label }) => (
                  <li
                    key={label}
                    className="flex items-center gap-3 rounded-xl px-4 py-3"
                    style={{
                      background: 'rgba(214,169,61,0.05)',
                      border: '1px solid rgba(214,169,61,0.22)',
                    }}
                  >
                    <Icon size={16} style={{ color: 'var(--fx-gold-light)' }} />
                    <span className="text-sm md:text-[15px] text-white">{label}</span>
                  </li>
                ))}
              </ul>

              <div className="text-[11px] font-bold uppercase tracking-[0.22em] mb-4" style={{ color: 'var(--fx-text-3)' }}>
                The future of trading combines
              </div>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {layers.map((l) => (
                  <li
                    key={l}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--fx-line-strong)',
                    }}
                  >
                    <CheckCircle2 size={14} style={{ color: 'var(--fx-gold-light)' }} />
                    <span className="text-xs md:text-sm text-white">{l}</span>
                  </li>
                ))}
              </ul>
            </div>
          </ScrollReveal>

          {/* RIGHT — futuristic artwork + quote */}
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <div
              className="relative h-full rounded-2xl p-7 md:p-9 overflow-hidden flex flex-col"
              style={{
                background:
                  'linear-gradient(160deg, rgba(214,169,61,0.10) 0%, var(--fx-bg-elev-2) 60%)',
                border: '1px solid rgba(214,169,61,0.30)',
                boxShadow: '0 30px 70px -30px rgba(214,169,61,0.30)',
              }}
            >
              <div className="absolute inset-0 fx-grid-bg" />

              {/* Minimal futuristic mark */}
              <div className="relative flex items-center justify-center flex-1 min-h-[180px]">
                <svg viewBox="0 0 240 200" className="w-full max-w-[280px] h-auto" aria-hidden>
                  <defs>
                    <linearGradient id="abPhilGrad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#ecc657" />
                      <stop offset="100%" stopColor="rgba(214,169,61,0.2)" />
                    </linearGradient>
                  </defs>
                  {/* concentric arcs */}
                  {[90, 70, 50, 30].map((r, i) => (
                    <circle
                      key={i}
                      cx="120"
                      cy="100"
                      r={r}
                      fill="none"
                      stroke={i === 0 ? 'url(#abPhilGrad)' : 'rgba(214,169,61,0.18)'}
                      strokeWidth={i === 0 ? '1.4' : '0.8'}
                      strokeDasharray={i % 2 ? '4 8' : ''}
                    />
                  ))}
                  {/* radials */}
                  {[0, 60, 120, 180, 240, 300].map((deg) => {
                    const rad = (deg * Math.PI) / 180
                    const x = 120 + Math.cos(rad) * 92
                    const y = 100 + Math.sin(rad) * 92
                    return (
                      <line
                        key={deg}
                        x1="120"
                        y1="100"
                        x2={x}
                        y2={y}
                        stroke="rgba(214,169,61,0.22)"
                        strokeWidth="0.8"
                      />
                    )
                  })}
                  {/* core */}
                  <circle cx="120" cy="100" r="10" fill="rgba(214,169,61,0.18)" />
                  <circle cx="120" cy="100" r="4" fill="#ecc657" />
                </svg>
              </div>

              <div
                className="relative mt-6 rounded-2xl p-5 md:p-6 text-center"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(214,169,61,0.16), rgba(214,169,61,0.04))',
                  border: '1px solid rgba(214,169,61,0.4)',
                }}
              >
                <Quote size={22} className="mx-auto mb-2" style={{ color: 'var(--fx-gold-light)' }} />
                <p className="text-base md:text-xl font-bold leading-tight gradient-text">
                  “The future of trading is not just faster — it is smarter.”
                </p>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  )
}
