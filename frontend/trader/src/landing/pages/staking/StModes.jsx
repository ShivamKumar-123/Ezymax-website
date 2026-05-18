import { Zap, Lock, CheckCircle2, XCircle } from 'lucide-react'
import SectionHeader from '@/landing/components/SectionHeader'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'
import CtFaqList from '@/landing/pages/copy-trading/CtFaqList'

const flexible = [
  { ok: true,  label: 'No lock-in period' },
  { ok: true,  label: 'Withdraw anytime' },
  { ok: false, label: 'Lower reward benefits' },
  { ok: false, label: 'No trading bonus' },
]

const locked = [
  { ok: true, label: 'Lock period (1 / 2 / 3 Year)' },
  { ok: true, label: 'Higher structured rewards' },
  { ok: true, label: 'Eligible for trading bonus' },
  { ok: true, label: 'Designed for long-term participants' },
]

const faq = [
  { q: 'What happens if I lock funds?', a: 'Funds remain in the contract for the selected duration.' },
  { q: 'Can I exit early?',             a: 'Early exit conditions depend on platform rules (if enabled).' },
]

export default function StModes() {
  return (
    <section id="modes" className="fx-section" style={{ background: 'var(--fx-bg-elev)' }}>
      <div className="fx-container">
        <SectionHeader
          badge="Liquidity Modes"
          title="Two Ways to Provide Liquidity"
          highlight="Two Ways"
          subtitle="Longer commitment unlocks stronger benefits."
        />

        <div className="mt-12 md:mt-16 grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          {/* Flexible */}
          <ScrollReveal variant="fadeUp">
            <div
              className="relative h-full rounded-2xl p-8 md:p-9"
              style={{
                background:
                  'linear-gradient(180deg, rgba(74,222,128,0.10) 0%, rgba(74,222,128,0.02) 60%), var(--fx-bg-elev)',
                border: '1px solid rgba(74,222,128,0.30)',
              }}
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ background: 'rgba(74,222,128,0.18)', border: '1px solid rgba(74,222,128,0.4)' }}
                  >
                    <Zap size={22} style={{ color: '#4ade80' }} />
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.22em] font-bold" style={{ color: '#4ade80' }}>
                      Short-Term
                    </div>
                    <h3 className="text-xl md:text-[24px] font-bold text-white">Flexible Liquidity</h3>
                  </div>
                </div>
              </div>

              <p className="text-base mb-6" style={{ color: 'var(--fx-text-2)' }}>
                Provide liquidity with full flexibility.
              </p>

              <ul className="space-y-3 mb-7">
                {flexible.map((f) => (
                  <li key={f.label} className="flex items-center gap-3">
                    {f.ok ? (
                      <CheckCircle2 size={18} style={{ color: '#4ade80' }} />
                    ) : (
                      <XCircle size={18} style={{ color: 'var(--fx-text-3)' }} />
                    )}
                    <span
                      className="text-sm md:text-[15px]"
                      style={{ color: f.ok ? '#fff' : 'var(--fx-text-3)' }}
                    >
                      {f.label}
                    </span>
                  </li>
                ))}
              </ul>

              <div
                className="rounded-xl px-4 py-3 text-xs"
                style={{
                  background: 'rgba(74,222,128,0.06)',
                  border: '1px solid rgba(74,222,128,0.30)',
                  color: '#4ade80',
                }}
              >
                Best for: users who want liquidity access without commitment.
              </div>
            </div>
          </ScrollReveal>

          {/* Locked */}
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <div
              className="relative h-full rounded-2xl p-8 md:p-9"
              style={{
                background:
                  'linear-gradient(180deg, rgba(214,169,61,0.12) 0%, rgba(214,169,61,0.02) 60%), var(--fx-bg-elev)',
                border: '1px solid rgba(214,169,61,0.40)',
                boxShadow: '0 24px 60px -28px rgba(214,169,61,0.35)',
              }}
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="feature-icon" style={{ width: 48, height: 48 }}>
                    <Lock size={22} />
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.22em] font-bold" style={{ color: 'var(--fx-gold-light)' }}>
                      Long-Term
                    </div>
                    <h3 className="text-xl md:text-[24px] font-bold text-white">Locked Liquidity</h3>
                  </div>
                </div>
                <span
                  className="hidden sm:inline-block px-3 py-1.5 rounded-full text-[11px] font-bold tracking-wider uppercase"
                  style={{
                    background: 'rgba(214,169,61,0.18)',
                    color: 'var(--fx-gold-light)',
                    border: '1px solid rgba(214,169,61,0.4)',
                  }}
                >
                  Higher Rewards
                </span>
              </div>

              <p className="text-base mb-6" style={{ color: 'var(--fx-text-2)' }}>
                Commit liquidity for a fixed duration to unlock higher benefits.
              </p>

              <ul className="space-y-3 mb-7">
                {locked.map((l) => (
                  <li key={l.label} className="flex items-center gap-3">
                    <CheckCircle2 size={18} style={{ color: 'var(--fx-gold-light)' }} />
                    <span className="text-sm md:text-[15px] text-white">{l.label}</span>
                  </li>
                ))}
              </ul>
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
