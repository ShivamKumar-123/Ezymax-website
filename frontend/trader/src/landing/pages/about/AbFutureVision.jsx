import { Rocket, Cog, Globe2, Cpu, Quote } from 'lucide-react'
import SectionHeader from '@/landing/components/SectionHeader'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

const directions = [
  { icon: Cog,    label: 'Protocol innovation' },
  { icon: Globe2, label: 'Ecosystem expansion' },
  { icon: Cpu,    label: 'Decentralized infrastructure' },
  { icon: Rocket, label: 'Advanced trading technologies' },
]

export default function AbFutureVision() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg-elev)' }}>
      <div className="fx-container">
        <SectionHeader
          badge="Future Vision"
          title="Building Beyond Traditional Trading"
          highlight="Beyond Traditional Trading"
          subtitle="FX Artha is continuously exploring the next layers of trading infrastructure."
        />

        <ScrollReveal variant="fadeUp">
          <div
            className="mt-12 md:mt-16 relative rounded-2xl p-8 md:p-12 overflow-hidden text-center"
            style={{
              background:
                'linear-gradient(160deg, rgba(214,169,61,0.10) 0%, var(--fx-bg-elev-2) 60%)',
              border: '1px solid rgba(214,169,61,0.30)',
              boxShadow: '0 30px 70px -30px rgba(214,169,61,0.35)',
            }}
          >
            {/* galaxy / grid backdrop */}
            <div className="absolute inset-0 fx-grid-bg" />
            <svg
              viewBox="0 0 800 220"
              className="absolute inset-0 w-full h-full pointer-events-none opacity-90"
              preserveAspectRatio="xMidYMid slice"
              aria-hidden
            >
              <defs>
                <radialGradient id="abFutureGalaxy" cx="50%" cy="50%" r="60%">
                  <stop offset="0%" stopColor="rgba(214,169,61,0.16)" />
                  <stop offset="100%" stopColor="rgba(214,169,61,0)" />
                </radialGradient>
              </defs>
              <rect width="800" height="220" fill="url(#abFutureGalaxy)" />
              {Array.from({ length: 30 }).map((_, i) => {
                const x = ((i * 47) % 800)
                const y = ((i * 91) % 220)
                const r = (i % 5) * 0.35 + 0.6
                return (
                  <circle
                    key={i}
                    cx={x}
                    cy={y}
                    r={r}
                    fill={i % 3 === 0 ? '#ecc657' : 'rgba(255,255,255,0.45)'}
                    opacity={0.3 + (i % 5) * 0.12}
                  />
                )
              })}
            </svg>

            <div className="relative max-w-3xl mx-auto">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4 mb-10">
                {directions.map(({ icon: Icon, label }) => (
                  <div
                    key={label}
                    className="rounded-2xl p-4 md:p-5"
                    style={{
                      background: 'var(--fx-bg-elev)',
                      border: '1px solid rgba(214,169,61,0.28)',
                    }}
                  >
                    <div className="feature-icon mx-auto mb-3" style={{ width: 40, height: 40 }}>
                      <Icon size={16} />
                    </div>
                    <div className="text-xs md:text-sm font-bold text-white text-center leading-snug">
                      {label}
                    </div>
                  </div>
                ))}
              </div>

              <div
                className="rounded-2xl p-6 md:p-8"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(214,169,61,0.18), rgba(214,169,61,0.04))',
                  border: '1px solid rgba(214,169,61,0.42)',
                }}
              >
                <Quote size={24} className="mx-auto mb-3" style={{ color: 'var(--fx-gold-light)' }} />
                <p className="text-lg md:text-2xl font-bold leading-tight gradient-text">
                  “We are not just building a platform.
                  <br />
                  We are building infrastructure for the future of trading.”
                </p>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}
