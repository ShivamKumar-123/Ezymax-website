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
        <div className="fx-section-frame">
        <SectionHeader
          badge="Our Philosophy"
          title="Trader-First Thinking"
          highlight="Trader-First"
          subtitle="The simple idea behind every decision we make: modern traders deserve more transparency, more flexibility, and infrastructure that actually treats them as the customer."
        />
        <div className="mt-12 md:mt-16 max-w-3xl mx-auto">
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

          <ScrollReveal variant="fadeUp" delay={0.2}>
            <div
              className="mt-8 md:mt-10 rounded-2xl p-6 md:p-8 text-center"
              style={{
                background:
                  'linear-gradient(180deg, rgba(214,169,61,0.14), rgba(214,169,61,0.03))',
                border: '1px solid rgba(214,169,61,0.40)',
              }}
            >
              <Quote size={22} className="mx-auto mb-3" style={{ color: 'var(--fx-gold-light)' }} />
              <p className="text-lg md:text-2xl font-bold leading-tight gradient-text">
                &ldquo;The future of trading is not just faster — it is smarter.&rdquo;
              </p>
            </div>
          </ScrollReveal>

        </div>
        </div>
      </div>
    </section>
  )
}
