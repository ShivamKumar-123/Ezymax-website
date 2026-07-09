import { Gauge, ShieldCheck, Activity, Eye } from 'lucide-react'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

const items = [
  {
    icon: Gauge,
    title: 'Adjustable Leverage',
    desc: 'Tune leverage to match the trade — never one-size-fits-all.',
  },
  {
    icon: ShieldCheck,
    title: 'Trade Insurance (optional)',
    desc: 'Activate partial loss cover on eligible trades, before execution.',
    gold: true,
  },
  {
    icon: Activity,
    title: 'Real-time Exposure',
    desc: 'Live view of open risk across all positions.',
  },
  {
    icon: Eye,
    title: 'Pre-trade Cost Visibility',
    desc: 'Brokerage, leverage fee, and spread are visible before you click.',
  },
]

export default function TxRiskControl() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg)' }}>
      <div className="fx-container">
        {/* ── Two-column intro ──────────────────────────────── */}
        <div className="fx-split-intro">
          <ScrollReveal variant="fadeUp">
            <div>
              <span className="fx-eyebrow mb-5">Risk Control</span>
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mt-5">
                Built-In <span className="gradient-text">Risk Management</span>
              </h2>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <p className="text-base md:text-lg" style={{ color: 'var(--fx-text-2)' }}>
              The unglamorous part of trading — knowing what you're walking into. These are the controls that catch most surprises before you click Buy.
            </p>
          </ScrollReveal>
        </div>

        <div className="fx-bento grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mt-12 md:mt-16 items-stretch">
          {items.map((it, i) => {
            const Icon = it.icon
            if (it.gold) {
              return (
                <ScrollReveal key={it.title} variant="fadeUp" delay={i * 0.05}>
                  <div className="fx-tile-gold h-full p-6 flex flex-col">
                    <div
                      className="relative z-[1] w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                      style={{ background: 'rgba(28,22,8,0.14)', border: '1px solid rgba(28,22,8,0.22)' }}
                    >
                      <Icon size={20} style={{ color: '#1c1608' }} />
                    </div>
                    <span className="fx-accent-bar mb-4 relative z-[1]" />
                    <h3 className="relative z-[1] text-base md:text-lg font-bold mb-2" style={{ color: '#1c1608' }}>{it.title}</h3>
                    <p className="relative z-[1] text-sm leading-relaxed" style={{ color: 'rgba(28,22,8,0.78)' }}>
                      {it.desc}
                    </p>
                  </div>
                </ScrollReveal>
              )
            }
            return (
              <ScrollReveal key={it.title} variant="fadeUp" delay={i * 0.05}>
                <div className="fx-tile h-full p-6 flex flex-col">
                  <div className="feature-icon mb-5" style={{ width: 48, height: 48 }}>
                    <Icon size={20} />
                  </div>
                  <span className="fx-accent-bar mb-4" />
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
