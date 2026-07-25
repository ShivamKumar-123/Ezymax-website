import { Zap, Gift, BarChart3, Dices, Ticket, Gavel, Trophy } from 'lucide-react'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

const rewards = [
  {
    icon: Zap,
    title: 'XP',
    subtitle: 'Progression Points',
    desc: 'Track progress and unlock platform features.',
    bar: 72,
    gold: true,
  },
  {
    icon: Gift,
    title: 'Platform Credits',
    subtitle: 'Ecosystem Utility',
    desc: 'Use within the ecosystem for utilities.',
    bar: 48,
    gold: false,
  },
  {
    icon: BarChart3,
    title: 'Performance Score',
    subtitle: 'Engagement Index',
    desc: 'Reflect your engagement and activity.',
    bar: 89,
    gold: false,
  },
]

const engagement = [
  { icon: Dices, label: 'Spin' },
  { icon: Ticket, label: 'Lottery' },
  { icon: Gavel, label: 'Bidding' },
  { icon: Trophy, label: 'Rewards' },
]

const [xp, credits, score] = rewards

/* Every cell shares one anatomy: overline pinned top-left, icon top-right,
   and the substance anchored to the bottom edge. Reading always starts in
   the same corner and lands in the same corner, which is what lets cells of
   four different sizes still scan as one grid. */
function Cell({ icon: Icon, overline, children, className = '', gold = false }) {
  return (
    <div className={`fx-cell ${gold ? 'fx-cell-gold' : ''} ${className}`}>
      <div className="fx-cell-top">
        <span className="fx-cell-overline">{overline}</span>
        <Icon size={18} className="fx-cell-icon" strokeWidth={1.75} />
      </div>
      <div className="fx-cell-body">{children}</div>
    </div>
  )
}

/* The bar carries a value, so it stays — but as a hairline at the very
   bottom edge of the cell rather than a chunky meter competing with type. */
function Meter({ value, gold = false }) {
  return (
    <div className={`fx-meter ${gold ? 'fx-meter-gold' : ''}`}>
      <span style={{ width: `${value}%` }} />
    </div>
  )
}

export default function FxGamification() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg)' }}>
      <div className="fx-container">
        {/* ── Two-column intro ──────────────────────────────── */}
        <div className="fx-split-intro">
          <ScrollReveal variant="fadeUp">
            <div>
              <span className="fx-eyebrow mb-5">Gamification</span>
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mt-5">
                Your Activity Has <span className="gradient-text">Value</span>
              </h2>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <p className="text-base md:text-lg" style={{ color: 'var(--fx-text-2)' }}>
              Every action you take on FX Artha quietly adds up. Trade, complete tasks, show up — your account terms get better while you're doing things you'd do anyway.
            </p>
          </ScrollReveal>
        </div>

        {/* ── Bento: one gold anchor, three panels, four small cells ── */}
        <div className="fx-gam-bento mt-10 md:mt-14">
          {/* Picture takes the tall slot — no chrome, it is its own content */}
          <ScrollReveal variant="fadeUp" className="fx-gam-media">
            <div className="fx-cell fx-cell-media h-full">
              <img src="/images/hero_card2.png" alt="Gamified rewards" />
            </div>
          </ScrollReveal>

          {/* Gold cell — wide and short, the one thing the eye lands on first */}
          <ScrollReveal variant="fadeUp" delay={0.06} className="fx-gam-anchor">
            <Cell icon={xp.icon} overline={xp.subtitle} gold className="h-full">
              <h3 className="fx-cell-title fx-cell-title-lg">{xp.title}</h3>
              <p className="fx-cell-desc">{xp.desc}</p>
              <Meter value={xp.bar} gold />
            </Cell>
          </ScrollReveal>

          <ScrollReveal variant="fadeUp" delay={0.12} className="fx-gam-wide">
            <Cell icon={credits.icon} overline={credits.subtitle} className="h-full">
              <h3 className="fx-cell-title">{credits.title}</h3>
              <p className="fx-cell-desc">{credits.desc}</p>
              <Meter value={credits.bar} />
            </Cell>
          </ScrollReveal>

          <ScrollReveal variant="fadeUp" delay={0.18} className="fx-gam-score">
            <Cell icon={score.icon} overline={score.subtitle} className="h-full">
              <h3 className="fx-cell-title">{score.title}</h3>
              <p className="fx-cell-desc">{score.desc}</p>
              <Meter value={score.bar} />
            </Cell>
          </ScrollReveal>

          {/* Four small cells close the grid on a steady beat */}
          {engagement.map(({ icon: Icon, label }, i) => (
            <ScrollReveal
              key={label}
              variant="fadeUp"
              delay={0.24 + i * 0.05}
              className="fx-gam-chip"
            >
              <div className="fx-cell fx-cell-sm h-full">
                <div className="fx-cell-top">
                  <Icon size={18} className="fx-cell-icon" strokeWidth={1.75} />
                </div>
                <div className="fx-cell-body">
                  <span className="fx-cell-title-sm">{label}</span>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal variant="fadeUp" delay={0.32}>
          <p
            className="mt-10 md:mt-12 text-center text-base md:text-lg italic max-w-2xl mx-auto fx-quote"
            style={{ color: 'var(--fx-text-2)' }}
          >
            &ldquo;Stay active. Unlock more.&rdquo;
          </p>
        </ScrollReveal>
      </div>
    </section>
  )
}
