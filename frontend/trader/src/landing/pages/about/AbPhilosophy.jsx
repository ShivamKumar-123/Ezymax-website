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
          subtitle="What the team keeps coming back to when we're deciding what to build."
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

        </div>
      </div>
    </section>
  )
}
