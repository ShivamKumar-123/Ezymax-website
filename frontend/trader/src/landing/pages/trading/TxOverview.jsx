import { Eye, Ban, TrendingUp, CheckCircle2 } from 'lucide-react'
import SectionHeader from '@/landing/components/SectionHeader'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

const principles = [
  'One unified trading environment',
  'Transparent cost structure',
  'No swap-based charging system',
  'Performance-driven progression (XP)',
  'Real-time execution & settlement',
]

const cards = [
  {
    icon: Eye,
    title: 'Transparent Pricing',
    desc: 'Every cost is visible before you execute — no hidden layers, no surprises.',
    accent: '#ecc657',
  },
  {
    icon: Ban,
    title: 'No Swap Model',
    desc: 'No swap fees at all. Leverage cost only applies when held overnight.',
    accent: '#4ade80',
  },
  {
    icon: TrendingUp,
    title: 'XP Progression',
    desc: 'Activity unlocks lower brokerage, lower leverage fee, and tighter spreads.',
    accent: '#a78bfa',
  },
]

export default function TxOverview() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg)' }}>
      <div className="fx-container">
        <div className="fx-section-frame">
        <SectionHeader
          badge="Trading Overview"
          title="Built for Transparency and Progress"
          highlight="Transparency"
          subtitle="We've cut out the usual mess. No account tiers, no artificial barriers. Everyone starts on the same conditions and earns better ones by actually trading."
        />
        <div className="mt-12 md:mt-16 grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
          {cards.map((c, i) => {
            const Icon = c.icon
            return (
              <ScrollReveal key={c.title} variant="fadeUp" delay={i * 0.06}>
                <div className="glass-card h-full p-6 md:p-7">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                    style={{ background: `${c.accent}1f`, border: `1px solid ${c.accent}55` }}
                  >
                    <Icon size={20} style={{ color: c.accent }} />
                  </div>
                  <h3 className="text-xl md:text-2xl font-bold text-white mb-2.5">{c.title}</h3>
                  <p className="text-sm md:text-[15px]" style={{ color: 'var(--fx-text-2)' }}>
                    {c.desc}
                  </p>
                </div>
              </ScrollReveal>
            )
          })}
        </div>

        <ScrollReveal variant="fadeUp" delay={0.25}>
          <div
            className="mt-10 md:mt-12 rounded-2xl p-6 md:p-7"
            style={{
              background:
                'linear-gradient(180deg, var(--fx-bg-elev) 0%, var(--fx-bg-elev-2) 100%)',
              border: '1px solid var(--fx-line-strong)',
            }}
          >
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] mb-4" style={{ color: 'var(--fx-gold-light)' }}>
              Core Principles
            </div>
            <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {principles.map((p) => (
                <li key={p} className="flex items-center gap-3">
                  <CheckCircle2 size={18} style={{ color: 'var(--fx-gold-light)' }} />
                  <span className="text-sm text-white">{p}</span>
                </li>
              ))}
            </ul>
          </div>
        </ScrollReveal>

        <ScrollReveal variant="fadeUp" delay={0.32}>
          <p
            className="mt-10 md:mt-12 text-center text-base md:text-lg italic max-w-2xl mx-auto"
            style={{ color: 'var(--fx-text-2)' }}
          >
            &ldquo;Your growth as a trader improves your trading conditions.&rdquo;
          </p>
        </ScrollReveal>

        </div>
      </div>
    </section>
  )
}
