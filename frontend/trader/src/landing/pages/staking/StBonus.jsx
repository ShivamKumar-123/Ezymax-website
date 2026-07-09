import { Sparkles, Lock, AlertTriangle, ArrowRight, Coins, Activity } from 'lucide-react'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'
import CtFaqList from '@/landing/pages/copy-trading/CtFaqList'

const faq = [
  { q: 'Can I withdraw after using trading bonus?',     a: 'No. Withdrawal is restricted during the lock period.' },
  { q: 'Is trading bonus available in flexible staking?', a: 'No. Only available in long-term locked staking.' },
]

export default function StBonus() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg)' }}>
      <div className="fx-container">
        {/* ── Two-column intro ──────────────────────────────── */}
        <div className="fx-split-intro">
          <ScrollReveal variant="fadeUp">
            <div>
              <span className="fx-eyebrow mb-5">Trading Bonus</span>
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mt-5">
                Unlock <span className="gradient-text">Trading Power</span> with Staking
              </h2>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <p className="text-base md:text-lg" style={{ color: 'var(--fx-text-2)' }}>
              Long-term stakers receive a trading bonus equal to their committed liquidity.
            </p>
          </ScrollReveal>
        </div>

        {/* ── Bento: gold mechanism tile + stat-chart figures ── */}
        <div className="fx-bento grid-cols-1 lg:grid-cols-12 mt-12 md:mt-16 items-stretch">
          {/* Left — gold mechanism tile */}
          <ScrollReveal variant="fadeUp" className="lg:col-span-7">
            <div className="fx-tile-gold h-full p-8 md:p-10 flex flex-col">
              <span className="badge mb-5 relative z-[1]" style={{ display: 'inline-flex' }}>
                <Sparkles size={11} style={{ color: 'var(--fx-gold)' }} />
                Key Feature
              </span>
              <h3 className="relative z-[1] text-2xl md:text-[34px] font-bold mb-4 leading-tight" style={{ color: '#1c1608' }}>
                Stake once. Trade with amplified power.
              </h3>

              <div className="relative z-[1] grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                <Step icon={Coins}    label="Stake liquidity" />
                <Step icon={Sparkles} label="Receive equivalent bonus" highlight />
                <Step icon={Activity} label="Use bonus for trading" />
              </div>

              <div
                className="relative z-[1] mt-auto rounded-xl px-4 py-3 inline-flex items-center gap-2 text-sm font-semibold self-start"
                style={{
                  background: 'rgba(28,22,8,0.10)',
                  border: '1px solid rgba(28,22,8,0.22)',
                  color: '#1c1608',
                }}
              >
                <ArrowRight size={14} />
                Equivalent to your committed liquidity
              </div>
            </div>
          </ScrollReveal>

          {/* Right — stat-chart figures */}
          <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4 md:gap-5">
            <ScrollReveal variant="fadeUp" delay={0.06}>
              <div className="fx-stat-chart h-full p-5 md:p-6 flex flex-col">
                <div className="fx-chart-curve" />
                <div className="relative z-[1] text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--fx-text-3)' }}>
                  Your Stake
                </div>
                <div className="relative z-[1] text-4xl font-bold gradient-text">$1,000.00</div>
              </div>
            </ScrollReveal>

            <ScrollReveal variant="fadeUp" delay={0.12}>
              <div className="fx-stat-chart h-full p-5 md:p-6 flex flex-col">
                <div className="fx-chart-curve" />
                <div className="relative z-[1] text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--fx-gold-light)' }}>
                  Trading Bonus
                </div>
                <div className="relative z-[1] text-4xl font-bold gradient-text">$1,000.00</div>
                <div className="relative z-[1] text-[11px] mt-1" style={{ color: 'var(--fx-text-3)' }}>
                  Use for trading within the platform
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>

        {/* Important rule strip — negative/warning, red retained intentionally */}
        <ScrollReveal variant="fadeUp" delay={0.18}>
          <div
            className="mt-6 rounded-2xl px-6 md:px-8 py-5 flex flex-wrap items-center gap-3"
            style={{
              background: 'rgba(248,113,113,0.06)',
              border: '1px solid rgba(248,113,113,0.30)',
            }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: 'rgba(248,113,113,0.18)',
                border: '1px solid rgba(248,113,113,0.45)',
              }}
            >
              <AlertTriangle size={16} style={{ color: '#f87171' }} />
            </div>
            <div className="flex-1 min-w-0">
              <div
                className="text-[11px] uppercase tracking-[0.22em] font-bold"
                style={{ color: '#f87171' }}
              >
                Important Rule
              </div>
              <div className="text-sm md:text-[15px] text-white">
                If trading bonus is activated, funds are locked for the selected duration —{' '}
                <span style={{ color: '#f87171' }}>withdrawal is restricted</span> during the lock period.
              </div>
            </div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: '#f87171' }}>
              <Lock size={13} />
              Lock-period applies
            </div>
          </div>
        </ScrollReveal>

        <ScrollReveal variant="fadeUp" delay={0.25}>
          <div className="fx-tile p-6 md:p-8 mt-8 max-w-3xl mx-auto">
            <CtFaqList items={faq} />
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}

function Step({ icon: Icon, label, highlight = false }) {
  return (
    <div
      className="rounded-xl p-4 flex flex-col items-center text-center gap-2"
      style={{
        background: highlight
          ? 'linear-gradient(180deg, rgba(28,22,8,0.16), rgba(28,22,8,0.04))'
          : 'rgba(28,22,8,0.06)',
        border: highlight ? '1px solid rgba(28,22,8,0.35)' : '1px solid rgba(28,22,8,0.16)',
      }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center"
        style={{
          background: 'rgba(28,22,8,0.10)',
          border: '1px solid rgba(28,22,8,0.22)',
        }}
      >
        <Icon size={16} style={{ color: '#1c1608' }} />
      </div>
      <div className="text-xs md:text-sm font-semibold" style={{ color: '#1c1608' }}>{label}</div>
    </div>
  )
}
