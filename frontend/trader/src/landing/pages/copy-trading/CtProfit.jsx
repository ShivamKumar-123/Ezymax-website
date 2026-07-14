import { Users, TrendingUp, ArrowRight, Coins, Crown } from 'lucide-react'
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
        {/* ── Two-column intro ──────────────────────────────── */}
        <div className="fx-split-intro">
          <ScrollReveal variant="fadeUp">
            <div>
              <span className="fx-eyebrow mb-5">Profit Sharing</span>
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mt-5">
                <span className="gradient-text">Performance-Based</span> Earnings
              </h2>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <p className="text-base md:text-lg" style={{ color: 'var(--fx-text-2)' }}>
              Master Traders take a slice of the profit they generate for followers — and only when there's actual profit to take a slice of.
            </p>
          </ScrollReveal>
        </div>

        {/* Flow diagram */}
        <ScrollReveal variant="fadeUp">
          <div className="fx-tile mt-12 md:mt-16 p-7 md:p-10">
            <span className="fx-accent-bar mb-6" />
            <div className="relative flex flex-col md:flex-row items-stretch gap-4 md:gap-3">
              <div className="flex-1">
                <FlowCard
                  icon={Users}
                  label="Follower"
                  title="Earns profit"
                  sub="$1,000 P&L"
                />
              </div>
              <Arrow />
              <div className="flex-1">
                <FlowCard
                  icon={TrendingUp}
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
                  label="Master Trader"
                  title="Earns share"
                  sub="% of follower profit"
                />
              </div>
            </div>

            <div
              className="mt-7 rounded-xl p-4 text-center"
              style={{
                background: 'rgba(214,169,61,0.06)',
                border: '1px solid rgba(214,169,61,0.30)',
              }}
            >
              <div className="inline-flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--fx-gold-light)' }}>
                <Coins size={14} />
                Loss outcomes never trigger a profit share
              </div>
            </div>
          </div>
        </ScrollReveal>

        <ScrollReveal variant="fadeUp" delay={0.18}>
          <p
            className="mt-8 md:mt-10 text-center text-base md:text-lg italic max-w-2xl mx-auto"
            style={{ color: 'var(--fx-text-2)' }}
          >
            &ldquo;You earn only when your followers profit.&rdquo;
          </p>
        </ScrollReveal>

        <ScrollReveal variant="fadeUp" delay={0.25}>
          <div className="mt-8 md:mt-10 max-w-3xl mx-auto">
            <CtFaqList items={faq} />
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}

function FlowCard({ icon: Icon, label, title, sub, highlight = false }) {
  return (
    <div
      className="fx-tile h-full p-5 text-center flex flex-col items-center"
      style={
        highlight
          ? { background: 'rgba(214,169,61,0.06)', borderColor: 'rgba(214,169,61,0.35)' }
          : undefined
      }
    >
      <div className="feature-icon mb-3" style={{ width: 48, height: 48 }}>
        <Icon size={20} />
      </div>
      <div
        className="text-[10px] uppercase tracking-wider mb-1"
        style={{ color: highlight ? 'var(--fx-gold-light)' : 'var(--fx-text-3)' }}
      >
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
