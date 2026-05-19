import { Zap, ArrowDownRight, CheckCircle2 } from 'lucide-react'
import SectionHeader from '@/landing/components/SectionHeader'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

const improvements = [
  { label: 'Brokerage fees', drop: '↓' },
  { label: 'Leverage fees', drop: '↓' },
  { label: 'Market spread', drop: '↓' },
]

export default function TxXP() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg)' }}>
      <div className="fx-container">
        <SectionHeader
          badge="XP Progression"
          title="Your Activity Unlocks Better Conditions"
          highlight="Better Conditions"
          subtitle="No 'Gold tier' upgrades. Your fees just quietly come down as you trade more."
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
              <div className="feature-icon mb-5">
                <Zap size={20} />
              </div>
              <h3 className="text-2xl md:text-[28px] font-bold text-white mb-4 leading-tight">
                The more you trade, the more efficient your trading becomes.
              </h3>
              <p className="text-base mb-6" style={{ color: 'var(--fx-text-2)' }}>
                XP isn&apos;t cosmetic. It directly improves your live trading conditions across all three
                cost components.
              </p>
              <ul className="space-y-3">
                {improvements.map((i) => (
                  <li
                    key={i.label}
                    className="flex items-center justify-between rounded-xl px-4 py-3"
                    style={{
                      background: 'rgba(214,169,61,0.05)',
                      border: '1px solid rgba(214,169,61,0.22)',
                    }}
                  >
                    <span className="flex items-center gap-3">
                      <CheckCircle2 size={18} style={{ color: 'var(--fx-gold-light)' }} />
                      <span className="text-sm md:text-[15px] text-white">{i.label}</span>
                    </span>
                    <span
                      className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider"
                      style={{ color: '#4ade80' }}
                    >
                      <ArrowDownRight size={13} /> Gradually lower
                    </span>
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
