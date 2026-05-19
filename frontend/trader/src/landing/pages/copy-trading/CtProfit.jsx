import { Users, TrendingUp, ArrowRight, Coins, Crown } from 'lucide-react'
import SectionHeader from '@/landing/components/SectionHeader'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'
import CtFaqList from './CtFaqList'

const faq = [
  { q: 'Do I pay if I lose?',     a: 'No. Profit sharing applies only on profits.' },
  { q: 'Is the percentage fixed?', a: 'Set by the Master Trader within platform limits.' },
]

export default function CtProfit() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg-elev)' }}>
      <div className="fx-container">
        <SectionHeader
          badge="Profit Sharing"
          title="Performance-Based Earnings"
          highlight="Performance-Based"
          subtitle="Master Traders earn a percentage of the profit generated for their followers."
        />

        {/* Flow diagram */}
        <ScrollReveal variant="fadeUp">
          <div
            className="mt-12 md:mt-16 relative rounded-2xl p-7 md:p-10 overflow-hidden"
            style={{
              background:
                'linear-gradient(160deg, rgba(214,169,61,0.06) 0%, var(--fx-bg-elev-2) 60%)',
              border: '1px solid rgba(214,169,61,0.22)',
            }}
          >
            <div className="absolute inset-0 fx-grid-bg" />
            <div className="relative flex flex-col md:flex-row items-stretch gap-4 md:gap-3">
              <div className="flex-1">
                <FlowCard
                  icon={Users}
                  iconColor="#a78bfa"
                  ring="rgba(167,139,250,0.35)"
                  label="Follower"
                  title="Earns profit"
                  sub="$1,000 P&L"
                />
              </div>
              <Arrow />
              <div className="flex-1">
                <FlowCard
                  icon={TrendingUp}
                  iconColor="#4ade80"
                  ring="rgba(74,222,128,0.35)"
                  label="Profit Pool"
                  title="Split applies"
                  sub="Only on profit"
                  highlight
                />
              </div>
              <Arrow />
              <div className="flex-1">
                <FlowCard
                  icon={Crown}
                  iconColor="#ecc657"
                  ring="rgba(214,169,61,0.45)"
                  label="Master Trader"
                  title="Earns share"
                  sub="% of follower profit"
                />
              </div>
            </div>

            <div
              className="relative mt-7 rounded-xl p-4 text-center"
              style={{
                background: 'rgba(74,222,128,0.06)',
                border: '1px solid rgba(74,222,128,0.30)',
              }}
            >
              <div className="inline-flex items-center gap-2 text-sm font-semibold" style={{ color: '#4ade80' }}>
                <Coins size={14} />
                Loss outcomes never trigger a profit share
              </div>
            </div>
          </div>
        </ScrollReveal>

        <ScrollReveal variant="fadeUp" delay={0.2}>
          <div className="mt-10 max-w-3xl mx-auto">
            <CtFaqList items={faq} />
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}

function FlowCard({ icon: Icon, iconColor, ring, label, title, sub, highlight = false }) {
  return (
    <div
      className="h-full rounded-2xl p-5 text-center"
      style={{
        background: highlight
          ? `linear-gradient(180deg, ${iconColor}1a, ${iconColor}05)`
          : 'var(--fx-bg-elev)',
        border: `1px solid ${ring}`,
        boxShadow: highlight ? `0 16px 40px -16px ${iconColor}55` : 'none',
      }}
    >
      <div
        className="w-12 h-12 mx-auto rounded-xl flex items-center justify-center mb-3"
        style={{
          background: `${iconColor}1f`,
          border: `1px solid ${iconColor}55`,
        }}
      >
        <Icon size={20} style={{ color: iconColor }} />
      </div>
      <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--fx-text-3)' }}>
        {label}
      </div>
      <div className="text-sm md:text-base font-bold text-white mb-1">{title}</div>
      <div className="text-xs" style={{ color: 'var(--fx-text-2)' }}>
        {sub}
      </div>
    </div>
  )
}

function Arrow() {
  return (
    <div className="hidden md:flex items-center justify-center px-1" style={{ color: 'var(--fx-gold-light)' }}>
      <ArrowRight size={22} />
    </div>
  )
}
