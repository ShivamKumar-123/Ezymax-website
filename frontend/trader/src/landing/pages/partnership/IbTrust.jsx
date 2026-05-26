import { Lock, Eye, Wallet, BarChart3 } from 'lucide-react'
import SectionHeader from '@/landing/components/SectionHeader'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

const pillars = [
  { icon: Lock,      label: 'Smart contract-based settlement' },
  { icon: Eye,       label: 'Transparent reward logic' },
  { icon: BarChart3, label: 'Real-time analytics' },
  { icon: Wallet,    label: 'User-controlled wallet connectivity' },
]

export default function IbTrust() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg-elev)' }}>
      <div className="fx-container">
        <SectionHeader
          badge="Trust & Transparency"
          title="Built Around Transparency"
          highlight="Transparency"
          subtitle="The bits you can actually inspect: the contract, the reward math, the dashboard, and your own wallet."
        />

        <ScrollReveal variant="fadeUp">
          <div
            className="mt-12 md:mt-16 relative rounded-2xl p-8 md:p-12 overflow-hidden text-center"
            style={{
              background:
                'linear-gradient(160deg, rgba(214,169,61,0.06) 0%, var(--fx-bg-elev-2) 60%)',
              border: '1px solid rgba(214,169,61,0.30)',
              boxShadow: '0 30px 70px -30px rgba(214,169,61,0.30)',
            }}
          >
            <div className="relative grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5 max-w-4xl mx-auto">
              {pillars.map((p) => {
                const Icon = p.icon
                return (
                  <div
                    key={p.label}
                    className="rounded-2xl p-5 md:p-6 flex flex-col items-center text-center"
                    style={{
                      background: 'var(--fx-bg-elev)',
                      border: '1px solid rgba(214,169,61,0.28)',
                    }}
                  >
                    <div className="feature-icon mb-4" style={{ width: 44, height: 44 }}>
                      <Icon size={18} />
                    </div>
                    <div className="text-sm md:text-[15px] font-bold text-white leading-snug">
                      {p.label}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}
