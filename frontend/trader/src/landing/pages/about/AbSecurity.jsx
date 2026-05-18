import {
  Lock,
  Cog,
  Activity,
  Wallet,
  ShieldCheck,
  BarChart3,
} from 'lucide-react'
import SectionHeader from '@/landing/components/SectionHeader'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'

const pillars = [
  { icon: Lock,        title: 'Smart Contract Infrastructure', desc: 'Protocol-based settlement logic for verifiable execution.', accent: '#ecc657' },
  { icon: Cog,         title: 'Automated Settlement Logic',    desc: 'Profit, loss, and rewards settle by system, not by approval.', accent: '#60a5fa' },
  { icon: Activity,    title: 'Real-Time Monitoring',          desc: 'Live visibility into positions, exposure, and protocol state.', accent: '#a78bfa' },
  { icon: Wallet,      title: 'Wallet Connectivity',           desc: 'You stay in control through your own wallet.',                accent: '#4ade80' },
  { icon: ShieldCheck, title: 'Risk Management Systems',       desc: 'Pre-trade controls and protection layers built in.',         accent: '#ecc657' },
  { icon: BarChart3,   title: 'Transparent Analytics',         desc: 'Every action mapped to clear, queryable data.',              accent: '#f59e0b' },
]

export default function AbSecurity() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg-elev)' }}>
      <div className="fx-container">
        <SectionHeader
          badge="Security & Transparency"
          title="Designed Around Trust"
          highlight="Trust"
          subtitle="The platform architecture prioritises transparent systems, protocol-based infrastructure, smart contract logic, and modern digital security practices."
        />

        <div className="mt-12 md:mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
          {pillars.map((p, i) => {
            const Icon = p.icon
            return (
              <ScrollReveal key={p.title} variant="fadeUp" delay={i * 0.04}>
                <div className="glass-card h-full p-6 md:p-7">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                    style={{ background: `${p.accent}1f`, border: `1px solid ${p.accent}55` }}
                  >
                    <Icon size={20} style={{ color: p.accent }} />
                  </div>
                  <h3 className="text-base md:text-lg font-bold text-white mb-2 leading-tight">
                    {p.title}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--fx-text-2)' }}>
                    {p.desc}
                  </p>
                </div>
              </ScrollReveal>
            )
          })}
        </div>

        <ScrollReveal variant="fadeUp" delay={0.25}>
          <p
            className="mt-10 text-center text-base md:text-lg font-semibold italic"
            style={{ color: 'var(--fx-gold-light)' }}
          >
            “Trust is built through systems — not promises.”
          </p>
        </ScrollReveal>
      </div>
    </section>
  )
}
