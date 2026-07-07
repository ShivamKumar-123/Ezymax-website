import { XCircle, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

const problems = [
  'You deposit funds â†’ platform controls them',
  'Withdrawals depend on approvals',
  'Execution is not fully transparent',
  'You rely on centralized systems',
]

const solutions = [
  'Funds interact with a smart contract layer',
  'No platform custody of user funds',
  'Trades execute via system-defined logic',
  'Profits & losses settle automatically',
]

export default function FxProblemSolution() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg)' }}>
      <div className="fx-container">
        {/* ── Two-column intro ──────────────────────────────── */}
        <div className="fx-split-intro">
          <ScrollReveal variant="fadeUp">
            <div>
              <span className="fx-eyebrow mb-5">Problem vs Solution</span>
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mt-5">
                Why Most Trading Platforms Still Require <span className="gradient-text">Blind Trust</span>
              </h2>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <p className="text-base md:text-lg" style={{ color: 'var(--fx-text-2)' }}>
              In a custodial setup, the platform holds the money and approves the withdrawals. We don't think that should be the default anymore.
            </p>
          </ScrollReveal>
        </div>

        {/* ── Bento: red problem tile vs. gold solution tile, VS between ── */}
        <div className="relative fx-bento grid-cols-1 md:grid-cols-2 mt-10 md:mt-14 items-stretch">
          {/* Problem — red tile (the one allowed non-gold accent) */}
          <ScrollReveal variant="fadeUp">
            <div
              className="fx-tile h-full p-7 md:p-8 flex flex-col"
              style={{
                background:
                  'linear-gradient(180deg, rgba(220,38,38,0.10) 0%, rgba(220,38,38,0.02) 60%), var(--fx-bg-elev)',
                border: '1px solid rgba(220,38,38,0.30)',
              }}
            >
              <div className="flex items-center gap-3 mb-5">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{
                    background: 'rgba(220,38,38,0.18)',
                    border: '1px solid rgba(220,38,38,0.35)',
                  }}
                >
                  <AlertTriangle size={20} style={{ color: '#f87171' }} />
                </div>
                <div>
                  <div
                    className="text-[11px] font-bold uppercase tracking-[0.22em]"
                    style={{ color: '#f87171' }}
                  >
                    The Problem
                  </div>
                </div>
              </div>

              <span
                className="fx-accent-bar mb-4"
                style={{ background: 'linear-gradient(90deg, #f87171, #dc2626)', boxShadow: '0 0 14px rgba(220,38,38,0.5)' }}
              />
              <h3 className="text-xl md:text-2xl font-bold text-white mb-5">
                Centralized Custody
              </h3>

              <ul className="space-y-3.5 mt-auto">
                {problems.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <XCircle size={18} className="mt-0.5 shrink-0" style={{ color: '#f87171' }} />
                    <span className="text-sm md:text-base" style={{ color: 'var(--fx-text-2)' }}>
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </ScrollReveal>

          {/* Solution — solid gold accent tile */}
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <div className="fx-tile-gold h-full p-7 md:p-8 flex flex-col">
              <div className="relative z-[1] flex items-center gap-3 mb-5">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(28,22,8,0.14)', border: '1px solid rgba(28,22,8,0.22)' }}
                >
                  <ShieldCheck size={20} style={{ color: '#1c1608' }} />
                </div>
                <div>
                  <div
                    className="text-[11px] font-bold uppercase tracking-[0.22em]"
                    style={{ color: '#1c1608' }}
                  >
                    The FX Artha Approach
                  </div>
                </div>
              </div>

              <span className="fx-accent-bar mb-4 relative z-[1]" />
              <h3 className="relative z-[1] text-xl md:text-2xl font-bold mb-5" style={{ color: '#1c1608' }}>
                Smart-Contract Execution
              </h3>

              <ul className="relative z-[1] space-y-3.5 mt-auto">
                {solutions.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2
                      size={18}
                      className="mt-0.5 shrink-0"
                      style={{ color: '#1c1608' }}
                    />
                    <span className="text-sm md:text-base" style={{ color: 'rgba(28,22,8,0.78)' }}>
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </ScrollReveal>

          {/* ── VS Badge (desktop only, centered between cards) ── */}
          <div className="hidden md:flex absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-sm font-extrabold tracking-wider"
              style={{
                background:
                  'linear-gradient(180deg, var(--fx-gold-light), var(--fx-gold) 70%, var(--fx-gold-dark))',
                color: '#1a1408',
                boxShadow:
                  '0 0 0 6px rgba(8,9,11,1), 0 0 0 7px rgba(214,169,61,0.45), 0 16px 40px -12px rgba(214,169,61,0.45)',
              }}
            >
              VS
            </div>
          </div>
        </div>

        <ScrollReveal variant="fadeUp" delay={0.25}>
          <p
            className="mt-10 md:mt-12 text-center text-base md:text-lg italic max-w-2xl mx-auto"
            style={{ color: 'var(--fx-text-2)' }}
          >
            &ldquo;Control stays with you. Execution stays with the system.&rdquo;
          </p>
        </ScrollReveal>
      </div>
    </section>
  )
}
