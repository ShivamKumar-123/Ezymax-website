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
          subtitle="The work doesn't stop at v1. The roadmap keeps pushing on protocol innovation, ecosystem reach, and decentralized infrastructure — toward a global trading system that scales."
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
