import { Lock, Eye, Coins, Wallet, ArrowRight, Users } from 'lucide-react'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'
import CtFaqList from '@/landing/pages/copy-trading/CtFaqList'

const mechanics = [
  { icon: Wallet, label: 'Funds are allocated to the protocol (smart contract)' },
  { icon: Coins,  label: 'Used to support trading liquidity' },
  { icon: ArrowRight, label: 'Rewards are generated based on participation' },
  { icon: Eye,    label: 'Users retain visibility and control' },
]

const flow = [
  { icon: Users, label: 'User', title: 'Allocates funds' },
  { icon: Lock,  label: 'Smart Contract', title: 'Holds liquidity', highlight: true },
  { icon: Coins, label: 'Rewards', title: 'Distributed by protocol' },
]

const faq = [
  { q: 'Is my money held by the platform?', a: 'No. Funds are allocated to a smart contract-based system.' },
  { q: 'Can I withdraw anytime?',           a: 'Depends on the plan you choose (Flexible or Locked).' },
]

export default function StOverview() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg)' }}>
      <div className="fx-container">
        {/* ── Two-column intro ──────────────────────────────── */}
        <div className="fx-split-intro-center">
          <ScrollReveal variant="fadeUp">
            <div>
              <span className="fx-eyebrow mb-5">Overview</span>
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mt-5">
                What is <span className="gradient-text">Staking in FX Artha?</span>
              </h2>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <p className="text-base md:text-lg" style={{ color: 'var(--fx-text-2)' }}>
              You are not depositing — you are participating.
            </p>
          </ScrollReveal>
        </div>

        {/* ── Bento: gold copy+mechanics tile + dark flow tile ── */}
        <div className="fx-bento grid-cols-1 lg:grid-cols-12 mt-10 md:mt-14 items-stretch">
          {/* LEFT — copy + mechanics (solid gold accent tile) */}
          <ScrollReveal variant="fadeUp" className="lg:col-span-7">
            <div className="fx-tile-gold h-full p-7 md:p-8 flex flex-col">
              <div
                className="relative z-[1] w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                style={{ background: 'rgba(28,22,8,0.14)', border: '1px solid rgba(28,22,8,0.22)' }}
              >
                <Lock size={20} style={{ color: '#1c1608' }} />
              </div>
              <span className="fx-accent-bar mb-4 relative z-[1]" />
              <p className="relative z-[1] text-base md:text-lg leading-relaxed mb-6" style={{ color: 'rgba(28,22,8,0.78)' }}>
                Staking in FX Artha means providing liquidity to the protocol through a smart
                contract. Your funds are <span className="font-bold" style={{ color: '#1c1608' }}>not held by a broker</span> —
                they remain in a decentralized structure where they contribute to the trading
                ecosystem.
              </p>

              <div className="relative z-[1] text-[11px] font-bold uppercase tracking-[0.22em] mb-4" style={{ color: '#1c1608' }}>
                Key Mechanics
              </div>
              <ul className="relative z-[1] space-y-3 mt-auto">
                {mechanics.map(({ icon: Icon, label }) => (
                  <li
                    key={label}
                    className="flex items-center gap-3 rounded-xl px-4 py-3"
                    style={{
                      background: 'rgba(28,22,8,0.08)',
                      border: '1px solid rgba(28,22,8,0.16)',
                    }}
                  >
                    <Icon size={16} style={{ color: '#1c1608' }} />
                    <span className="text-sm md:text-[15px] font-medium" style={{ color: '#1c1608' }}>{label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </ScrollReveal>

          {/* RIGHT — User → Contract → Rewards flow (dark tile) */}
          <ScrollReveal variant="fadeUp" delay={0.1} className="lg:col-span-5">
            <div className="fx-tile h-full p-7 md:p-8 flex flex-col">
              <span className="fx-accent-bar mb-4" />
              <h3 className="text-xl md:text-2xl font-bold text-white mb-6">
                User &rarr; Contract &rarr; Rewards
              </h3>
              <div className="space-y-3">
                {flow.map((s, i) => (
                  <div key={s.title}>
                    <StepCard icon={s.icon} label={s.label} title={s.title} highlight={s.highlight} />
                    {i < flow.length - 1 && <Connector />}
                  </div>
                ))}
              </div>
            </div>
          </ScrollReveal>
        </div>

        <ScrollReveal variant="fadeUp" delay={0.25}>
          <div className="mt-8 max-w-3xl mx-auto">
            <CtFaqList items={faq} />
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}

function StepCard({ icon: Icon, label, title, highlight = false }) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl px-4 py-3"
      style={{
        background: highlight
          ? 'linear-gradient(180deg, rgba(214,169,61,0.16), rgba(214,169,61,0.03))'
          : 'var(--fx-bg-elev)',
        border: '1px solid rgba(214,169,61,0.35)',
        boxShadow: highlight ? '0 16px 40px -16px rgba(214,169,61,0.4)' : 'none',
      }}
    >
      <div className="feature-icon shrink-0" style={{ width: 40, height: 40 }}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--fx-text-3)' }}>
          {label}
        </div>
        <div className="text-sm font-bold text-white">{title}</div>
      </div>
    </div>
  )
}

function Connector() {
  return (
    <div className="flex justify-center" style={{ color: 'var(--fx-gold-light)' }}>
      <svg width="14" height="22" viewBox="0 0 14 22" fill="none" aria-hidden>
        <path
          d="M7 0 L7 16 M3 12 L7 16 L11 12"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}
