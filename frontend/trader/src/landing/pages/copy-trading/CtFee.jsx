import { Crown, Building2, Users } from 'lucide-react'
import ScrollReveal from '@/landing/components/animations/ScrollReveal'
import CtFaqList from './CtFaqList'

const faq = [
  { q: 'Do followers pay extra fees?', a: 'No direct platform fee is charged to followers.' },
]

export default function CtFee() {
  return (
    <section className="fx-section" style={{ background: 'var(--fx-bg)' }}>
      <div className="fx-container">
        {/* ── Two-column intro ──────────────────────────────── */}
        <div className="fx-split-intro">
          <ScrollReveal variant="fadeUp">
            <div>
              <span className="fx-eyebrow mb-5">Platform Fee</span>
              <h2 className="fx-headline text-3xl md:text-4xl lg:text-5xl mt-5">
                Platform <span className="gradient-text">Fee Structure</span>
              </h2>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <p className="text-base md:text-lg" style={{ color: 'var(--fx-text-2)' }}>
              We get paid the same way Master Traders do — only when followers actually make money. No subscription, no surcharge on followers.
            </p>
          </ScrollReveal>
        </div>

        {/* ── Bento: fee split tile + gold logic tile ───────── */}
        <div
          className="mt-12 md:mt-16 grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10 items-stretch"
        >
          {/* Visual split — Master share & Platform cut */}
          <ScrollReveal variant="fadeUp">
            <div className="fx-tile h-full p-7 md:p-8 flex flex-col">
              <span className="fx-accent-bar mb-4" />
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
                      'linear-gradient(90deg, rgba(214,169,61,0.35), rgba(214,169,61,0.6))',
                    boxShadow: '0 0 12px rgba(214,169,61,0.4)',
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
                    style={{ background: 'rgba(214,169,61,0.55)' }}
                  />
                  <span style={{ color: 'var(--fx-text-2)' }}>Platform</span>
                </div>
              </div>

              <div className="mt-7 space-y-3">
                <Row
                  icon={Users}
                  label="Follower profit"
                  value="$100"
                  note="Source of distribution"
                />
                <Row
                  icon={Crown}
                  label="Master share (illustrative 20%)"
                  value="$20 → $15 net"
                  note="After platform cut"
                  highlight
                />
                <Row
                  icon={Building2}
                  label="Platform cut (illustrative 25% of master share)"
                  value="$5"
                  note="Charged on master only"
                />
              </div>
            </div>
          </ScrollReveal>

          {/* Logic explanation — solid gold accent tile */}
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <div className="fx-tile-gold h-full p-7 md:p-8 flex flex-col">
              <div
                className="relative z-[1] w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                style={{ background: 'rgba(28,22,8,0.14)', border: '1px solid rgba(28,22,8,0.22)' }}
              >
                <Building2 size={20} style={{ color: '#1c1608' }} />
              </div>
              <span className="fx-accent-bar mb-4 relative z-[1]" />
              <h3 className="relative z-[1] text-xl md:text-2xl font-bold mb-4 leading-tight" style={{ color: '#1c1608' }}>
                Aligned incentives across all participants
              </h3>
              <ul
                className="relative z-[1] space-y-3 mb-7 text-sm md:text-[15px] leading-relaxed"
                style={{ color: 'rgba(28,22,8,0.78)' }}
              >
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#1c1608' }} />
                  Profit is shared with the Master Trader on profitable outcomes.
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#1c1608' }} />
                  The platform takes a percentage from the Master&apos;s share.
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#1c1608' }} />
                  Remaining goes to the Master Trader.
                </li>
              </ul>
            </div>
          </ScrollReveal>
        </div>

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
    </section>
  )
}

function Row({ icon: Icon, label, value, note, highlight = false }) {
  return (
    <div
      className="flex items-center justify-between rounded-xl px-4 py-3"
      style={{
        background: highlight ? 'rgba(214,169,61,0.10)' : 'rgba(255,255,255,0.03)',
        border: highlight ? '1px solid rgba(214,169,61,0.35)' : '1px solid var(--fx-line-strong)',
      }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{
            background: 'rgba(214,169,61,0.12)',
            border: '1px solid rgba(214,169,61,0.35)',
          }}
        >
          <Icon size={14} style={{ color: 'var(--fx-gold-light)' }} />
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
