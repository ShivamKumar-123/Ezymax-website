import { Zap, Gift, BarChart3, Dices, Ticket, Gavel, Trophy } from 'lucide-react'
import SectionHeader from '@/landing/components/SectionHeader'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

const rewards = [
  {
    icon: Zap,
    title: 'XP',
    subtitle: 'Progression Points',
    desc: 'Track progress and unlock platform features.',
    accent: '#a78bfa',
    bar: 72,
  },
  {
    icon: Gift,
    title: 'Platform Credits',
    subtitle: 'Ecosystem Utility',
    desc: 'Use within the ecosystem for utilities.',
    accent: '#ecc657',
    bar: 48,
  },
  {
    icon: BarChart3,
    title: 'Performance Score',
    subtitle: 'Engagement Index',
    desc: 'Reflect your engagement and activity.',
    accent: '#60a5fa',
    bar: 89,
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
        <SectionHeader
          badge="Gamification"
          title="Your Activity Has Value"
          highlight="Value"
          subtitle="Every action you take on FX Artha quietly adds up. Trade, complete tasks, show up — your account terms get better while you're doing things you'd do anyway."
        />

        {/* ── 3 reward cards ──────────────────────────────────── */}
        <div className="mt-12 md:mt-16 grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
          {rewards.map((r, i) => {
            const Icon = r.icon
            return (
              <ScrollReveal key={r.title} variant="fadeUp" delay={i * 0.06}>
                <div className="glass-card h-full p-6 md:p-7">
                  <div className="flex items-center justify-between mb-5">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{
                        background: `${r.accent}1f`,
                        border: `1px solid ${r.accent}55`,
                      }}
                    >
                      <Icon size={20} style={{ color: r.accent }} />
                    </div>
                    <span
                      className="text-[11px] font-bold uppercase tracking-[0.22em]"
                      style={{ color: r.accent }}
                    >
                      {r.subtitle}
                    </span>
                  </div>
                  <h3 className="text-xl md:text-2xl font-bold text-white mb-2">{r.title}</h3>
                  <p className="text-sm md:text-[15px] mb-5" style={{ color: 'var(--fx-text-2)' }}>
                    {r.desc}
                  </p>
                  <div
                    className="h-2 w-full rounded-full overflow-hidden"
                    style={{ background: 'rgba(255,255,255,0.06)' }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${r.bar}%`,
                        background: `linear-gradient(90deg, ${r.accent}, ${r.accent}aa)`,
                        boxShadow: `0 0 12px ${r.accent}66`,
                      }}
                    />
                  </div>
                </div>
              </ScrollReveal>
            )
          })}
        </div>

        {/* ── Engagement icons row ─────────────────────────────── */}
        <ScrollReveal variant="fadeUp" delay={0.25}>
          <div
            className="mt-8 md:mt-10 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 p-5 md:p-6 rounded-2xl"
            style={{
              background:
                'linear-gradient(180deg, var(--fx-bg-elev) 0%, var(--fx-bg-elev-2) 100%)',
              border: '1px solid var(--fx-line-strong)',
            }}
          >
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
        </ScrollReveal>

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
