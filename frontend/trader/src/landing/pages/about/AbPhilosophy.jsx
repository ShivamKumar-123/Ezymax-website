import { CheckCircle2, Eye, Sliders, Cog, Sparkles, Quote } from 'lucide-react'
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
        {/* ── Two-column intro ──────────────────────────────── */}
        <div className="fx-split-intro">
          <ScrollReveal variant="fadeUp">
            <div>
              <span className="fx-eyebrow mb-5">Our Philosophy</span>
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mt-5">
                <span className="gradient-text">Trader-First</span> Thinking
              </h2>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <p className="text-base md:text-lg" style={{ color: 'var(--fx-text-2)' }}>
              The simple idea behind every decision we make: modern traders deserve more transparency, more flexibility, and infrastructure that actually treats them as the customer.
            </p>
          </ScrollReveal>
        </div>

        {/* ── Bento: gold "deserves" tile + dark "combines" tile ─ */}
        <div className="fx-bento grid-cols-1 lg:grid-cols-2 mt-12 md:mt-16 items-stretch">
          {/* Modern traders deserve — gold accent tile */}
          <ScrollReveal variant="fadeUp">
            <div className="fx-tile-gold h-full p-7 md:p-8 flex flex-col">
              <span className="fx-accent-bar mb-4 relative z-[1]" />
              <div className="relative z-[1] text-[11px] font-bold uppercase tracking-[0.22em] mb-4" style={{ color: 'rgba(28,22,8,0.78)' }}>
                Modern traders deserve
              </div>
              <ul className="relative z-[1] space-y-3">
                {deserves.map(({ icon: Icon, label }) => (
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

          {/* The future of trading combines — dark tile */}
          <ScrollReveal variant="fadeUp" delay={0.08}>
            <div className="fx-tile h-full p-7 md:p-8 flex flex-col">
              <span className="fx-accent-bar mb-4" />
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
        </div>

        {/* ── Closing quote ─────────────────────────────────── */}
        <ScrollReveal variant="fadeUp" delay={0.2}>
          <div className="fx-tile mt-4 md:mt-5 p-6 md:p-8 text-center">
            <Quote size={22} className="mx-auto mb-3" style={{ color: 'var(--fx-gold-light)' }} />
            <p className="text-lg md:text-2xl font-bold leading-tight gradient-text">
              &ldquo;The future of trading is not just faster — it is smarter.&rdquo;
            </p>
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}
