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

        {/* ── Bento: 3 reward tiles (one solid gold) ────────── */}
        <div className="fx-bento grid-cols-1 md:grid-cols-3 mt-10 md:mt-14 items-stretch">
          {rewards.map((r, i) => {
            const Icon = r.icon
            if (r.gold) {
              return (
                <ScrollReveal key={r.title} variant="fadeUp" delay={i * 0.06}>
                  <div className="fx-tile-gold h-full p-7 md:p-8 flex flex-col">
                    <div className="relative z-[1] flex items-center justify-between mb-5">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center"
                        style={{ background: 'rgba(28,22,8,0.14)', border: '1px solid rgba(28,22,8,0.22)' }}
                      >
                        <Icon size={20} style={{ color: '#1c1608' }} />
                      </div>
                      <span
                        className="text-[11px] font-bold uppercase tracking-[0.22em]"
                        style={{ color: '#1c1608' }}
                      >
                        {r.subtitle}
                      </span>
                    </div>
                    <span className="fx-accent-bar mb-4 relative z-[1]" />
                    <h3 className="relative z-[1] text-xl md:text-2xl font-bold mb-2" style={{ color: '#1c1608' }}>
                      {r.title}
                    </h3>
                    <p className="relative z-[1] text-sm md:text-[15px] mb-5" style={{ color: 'rgba(28,22,8,0.78)' }}>
                      {r.desc}
                    </p>
                    <div
                      className="relative z-[1] h-2 w-full rounded-full overflow-hidden mt-auto"
                      style={{ background: 'rgba(28,22,8,0.16)' }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${r.bar}%`,
                          background: 'linear-gradient(90deg, #1c1608, rgba(28,22,8,0.7))',
                        }}
                      />
                    </div>
                  </div>
                </ScrollReveal>
              )
            }
            return (
              <ScrollReveal key={r.title} variant="fadeUp" delay={i * 0.06}>
                <div className="fx-tile h-full p-7 md:p-8 flex flex-col">
                  <div className="flex items-center justify-between mb-5">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{
                        background: 'rgba(214,169,61,0.12)',
                        border: '1px solid rgba(214,169,61,0.32)',
                      }}
                    >
                      <Icon size={20} style={{ color: 'var(--fx-gold-light)' }} />
                    </div>
                    <span
                      className="text-[11px] font-bold uppercase tracking-[0.22em]"
                      style={{ color: 'var(--fx-gold-light)' }}
                    >
                      {r.subtitle}
                    </span>
                  </div>
                  <span className="fx-accent-bar mb-4" />
                  <h3 className="text-xl md:text-2xl font-bold text-white mb-2">{r.title}</h3>
                  <p className="text-sm md:text-[15px] mb-5" style={{ color: 'var(--fx-text-2)' }}>
                    {r.desc}
                  </p>
                  <div
                    className="h-2 w-full rounded-full overflow-hidden mt-auto"
                    style={{ background: 'rgba(255,255,255,0.06)' }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${r.bar}%`,
                        background: 'linear-gradient(90deg, var(--fx-gold-light), var(--fx-gold))',
                        boxShadow: '0 0 12px rgba(214,169,61,0.4)',
                      }}
                    />
                  </div>
                </div>
              </ScrollReveal>
            )
          })}
        </div>

        {/* ── Bento row: engagement strip + image tile ──────── */}
        <div className="fx-bento grid-cols-1 md:grid-cols-3 mt-5 md:mt-6 items-stretch">
          {/* Engagement strip — full-width gold-accented tile */}
          <ScrollReveal variant="fadeUp" delay={0.2} className="md:col-span-2">
            <div className="fx-tile h-full p-7 md:p-8 flex flex-col">
              <span className="fx-accent-bar mb-4" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mt-auto">
                {engagement.map(({ icon: Icon, label }) => (
                  <div
                    key={label}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl"
                    style={{
                      background: 'rgba(214,169,61,0.05)',
                      border: '1px solid rgba(214,169,61,0.18)',
                    }}
                  >
                    <Icon size={18} style={{ color: 'var(--fx-gold-light)' }} />
                    <span className="text-sm font-semibold text-white">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </ScrollReveal>

          {/* Image tile */}
          <ScrollReveal variant="fadeUp" delay={0.28}>
            <div className="fx-tile h-full min-h-[280px] overflow-hidden">
              <img
                src="/images/hero_card2.png"
                alt="Gamified rewards"
                className="h-full w-full object-cover"
              />
            </div>
          </ScrollReveal>
        </div>

        <ScrollReveal variant="fadeUp" delay={0.32}>
          <p
            className="mt-10 md:mt-12 text-center text-base md:text-lg italic max-w-2xl mx-auto"
            style={{ color: 'var(--fx-text-2)' }}
          >
            &ldquo;Stay active. Unlock more.&rdquo;
          </p>
        </ScrollReveal>
      </div>
    </section>
  )
}
