import { Rocket, Cog, Globe2, Cpu, Quote } from 'lucide-react'
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
        {/* ── Two-column intro ──────────────────────────────── */}
        <div className="fx-split-intro">
          <ScrollReveal variant="fadeUp">
            <div>
              <span className="fx-eyebrow mb-5">Future Vision</span>
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mt-5">
                Building <span className="gradient-text">Beyond Traditional Trading</span>
              </h2>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <p className="text-base md:text-lg" style={{ color: 'var(--fx-text-2)' }}>
              The work doesn't stop at v1. The roadmap keeps pushing on protocol innovation, ecosystem reach, and decentralized infrastructure — toward a global trading system that scales.
            </p>
          </ScrollReveal>
        </div>

        {/* ── Direction tiles ───────────────────────────────── */}
        <div className="mt-12 md:mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 items-stretch">
          {directions.map(({ icon: Icon, label }, i) => (
            <ScrollReveal key={label} variant="fadeUp" delay={i * 0.06}>
              <div className="fx-tile h-full p-6 md:p-7 flex flex-col">
                <div className="feature-icon mb-4" style={{ width: 48, height: 48 }}>
                  <Icon size={20} />
                </div>
                <span className="fx-accent-bar mb-4" />
                <div className="text-sm md:text-base font-bold text-white leading-snug">
                  {label}
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>

        {/* ── Gold vision quote + image media ───────────────── */}
        <div className="fx-bento grid-cols-1 lg:grid-cols-2 mt-4 md:mt-5 items-stretch">
          <ScrollReveal variant="fadeUp">
            <div className="fx-tile-gold h-full p-8 md:p-12 flex flex-col justify-center text-center">
              <Quote size={24} className="relative z-[1] mx-auto mb-3" style={{ color: '#1c1608' }} />
              <p className="relative z-[1] text-lg md:text-2xl font-bold leading-tight" style={{ color: '#1c1608' }}>
                “We are not just building a platform.
                <br />
                We are building infrastructure for the future of trading.”
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal variant="fadeUp" delay={0.1}>
            <div className="fx-tile-media h-full min-h-[280px]">
              <span className="fx-tile-media-label">Image</span>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  )
}
