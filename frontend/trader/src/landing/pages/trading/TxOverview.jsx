import ScrollReveal from '@/landing/components/animations/ScrollReveal'

const stats = [
  {
    value: '0.0',
    unit: 'pips',
    label: 'Raw spreads from',
    desc: 'Every cost is visible before you execute — no hidden layers, no surprises.',
  },
  {
    value: '0',
    unit: '',
    label: 'Swap-based fees',
    desc: 'No swap charging at all. A leverage fee applies only when a position is held overnight.',
    raised: true,
  },
  {
    value: '24/7',
    unit: '',
    label: 'Real-time settlement',
    desc: 'On-chain execution and settlement — always on, fully transparent.',
  },
]

function StatCard({ value, unit, label, desc, raised }) {
  return (
    <div
      className={`fx-tile fx-tile-hover-gold h-full p-7 md:p-8 flex flex-col min-h-[280px] md:min-h-[320px] transition-transform ${
        raised ? 'md:-translate-y-6 lg:-translate-y-10' : ''
      }`}
      style={
        raised
          ? {
              borderColor: 'rgba(214,169,61,0.35)',
              boxShadow: '0 40px 90px -44px rgba(214,169,61,0.35)',
            }
          : undefined
      }
    >
      <div className="flex items-start gap-1.5">
        <span className="fx-headline text-5xl md:text-6xl lg:text-7xl leading-none">{value}</span>
        {unit && (
          <span className="text-xl md:text-2xl font-bold pt-1.5" style={{ color: 'var(--fx-gold-light)' }}>
            {unit}
          </span>
        )}
      </div>
      <div
        className="mt-4 text-[11px] md:text-xs font-bold uppercase tracking-[0.2em]"
        style={{ color: 'var(--fx-gold-light)' }}
      >
        {label}
      </div>
      <p className="mt-auto pt-6 text-sm leading-relaxed" style={{ color: 'var(--fx-text-3)' }}>
        {desc}
      </p>
    </div>
  )
}

export default function TxOverview() {
  return (
    <section className="fx-section relative overflow-hidden" style={{ background: 'var(--fx-bg)' }}>
      <div className="fx-container relative">
        {/* ── Centered header ── */}
        <div className="text-center max-w-3xl mx-auto">
          <ScrollReveal variant="fadeUp">
            <div className="flex justify-center">
              <span className="fx-eyebrow">Trading Overview</span>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.08}>
            <p
              className="mt-7 text-2xl md:text-[28px] lg:text-[34px] font-medium leading-[1.35]"
              style={{ color: 'var(--fx-text)' }}
            >
              One unified trading environment — no account tiers, no artificial barriers. Everyone
              starts on the same conditions and{' '}
              <span className="fx-gold-text">earns better ones by actually trading.</span>
            </p>
          </ScrollReveal>
        </div>

        {/* ── Staggered stat cards over a concentric-ring backdrop ── */}
        <div className="relative mt-16 md:mt-24 lg:mt-28">
          {/* faint concentric rings, like a radar target behind the cards */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[860px] h-[860px] max-w-none rounded-full"
            style={{
              background:
                'repeating-radial-gradient(circle at center, transparent 0 89px, rgba(214,169,61,0.08) 89px 90px)',
              WebkitMaskImage: 'radial-gradient(circle, #000 0%, rgba(0,0,0,0.35) 55%, transparent 72%)',
              maskImage: 'radial-gradient(circle, #000 0%, rgba(0,0,0,0.35) 55%, transparent 72%)',
            }}
          />

          <div className="relative grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6 lg:gap-8 items-stretch max-w-5xl mx-auto">
            {stats.map((s, i) => (
              <ScrollReveal key={s.label} variant="fadeUp" delay={i * 0.08}>
                <StatCard {...s} />
              </ScrollReveal>
            ))}
          </div>
        </div>

        <ScrollReveal variant="fadeUp" delay={0.3}>
          <p
            className="mt-16 md:mt-24 lg:mt-28 text-center text-base md:text-lg italic max-w-2xl mx-auto"
            style={{ color: 'var(--fx-text-2)' }}
          >
            &ldquo;Your growth as a trader improves your trading conditions.&rdquo;
          </p>
        </ScrollReveal>
      </div>
    </section>
  )
}
