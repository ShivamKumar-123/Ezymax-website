import { Coins, Gauge, CheckCircle2 } from 'lucide-react'
import SectionHeader from '@/landing/components/SectionHeader'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

const funded = ['No leverage exposure', 'Only brokerage applies', 'Lower risk profile']
const leveraged = [
  'Adjustable leverage',
  'Capital efficiency',
  'Leverage cost applies only when positions are held overnight',
]

export default function TxModes() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg-elev)' }}>
      <div className="fx-container">
        <SectionHeader
          badge="Trading Modes"
          title="Flexible Trading Modes"
          highlight="Trading Modes"
          subtitle="Two ways to trade — pick whichever fits how you want to handle risk. Same transparent rules apply to both."
        />

        <div className="mt-12 md:mt-16 grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          {/* Fully Funded */}
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
                  <Coins size={22} style={{ color: '#4ade80' }} />
                </div>
                <h3 className="text-2xl md:text-[26px] font-bold text-white">Fully Funded Mode</h3>
              </div>
              <p className="text-base mb-6" style={{ color: 'var(--fx-text-2)' }}>
                Trade using only your available capital.
              </p>
              <ul className="space-y-3">
                {funded.map((f) => (
                  <li key={f} className="flex items-center gap-3">
                    <CheckCircle2 size={18} style={{ color: '#4ade80' }} />
                    <span className="text-sm md:text-[15px] text-white">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          </ScrollReveal>

          {/* Leveraged */}
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
                  <Gauge size={22} style={{ color: '#60a5fa' }} />
                </div>
                <h3 className="text-2xl md:text-[26px] font-bold text-white">Leveraged Mode</h3>
              </div>
              <p className="text-base mb-6" style={{ color: 'var(--fx-text-2)' }}>
                Enhance your trading power using leverage.
              </p>
              <ul className="space-y-3">
                {leveraged.map((f) => (
                  <li key={f} className="flex items-center gap-3">
                    <CheckCircle2 size={18} style={{ color: '#60a5fa' }} />
                    <span className="text-sm md:text-[15px] text-white">{f}</span>
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
