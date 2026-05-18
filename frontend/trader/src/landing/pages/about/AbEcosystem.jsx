import {
  Activity,
  Copy,
  ShieldCheck,
  Gem,
  Coins,
  Zap,
  Handshake,
  Lock,
} from 'lucide-react'
import SectionHeader from '@/landing/components/SectionHeader'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

/* 8 modules arranged around the FX Artha hub.
   Desktop: 3x3 grid (hub centered).
   Mobile:  2-col grid (hub spans full width). */
const modules = [
  { icon: Activity,    title: 'Trading',           desc: 'Spot, leveraged, and demo modes.', accent: '#ecc657' },
  { icon: Copy,        title: 'Copy Trading',      desc: 'Mirror verified strategies.',      accent: '#a78bfa' },
  { icon: ShieldCheck, title: 'Trade Insurance',   desc: 'Optional pre-trade protection.',   accent: '#4ade80' },
  { icon: Gem,         title: 'Staking',           desc: 'Activate idle assets.',            accent: '#60a5fa' },
  { icon: Coins,       title: 'Reward Economy',    desc: 'Activity-based rewards.',          accent: '#ecc657' },
  { icon: Zap,         title: 'XP Progression',    desc: 'Better conditions over time.',     accent: '#a78bfa' },
  { icon: Handshake,   title: 'Partner Ecosystem', desc: 'IB program & growth network.',     accent: '#4ade80' },
  { icon: Lock,        title: 'Smart Contracts',   desc: 'Protocol-based settlement.',       accent: '#60a5fa' },
]

export default function AbEcosystem() {
  return (
    <section id="ecosystem" className="fx-section" style={{ background: 'var(--fx-bg-elev)' }}>
      <div className="fx-container">
        <SectionHeader
          badge="The FX Artha Ecosystem"
          title="One Ecosystem. Multiple Opportunities."
          highlight="Multiple Opportunities"
          subtitle="A connected financial ecosystem where you trade, copy strategies, stake, earn rewards, and engage with protocol utilities."
        />

        {/* Mobile-first layout: 2-col grid with hub on top. */}
        <div className="mt-12 md:mt-16 md:hidden grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <HubCard />
          </div>
          {modules.map((m) => (
            <ModuleCard key={m.title} {...m} />
          ))}
        </div>

        {/* Desktop ecosystem wheel — 3x3 grid w/ hub centered */}
        <div className="hidden md:block mt-12 md:mt-16">
          <div className="relative max-w-5xl mx-auto">
            {/* Decorative orbits behind */}
            <svg
              viewBox="0 0 800 540"
              className="absolute inset-0 w-full h-full pointer-events-none"
              preserveAspectRatio="xMidYMid meet"
              aria-hidden
            >
              <defs>
                <radialGradient id="abEcoGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="rgba(214,169,61,0.10)" />
                  <stop offset="100%" stopColor="rgba(214,169,61,0)" />
                </radialGradient>
              </defs>
              <ellipse cx="400" cy="270" rx="380" ry="240" fill="url(#abEcoGlow)" />
              <ellipse cx="400" cy="270" rx="320" ry="180" fill="none" stroke="rgba(255,255,255,0.05)" />
              <ellipse cx="400" cy="270" rx="220" ry="120" fill="none" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 6" />
            </svg>

            <div className="relative grid grid-cols-3 gap-5 lg:gap-7">
              <ScrollReveal variant="fadeUp" delay={0.0}>
                <ModuleCard {...modules[0]} />
              </ScrollReveal>
              <ScrollReveal variant="fadeUp" delay={0.05}>
                <ModuleCard {...modules[1]} />
              </ScrollReveal>
              <ScrollReveal variant="fadeUp" delay={0.10}>
                <ModuleCard {...modules[2]} />
              </ScrollReveal>

              <ScrollReveal variant="fadeUp" delay={0.05}>
                <ModuleCard {...modules[5]} />
              </ScrollReveal>
              <ScrollReveal variant="fadeUp" delay={0.0}>
                <HubCard />
              </ScrollReveal>
              <ScrollReveal variant="fadeUp" delay={0.05}>
                <ModuleCard {...modules[3]} />
              </ScrollReveal>

              <ScrollReveal variant="fadeUp" delay={0.10}>
                <ModuleCard {...modules[6]} />
              </ScrollReveal>
              <ScrollReveal variant="fadeUp" delay={0.05}>
                <ModuleCard {...modules[4]} />
              </ScrollReveal>
              <ScrollReveal variant="fadeUp" delay={0.0}>
                <ModuleCard {...modules[7]} />
              </ScrollReveal>
            </div>
          </div>
        </div>

        <ScrollReveal variant="fadeUp" delay={0.3}>
          <p
            className="mt-10 text-center text-base md:text-lg font-semibold italic"
            style={{ color: 'var(--fx-gold-light)' }}
          >
            “Every feature is designed to strengthen the ecosystem experience.”
          </p>
        </ScrollReveal>
      </div>
    </section>
  )
}

function HubCard() {
  return (
    <div
      className="h-full rounded-2xl p-6 md:p-8 flex flex-col items-center justify-center text-center"
      style={{
        background:
          'radial-gradient(70% 80% at 50% 30%, rgba(214,169,61,0.30), rgba(214,169,61,0.04) 70%), var(--fx-bg)',
        border: '1px solid rgba(214,169,61,0.55)',
        boxShadow:
          '0 0 0 1px rgba(214,169,61,0.08) inset, 0 30px 70px -30px rgba(214,169,61,0.55)',
        minHeight: 170,
      }}
    >
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
        style={{
          background:
            'linear-gradient(180deg, var(--fx-gold-light), var(--fx-gold))',
          color: '#1a1408',
          boxShadow: '0 12px 30px -10px rgba(214,169,61,0.55)',
        }}
      >
        <span className="text-xl font-extrabold">FX</span>
      </div>
      <div className="text-[11px] uppercase tracking-[0.22em] mb-1" style={{ color: 'var(--fx-gold-light)' }}>
        Core Hub
      </div>
      <div className="text-base md:text-lg font-extrabold text-white">FX Artha</div>
      <div className="text-xs mt-1" style={{ color: 'var(--fx-text-3)' }}>
        Connected ecosystem
      </div>
    </div>
  )
}

function ModuleCard({ icon: Icon, title, desc, accent }) {
  return (
    <div
      className="h-full rounded-2xl p-5 md:p-6 transition-transform duration-300"
      style={{
        background:
          'linear-gradient(180deg, var(--fx-bg-elev) 0%, var(--fx-bg-elev-2) 100%)',
        border: `1px solid ${accent}40`,
      }}
    >
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center mb-3"
        style={{ background: `${accent}1f`, border: `1px solid ${accent}55` }}
      >
        <Icon size={18} style={{ color: accent }} />
      </div>
      <div className="text-sm md:text-base font-bold text-white mb-1">{title}</div>
      <div className="text-xs md:text-[13px]" style={{ color: 'var(--fx-text-2)' }}>
        {desc}
      </div>
    </div>
  )
}
