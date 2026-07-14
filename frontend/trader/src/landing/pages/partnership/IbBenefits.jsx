import { Lock, Sparkles, Globe2, BarChart3, Coins, Handshake } from 'lucide-react'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

const benefits = [
  {
    icon: Lock,
    title: 'Smart Contract-Based Infrastructure',
    desc: 'User funds operate through protocol-based settlement.',
  },
  {
    icon: Sparkles,
    title: 'Modern Trading Ecosystem',
    desc: 'Gamification, copy trading, staking, insurance, and rewards.',
  },
  {
    icon: Globe2,
    title: 'Global Growth Opportunity',
    desc: 'Built for modern retail and Web3-native traders.',
  },
  {
    icon: BarChart3,
    title: 'Advanced Partner Dashboard',
    desc: 'Track users, trading activity, and performance analytics.',
  },
  {
    icon: Coins,
    title: 'Performance-Based Rewards',
    desc: 'Earnings aligned with ecosystem activity.',
  },
  {
    icon: Handshake,
    title: 'Long-Term Partnership Model',
    desc: 'Built for scalability and retention.',
  },
]

/* Decorative gold-on-dark chip that sits in a corner of the solid-gold cards.
   Purely ornamental — carries no text. */
function GoldChip({ icon: Icon, size = 52 }) {
  return (
    <div
      className="relative z-[1] flex items-center justify-center rounded-2xl"
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(155deg, #2a2410 0%, #1c1608 100%)',
        border: '1px solid rgba(28,22,8,0.35)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
      }}
    >
      <Icon size={Math.round(size * 0.42)} style={{ color: '#f2d477' }} />
    </div>
  )
}

/* Small ornamental bar-chart silhouette used on a gold card — no numbers. */
function GoldBars() {
  return (
    <svg aria-hidden viewBox="0 0 120 60" className="relative z-[1] w-28 h-14">
      {[10, 26, 42, 58, 74, 90].map((x, i) => {
        const h = [22, 34, 18, 46, 30, 52][i]
        return (
          <rect
            key={x}
            x={x}
            y={60 - h}
            width="14"
            height={h}
            rx="3"
            fill="#1c1608"
            opacity={0.22 + i * 0.11}
          />
        )
      })}
    </svg>
  )
}

export default function IbBenefits() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg)' }}>
      <div className="fx-container">
        {/* ── Two-column intro ──────────────────────────────── */}
        <div className="fx-split-intro">
          <ScrollReveal variant="fadeUp">
            <div>
              <span className="fx-eyebrow mb-5">Why FX Artha</span>
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mt-5">
                Why IBs Choose <span className="gradient-text">FX Artha</span>
              </h2>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <p className="text-base md:text-lg" style={{ color: 'var(--fx-text-2)' }}>
              The honest reasons people send their audience here instead of somewhere else.
            </p>
          </ScrollReveal>
        </div>

        {/* ── Asymmetric value bento: solid-gold statement blocks
             intermixed with dark cards, varied col/row spans ── */}
        <div className="fx-bento grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 mt-10 md:mt-14 auto-rows-[minmax(0,1fr)]">
          {/* [0] Smart Contract — LARGE solid gold, spans wide + tall */}
          <ScrollReveal variant="fadeUp" className="sm:col-span-2 lg:col-span-7 lg:row-span-2">
            <div className="fx-tile-gold h-full p-7 md:p-9 flex flex-col justify-between min-h-[240px]">
              <GoldChip icon={benefits[0].icon} size={56} />
              <div className="relative z-[1] mt-6">
                <span className="fx-accent-bar mb-4" />
                <h3
                  className="text-2xl md:text-3xl lg:text-[34px] font-extrabold leading-[1.08] mb-3"
                  style={{ color: '#1c1608' }}
                >
                  {benefits[0].title}
                </h3>
                <p className="text-sm md:text-base leading-relaxed max-w-md" style={{ color: 'rgba(28,22,8,0.78)' }}>
                  {benefits[0].desc}
                </p>
              </div>
            </div>
          </ScrollReveal>

          {/* [1] Modern Ecosystem — dark tall card */}
          <ScrollReveal variant="fadeUp" delay={0.05} className="lg:col-span-5">
            <div className="fx-tile h-full p-7 md:p-8 flex flex-col">
              <div className="feature-icon mb-5" style={{ width: 48, height: 48 }}>
                {(() => { const Icon = benefits[1].icon; return <Icon size={20} /> })()}
              </div>
              <span className="fx-accent-bar mb-4" />
              <h3 className="text-lg md:text-xl font-bold text-white mb-2 leading-tight">{benefits[1].title}</h3>
              <p className="text-sm md:text-base leading-relaxed" style={{ color: 'var(--fx-text-2)' }}>
                {benefits[1].desc}
              </p>
            </div>
          </ScrollReveal>

          {/* [2] Global Growth — solid gold, medium */}
          <ScrollReveal variant="fadeUp" delay={0.1} className="lg:col-span-5">
            <div className="fx-tile-gold h-full p-6 md:p-7 flex flex-col justify-between min-h-[200px]">
              <GoldChip icon={benefits[2].icon} />
              <div className="relative z-[1] mt-5">
                <span className="fx-accent-bar mb-3" />
                <h3 className="text-xl md:text-2xl font-extrabold leading-tight mb-2" style={{ color: '#1c1608' }}>
                  {benefits[2].title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(28,22,8,0.78)' }}>
                  {benefits[2].desc}
                </p>
              </div>
            </div>
          </ScrollReveal>

          {/* [3] Advanced Dashboard — dark card with ornamental bars */}
          <ScrollReveal variant="fadeUp" delay={0.15} className="lg:col-span-4">
            <div className="fx-tile h-full p-6 md:p-7 flex flex-col">
              <div className="feature-icon mb-5" style={{ width: 48, height: 48 }}>
                {(() => { const Icon = benefits[3].icon; return <Icon size={20} /> })()}
              </div>
              <span className="fx-accent-bar mb-4" />
              <h3 className="text-base md:text-lg font-bold text-white mb-2 leading-tight">{benefits[3].title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--fx-text-2)' }}>
                {benefits[3].desc}
              </p>
            </div>
          </ScrollReveal>

          {/* [4] Performance Rewards — solid gold with bar-chart illustration */}
          <ScrollReveal variant="fadeUp" delay={0.2} className="sm:col-span-2 lg:col-span-4">
            <div className="fx-tile-gold h-full p-6 md:p-7 flex flex-col justify-between min-h-[200px]">
              <GoldBars />
              <div className="relative z-[1] mt-5">
                <span className="fx-accent-bar mb-3" />
                <h3 className="text-xl md:text-2xl font-extrabold leading-tight mb-2" style={{ color: '#1c1608' }}>
                  {benefits[4].title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(28,22,8,0.78)' }}>
                  {benefits[4].desc}
                </p>
              </div>
            </div>
          </ScrollReveal>

          {/* [5] Long-Term Partnership — dark card */}
          <ScrollReveal variant="fadeUp" delay={0.25} className="lg:col-span-4">
            <div className="fx-tile h-full p-6 md:p-7 flex flex-col">
              <div className="feature-icon mb-5" style={{ width: 48, height: 48 }}>
                {(() => { const Icon = benefits[5].icon; return <Icon size={20} /> })()}
              </div>
              <span className="fx-accent-bar mb-4" />
              <h3 className="text-base md:text-lg font-bold text-white mb-2 leading-tight">{benefits[5].title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--fx-text-2)' }}>
                {benefits[5].desc}
              </p>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  )
}
