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
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

/* 8 modules arranged around the FX Artha hub.
   Desktop: 3x3 grid (hub centered).
   Mobile:  2-col grid (hub spans full width). */
const modules = [
  { icon: Activity,    title: 'Trading',           desc: 'Spot, leveraged, and demo modes.' },
  { icon: Copy,        title: 'Copy Trading',      desc: 'Mirror verified strategies.' },
  { icon: ShieldCheck, title: 'Trade Insurance',   desc: 'Optional pre-trade protection.' },
  { icon: Gem,         title: 'Staking',           desc: 'Activate idle assets.' },
  { icon: Coins,       title: 'Reward Economy',    desc: 'Activity-based rewards.' },
  { icon: Zap,         title: 'XP Progression',    desc: 'Better conditions over time.' },
  { icon: Handshake,   title: 'Partner Ecosystem', desc: 'IB program & growth network.' },
  { icon: Lock,        title: 'Smart Contracts',   desc: 'Protocol-based settlement.' },
]

export default function AbEcosystem() {
  return (
    <section id="ecosystem" className="fx-section" style={{ background: 'var(--fx-bg-elev)' }}>
      <div className="fx-container">
        {/* ── Two-column intro ──────────────────────────────── */}
        <div className="fx-split-intro">
          <ScrollReveal variant="fadeUp">
            <div>
              <span className="fx-eyebrow mb-5">The FX Artha Ecosystem</span>
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mt-5">
                One Ecosystem. <span className="gradient-text">Multiple Opportunities.</span>
              </h2>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <p className="text-base md:text-lg" style={{ color: 'var(--fx-text-2)' }}>
              Trading sits at the centre, surrounded by other ways to put your account to work — copying, staking, rewards, partner programs. All of it connected, all of it in one place.
            </p>
          </ScrollReveal>
        </div>

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
            <div className="relative grid grid-cols-3 gap-5 lg:gap-7 items-stretch">
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
            className="mt-10 md:mt-12 text-center text-base md:text-lg italic max-w-2xl mx-auto"
            style={{ color: 'var(--fx-text-2)' }}
          >
            &ldquo;Every feature is designed to strengthen the ecosystem experience.&rdquo;
          </p>
        </ScrollReveal>
      </div>
    </section>
  )
}

function HubCard() {
  return (
    <div className="fx-tile-gold h-full p-6 md:p-8 flex flex-col items-center justify-center text-center" style={{ minHeight: 170 }}>
      <div
        className="relative z-[1] w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
        style={{
          background: 'linear-gradient(180deg, #2a2210 0%, #16110a 100%)',
          border: '1px solid rgba(28,22,8,0.5)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.10), 0 12px 26px -12px rgba(0,0,0,0.55)',
        }}
      >
        <span className="text-xl font-extrabold" style={{ color: 'var(--fx-gold-light)' }}>FX</span>
      </div>
      <div className="relative z-[1] text-[11px] uppercase tracking-[0.22em] mb-1" style={{ color: 'rgba(28,22,8,0.78)' }}>
        Core Hub
      </div>
      <div className="relative z-[1] text-base md:text-lg font-extrabold" style={{ color: '#1c1608' }}>FX Artha</div>
      <div className="relative z-[1] text-xs mt-1" style={{ color: 'rgba(28,22,8,0.7)' }}>
        Connected ecosystem
      </div>
    </div>
  )
}

function ModuleCard({ icon: Icon, title, desc }) {
  return (
    <div className="fx-tile h-full p-5 md:p-6 flex flex-col">
      <div className="feature-icon mb-3" style={{ width: 48, height: 48 }}>
        <Icon size={20} />
      </div>
      <span className="fx-accent-bar mb-4" />
      <div className="text-sm md:text-base font-bold text-white mb-1">{title}</div>
      <div className="text-xs md:text-[13px]" style={{ color: 'var(--fx-text-2)' }}>
        {desc}
      </div>
    </div>
  )
}
