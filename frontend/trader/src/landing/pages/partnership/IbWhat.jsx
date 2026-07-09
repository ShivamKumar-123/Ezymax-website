import { Handshake, Users, Activity, Coins, ArrowRight } from 'lucide-react'
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
  { icon: Handshake, label: 'IB' },
  { icon: Users,     label: 'Traders' },
  { icon: Activity,  label: 'Trading Activity' },
  { icon: Coins,     label: 'Rewards' },
]

export default function IbWhat() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg)' }}>
      <div className="fx-container">
        {/* ── Two-column intro ──────────────────────────────── */}
        <div className="fx-split-intro">
          <ScrollReveal variant="fadeUp">
            <div>
              <span className="fx-eyebrow mb-5">What is an IB?</span>
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mt-5">
                What is an <span className="gradient-text">Introducing Broker (IB)</span>?
              </h2>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <p className="text-base md:text-lg" style={{ color: 'var(--fx-text-2)' }}>
              If you already work with traders, this is the boring-but-honest version of an affiliate program.
            </p>
          </ScrollReveal>
        </div>

        {/* ── Bento: copy tile + flow tile ──────────────────── */}
        <div className="fx-bento grid-cols-1 lg:grid-cols-12 mt-10 md:mt-14 items-stretch">
          {/* LEFT — copy */}
          <ScrollReveal variant="fadeUp" className="lg:col-span-7">
            <div className="fx-tile h-full p-7 md:p-8 flex flex-col">
              <div className="feature-icon mb-5" style={{ width: 48, height: 48 }}>
                <Handshake size={20} />
              </div>
              <span className="fx-accent-bar mb-4" />
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
            <div className="fx-tile h-full p-6 md:p-7 flex flex-col">
              <span className="fx-accent-bar mb-4" />
              <div className="space-y-3">
                {flow.map((node, i) => {
                  const Icon = node.icon
                  const isLast = i === flow.length - 1
                  return (
                    <div key={node.label}>
                      <div
                        className="flex items-center gap-3 rounded-xl px-4 py-3"
                        style={{
                          background: 'var(--fx-bg-elev)',
                          border: '1px solid rgba(214,169,61,0.28)',
                        }}
                      >
                        <div className="feature-icon shrink-0" style={{ width: 40, height: 40 }}>
                          <Icon size={18} />
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
          <div className="mt-10 max-w-3xl mx-auto">
            <CtFaqList items={faq} />
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}
