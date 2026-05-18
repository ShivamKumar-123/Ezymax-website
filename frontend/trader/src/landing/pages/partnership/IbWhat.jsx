import { Handshake, Users, Activity, Coins, ArrowRight } from 'lucide-react'
import SectionHeader from '@/landing/components/SectionHeader'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'
import CtFaqList from '@/landing/pages/copy-trading/CtFaqList'

const faq = [
  {
    q: 'Who can become an IB?',
    a: 'Anyone with a trading audience, community, educational platform, or client network.',
  },
  {
    q: 'Do I need trading experience?',
    a: 'Not mandatory, but industry understanding is recommended.',
  },
  {
    q: 'Is this an affiliate program?',
    a: 'No. This is a long-term partnership model focused on ecosystem growth.',
  },
]

const flow = [
  { icon: Handshake, label: 'IB', accent: '#ecc657' },
  { icon: Users,     label: 'Traders', accent: '#a78bfa' },
  { icon: Activity,  label: 'Trading Activity', accent: '#60a5fa' },
  { icon: Coins,     label: 'Rewards', accent: '#4ade80' },
]

export default function IbWhat() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg)' }}>
      <div className="fx-container">
        <SectionHeader
          badge="What is an IB?"
          title="What is an Introducing Broker (IB)?"
          highlight="Introducing Broker (IB)"
          subtitle="Build relationships. Grow a trading network. Earn from activity."
        />

        <div className="mt-12 md:mt-16 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
          {/* LEFT — copy */}
          <ScrollReveal variant="fadeUp" className="lg:col-span-7">
            <div
              className="h-full rounded-2xl p-7 md:p-8"
              style={{
                background:
                  'linear-gradient(180deg, var(--fx-bg-elev-2) 0%, var(--fx-bg-elev) 100%)',
                border: '1px solid var(--fx-line-strong)',
              }}
            >
              <div className="feature-icon mb-5">
                <Handshake size={20} />
              </div>
              <p className="text-base md:text-lg leading-relaxed mb-5" style={{ color: 'var(--fx-text-2)' }}>
                An Introducing Broker (IB) is a{' '}
                <span style={{ color: 'var(--fx-gold-light)' }}>strategic partner</span> who introduces
                traders to the FX Artha ecosystem. IBs help grow the trading community while earning
                performance-based rewards from trading activity generated through their network.
              </p>
              <p className="text-sm md:text-base leading-relaxed" style={{ color: 'var(--fx-text-2)' }}>
                Unlike traditional affiliate systems, the FX Artha IB model is designed for{' '}
                <span style={{ color: 'var(--fx-gold-light)' }}>long-term partnerships</span>,
                trader retention, and ecosystem growth.
              </p>
            </div>
          </ScrollReveal>

          {/* RIGHT — IB → Traders → Activity → Rewards flow */}
          <ScrollReveal variant="fadeUp" delay={0.1} className="lg:col-span-5">
            <div
              className="h-full rounded-2xl p-6 md:p-7 relative overflow-hidden"
              style={{
                background:
                  'linear-gradient(160deg, rgba(214,169,61,0.06) 0%, var(--fx-bg-elev-2) 60%)',
                border: '1px solid rgba(214,169,61,0.22)',
              }}
            >
              <div className="absolute inset-0 fx-grid-bg" />
              <div className="relative space-y-3">
                {flow.map((node, i) => {
                  const Icon = node.icon
                  const isLast = i === flow.length - 1
                  return (
                    <div key={node.label}>
                      <div
                        className="flex items-center gap-3 rounded-xl px-4 py-3"
                        style={{
                          background: 'var(--fx-bg-elev)',
                          border: `1px solid ${node.accent}45`,
                        }}
                      >
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                          style={{
                            background: `${node.accent}1f`,
                            border: `1px solid ${node.accent}55`,
                          }}
                        >
                          <Icon size={18} style={{ color: node.accent }} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--fx-text-3)' }}>
                            Step {i + 1}
                          </div>
                          <div className="text-sm font-bold text-white">{node.label}</div>
                        </div>
                      </div>
                      {!isLast && (
                        <div className="flex justify-center" style={{ color: 'var(--fx-gold-light)' }}>
                          <ArrowRight size={16} className="rotate-90 my-1" />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </ScrollReveal>
        </div>

        <ScrollReveal variant="fadeUp" delay={0.2}>
          <p
            className="mt-10 text-center text-base md:text-lg font-semibold italic"
            style={{ color: 'var(--fx-gold-light)' }}
          >
            “Build relationships. Grow a trading network. Earn from activity.”
          </p>
        </ScrollReveal>

        <ScrollReveal variant="fadeUp" delay={0.25}>
          <div className="mt-8 max-w-3xl mx-auto">
            <CtFaqList items={faq} />
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}
