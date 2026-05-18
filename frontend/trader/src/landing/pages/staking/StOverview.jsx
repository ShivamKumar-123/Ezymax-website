import { Lock, Eye, Coins, Wallet, ArrowRight, Users } from 'lucide-react'
import SectionHeader from '@/landing/components/SectionHeader'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'
import CtFaqList from '@/landing/pages/copy-trading/CtFaqList'

const mechanics = [
  { icon: Wallet, label: 'Funds are allocated to the protocol (smart contract)' },
  { icon: Coins,  label: 'Used to support trading liquidity' },
  { icon: ArrowRight, label: 'Rewards are generated based on participation' },
  { icon: Eye,    label: 'Users retain visibility and control' },
]

const faq = [
  { q: 'Is my money held by the platform?', a: 'No. Funds are allocated to a smart contract-based system.' },
  { q: 'Can I withdraw anytime?',           a: 'Depends on the plan you choose (Flexible or Locked).' },
]

export default function StOverview() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg)' }}>
      <div className="fx-container">
        <SectionHeader
          badge="Overview"
          title="What is Staking in FX Artha?"
          highlight="Staking in FX Artha?"
          subtitle="Your funds stay in a smart contract. The protocol uses that pool to run trading on the platform and pays a share of what it earns back to you."
        />

        <div className="mt-12 md:mt-16 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
          {/* LEFT — copy + mechanics */}
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
                <Lock size={20} />
              </div>
              <p className="text-base md:text-lg leading-relaxed mb-6" style={{ color: 'var(--fx-text-2)' }}>
                Staking in FX Artha means providing liquidity to the protocol through a smart
                contract. Your funds are <span style={{ color: 'var(--fx-gold-light)' }}>not held by a broker</span> —
                they remain in a decentralized structure where they contribute to the trading
                ecosystem.
              </p>

              <div className="text-[11px] font-bold uppercase tracking-[0.22em] mb-4" style={{ color: 'var(--fx-gold-light)' }}>
                Key Mechanics
              </div>
              <ul className="space-y-3">
                {mechanics.map(({ icon: Icon, label }) => (
                  <li
                    key={label}
                    className="flex items-center gap-3 rounded-xl px-4 py-3"
                    style={{
                      background: 'rgba(214,169,61,0.05)',
                      border: '1px solid rgba(214,169,61,0.22)',
                    }}
                  >
                    <Icon size={16} style={{ color: 'var(--fx-gold-light)' }} />
                    <span className="text-sm md:text-[15px] text-white">{label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </ScrollReveal>

          {/* RIGHT — User → Contract → Rewards diagram */}
          <ScrollReveal variant="fadeUp" delay={0.1} className="lg:col-span-5">
            <div
              className="h-full rounded-2xl p-7 md:p-8 relative overflow-hidden"
              style={{
                background:
                  'linear-gradient(160deg, rgba(214,169,61,0.06) 0%, var(--fx-bg-elev-2) 60%)',
                border: '1px solid rgba(214,169,61,0.22)',
              }}
            >
              <div className="absolute inset-0 fx-grid-bg" />
              <div className="relative space-y-3">
                <StepCard icon={Users} color="#a78bfa" label="User" title="Allocates funds" />
                <Connector />
                <StepCard icon={Lock} color="#ecc657" label="Smart Contract" title="Holds liquidity" highlight />
                <Connector />
                <StepCard icon={Coins} color="#4ade80" label="Rewards" title="Distributed by protocol" />
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

function StepCard({ icon: Icon, color, label, title, highlight = false }) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl px-4 py-3"
      style={{
        background: highlight
          ? `linear-gradient(180deg, ${color}1a, ${color}05)`
          : 'var(--fx-bg-elev)',
        border: `1px solid ${color}55`,
        boxShadow: highlight ? `0 16px 40px -16px ${color}55` : 'none',
      }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{
          background: `${color}1f`,
          border: `1px solid ${color}55`,
        }}
      >
        <Icon size={18} style={{ color }} />
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
