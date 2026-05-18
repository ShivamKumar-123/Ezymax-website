import { Gem, ArrowRight, TrendingUp, Activity, CheckCircle2 } from 'lucide-react'
import SectionHeader from '@/landing/components/SectionHeader'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

const benefits = [
  'Structured earning opportunities',
  'Additional trading utility',
  'Participation in ecosystem growth',
]

export default function FxStaking() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg)' }}>
      <div className="fx-container">
        <SectionHeader
          badge="Staking"
          title="Activate Idle Assets"
          highlight="Idle Assets"
          subtitle="Make your assets work beyond holding."
        />

        <div className="mt-12 md:mt-16 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* ── Left visual ──────────────────────────────────── */}
          <ScrollReveal variant="fadeUp">
            <div
              className="relative rounded-2xl p-8 md:p-10 overflow-hidden"
              style={{
                background:
                  'linear-gradient(160deg, rgba(214,169,61,0.06) 0%, var(--fx-bg-elev-2) 60%)',
                border: '1px solid rgba(214,169,61,0.22)',
                minHeight: 360,
              }}
            >
              <div className="absolute inset-0 fx-grid-bg" />

              <div className="relative grid grid-cols-3 gap-3 md:gap-4 items-center">
                {/* Stake */}
                <div
                  className="rounded-2xl p-4 md:p-5 text-center"
                  style={{
                    background: 'var(--fx-bg-elev)',
                    border: '1px solid rgba(214,169,61,0.28)',
                  }}
                >
                  <div className="feature-icon mx-auto mb-3" style={{ width: 44, height: 44 }}>
                    <Gem size={18} />
                  </div>
                  <div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--fx-text-3)' }}>
                    Step 1
                  </div>
                  <div className="text-sm md:text-base font-bold text-white">Stake</div>
                </div>

                <div className="flex justify-center" style={{ color: 'var(--fx-gold-light)' }}>
                  <ArrowRight size={20} />
                </div>

                {/* Earn */}
                <div
                  className="rounded-2xl p-4 md:p-5 text-center"
                  style={{
                    background: 'var(--fx-bg-elev)',
                    border: '1px solid rgba(214,169,61,0.28)',
                  }}
                >
                  <div className="feature-icon mx-auto mb-3" style={{ width: 44, height: 44 }}>
                    <TrendingUp size={18} />
                  </div>
                  <div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--fx-text-3)' }}>
                    Step 2
                  </div>
                  <div className="text-sm md:text-base font-bold text-white">Earn</div>
                </div>
              </div>

              <div className="relative mt-6 grid grid-cols-3 gap-3 md:gap-4 items-center">
                <div></div>
                <div className="flex justify-center" style={{ color: 'var(--fx-gold-light)' }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 5v14M5 12l7 7 7-7"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div></div>
              </div>

              <div className="relative mt-2 flex justify-center">
                <div
                  className="rounded-2xl p-4 md:p-5 text-center w-full md:w-3/5"
                  style={{
                    background:
                      'linear-gradient(180deg, rgba(214,169,61,0.16), rgba(214,169,61,0.04))',
                    border: '1px solid rgba(214,169,61,0.45)',
                    boxShadow: '0 16px 40px -16px rgba(214,169,61,0.45)',
                  }}
                >
                  <div className="feature-icon mx-auto mb-3" style={{ width: 44, height: 44 }}>
                    <Activity size={18} />
                  </div>
                  <div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--fx-gold-light)' }}>
                    Step 3
                  </div>
                  <div className="text-sm md:text-base font-bold text-white">Trade with Utility</div>
                </div>
              </div>
            </div>
          </ScrollReveal>

          {/* ── Right content ─────────────────────────────────── */}
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <h3 className="text-2xl md:text-[32px] font-bold text-white mb-5 leading-tight">
              Allocate your assets within the ecosystem to{' '}
              <span className="gradient-text">participate in platform activity</span>.
            </h3>
            <p className="text-base md:text-lg mb-7" style={{ color: 'var(--fx-text-2)' }}>
              Structured earning opportunities, trading utility, and direct participation
              in ecosystem growth — all from assets that would otherwise sit idle.
            </p>

            <ul className="space-y-3.5 mb-7">
              {benefits.map((b) => (
                <li key={b} className="flex items-start gap-3">
                  <CheckCircle2 size={18} className="mt-0.5" style={{ color: 'var(--fx-gold-light)' }} />
                  <span className="text-sm md:text-base text-white">{b}</span>
                </li>
              ))}
            </ul>

            <div
              className="rounded-xl p-4 text-xs md:text-sm italic"
              style={{
                background: 'rgba(214,169,61,0.04)',
                border: '1px solid rgba(214,169,61,0.18)',
                color: 'var(--fx-text-3)',
              }}
            >
              Note: Returns and conditions vary based on duration and system dynamics.
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  )
}
