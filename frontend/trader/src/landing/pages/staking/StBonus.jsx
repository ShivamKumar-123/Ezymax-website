import { Sparkles, Lock, AlertTriangle, ArrowRight, Coins, Activity } from 'lucide-react'
import SectionHeader from '@/landing/components/SectionHeader'
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
        <div className="fx-section-frame">
        <SectionHeader
          badge="Trading Bonus"
          title="Unlock Trading Power with Staking"
          highlight="Trading Power"
          subtitle="Long-term stakers receive a trading bonus equal to their committed liquidity."
        />
        <ScrollReveal variant="fadeUp">
          <div
            className="mt-12 md:mt-16 relative rounded-3xl overflow-hidden"
            style={{
              background:
                'linear-gradient(135deg, rgba(214,169,61,0.20) 0%, var(--fx-bg-elev-2) 60%), var(--fx-bg-elev)',
              border: '1px solid rgba(214,169,61,0.45)',
              boxShadow: '0 40px 100px -30px rgba(214,169,61,0.45)',
            }}
          >
            <div
              className="absolute -top-px left-[6%] right-[6%] h-px"
              style={{
                background:
                  'linear-gradient(90deg, transparent, rgba(214,169,61,0.95), transparent)',
              }}
            />
            <div className="absolute inset-0 fx-grid-bg pointer-events-none" />

            <div className="relative p-8 md:p-12 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
              {/* Left — mechanism flow */}
              <div className="lg:col-span-7">
                <span className="badge mb-5" style={{ display: 'inline-flex' }}>
                  <Sparkles size={11} style={{ color: 'var(--fx-gold)' }} />
                  Key Feature
                </span>
                <h3 className="text-2xl md:text-[34px] font-bold text-white mb-4 leading-tight">
                  Stake once. <span className="gradient-text">Trade with amplified power.</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                  <Step icon={Coins}    label="Stake liquidity" />
                  <Step icon={Sparkles} label="Receive equivalent bonus" highlight />
                  <Step icon={Activity} label="Use bonus for trading" />
                </div>

                <div
                  className="rounded-xl px-4 py-3 inline-flex items-center gap-2 text-sm font-semibold"
                  style={{
                    background: 'rgba(214,169,61,0.10)',
                    border: '1px solid rgba(214,169,61,0.40)',
                    color: 'var(--fx-gold-light)',
                  }}
                >
                  <ArrowRight size={14} />
                  Equivalent to your committed liquidity
                </div>
              </div>

              {/* Right — bonus illustration */}
              <div className="lg:col-span-5">
                <div
                  className="rounded-2xl p-6 md:p-7"
                  style={{
                    background: 'var(--fx-bg)',
                    border: '1px solid rgba(214,169,61,0.30)',
                  }}
                >
                  <div className="text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--fx-text-3)' }}>
                    Your Stake
                  </div>
                  <div className="text-2xl font-extrabold text-white mb-4">$1,000.00</div>

                  <div className="flex items-center justify-center my-3" style={{ color: 'var(--fx-gold-light)' }}>
                    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                      <path
                        d="M11 2 L11 18 M5 12 L11 18 L17 12"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>

                  <div
                    className="rounded-xl p-4 text-center"
                    style={{
                      background:
                        'linear-gradient(180deg, rgba(214,169,61,0.20), rgba(214,169,61,0.04))',
                      border: '1px solid rgba(214,169,61,0.55)',
                    }}
                  >
                    <div className="text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--fx-gold-light)' }}>
                      Trading Bonus
                    </div>
                    <div className="text-3xl font-extrabold gradient-text">$1,000.00</div>
                    <div className="text-[11px] mt-1" style={{ color: 'var(--fx-text-3)' }}>
                      Use for trading within the platform
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Important rule strip */}
            <div
              className="relative px-8 md:px-12 py-5 flex flex-wrap items-center gap-3"
              style={{
                background: 'rgba(248,113,113,0.06)',
                borderTop: '1px solid rgba(248,113,113,0.30)',
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
          </div>
        </ScrollReveal>

        <ScrollReveal variant="fadeUp" delay={0.25}>
          <div className="mt-8 max-w-3xl mx-auto">
            <CtFaqList items={faq} />
          </div>
        </ScrollReveal>
        </div>
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
          ? 'linear-gradient(180deg, rgba(214,169,61,0.18), rgba(214,169,61,0.04))'
          : 'rgba(255,255,255,0.03)',
        border: highlight ? '1px solid rgba(214,169,61,0.55)' : '1px solid var(--fx-line-strong)',
      }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center"
        style={{
          background: highlight ? 'rgba(214,169,61,0.20)' : 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(214,169,61,0.35)',
        }}
      >
        <Icon size={16} style={{ color: highlight ? '#ecc657' : 'var(--fx-gold-light)' }} />
      </div>
      <div className="text-xs md:text-sm font-semibold text-white">{label}</div>
    </div>
  )
}
