import { Eye, Ban, TrendingUp, CheckCircle2 } from 'lucide-react'
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
    gold: true,
  },
  {
    icon: Ban,
    title: 'No Swap Model',
    desc: 'No swap fees at all. Leverage cost only applies when held overnight.',
    gold: false,
  },
  {
    icon: TrendingUp,
    title: 'XP Progression',
    desc: 'Activity unlocks lower brokerage, lower leverage fee, and tighter spreads.',
    gold: false,
  },
]

export default function TxOverview() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg)' }}>
      <div className="fx-container">
        {/* ── Two-column intro ──────────────────────────────── */}
        <div className="fx-split-intro">
          <ScrollReveal variant="fadeUp">
            <div>
              <span className="fx-eyebrow mb-5">Trading Overview</span>
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mt-5">
                Built for <span className="gradient-text">Transparency</span> and Progress
              </h2>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <p className="text-base md:text-lg" style={{ color: 'var(--fx-text-2)' }}>
              We've cut out the usual mess. No account tiers, no artificial barriers. Everyone starts on the same conditions and earns better ones by actually trading.
            </p>
          </ScrollReveal>
        </div>

        {/* ── Bento: 3 cards (one solid gold) ───────────────── */}
        <div className="fx-bento grid-cols-1 md:grid-cols-3 mt-10 md:mt-14 items-stretch">
          {cards.map((c, i) => {
            const Icon = c.icon
            if (c.gold) {
              return (
                <ScrollReveal key={c.title} variant="fadeUp" delay={i * 0.06}>
                  <div className="fx-tile-gold h-full p-7 md:p-8 flex flex-col">
                    <div
                      className="relative z-[1] w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                      style={{ background: 'rgba(28,22,8,0.14)', border: '1px solid rgba(28,22,8,0.22)' }}
                    >
                      <Icon size={20} style={{ color: '#1c1608' }} />
                    </div>
                    <span className="fx-accent-bar mb-4 relative z-[1]" />
                    <h3 className="relative z-[1] text-xl md:text-2xl font-bold mb-2.5" style={{ color: '#1c1608' }}>
                      {c.title}
                    </h3>
                    <p className="relative z-[1] text-sm md:text-[15px]" style={{ color: 'rgba(28,22,8,0.78)' }}>
                      {c.desc}
                    </p>
                  </div>
                </ScrollReveal>
              )
            }
            return (
              <ScrollReveal key={c.title} variant="fadeUp" delay={i * 0.06}>
                <div className="fx-tile h-full p-7 md:p-8 flex flex-col">
                  <div className="feature-icon mb-5" style={{ width: 48, height: 48 }}>
                    <Icon size={20} />
                  </div>
                  <span className="fx-accent-bar mb-4" />
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
          <div className="fx-tile p-6 md:p-7 mt-10 md:mt-12">
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
    </section>
  )
}
