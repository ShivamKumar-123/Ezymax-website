import { ShieldCheck, TrendingDown, MinusCircle, Coins } from 'lucide-react'
import SectionHeader from '@/landing/components/SectionHeader'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

export default function InLogic() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg)' }}>
      <div className="fx-container">
        <SectionHeader
          badge="Coverage Logic"
          title="How Coverage Works"
          highlight="Coverage Works"
          subtitle="Every plan comes with a pool of coverage for its duration. Losses draw down the pool — once it's empty, the plan stops covering until you activate a new one."
        />

        <ScrollReveal variant="fadeUp">
          <div
            className="mt-12 md:mt-16 relative rounded-2xl p-7 md:p-10 overflow-hidden"
            style={{
              background:
                'linear-gradient(160deg, rgba(214,169,61,0.08) 0%, var(--fx-bg-elev-2) 60%)',
              border: '1px solid rgba(214,169,61,0.30)',
            }}
          >
            <div className="absolute inset-0 fx-grid-bg" />

            <div className="relative flex flex-col md:flex-row items-stretch gap-4 md:gap-3">
              <div className="flex-1">
                <Node
                  icon={ShieldCheck}
                  color="#ecc657"
                  label="Coverage Pool"
                  title="$3,000 / period"
                  sub="Plan capacity"
                  step="1"
                />
              </div>
              <Arrow />
              <div className="flex-1">
                <Node
                  icon={TrendingDown}
                  color="#f87171"
                  label="Trade Loss"
                  title="–$1,000"
                  sub="Eligible trade"
                  step="2"
                />
              </div>
              <Arrow />
              <div className="flex-1">
                <Node
                  icon={MinusCircle}
                  color="#a78bfa"
                  label="Deduction"
                  title="–$300 covered"
                  sub="Coverage % of loss"
                  step="3"
                  highlight
                />
              </div>
              <Arrow />
              <div className="flex-1">
                <Node
                  icon={Coins}
                  color="#4ade80"
                  label="Remaining Balance"
                  title="$2,700 left"
                  sub="Pool after coverage"
                  step="4"
                />
              </div>
            </div>

            {/* Pool balance bar */}
            <div className="relative mt-8">
              <div className="flex items-center justify-between text-xs mb-2">
                <span style={{ color: 'var(--fx-text-3)' }}>Coverage Pool</span>
                <span className="font-bold text-white">$2,700 / $3,000</span>
              </div>
              <div
                className="h-3 rounded-full overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.06)' }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: '90%',
                    background:
                      'linear-gradient(90deg, var(--fx-gold-light), var(--fx-gold))',
                    boxShadow: '0 0 12px rgba(214,169,61,0.55)',
                  }}
                />
              </div>
              <div className="mt-3 text-[11px] italic" style={{ color: 'var(--fx-text-3)' }}>
                Once the pool reaches zero, no further coverage applies until a new plan is activated.
              </div>
            </div>
          </div>
        </ScrollReveal>

        <ScrollReveal variant="fadeUp" delay={0.2}>
          <p
            className="mt-10 md:mt-12 text-center text-base md:text-lg italic max-w-2xl mx-auto"
            style={{ color: 'var(--fx-text-2)' }}
          >
            &ldquo;Coverage applies across your activity — not individually per trade.&rdquo;
          </p>
        </ScrollReveal>
      </div>
    </section>
  )
}

function Node({ icon: Icon, color, label, title, sub, step, highlight = false }) {
  return (
    <div
      className="rounded-2xl p-5 text-center relative"
      style={{
        background: highlight
          ? `linear-gradient(180deg, ${color}1a, ${color}05)`
          : 'var(--fx-bg-elev)',
        border: `1px solid ${color}55`,
        boxShadow: highlight ? `0 16px 40px -16px ${color}55` : 'none',
      }}
    >
      <span
        className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold"
        style={{
          background: 'linear-gradient(180deg, var(--fx-gold-light), var(--fx-gold))',
          color: '#1a1408',
          boxShadow: '0 6px 14px -6px rgba(214,169,61,0.55)',
        }}
      >
        {step}
      </span>
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center mx-auto mb-3"
        style={{
          background: `${color}1f`,
          border: `1px solid ${color}55`,
        }}
      >
        <Icon size={18} style={{ color }} />
      </div>
      <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--fx-text-3)' }}>
        {label}
      </div>
      <div className="text-sm md:text-base font-bold text-white mb-1">{title}</div>
      <div className="text-[11px]" style={{ color: 'var(--fx-text-2)' }}>
        {sub}
      </div>
    </div>
  )
}

function Arrow() {
  return (
    <div className="hidden md:flex items-center justify-center" style={{ color: 'var(--fx-gold-light)' }}>
      <svg width="20" height="14" viewBox="0 0 22 14" fill="none" aria-hidden>
        <path
          d="M0 7 L18 7 M14 3 L18 7 L14 11"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}
