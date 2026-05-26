import { Gauge, ShieldCheck, Activity, Eye } from 'lucide-react'
import SectionHeader from '@/landing/components/SectionHeader'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

const items = [
  {
    icon: Gauge,
    accent: '#60a5fa',
    title: 'Adjustable Leverage',
    desc: 'Tune leverage to match the trade — never one-size-fits-all.',
  },
  {
    icon: ShieldCheck,
    accent: '#ecc657',
    title: 'Trade Insurance (optional)',
    desc: 'Activate partial loss cover on eligible trades, before execution.',
  },
  {
    icon: Activity,
    accent: '#a78bfa',
    title: 'Real-time Exposure',
    desc: 'Live view of open risk across all positions.',
  },
  {
    icon: Eye,
    accent: '#4ade80',
    title: 'Pre-trade Cost Visibility',
    desc: 'Brokerage, leverage fee, and spread are visible before you click.',
  },
]

export default function TxRiskControl() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg)' }}>
      <div className="fx-container">
        <SectionHeader
          badge="Risk Control"
          title="Built-In Risk Management"
          highlight="Risk Management"
          subtitle="The unglamorous part of trading — knowing what you're walking into. These are the controls that catch most surprises before you click Buy."
        />

        <div className="mt-12 md:mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {items.map((it, i) => {
            const Icon = it.icon
            return (
              <ScrollReveal key={it.title} variant="fadeUp" delay={i * 0.05}>
                <div className="glass-card h-full p-6">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                    style={{ background: `${it.accent}1f`, border: `1px solid ${it.accent}55` }}
                  >
                    <Icon size={20} style={{ color: it.accent }} />
                  </div>
                  <h3 className="text-base md:text-lg font-bold text-white mb-2">{it.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--fx-text-2)' }}>
                    {it.desc}
                  </p>
                </div>
              </ScrollReveal>
            )
          })}
        </div>

        <ScrollReveal variant="fadeUp" delay={0.25}>
          <p
            className="mt-10 md:mt-12 text-center text-base md:text-lg italic max-w-2xl mx-auto"
            style={{ color: 'var(--fx-text-2)' }}
          >
            &ldquo;Better control leads to better decisions.&rdquo;
          </p>
        </ScrollReveal>
      </div>
    </section>
  )
}
