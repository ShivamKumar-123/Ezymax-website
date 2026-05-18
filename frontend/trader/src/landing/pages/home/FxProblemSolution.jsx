import { XCircle, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react'
import SectionHeader from '@/landing/components/SectionHeader'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

const problems = [
  'You deposit funds → platform controls them',
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
        <SectionHeader
          badge="Problem vs Solution"
          title="Why Most Trading Platforms Still Require Blind Trust"
          highlight="Blind Trust"
          subtitle="Custodial systems put you at the platform's mercy. FX Artha keeps you in control."
        />

        <div className="relative mt-12 md:mt-16 grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10">
          {/* ── Problem Card ───────────────────────────────────── */}
          <ScrollReveal variant="fadeUp">
            <div
              className="relative h-full p-7 md:p-8 rounded-2xl overflow-hidden"
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
                  <div className="text-lg md:text-xl font-bold text-white">
                    Centralized Custody
                  </div>
                </div>
              </div>

              <ul className="space-y-3.5">
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

          {/* ── Solution Card ─────────────────────────────────── */}
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <div
              className="relative h-full p-7 md:p-8 rounded-2xl overflow-hidden"
              style={{
                background:
                  'linear-gradient(180deg, rgba(214,169,61,0.10) 0%, rgba(214,169,61,0.02) 60%), var(--fx-bg-elev)',
                border: '1px solid rgba(214,169,61,0.35)',
                boxShadow: '0 24px 60px -28px rgba(214,169,61,0.35)',
              }}
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="feature-icon" style={{ width: 44, height: 44 }}>
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <div
                    className="text-[11px] font-bold uppercase tracking-[0.22em]"
                    style={{ color: 'var(--fx-gold-light)' }}
                  >
                    The FX Artha Approach
                  </div>
                  <div className="text-lg md:text-xl font-bold text-white">
                    Smart-Contract Execution
                  </div>
                </div>
              </div>

              <ul className="space-y-3.5">
                {solutions.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2
                      size={18}
                      className="mt-0.5 shrink-0"
                      style={{ color: 'var(--fx-gold-light)' }}
                    />
                    <span className="text-sm md:text-base" style={{ color: 'var(--fx-text-2)' }}>
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </ScrollReveal>

          {/* ── VS Badge (desktop only, centered between cards) ─ */}
          <div className="hidden lg:flex absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
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

        <ScrollReveal variant="fadeUp" delay={0.2}>
          <p
            className="mt-10 md:mt-14 text-center text-lg md:text-xl font-semibold tracking-tight"
            style={{ color: 'var(--fx-gold-light)' }}
          >
            “Control stays with you. Execution stays with the system.”
          </p>
        </ScrollReveal>
      </div>
    </section>
  )
}
