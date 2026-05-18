import { Activity, Copy, CheckCircle2 } from 'lucide-react'
import SectionHeader from '@/landing/components/SectionHeader'
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
        <SectionHeader
          badge="Self vs Copy"
          title="Use Your Capital Your Way"
          highlight="Your Way"
          subtitle="Trade yourself, or let a trader you trust trade for you. Same account, same rules."
        />

        <div className="mt-12 md:mt-16 grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          {/* Self */}
          <ScrollReveal variant="fadeUp">
            <div
              className="relative h-full rounded-2xl p-8 md:p-9"
              style={{
                background:
                  'linear-gradient(180deg, rgba(74,222,128,0.10) 0%, rgba(74,222,128,0.02) 60%), var(--fx-bg-elev)',
                border: '1px solid rgba(74,222,128,0.30)',
              }}
            >
              <div className="flex items-center gap-3 mb-5">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(74,222,128,0.18)', border: '1px solid rgba(74,222,128,0.4)' }}
                >
                  <Activity size={22} style={{ color: '#4ade80' }} />
                </div>
                <h3 className="text-2xl md:text-[26px] font-bold text-white">Self Trading</h3>
              </div>
              <ul className="space-y-3">
                {self.map((f) => (
                  <li key={f} className="flex items-center gap-3">
                    <CheckCircle2 size={18} style={{ color: '#4ade80' }} />
                    <span className="text-sm md:text-[15px] text-white">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          </ScrollReveal>

          {/* Copy */}
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <div
              className="relative h-full rounded-2xl p-8 md:p-9"
              style={{
                background:
                  'linear-gradient(180deg, rgba(96,165,250,0.10) 0%, rgba(96,165,250,0.02) 60%), var(--fx-bg-elev)',
                border: '1px solid rgba(96,165,250,0.30)',
              }}
            >
              <div className="flex items-center gap-3 mb-5">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(96,165,250,0.18)', border: '1px solid rgba(96,165,250,0.4)' }}
                >
                  <Copy size={22} style={{ color: '#60a5fa' }} />
                </div>
                <h3 className="text-2xl md:text-[26px] font-bold text-white">Copy Trading</h3>
              </div>
              <ul className="space-y-3">
                {copy.map((f) => (
                  <li key={f} className="flex items-center gap-3">
                    <CheckCircle2 size={18} style={{ color: '#60a5fa' }} />
                    <span className="text-sm md:text-[15px] text-white">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          </ScrollReveal>
        </div>

        <ScrollReveal variant="fadeUp" delay={0.25}>
          <div className="mt-8 max-w-3xl mx-auto">
            <CtFaqList items={faq} />
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}
