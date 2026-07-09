import { Activity, Copy, CheckCircle2 } from 'lucide-react'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'
import CtFaqList from '@/landing/pages/copy-trading/CtFaqList'

const self = ['Trade independently', 'Full control over strategy']
const copy = ['Allocate to master traders', 'Passive participation']

const faq = [
  { q: 'Can I switch between self and copy trading?', a: 'Yes, based on your preference.' },
]

export default function StSelfVsCopy() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg-elev)' }}>
      <div className="fx-container">
        {/* ── Two-column intro ──────────────────────────────── */}
        <div className="fx-split-intro">
          <ScrollReveal variant="fadeUp">
            <div>
              <span className="fx-eyebrow mb-5">Self vs Copy</span>
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mt-5">
                Use Your Capital <span className="gradient-text">Your Way</span>
              </h2>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <p className="text-base md:text-lg" style={{ color: 'var(--fx-text-2)' }}>
              Active or passive — your choice.
            </p>
          </ScrollReveal>
        </div>

        <div className="mt-12 md:mt-16 grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-stretch">
          {/* Self — solid gold accent tile */}
          <ScrollReveal variant="fadeUp">
            <div className="fx-tile-gold h-full p-8 md:p-9 flex flex-col">
              <div className="flex items-center gap-3 mb-5 relative z-[1]">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(28,22,8,0.14)', border: '1px solid rgba(28,22,8,0.22)' }}
                >
                  <Activity size={22} style={{ color: '#1c1608' }} />
                </div>
                <h3 className="text-2xl md:text-[26px] font-bold" style={{ color: '#1c1608' }}>Self Trading</h3>
              </div>
              <ul className="space-y-3 relative z-[1]">
                {self.map((f) => (
                  <li key={f} className="flex items-center gap-3">
                    <CheckCircle2 size={18} style={{ color: '#1c1608' }} />
                    <span className="text-sm md:text-[15px] font-medium" style={{ color: '#1c1608' }}>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          </ScrollReveal>

          {/* Copy — dark tile with gold accents */}
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <div className="fx-tile h-full p-8 md:p-9 flex flex-col">
              <div className="flex items-center gap-3 mb-5">
                <div className="feature-icon shrink-0" style={{ width: 48, height: 48 }}>
                  <Copy size={20} />
                </div>
                <h3 className="text-2xl md:text-[26px] font-bold text-white">Copy Trading</h3>
              </div>
              <ul className="space-y-3">
                {copy.map((f) => (
                  <li key={f} className="flex items-center gap-3">
                    <CheckCircle2 size={18} style={{ color: 'var(--fx-gold-light)' }} />
                    <span className="text-sm md:text-[15px] text-white">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          </ScrollReveal>
        </div>

        <ScrollReveal variant="fadeUp" delay={0.25}>
          <div className="fx-tile p-6 md:p-8 mt-8 max-w-3xl mx-auto">
            <CtFaqList items={faq} />
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}
