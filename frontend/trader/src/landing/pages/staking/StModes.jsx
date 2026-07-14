import { Zap, Lock, CheckCircle2, XCircle } from 'lucide-react'
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
        {/* ── Two-column intro ──────────────────────────────── */}
        <div className="fx-split-intro-center">
          <ScrollReveal variant="fadeUp">
            <div>
              <span className="fx-eyebrow mb-5">Liquidity Modes</span>
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mt-5">
                <span className="gradient-text">Two Ways</span> to Provide Liquidity
              </h2>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <p className="text-base md:text-lg" style={{ color: 'var(--fx-text-2)' }}>
              Longer commitment unlocks stronger benefits.
            </p>
          </ScrollReveal>
        </div>

        {/* ── Bento: dark flexible tile + gold locked tile ───── */}
        <div className="fx-bento grid-cols-1 lg:grid-cols-2 mt-10 md:mt-14 items-stretch">
          {/* Flexible — dark tile with gold accent bar */}
          <ScrollReveal variant="fadeUp">
            <div className="fx-tile h-full p-7 md:p-8 flex flex-col">
              <div className="flex items-center gap-3 mb-5">
                <div className="feature-icon" style={{ width: 48, height: 48 }}>
                  <Zap size={22} />
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-[0.22em] font-bold" style={{ color: 'var(--fx-gold-light)' }}>
                    Short-Term
                  </div>
                  <h3 className="text-xl md:text-[24px] font-bold text-white">Flexible Liquidity</h3>
                </div>
              </div>

              <span className="fx-accent-bar mb-4" />

              <p className="text-base mb-6" style={{ color: 'var(--fx-text-2)' }}>
                Provide liquidity with full flexibility.
              </p>

              <ul className="space-y-3 mb-7">
                {flexible.map((f) => (
                  <li key={f.label} className="flex items-center gap-3">
                    {f.ok ? (
                      <CheckCircle2 size={18} style={{ color: 'var(--fx-gold-light)' }} />
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
                className="mt-auto rounded-xl px-4 py-3 text-xs"
                style={{
                  background: 'rgba(214,169,61,0.06)',
                  border: '1px solid rgba(214,169,61,0.30)',
                  color: 'var(--fx-gold-light)',
                }}
              >
                Best for: users who want liquidity access without commitment.
              </div>
            </div>
          </ScrollReveal>

          {/* Locked — solid gold accent tile */}
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <div className="fx-tile-gold h-full p-7 md:p-8 flex flex-col">
              <div className="relative z-[1] flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ background: 'rgba(28,22,8,0.14)', border: '1px solid rgba(28,22,8,0.22)' }}
                  >
                    <Lock size={22} style={{ color: '#1c1608' }} />
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.22em] font-bold" style={{ color: '#1c1608' }}>
                      Long-Term
                    </div>
                    <h3 className="text-xl md:text-[24px] font-bold" style={{ color: '#1c1608' }}>Locked Liquidity</h3>
                  </div>
                </div>
                <span
                  className="hidden sm:inline-block px-3 py-1.5 rounded-full text-[11px] font-bold tracking-wider uppercase"
                  style={{
                    background: 'rgba(28,22,8,0.14)',
                    color: '#1c1608',
                    border: '1px solid rgba(28,22,8,0.28)',
                  }}
                >
                  Higher Rewards
                </span>
              </div>

              <span className="fx-accent-bar mb-4 relative z-[1]" />

              <p className="relative z-[1] text-base mb-6" style={{ color: 'rgba(28,22,8,0.78)' }}>
                Commit liquidity for a fixed duration to unlock higher benefits.
              </p>

              <ul className="relative z-[1] space-y-3 mb-7 mt-auto">
                {locked.map((l) => (
                  <li key={l.label} className="flex items-center gap-3">
                    <CheckCircle2 size={18} style={{ color: '#1c1608' }} />
                    <span className="text-sm md:text-[15px] font-medium" style={{ color: '#1c1608' }}>{l.label}</span>
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
