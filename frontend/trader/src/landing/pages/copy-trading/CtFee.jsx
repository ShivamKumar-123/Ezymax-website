import { Crown, Building2, Users } from 'lucide-react'
import SectionHeader from '@/landing/components/SectionHeader'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'
import CtFaqList from './CtFaqList'

const faq = [
  { q: 'Do followers pay extra fees?', a: 'No direct platform fee is charged to followers.' },
]

export default function CtFee() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg)' }}>
      <div className="fx-container">
        <div className="fx-section-frame">
        <SectionHeader
          badge="Platform Fee"
          title="Platform Fee Structure"
          highlight="Fee Structure"
          subtitle="We get paid the same way Master Traders do — only when followers actually make money. No subscription, no surcharge on followers."
        />
        <ScrollReveal variant="fadeUp">
          <div
            className="mt-12 md:mt-16 grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10 items-stretch"
          >
            {/* Visual split — Master share & Platform cut */}
            <div
              className="relative rounded-2xl p-7 md:p-8 overflow-hidden"
              style={{
                background:
                  'linear-gradient(160deg, rgba(214,169,61,0.06) 0%, var(--fx-bg-elev-2) 60%)',
                border: '1px solid rgba(214,169,61,0.22)',
              }}
            >
              <div className="absolute inset-0 fx-grid-bg" />
              <div className="relative">
                <div className="text-[11px] font-bold uppercase tracking-[0.22em] mb-5" style={{ color: 'var(--fx-gold-light)' }}>
                  Master Trader Share
                </div>

                {/* Stacked bar */}
                <div
                  className="h-4 rounded-full overflow-hidden flex"
                  style={{ background: 'rgba(255,255,255,0.06)' }}
                >
                  <div
                    className="h-full"
                    style={{
                      width: '75%',
                      background:
                        'linear-gradient(90deg, var(--fx-gold-light), var(--fx-gold))',
                      boxShadow: '0 0 12px rgba(214,169,61,0.5)',
                    }}
                  />
                  <div
                    className="h-full"
                    style={{
                      width: '25%',
                      background:
                        'linear-gradient(90deg, rgba(96,165,250,0.6), rgba(96,165,250,0.95))',
                      boxShadow: '0 0 12px rgba(96,165,250,0.4)',
                    }}
                  />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ background: 'var(--fx-gold)' }}
                    />
                    <span style={{ color: 'var(--fx-text-2)' }}>Master Trader</span>
                  </div>
                  <div className="flex items-center gap-2 justify-end">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ background: '#60a5fa' }}
                    />
                    <span style={{ color: 'var(--fx-text-2)' }}>Platform</span>
                  </div>
                </div>

                <div className="mt-7 space-y-3">
                  <Row
                    icon={Users}
                    color="#a78bfa"
                    label="Follower profit"
                    value="$100"
                    note="Source of distribution"
                  />
                  <Row
                    icon={Crown}
                    color="#ecc657"
                    label="Master share (illustrative 20%)"
                    value="$20 → $15 net"
                    note="After platform cut"
                    highlight
                  />
                  <Row
                    icon={Building2}
                    color="#60a5fa"
                    label="Platform cut (illustrative 25% of master share)"
                    value="$5"
                    note="Charged on master only"
                  />
                </div>
              </div>
            </div>

            {/* Logic explanation */}
            <div
              className="h-full rounded-2xl p-7 md:p-8"
              style={{
                background:
                  'linear-gradient(180deg, var(--fx-bg-elev-2) 0%, var(--fx-bg-elev) 100%)',
                border: '1px solid var(--fx-line-strong)',
              }}
            >
              <div className="feature-icon mb-5">
                <Building2 size={20} />
              </div>
              <h3 className="text-xl md:text-2xl font-bold text-white mb-4 leading-tight">
                Aligned incentives across all participants
              </h3>
              <ul
                className="space-y-3 mb-7 text-sm md:text-[15px] leading-relaxed"
                style={{ color: 'var(--fx-text-2)' }}
              >
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--fx-gold)' }} />
                  Profit is shared with the Master Trader on profitable outcomes.
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--fx-gold)' }} />
                  The platform takes a percentage from the Master&apos;s share.
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--fx-gold)' }} />
                  Remaining goes to the Master Trader.
                </li>
              </ul>
            </div>
          </div>
        </ScrollReveal>

        <ScrollReveal variant="fadeUp" delay={0.2}>
          <p
            className="mt-8 md:mt-10 text-center text-base md:text-lg italic max-w-2xl mx-auto"
            style={{ color: 'var(--fx-text-2)' }}
          >
            &ldquo;Aligned incentives across all participants.&rdquo;
          </p>
        </ScrollReveal>

        <ScrollReveal variant="fadeUp" delay={0.28}>
          <div className="mt-8 md:mt-10 max-w-3xl mx-auto">
            <CtFaqList items={faq} />
          </div>
        </ScrollReveal>
        </div>
      </div>
    </section>
  )
}

function Row({ icon: Icon, color, label, value, note, highlight = false }) {
  return (
    <div
      className="flex items-center justify-between rounded-xl px-4 py-3"
      style={{
        background: highlight ? `${color}10` : 'rgba(255,255,255,0.03)',
        border: highlight ? `1px solid ${color}55` : '1px solid var(--fx-line-strong)',
      }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{
            background: `${color}1f`,
            border: `1px solid ${color}55`,
          }}
        >
          <Icon size={14} style={{ color }} />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white truncate">{label}</div>
          <div className="text-[11px]" style={{ color: 'var(--fx-text-3)' }}>
            {note}
          </div>
        </div>
      </div>
      <div className="text-sm font-bold text-white shrink-0 ml-3">{value}</div>
    </div>
  )
}
